import React, { useState, useEffect, useRef } from 'react';
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
    document?: string; // CNPJ/CPF
    address?: string;
}

interface Product {
    id: string;
    name: string;
    cost_price?: number;
}

interface PurchaseOrder {
    id: string;
    product_id: string;
    supplier_id: string;
    quantity: number;
    unit_price: number;
    status: 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';
    created_at: string;
    notes?: string;
    products?: { name: string; cost_price: number };
    suppliers?: { name: string; phone: string; email: string; document: string; address: string };
}

const statusLabels: Record<string, string> = {
    pending: 'Aguardando Aprovação',
    approved: 'Aprovado',
    ordered: 'Pedido Enviado',
    received: 'Mercadoria Recebida',
    cancelled: 'Cancelado'
};

const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    approved: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    ordered: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    received: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
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
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Forms
    const [orderForm, setOrderForm] = useState({ product_id: '', supplier_id: '', quantity: 1, notes: '' });
    const [supplierForm, setSupplierForm] = useState({ name: '', email: '', phone: '', category: 'Produtos', document: '', address: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [ordersRes, suppliersRes, productsRes] = await Promise.all([
            supabase.from('purchase_orders').select('*, products(name, cost_price), suppliers(*)').order('created_at', { ascending: false }),
            supabase.from('suppliers').select('*').order('name'),
            supabase.from('products').select('id, name, cost_price').order('name')
        ]);

        setOrders(ordersRes.data || []);
        setSuppliers(suppliersRes.data || []);
        setProducts(productsRes.data || []);
        setLoading(false);
    };

    const handleSaveOrder = async () => {
        if (!orderForm.product_id || !orderForm.supplier_id) {
            setToast({ message: 'Selecione o produto e o fornecedor', type: 'error' });
            return;
        }

        const selectedProduct = products.find(p => p.id === orderForm.product_id);

        const { error } = await supabase.from('purchase_orders').insert([{
            ...orderForm,
            unit_price: selectedProduct?.cost_price || 0,
            status: 'pending',
            tenant_id: tenantId
        }]);

        if (error) {
            setToast({ message: 'Erro ao criar pedido', type: 'error' });
        } else {
            setToast({ message: 'Pedido de compra gerado com sucesso!', type: 'success' });
            setIsOrderModalOpen(false);
            setOrderForm({ product_id: '', supplier_id: '', quantity: 1, notes: '' });
            fetchData();
        }
    };

    const handleUpdateStatus = async (orderId: string, newStatus: PurchaseOrder['status']) => {
        const { error } = await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', orderId);
        if (error) {
            setToast({ message: 'Erro ao atualizar pedido', type: 'error' });
        } else {
            setToast({ message: `Pedido ${statusLabels[newStatus]}`, type: 'info' });
            fetchData();
            if (selectedOrder?.id === orderId) {
                // Refresh local state if detail modal is open
                fetchData();
            }
        }
    };

    const handleReceiveOrder = async (orderId: string) => {
        const { error } = await supabase.rpc('receive_purchase_order', { p_order_id: orderId });

        if (error) {
            setToast({ message: 'Erro ao receber pedido', type: 'error' });
        } else {
            setToast({ message: 'Estoque atualizado e pedido recebido!', type: 'success' });
            fetchData();
            setIsDetailModalOpen(false);
        }
    };

    const handleSaveSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('suppliers').insert([{ ...supplierForm, tenant_id: tenantId }]);

        if (error) {
            setToast({ message: 'Erro ao cadastrar fornecedor', type: 'error' });
        } else {
            setToast({ message: 'Fornecedor cadastrado com sucesso!', type: 'success' });
            setIsSupplierModalOpen(false);
            setSupplierForm({ name: '', email: '', phone: '', category: 'Produtos', document: '', address: '' });
            fetchData();
        }
    };

    const handlePrintOrder = () => {
        window.print();
    };

    const handleWhatsAppOrder = (order: PurchaseOrder) => {
        if (!order.suppliers?.phone) {
            setToast({ message: 'Fornecedor sem telefone cadastrado', type: 'error' });
            return;
        }

        const msg = `*PEDIDO DE COMPRA #${order.id.slice(0, 8).toUpperCase()}*\n\n` +
            `Prezados, gostaríamos de solicitar a reposição do seguinte item:\n\n` +
            `📦 *Produto:* ${order.products?.name}\n` +
            `🔢 *Quantidade:* ${order.quantity}\n` +
            `💰 *Preço Ref:* R$ ${(order.unit_price || 0).toFixed(2)}\n\n` +
            `Favor confirmar o recebimento e nos informar o prazo de entrega.`;

        window.open(`https://wa.me/55${order.suppliers.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-3xl">inventory_2</span>
                        Gestão de Compras
                    </h2>
                    <p className="text-slate-500 mt-1">Controle de suprimentos, ordens de reposição e fornecedores.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setIsSupplierModalOpen(true)} leftIcon="groups">
                        Fornecedores
                    </Button>
                    <Button onClick={() => setIsOrderModalOpen(true)} leftIcon="add_shopping_cart">
                        Novo Pedido
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden print:hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                                <th className="px-6 py-4">Ref/Data</th>
                                <th className="px-6 py-4">Produto / Descrição</th>
                                <th className="px-6 py-4">Fornecedor</th>
                                <th className="px-6 py-4 text-center">Qtd</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-border-dark text-sm">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                                    Carregando pedidos...
                                </td></tr>
                            ) : orders.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                                    <span className="material-symbols-outlined text-4xl text-slate-300">shopping_basket</span>
                                    Nenhum pedido de compra realizado ainda.
                                </td></tr>
                            ) : (
                                orders.map(order => (
                                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-900 dark:text-white">#{order.id.slice(0, 4).toUpperCase()}</p>
                                            <p className="text-[10px] text-slate-400">{new Date(order.created_at).toLocaleDateString()}</p>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-slate-400 text-sm">shopping_bag</span>
                                                {order.products?.name || 'Produto Removido'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            {order.suppliers?.name || 'Fornecedor Pendente'}
                                        </td>
                                        <td className="px-6 py-4 text-center font-bold">
                                            {order.quantity}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${statusColors[order.status]}`}>
                                                {statusLabels[order.status]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => { setSelectedOrder(order); setIsDetailModalOpen(true); }}
                                                className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                title="Ver Detalhes do Pedido"
                                            >
                                                <span className="material-symbols-outlined">visibility</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* NEW ORDER MODAL */}
            <Modal
                isOpen={isOrderModalOpen}
                onClose={() => setIsOrderModalOpen(false)}
                title="Abrir Pedido de Compra"
                maxWidth="md"
            >
                <div className="space-y-5">
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex items-start gap-3">
                        <span className="material-symbols-outlined text-primary">info</span>
                        <div>
                            <p className="text-xs font-bold text-primary uppercase">Sugestão Profissional</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Ao emitir o pedido, você poderá gerar um PDF oficial e enviar via WhatsApp para o fornecedor.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-slate-500 ml-1">Produto para Reposição</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">inventory</span>
                                <select
                                    value={orderForm.product_id}
                                    onChange={(e) => setOrderForm({ ...orderForm, product_id: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl p-3 pl-10 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                                >
                                    <option value="">Selecione um produto do estoque...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.cost_price ? `(Custo: R$ ${p.cost_price.toFixed(2)})` : ''}</option>)}
                                </select>
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-slate-500 ml-1">Fornecedor Selecionado</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">store</span>
                                <select
                                    value={orderForm.supplier_id}
                                    onChange={(e) => setOrderForm({ ...orderForm, supplier_id: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl p-3 pl-10 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                                >
                                    <option value="">Selecione o fornecedor...</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} - {s.category}</option>)}
                                </select>
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase text-slate-500 ml-1">Quantidade</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={orderForm.quantity}
                                    onChange={(e) => setOrderForm({ ...orderForm, quantity: parseInt(e.target.value) || 1 })}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase text-slate-500 ml-1">Preço Total Estimado</label>
                                <div className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-border-dark rounded-xl p-3 text-sm font-black text-primary">
                                    R$ {((products.find(p => p.id === orderForm.product_id)?.cost_price || 0) * orderForm.quantity).toFixed(2)}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-slate-500 ml-1">Observações do Pedido</label>
                            <textarea
                                placeholder="Ex: Entrega urgente, horário comercial..."
                                value={orderForm.notes}
                                onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 h-24"
                            />
                        </div>

                        <div className="pt-2">
                            <Button className="w-full py-4 text-base font-black shadow-xl" onClick={handleSaveOrder}>
                                <span className="material-symbols-outlined mr-2">send</span>
                                EMITIR ORDEM DE COMPRA
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* DETAIL / PRINT MODAL */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                title="Detalhes do Pedido de Compra"
                maxWidth="3xl"
            >
                {selectedOrder && (
                    <div className="space-y-6">
                        {/* Status Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-background-dark rounded-2xl border border-slate-200 dark:border-border-dark print:hidden">
                            <div className="flex items-center gap-3">
                                <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase border ${statusColors[selectedOrder.status]}`}>
                                    {statusLabels[selectedOrder.status]}
                                </span>
                                <p className="text-xs text-slate-500 font-medium">Emitido em: {new Date(selectedOrder.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleWhatsAppOrder(selectedOrder)}
                                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">chat</span>
                                    WhatsApp
                                </button>
                                <button
                                    onClick={handlePrintOrder}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                                    Gerar PDF / Imprimir
                                </button>
                            </div>
                        </div>

                        {/* PROFESSIONAL ORDER DOCUMENT (This is what will be printed) */}
                        <div className="bg-white dark:bg-white text-slate-900 p-8 rounded-lg border border-slate-200 shadow-sm print:border-0 print:shadow-none print:p-0 print:mx-auto print:max-w-none" id="printable-order">
                            {/* HEADER */}
                            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                                <div>
                                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">SOU MANA.GER</h1>
                                    <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Gestão Profissional de Barbearia</p>
                                    <div className="mt-4 text-xs font-medium space-y-0.5">
                                        <p>CONTROLE DE REPOSIÇÃO DE ESTOQUE</p>
                                        <p>CNPJ: 12.345.678/0001-90</p>
                                        <p>Rua Exemplo, 123 - Centro</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="bg-slate-900 text-white px-6 py-2 rounded-lg mb-2">
                                        <p className="text-[10px] font-bold uppercase">Pedido de Compra</p>
                                        <p className="text-2xl font-black">#{selectedOrder.id.slice(0, 8).toUpperCase()}</p>
                                    </div>
                                    <p className="text-xs font-bold text-slate-500">DATA: {new Date(selectedOrder.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>

                            {/* SUPPLIER INFO */}
                            <div className="grid grid-cols-2 gap-12 mb-10">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2 border-b border-slate-100 pb-1">Para (Fornecedor)</p>
                                    <p className="text-base font-black text-slate-900">{selectedOrder.suppliers?.name}</p>
                                    <p className="text-sm text-slate-600 mt-1">{selectedOrder.suppliers?.email || 'e-mail não informado'}</p>
                                    <p className="text-sm text-slate-600">{selectedOrder.suppliers?.phone || 'telefone não informado'}</p>
                                    <p className="text-xs text-slate-500 mt-2 font-medium">{selectedOrder.suppliers?.document ? `CNPJ/CPF: ${selectedOrder.suppliers.document}` : ''}</p>
                                    <p className="text-xs text-slate-500 font-medium">{selectedOrder.suppliers?.address || ''}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-2 border-b border-slate-100 pb-1">Instruções de Entrega</p>
                                    <p className="text-sm text-slate-700 italic leading-relaxed">
                                        {selectedOrder.notes || 'Nenhuma instrução específica informada.'}
                                    </p>
                                </div>
                            </div>

                            {/* ITEM TABLE */}
                            <div className="mb-10">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 border-y-2 border-slate-900">
                                            <th className="px-4 py-3 text-left text-[10px] font-black uppercase">Ref</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-black uppercase">Descrição do Produto</th>
                                            <th className="px-4 py-3 text-center text-[10px] font-black uppercase">Qtd</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-black uppercase">v. Unitário</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-black uppercase">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="px-4 py-5 text-xs font-bold text-slate-400">{selectedOrder.product_id.slice(0, 5).toUpperCase()}</td>
                                            <td className="px-4 py-5 text-sm font-black text-slate-900 uppercase tracking-tight">{selectedOrder.products?.name}</td>
                                            <td className="px-4 py-5 text-center text-sm font-bold">{selectedOrder.quantity}</td>
                                            <td className="px-4 py-5 text-right text-sm">R$ {selectedOrder.unit_price?.toFixed(2) || '0.00'}</td>
                                            <td className="px-4 py-5 text-right text-sm font-black">R$ {(selectedOrder.quantity * (selectedOrder.unit_price || 0)).toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-900">
                                            <td colSpan={3}></td>
                                            <td className="px-4 py-4 text-right text-xs font-black bg-slate-50">VALOR TOTAL:</td>
                                            <td className="px-4 py-4 text-right text-xl font-black bg-slate-50">R$ {(selectedOrder.quantity * (selectedOrder.unit_price || 0)).toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* SIGNATURES */}
                            <div className="mt-20 flex justify-between gap-12">
                                <div className="flex-1 text-center border-t border-slate-300 pt-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Responsável SOU MANA.GER</p>
                                    <p className="text-xs font-black text-slate-900 uppercase">Assinatura autorizada</p>
                                </div>
                                <div className="flex-1 text-center border-t border-slate-300 pt-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Aceite do Fornecedor</p>
                                    <p className="text-xs font-black text-slate-900 uppercase">Data e Carimbo</p>
                                </div>
                            </div>

                            {/* FOOTER */}
                            <div className="mt-12 text-center text-[9px] text-slate-300 uppercase tracking-[0.2em]">
                                Este documento é um espelho de pedido de compra gerado eletronicamente pelo SOU MANA.GER
                            </div>
                        </div>

                        {/* ACTIONS AT THE END */}
                        <div className="pt-4 border-t border-slate-200 dark:border-border-dark flex justify-end gap-2 print:hidden">
                            {selectedOrder.status === 'pending' && (
                                <>
                                    <Button variant="danger" size="sm" onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}>Cancelar</Button>
                                    <Button variant="primary" size="sm" onClick={() => handleUpdateStatus(selectedOrder.id, 'approved')}>Aprovar Pedido</Button>
                                </>
                            )}
                            {selectedOrder.status === 'approved' && (
                                <Button variant="primary" size="sm" onClick={() => handleUpdateStatus(selectedOrder.id, 'ordered')}>Marcar como Enviado</Button>
                            )}
                            {selectedOrder.status === 'ordered' && (
                                <Button variant="success" size="sm" onClick={() => handleReceiveOrder(selectedOrder.id)}>Dar Entrada no Estoque</Button>
                            )}
                            <Button variant="secondary" size="sm" onClick={() => setIsDetailModalOpen(false)}>Fechar</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* SUPPLIER MODAL */}
            <Modal
                isOpen={isSupplierModalOpen}
                onClose={() => setIsSupplierModalOpen(false)}
                title="Sincronizar Fornecedores"
                maxWidth="3xl"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* LIST */}
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            <p className="text-xs font-bold uppercase text-slate-500 mb-2">Parceiros Cadastrados</p>
                            {suppliers.map(s => (
                                <div key={s.id} className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-border-dark group hover:border-primary/30 transition-all">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-black text-sm text-slate-900 dark:text-white group-hover:text-primary transition-colors">{s.name}</p>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold mt-0.5">{s.category}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            {s.phone && (
                                                <button onClick={() => window.open(`tel:${s.phone}`)} className="p-1.5 text-slate-400 hover:text-primary rounded-lg">
                                                    <span className="material-symbols-outlined text-sm">phone</span>
                                                </button>
                                            )}
                                            {s.email && (
                                                <button onClick={() => window.open(`mailto:${s.email}`)} className="p-1.5 text-slate-400 hover:text-primary rounded-lg">
                                                    <span className="material-symbols-outlined text-sm">mail</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <div className="bg-white dark:bg-black/20 p-2 rounded text-[10px] text-slate-400">
                                            DOC: <span className="font-bold text-slate-600 dark:text-slate-300">{s.document || '—'}</span>
                                        </div>
                                        <div className="bg-white dark:bg-black/20 p-2 rounded text-[10px] text-slate-400">
                                            CONTÊ: <span className="font-bold text-slate-600 dark:text-slate-300 truncate inline-block w-full">{s.phone || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {suppliers.length === 0 && <p className="text-center py-10 text-slate-500 text-xs">Nenhum fornecedor cadastrado.</p>}
                        </div>

                        {/* ADD FORM */}
                        <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-2xl border border-dashed border-slate-300 dark:border-border-dark">
                            <p className="text-xs font-bold uppercase text-slate-500 mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">person_add</span>
                                Adicionar Novo Parceiro
                            </p>
                            <form onSubmit={handleSaveSupplier} className="space-y-4">
                                <input required placeholder="Nome do Fornecedor / Empresa" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20" />
                                <div className="grid grid-cols-2 gap-3">
                                    <input placeholder="WhatsApp / Telefone" value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]" />
                                    <input placeholder="CNPJ / CPF" value={supplierForm.document} onChange={e => setSupplierForm({ ...supplierForm, document: e.target.value })} className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl p-3 text-sm text-slate-900 dark:text-white outline-none" />
                                </div>
                                <input placeholder="E-mail de Contato" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl p-3 text-sm text-slate-900 dark:text-white outline-none" />
                                <input placeholder="Endereço Completo" value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl p-3 text-sm text-slate-900 dark:text-white outline-none" />
                                <select
                                    value={supplierForm.category}
                                    onChange={e => setSupplierForm({ ...supplierForm, category: e.target.value })}
                                    className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl p-3 text-sm text-slate-900 dark:text-white outline-none"
                                >
                                    <option value="Produtos">Produtos de Revenda</option>
                                    <option value="Uso Profissional">Uso Profissional (Lâminas, Shampoos)</option>
                                    <option value="Equipamentos">Equipamentos e Móveis</option>
                                    <option value="Limpeza">Material de Limpeza</option>
                                    <option value="Outros">Outros</option>
                                </select>
                                <Button type="submit" className="w-full py-4 font-black">SALVAR FORNECEDOR</Button>
                            </form>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* PRINT CSS STYLES */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-order, #printable-order * {
                        visibility: visible;
                    }
                    #printable-order {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white !important;
                        color: black !important;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default Orders;