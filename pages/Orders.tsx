import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';

interface Supplier {
    id: string;
    name: string;
    email: string;
    phone: string;
    category: string;
}

interface Product {
    id: string;
    name: string;
}

interface PurchaseOrder {
    id: string;
    product_id: string;
    supplier_id: string;
    quantity: number;
    status: 'pending' | 'approved' | 'ordered' | 'received';
    created_at: string;
    products?: { name: string };
    suppliers?: { name: string };
}

const statusLabels: Record<string, string> = { pending: 'Pendente', approved: 'Aprovado', ordered: 'Enviado', received: 'Recebido' };
const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    approved: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    ordered: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    received: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const Orders: React.FC = () => {
    const { tenantId } = useAuth();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Modals
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

    // Forms
    const [orderForm, setOrderForm] = useState({ product_id: '', supplier_id: '', quantity: 1 });
    const [supplierForm, setSupplierForm] = useState({ name: '', email: '', phone: '', category: 'Outros' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [ordersRes, suppliersRes, productsRes] = await Promise.all([
            supabase.from('purchase_orders').select('*, products(name), suppliers(name)').order('created_at', { ascending: false }),
            supabase.from('suppliers').select('*').order('name'),
            supabase.from('products').select('id, name').order('name')
        ]);

        setOrders(ordersRes.data || []);
        setSuppliers(suppliersRes.data || []);
        setProducts(productsRes.data || []);
        setLoading(false);
    };

    const handleSaveOrder = async () => {
        if (!orderForm.product_id || !orderForm.supplier_id) return;

        const { error } = await supabase.from('purchase_orders').insert([{
            ...orderForm,
            status: 'pending',
            tenant_id: tenantId
        }]);

        if (error) {
            setToast({ message: 'Erro ao criar pedido', type: 'error' });
        } else {
            setToast({ message: 'Pedido criado com sucesso!', type: 'success' });
            setIsOrderModalOpen(false);
            fetchData();
        }
    };

    const handleReceiveOrder = async (orderId: string) => {
        const { error } = await supabase.rpc('receive_purchase_order', { p_order_id: orderId });

        if (error) {
            setToast({ message: 'Erro ao receber pedido', type: 'error' });
        } else {
            setToast({ message: 'Estoque atualizado e pedido recebido!', type: 'success' });
            fetchData();
        }
    };

    const handleSaveSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('suppliers').insert([{ ...supplierForm, tenant_id: tenantId }]);

        if (error) {
            setToast({ message: 'Erro ao cadastrar fornecedor', type: 'error' });
        } else {
            setToast({ message: 'Fornecedor cadastrado!', type: 'success' });
            setIsSupplierModalOpen(false);
            setSupplierForm({ name: '', email: '', phone: '', category: 'Outros' });
            fetchData();
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Pedidos de Compra</h2>
                    <p className="text-slate-500 mt-1">Gerencie ordens de reposição e fornecedores.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setIsSupplierModalOpen(true)} leftIcon="group">
                        Fornecedores
                    </Button>
                    <Button onClick={() => setIsOrderModalOpen(true)} leftIcon="add_shopping_cart">
                        Novo Pedido
                    </Button>
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                                <th className="px-6 py-4">Produto</th>
                                <th className="px-6 py-4">Fornecedor</th>
                                <th className="px-6 py-4 text-center">Qtd</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-border-dark text-sm">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center">Carregando...</td></tr>
                            ) : orders.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum pedido encontrado.</td></tr>
                            ) : (
                                orders.map(order => (
                                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                            {order.products?.name || 'Carregando...'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            {order.suppliers?.name || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold">
                                            {order.quantity}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusColors[order.status]}`}>
                                                {statusLabels[order.status]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {order.status !== 'received' && (
                                                <Button size="sm" variant="success" onClick={() => handleReceiveOrder(order.id)}>
                                                    Receber
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Order Modal */}
            <Modal
                isOpen={isOrderModalOpen}
                onClose={() => setIsOrderModalOpen(false)}
                title="Solicitar Reposição"
                maxWidth="md"
            >
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-slate-500">Produto</label>
                        <select
                            value={orderForm.product_id}
                            onChange={(e) => setOrderForm({ ...orderForm, product_id: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                        >
                            <option value="" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Selecione...</option>
                            {products.map(p => <option key={p.id} value={p.id} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{p.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-slate-500">Fornecedor</label>
                        <select
                            value={orderForm.supplier_id}
                            onChange={(e) => setOrderForm({ ...orderForm, supplier_id: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                        >
                            <option value="" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Selecione...</option>
                            {suppliers.map(s => <option key={s.id} value={s.id} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{s.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-slate-500">Quantidade</label>
                        <input
                            type="number"
                            value={orderForm.quantity}
                            onChange={(e) => setOrderForm({ ...orderForm, quantity: parseInt(e.target.value) })}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none"
                        />
                    </div>
                    <Button className="w-full py-4 text-base" onClick={handleSaveOrder}>
                        Confirmar Pedido
                    </Button>
                </div>
            </Modal>

            {/* Supplier Modal */}
            <Modal
                isOpen={isSupplierModalOpen}
                onClose={() => setIsSupplierModalOpen(false)}
                title="Gerenciar Fornecedores"
                maxWidth="lg"
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        {suppliers.map(s => (
                            <div key={s.id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-border-dark flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{s.name}</p>
                                    <p className="text-xs text-slate-500">{s.category}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={handleSaveSupplier} className="pt-4 border-t border-slate-200 dark:border-border-dark space-y-3">
                        <p className="text-xs font-bold uppercase text-slate-500">Novo Fornecedor</p>
                        <input required placeholder="Nome" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none" />
                        <div className="grid grid-cols-2 gap-2">
                            <input placeholder="Email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none" />
                            <input placeholder="Telefone" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none" />
                        </div>
                        <Button type="submit" size="sm" className="w-full">Cadastrar</Button>
                    </form>
                </div>
            </Modal>
        </div>
    );
};

export default Orders;