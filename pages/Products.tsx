import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Button from '../components/ui/Button';
import Toast from '../components/Toast';

interface Product {
    id: string;
    name: string;
    description: string;
    cost_price: number;
    sale_price: number;
    stock_quantity: number;
    minimum_stock: number;
    auto_generate_purchase_order: boolean;
    active: boolean;
}

const Products: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [form, setForm] = useState({
        name: '',
        description: '',
        cost_price: 0,
        sale_price: 0,
        stock_quantity: 0,
        minimum_stock: 0,
        auto_generate_purchase_order: false
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name');

        if (error) {
            setToast({ message: 'Erro ao carregar produtos', type: 'error' });
        } else {
            setProducts(data || []);
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...form };

        let error;
        if (editingProduct) {
            const { error: err } = await supabase
                .from('products')
                .update(payload)
                .eq('id', editingProduct.id);
            error = err;
        } else {
            const { error: err } = await supabase
                .from('products')
                .insert([payload]);
            error = err;
        }

        if (error) {
            setToast({ message: 'Erro ao salvar produto', type: 'error' });
        } else {
            setToast({ message: 'Produto salvo com sucesso!', type: 'success' });
            setShowModal(false);
            setEditingProduct(null);
            setForm({
                name: '',
                description: '',
                cost_price: 0,
                sale_price: 0,
                stock_quantity: 0,
                minimum_stock: 0,
                auto_generate_purchase_order: false
            });
            fetchProducts();
        }
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setForm({
            name: product.name,
            description: product.description || '',
            cost_price: product.cost_price,
            sale_price: product.sale_price,
            stock_quantity: product.stock_quantity,
            minimum_stock: product.minimum_stock,
            auto_generate_purchase_order: product.auto_generate_purchase_order
        });
        setShowModal(true);
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Produtos e Estoque</h2>
                    <p className="text-slate-500 mt-1">Gerencie seu inventário e controle de reposição.</p>
                </div>
                <Button onClick={() => setShowModal(true)} leftIcon="add">
                    Novo Produto
                </Button>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-border-dark flex gap-4">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Buscar produtos..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                                <th className="px-6 py-4">Produto</th>
                                <th className="px-6 py-4">Preço (Custo/Venda)</th>
                                <th className="px-6 py-4">Estoque</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-border-dark">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Carregando...</td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum produto encontrado.</td>
                                </tr>
                            ) : (
                                filteredProducts.map(product => (
                                    <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-900 dark:text-white">{product.name}</p>
                                            <p className="text-xs text-slate-500 line-clamp-1">{product.description || 'Sem descrição'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm">
                                                <p className="text-slate-500">Custo: R$ {product.cost_price.toFixed(2)}</p>
                                                <p className="font-bold text-emerald-500">Venda: R$ {product.sale_price.toFixed(2)}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${product.stock_quantity <= product.minimum_stock ? 'text-orange-500' : 'text-slate-900 dark:text-white'}`}>
                                                    {product.stock_quantity} un
                                                </span>
                                                {product.stock_quantity <= product.minimum_stock && (
                                                    <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/30 text-orange-600 text-[10px] font-bold uppercase border border-orange-200 dark:border-orange-900">
                                                        Baixo
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Mín: {product.minimum_stock}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${product.active ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                {product.active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => handleEdit(product)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-primary transition-colors">
                                                <span className="material-symbols-outlined">edit</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/50 backdrop-blur-sm">
                    <div className="my-auto bg-white dark:bg-card-dark w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 dark:border-border-dark flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-border-dark flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                            </h3>
                            <button onClick={() => { setShowModal(false); setEditingProduct(null); }} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-slate-500">Nome do Produto</label>
                                    <input
                                        required
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase text-slate-500">Descrição</label>
                                    <textarea
                                        rows={2}
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold uppercase text-slate-500">Custo (R$)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={form.cost_price}
                                            onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold uppercase text-slate-500">Venda (R$)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={form.sale_price}
                                            onChange={(e) => setForm({ ...form, sale_price: parseFloat(e.target.value) })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold uppercase text-slate-500">Qtd em Estoque</label>
                                        <input
                                            type="number"
                                            value={form.stock_quantity}
                                            onChange={(e) => setForm({ ...form, stock_quantity: parseInt(e.target.value) })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold uppercase text-slate-500">Estoque Mínimo</label>
                                        <input
                                            type="number"
                                            value={form.minimum_stock}
                                            onChange={(e) => setForm({ ...form, minimum_stock: parseInt(e.target.value) })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="auto_order"
                                        checked={form.auto_generate_purchase_order}
                                        onChange={(e) => setForm({ ...form, auto_generate_purchase_order: e.target.checked })}
                                        className="size-4 accent-primary"
                                    />
                                    <label htmlFor="auto_order" className="text-sm text-slate-600 dark:text-slate-400 font-medium">Gerar pedido de compra automaticamente</label>
                                </div>
                            </div>
                            <div className="flex gap-3 p-6 pt-4 shrink-0">
                                <Button variant="secondary" className="flex-1" onClick={() => { setShowModal(false); setEditingProduct(null); }}>
                                    Cancelar
                                </Button>
                                <Button type="submit" className="flex-1">
                                    {editingProduct ? 'Atualizar' : 'Salvar'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Products;
