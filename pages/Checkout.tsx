import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

// Types
interface CartItem {
    id: string; // for UI tracking
    dbId?: string; // from database if editing
    type: 'service' | 'product';
    name: string;
    price: number;
    quantity: number;
    service_id?: string;
    product_id?: string;
    staff_id?: string;
}

interface Client {
    id: string;
    name: string;
    avatar: string;
    phone?: string;
}

interface Staff {
    id: string;
    name: string;
}

const Checkout: React.FC = () => {
    const { id: comandaId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { tenantId } = useAuth();
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // State
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('paid');
    const [paymentMethod, setPaymentMethod] = useState<'credit' | 'debit' | 'cash' | 'pix' | 'other'>('credit');
    const [discount, setDiscount] = useState<string>('0');
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [itemModalTab, setItemModalTab] = useState<'services' | 'products'>('services');
    const [searchTerm, setSearchTerm] = useState('');

    // DB Data
    const [clients, setClients] = useState<Client[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch initial data
    const fetchData = useCallback(async () => {
        setLoading(true);
        const [clientsRes, staffRes, servicesRes, productsRes] = await Promise.all([
            supabase.from('clients').select('id, name, avatar, phone').order('name'),
            supabase.from('staff').select('id, name').eq('status', 'active'),
            supabase.from('services').select('*').eq('active', true),
            supabase.from('products').select('*').eq('active', true),
        ]);

        if (clientsRes.data) setClients(clientsRes.data);
        if (staffRes.data) setStaff(staffRes.data);
        if (servicesRes.data) setServices(servicesRes.data);
        if (productsRes.data) setProducts(productsRes.data);

        // If editing a comanda
        if (comandaId) {
            const { data: comanda, error: comError } = await supabase
                .from('comandas')
                .select(`
          *,
          clients(id, name, avatar, phone),
          comanda_items(*)
        `)
                .eq('id', comandaId)
                .single();

            if (comanda && !comError) {
                setSelectedClient(comanda.clients);
                setPaymentStatus(comanda.status === 'paid' ? 'paid' : 'pending');
                setPaymentMethod(comanda.payment_method || 'credit');
                setDiscount(String(comanda.discount || 0));

                const mappedItems: CartItem[] = comanda.comanda_items.map((item: any) => ({
                    id: item.id,
                    dbId: item.id,
                    type: item.service_id ? 'service' : 'product',
                    name: item.product_name,
                    price: item.unit_price,
                    quantity: item.quantity,
                    service_id: item.service_id,
                    product_id: item.product_id,
                    staff_id: item.staff_id
                }));
                setCart(mappedItems);
            }
        }
        setLoading(false);
    }, [comandaId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Calculations
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const discountValue = parseFloat(discount) || 0;
    const total = Math.max(0, subtotal - discountValue);

    // Handlers
    const handleAddItem = (item: any, type: 'service' | 'product') => {
        const newItem: CartItem = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            name: item.name,
            price: item.price,
            quantity: 1,
            service_id: type === 'service' ? item.id : undefined,
            product_id: type === 'product' ? item.id : undefined,
            staff_id: staff[0]?.id // Default to first available pro
        };
        setCart([...cart, newItem]);
        setIsItemModalOpen(false);
    };

    const handleRemoveItem = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const handleStaffChange = (itemId: string, proId: string) => {
        setCart(cart.map(item => item.id === itemId ? { ...item, staff_id: proId } : item));
    };

    const handleFinish = async () => {
        if (!selectedClient) {
            setToast({ message: 'Selecione um cliente.', type: 'error' });
            return;
        }

        setLoading(true);
        try {
            let currentComandaId = comandaId;

            // 1. Create or Update Comanda
            const comandaData = {
                client_id: selectedClient.id,
                status: paymentStatus === 'paid' ? 'paid' : 'open',
                payment_method: paymentStatus === 'paid' ? paymentMethod : null,
                subtotal: subtotal,
                discount: discountValue,
                total: total,
                tenant_id: tenantId
            };

            if (currentComandaId) {
                await supabase.from('comandas').update(comandaData).eq('id', currentComandaId);
                // Delete existing items to re-insert (simple sync strategy)
                await supabase.from('comanda_items').delete().eq('comanda_id', currentComandaId);
            } else {
                const { data: newC } = await supabase.from('comandas').insert(comandaData).select().single();
                currentComandaId = newC.id;
            }

            // 2. Insert Items
            const itemsToInsert = cart.map(item => ({
                comanda_id: currentComandaId,
                service_id: item.service_id || null,
                product_id: item.product_id || null,
                product_name: item.name,
                quantity: item.quantity,
                unit_price: item.price,
                staff_id: item.staff_id || null,
                tenant_id: tenantId
            }));

            await supabase.from('comanda_items').insert(itemsToInsert);

            // 3. If PAID, finalize via RPC (this reduces stock and marks as paid in DB)
            if (paymentStatus === 'paid') {
                const { error: rpcError } = await supabase.rpc('close_order', { p_comanda_id: currentComandaId });

                if (rpcError) {
                    throw rpcError;
                }

                const { data: { user } } = await supabase.auth.getUser();
                await supabase.from('transactions').insert({
                    user_id: user?.id,
                    type: 'income',
                    category: 'Venda de Balcão',
                    amount: total,
                    description: `Venda - Cliente: ${selectedClient.name}`,
                    payment_method: paymentMethod,
                    date: new Date().toISOString(),
                    tenant_id: tenantId
                });
            }

            setToast({ message: paymentStatus === 'paid' ? 'Venda realizada com sucesso!' : 'Comanda salva em aberto!', type: 'success' });

            setTimeout(() => {
                if (paymentStatus === 'pending') {
                    navigate('/comandas');
                } else {
                    navigate('/financial');
                }
            }, 1500);

        } catch (err) {
            console.error(err);
            setToast({ message: 'Erro ao salvar operação.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = itemModalTab === 'services'
        ? services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="max-w-7xl mx-auto w-full animate-fade-in pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-primary">point_of_sale</span>
                        {comandaId ? 'Editar Comanda' : 'Checkout Pós-Atendimento'}
                    </h1>
                    <p className="text-slate-500 mt-1">{comandaId ? 'Ajuste os itens ou finalize o pagamento.' : 'Finalize o atendimento, lance comissões e produtos.'}</p>
                </div>
                <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pedido</p>
                    <p className="text-xl font-mono font-bold text-slate-900 dark:text-white">#{comandaId ? comandaId.slice(0, 8) : 'NOVO'}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COLUMN: Client & Cart */}
                <div className="lg:col-span-2 space-y-6">

                    {/* 1. Client Selection */}
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400">person</span>
                                Cliente
                            </h3>
                            {!selectedClient && (
                                <button
                                    onClick={() => setIsClientModalOpen(true)}
                                    className="text-primary text-sm font-bold hover:underline"
                                >
                                    Buscar Cliente
                                </button>
                            )}
                            {selectedClient && !comandaId && (
                                <button
                                    onClick={() => setSelectedClient(null)}
                                    className="text-red-500 text-xs font-bold hover:underline"
                                >
                                    Trocar
                                </button>
                            )}
                        </div>

                        {selectedClient ? (
                            <div className="flex items-center gap-4 bg-slate-50 dark:bg-background-dark p-4 rounded-lg border border-slate-100 dark:border-border-dark">
                                <img src={selectedClient.avatar} alt={selectedClient.name} className="size-12 rounded-full border-2 border-white dark:border-slate-700" />
                                <div>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedClient.name}</p>
                                    <p className="text-xs text-slate-500">{selectedClient.phone || 'Sem telefone'}</p>
                                </div>
                            </div>
                        ) : (
                            <div
                                onClick={() => setIsClientModalOpen(true)}
                                className="border-2 border-dashed border-slate-200 dark:border-border-dark rounded-lg p-8 flex flex-col items-center justify-center text-slate-400 hover:text-primary hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-3xl mb-2">person_search</span>
                                <span className="font-bold text-sm">Clique para selecionar um cliente</span>
                            </div>
                        )}
                    </div>

                    {/* 2. Cart Items */}
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 shadow-sm min-h-[400px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400">shopping_cart</span>
                                Itens do Pedido
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setItemModalTab('services'); setIsItemModalOpen(true); }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-bold transition-all"
                                >
                                    <span className="material-symbols-outlined text-sm">content_cut</span>
                                    + Serviço
                                </button>
                                <button
                                    onClick={() => { setItemModalTab('products'); setIsItemModalOpen(true); }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white rounded-lg text-xs font-bold transition-all"
                                >
                                    <span className="material-symbols-outlined text-sm">shopping_bag</span>
                                    + Produto
                                </button>
                            </div>
                        </div>

                        <div className="flex-1">
                            {cart.length > 0 ? (
                                <div className="space-y-3">
                                    {cart.map((item) => (
                                        <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg border border-slate-100 dark:border-border-dark bg-white dark:bg-background-dark group hover:border-primary/30 transition-all">
                                            {/* Icon */}
                                            <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'service' ? 'bg-blue-500/10 text-primary' : 'bg-amber-500/10 text-amber-500'}`}>
                                                <span className="material-symbols-outlined">{item.type === 'service' ? 'content_cut' : 'package_2'}</span>
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{item.name}</p>

                                                {/* Professional Selector (Commission logic) */}
                                                <div className="flex items-center gap-1 mt-1">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold">Responsável:</span>
                                                    <select
                                                        value={item.staff_id}
                                                        onChange={(e) => handleStaffChange(item.id, e.target.value)}
                                                        className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-300 border-none outline-none p-0 cursor-pointer hover:text-primary [color-scheme:light] dark:[color-scheme:dark]"
                                                    >
                                                        {staff.map(pro => (
                                                            <option key={pro.id} value={pro.id} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{pro.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Price */}
                                            <div className="text-right">
                                                <p className="font-bold text-slate-900 dark:text-white">R$ {item.price.toFixed(2)}</p>
                                                {item.quantity > 1 && <p className="text-xs text-slate-500">x{item.quantity}</p>}
                                            </div>

                                            {/* Remove Action */}
                                            <button
                                                onClick={() => handleRemoveItem(item.id)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            >
                                                <span className="material-symbols-outlined">delete</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <span className="material-symbols-outlined text-6xl mb-4">remove_shopping_cart</span>
                                    <p className="text-sm font-medium">O carrinho está vazio</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Payment */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 shadow-xl sticky top-24">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">receipt_long</span>
                            Resumo Financeiro
                        </h3>

                        {/* Payment Status Toggle */}
                        <div className="mb-6">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Ação do Pedido</label>
                            <div className="flex bg-slate-100 dark:bg-background-dark p-1 rounded-xl">
                                <button
                                    onClick={() => setPaymentStatus('paid')}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${paymentStatus === 'paid'
                                        ? 'bg-emerald-500 text-white shadow-md'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    Finalizar
                                </button>
                                <button
                                    onClick={() => setPaymentStatus('pending')}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${paymentStatus === 'pending'
                                        ? 'bg-amber-500 text-white shadow-md'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-sm">save</span>
                                    Salvar Aberta
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                                <span>Subtotal</span>
                                <span className="font-bold text-slate-900 dark:text-white">R$ {subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                                <span>Desconto (R$)</span>
                                <input
                                    type="number"
                                    value={discount}
                                    onChange={(e) => setDiscount(e.target.value)}
                                    className="w-20 text-right bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded px-2 py-1 text-sm font-bold focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div className="h-px bg-slate-200 dark:bg-border-dark border-dashed"></div>
                            <div className="flex justify-between items-end">
                                <span className="font-bold text-lg text-slate-900 dark:text-white">Total</span>
                                <span className="font-black text-3xl text-primary tracking-tighter">R$ {total.toFixed(2)}</span>
                            </div>
                        </div>

                        {paymentStatus === 'paid' && (
                            <div className="mb-8 animate-fade-in">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Forma de Pagamento</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'credit', icon: 'credit_card', label: 'Crédito' },
                                        { id: 'debit', icon: 'payments', label: 'Débito' },
                                        { id: 'pix', icon: 'qr_code_2', label: 'Pix' },
                                        { id: 'cash', icon: 'attach_money', label: 'Dinheiro' }
                                    ].map(method => (
                                        <button
                                            key={method.id}
                                            onClick={() => setPaymentMethod(method.id as any)}
                                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === method.id ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25' : 'bg-slate-50 dark:bg-background-dark border-slate-200 dark:border-border-dark text-slate-500 hover:border-primary/50'}`}
                                        >
                                            <span className="material-symbols-outlined">{method.icon}</span>
                                            <span className="text-xs font-bold">{method.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleFinish}
                            disabled={cart.length === 0 || loading}
                            className={`w-full py-4 text-white rounded-xl font-bold text-lg shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group ${paymentStatus === 'paid'
                                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                                : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                                }`}
                        >
                            {loading ? (
                                <div className="animate-spin size-6 border-2 border-white/30 border-t-white rounded-full"></div>
                            ) : (
                                <>
                                    <span>{paymentStatus === 'paid' ? 'Confirmar e Fechar' : 'Salvar em Aberto'}</span>
                                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                                        {paymentStatus === 'paid' ? 'check_circle' : 'save_as'}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>

            {/* --- MODALS --- */}

            {/* Client Selection Modal */}
            <Modal
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                title="Selecionar Cliente"
                maxWidth="md"
            >
                <div className="space-y-2">
                    {clients.map(client => (
                        <button
                            key={client.id}
                            onClick={() => { setSelectedClient(client); setIsClientModalOpen(false); }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left"
                        >
                            <img src={client.avatar} className="size-10 rounded-full" />
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white text-sm">{client.name}</p>
                                <p className="text-xs text-slate-500">{client.phone || 'Sem telefone'}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </Modal>

            {/* Add Item Modal */}
            <Modal
                isOpen={isItemModalOpen}
                onClose={() => setIsItemModalOpen(false)}
                title={`Adicionar ${itemModalTab === 'services' ? 'Serviço' : 'Produto'}`}
                maxWidth="lg"
            >
                <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark rounded-lg p-2">
                        <input
                            autoFocus
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={`Buscar ${itemModalTab}...`}
                            className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>

                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-1">
                        <div className="space-y-1">
                            {filteredItems.map((item: any) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleAddItem(item, itemModalTab === 'services' ? 'service' : 'product')}
                                    className="w-full flex items-center justify-between p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`size-8 rounded flex items-center justify-center ${itemModalTab === 'services' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-500'}`}>
                                            <span className="material-symbols-outlined text-lg">{itemModalTab === 'services' ? 'content_cut' : 'package_2'}</span>
                                        </div>
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</span>
                                    </div>
                                    <span className="font-bold text-slate-900 dark:text-white">R$ {item.price.toFixed(2)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default Checkout;