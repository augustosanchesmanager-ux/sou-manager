import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getScopedClient } from '../services/supabaseClient';
import Button from '../components/ui/Button';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

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

const normalizeProduct = (product: Partial<Product> & { id: string; name: string }): Product => ({
    id: product.id,
    name: product.name,
    description: product.description || '',
    cost_price: Number(product.cost_price ?? 0),
    sale_price: Number(product.sale_price ?? 0),
    stock_quantity: Number(product.stock_quantity ?? 0),
    minimum_stock: Number(product.minimum_stock ?? 0),
    auto_generate_purchase_order: Boolean(product.auto_generate_purchase_order),
    active: typeof product.active === 'boolean' ? product.active : true,
});

const Products: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { tenantId } = useAuth();
    const barberSupabase = getScopedClient('barber');
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const [form, setForm] = useState({
        name: '',
        description: '',
        cost_price: 0,
        sale_price: 0,
        stock_quantity: 0,
        minimum_stock: 0,
        auto_generate_purchase_order: false,
        active: true,
    });

    const fetchProducts = useCallback(async () => {
        if (!tenantId) {
            setProducts([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { data, error } = await barberSupabase
            .from('products')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('name');

        if (error) {
            setToast({ message: 'Erro ao carregar produtos', type: 'error' });
        } else {
            setProducts((data || []).map((product) => normalizeProduct(product as Product)));
        }
        setLoading(false);
    }, [barberSupabase, tenantId]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const openNewModal = () => {
        setEditingProduct(null);
        setForm({
            name: '',
            description: '',
            cost_price: 0,
            sale_price: 0,
            stock_quantity: 0,
            minimum_stock: 0,
            auto_generate_purchase_order: false,
            active: true,
        });
        setShowModal(true);
    };

    useEffect(() => {
        const shouldOpenNew = Boolean((location.state as { openNewProduct?: boolean } | null)?.openNewProduct);
        if (!shouldOpenNew) return;
        openNewModal();
        navigate(location.pathname, { replace: true, state: null });
    }, [location.pathname, location.state, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...form, tenant_id: tenantId };

        let error;
        if (editingProduct) {
            const { error: err } = await barberSupabase
                .from('products')
                .update(payload)
                .eq('id', editingProduct.id)
                .eq('tenant_id', tenantId);
            error = err;
        } else {
            const { error: err } = await barberSupabase
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
                auto_generate_purchase_order: false,
                active: true,
            });
            fetchProducts();
        }
    };

    const handleEdit = (product: Product) => {
        const normalizedProduct = normalizeProduct(product);
        setEditingProduct(product);
        setForm({
            name: normalizedProduct.name,
            description: normalizedProduct.description || '',
            cost_price: normalizedProduct.cost_price,
            sale_price: normalizedProduct.sale_price,
            stock_quantity: normalizedProduct.stock_quantity,
            minimum_stock: normalizedProduct.minimum_stock,
            auto_generate_purchase_order: normalizedProduct.auto_generate_purchase_order,
            active: normalizedProduct.active,
        });
        setShowModal(true);
    };

    const handleDelete = async () => {
        if (!deleteTarget || !tenantId) return;
        setDeleting(true);
        try {
            const { error } = await barberSupabase
                .from('products')
                .delete()
                .eq('id', deleteTarget.id)
                .eq('tenant_id', tenantId);

            if (error) {
                let message = 'Erro ao excluir produto.';
                if (error.code === '23503' || error.message.includes('foreign key constraint') || error.message.includes('violates foreign key')) {
                    message = 'Não é possível excluir este produto porque ele possui histórico de vendas em comandas ou movimentações de estoque. Para desativá-lo, altere o status para "Inativo" no botão Editar.';
                } else {
                    message = `Erro ao excluir produto: ${error.message} (${error.code || 'sem-codigo'})`;
                }
                setToast({ message, type: 'error' });
            } else {
                setToast({ message: 'Produto excluído com sucesso.', type: 'info' });
                setDeleteTarget(null);
                fetchProducts();
            }
        } catch (err: any) {
            console.error('DELETE PRODUCT ERROR:', err);
            let message = 'Erro ao excluir produto.';
            if (err?.code === '23503' || err?.message?.includes('foreign key')) {
                message = 'Não é possível excluir este produto porque ele possui histórico de vendas em comandas ou movimentações de estoque. Para desativá-lo, altere o status para "Inativo" no botão Editar.';
            }
            setToast({ message, type: 'error' });
        } finally {
            setDeleting(false);
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.description?.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all'
            ? true
            : statusFilter === 'active'
                ? p.active
                : !p.active;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Produtos e Estoque</h2>
                    <p className="text-slate-500 mt-1">Gerencie seu inventário e controle de reposição.</p>
                </div>
                <Button onClick={openNewModal} leftIcon="add">
                    Novo Produto
                </Button>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-border-dark flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Buscar produtos..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary transition-all"
                        />
                    </div>

                    <div className="inline-flex self-start sm:self-auto items-center bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#262626] p-1 rounded-xl text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('active')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                statusFilter === 'active'
                                    ? 'bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            Ativos ({products.filter(p => p.active).length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('inactive')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                statusFilter === 'inactive'
                                    ? 'bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            Inativos ({products.filter(p => !p.active).length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                statusFilter === 'all'
                                    ? 'bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            Todos ({products.length})
                        </button>
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
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                        {search || statusFilter !== 'all'
                                            ? 'Nenhum produto encontrado com os filtros aplicados.'
                                            : 'Nenhum produto encontrado.'}
                                    </td>
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
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEdit(product)}
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-primary transition-colors"
                                                    title="Editar"
                                                >
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteTarget(product)}
                                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingProduct(null); }}
                title={editingProduct ? 'Editar Produto' : 'Novo Produto'}
                maxWidth="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
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
                    <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="product_active"
                                checked={form.active}
                                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                                className="size-4 accent-primary"
                            />
                            <label htmlFor="product_active" className="text-sm text-slate-700 dark:text-slate-300 font-bold">
                                Produto ativo para venda
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="auto_order"
                                checked={form.auto_generate_purchase_order}
                                onChange={(e) => setForm({ ...form, auto_generate_purchase_order: e.target.checked })}
                                className="size-4 accent-primary"
                            />
                            <label htmlFor="auto_order" className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                                Gerar pedido de compra automaticamente
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                        <Button variant="secondary" className="flex-1" onClick={() => { setShowModal(false); setEditingProduct(null); }}>
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1">
                            {editingProduct ? 'Atualizar' : 'Salvar'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Excluir Produto"
                    maxWidth="md"
                >
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Tem certeza que deseja excluir o produto <strong>{deleteTarget.name}</strong>?
                        </p>
                        <p className="text-xs text-slate-400">
                            Caso o produto já possua histórico de vendas em comandas ou movimentações de estoque, a exclusão será bloqueada para proteger os registros financeiros da barbearia.
                        </p>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                                Cancelar
                            </Button>
                            <Button variant="danger" onClick={handleDelete} loading={deleting}>
                                Excluir
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default Products;
