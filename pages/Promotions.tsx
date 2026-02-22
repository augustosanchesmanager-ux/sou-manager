import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Button from '../components/ui/Button';
import Toast from '../components/Toast';

interface Promotion {
    id: string;
    title: string;
    target_type: 'service' | 'product' | 'all';
    target_id: string | null;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    start_date: string;
    end_date: string;
    active: boolean;
    created_at: string;
}

interface ItemOption {
    id: string;
    name: string;
}

const Promotions: React.FC = () => {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [services, setServices] = useState<ItemOption[]>([]);
    const [products, setProducts] = useState<ItemOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<Partial<Promotion>>({
        title: '',
        target_type: 'all',
        target_id: '',
        discount_type: 'percentage',
        discount_value: 0,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        active: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [promoRes, servRes, prodRes] = await Promise.all([
            supabase.from('promotions').select('*').order('created_at', { ascending: false }),
            supabase.from('services').select('id, name').eq('active', true),
            supabase.from('products').select('id, name')
        ]);

        if (promoRes.data) setPromotions(promoRes.data);
        if (servRes.data) setServices(servRes.data);
        if (prodRes.data) setProducts(prodRes.data);

        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = { ...form };
        if (payload.target_type === 'all') payload.target_id = null;
        if ((payload.target_type === 'service' || payload.target_type === 'product') && !payload.target_id) {
            setToast({ message: 'Selecione um item alvo', type: 'error' });
            return;
        }

        const { error } = await supabase.from('promotions').insert([payload]);

        if (error) {
            setToast({ message: `Erro: ${error.message}`, type: 'error' });
        } else {
            setToast({ message: 'Promoção criada com sucesso!', type: 'success' });
            setIsModalOpen(false);
            setForm({
                title: '', target_type: 'all', target_id: '', discount_type: 'percentage',
                discount_value: 0,
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                active: true
            });
            fetchData();
        }
    };

    const toggleActive = async (id: string, current: boolean) => {
        const { error } = await supabase.from('promotions').update({ active: !current }).eq('id', id);
        if (!error) fetchData();
    };

    const deletePromo = async (id: string) => {
        if (!confirm('Deseja excluir esta promoção?')) return;
        const { error } = await supabase.from('promotions').delete().eq('id', id);
        if (!error) {
            setToast({ message: 'Promoção excluída', type: 'info' });
            fetchData();
        }
    };

    const getTargetName = (type: string, id: string | null) => {
        if (type === 'all') return 'Todos os itens';
        if (type === 'service') return services.find(s => s.id === id)?.name || 'Serviço excluído';
        if (type === 'product') return products.find(p => p.id === id)?.name || 'Produto excluído';
        return 'Desconhecido';
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex justify-between items-center sm:flex-row flex-col gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Promoções e Ofertas</h2>
                    <p className="text-slate-500 mt-1 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-amber-500">local_fire_department</span>
                        Crie estratégias de vendas e descontos
                    </p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 shadow-lg shadow-primary/20">
                    <span className="material-symbols-outlined text-sm">add</span> Nova Promoção
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : promotions.length === 0 ? (
                <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-12 text-center text-slate-500 shadow-sm">
                    <div className="size-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl text-slate-400">loyalty</span>
                    </div>
                    <p className="font-bold text-slate-700 dark:text-slate-300">Nenhuma promoção ativa</p>
                    <p className="text-sm mt-1">Atraia mais clientes criando sua primeira oferta especial.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {promotions.map(promo => {
                        const isExpired = new Date(promo.end_date) < new Date();
                        const statusColor = !promo.active ? 'bg-slate-100 text-slate-600' : isExpired ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600';
                        const statusText = !promo.active ? 'Inativo' : isExpired ? 'Expirado' : 'Ativo';

                        return (
                            <div key={promo.id} className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                                <div className={`absolute top-0 w-full h-1 ${promo.active && !isExpired ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor}`}>
                                            {statusText}
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => toggleActive(promo.id, promo.active)} className="text-slate-400 hover:text-primary transition-colors">
                                                <span className="material-symbols-outlined text-lg">{promo.active ? 'pause_circle' : 'play_circle'}</span>
                                            </button>
                                            <button onClick={() => deletePromo(promo.id)} className="text-slate-400 hover:text-rose-500 transition-colors">
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">{promo.title}</h3>
                                    <p className="text-sm text-slate-500 mb-4">{getTargetName(promo.target_type, promo.target_id)}</p>

                                    <div className="flex items-end gap-2 mb-4">
                                        <span className="text-3xl font-black text-rose-500 leading-none">
                                            {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `R$ ${promo.discount_value.toFixed(2)}`}
                                        </span>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">OFF</span>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3 flex items-center gap-3">
                                        <span className="material-symbols-outlined text-slate-400 text-lg">event</span>
                                        <div className="text-xs text-slate-600 dark:text-slate-300">
                                            Válido: <br />
                                            <span className="font-bold">{new Date(promo.start_date).toLocaleDateString()}</span> até <span className="font-bold">{new Date(promo.end_date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
                    <div className="my-auto bg-white dark:bg-card-dark w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-border-dark flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden transform scale-95 animate-scale-up">
                        <div className="p-6 border-b border-slate-100 dark:border-border-dark flex justify-between items-center bg-slate-50 dark:bg-white/5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">campaign</span>
                                Nova Promoção
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Título da Promoção</label>
                                <input
                                    type="text"
                                    required
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    placeholder="Ex: Black Friday 2024"
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Aplica-se A</label>
                                    <select
                                        value={form.target_type}
                                        onChange={e => setForm({ ...form, target_type: e.target.value as any, target_id: '' })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                    >
                                        <option value="all">Todo o Sistema</option>
                                        <option value="service">Serviço Específico</option>
                                        <option value="product">Produto Específico</option>
                                    </select>
                                </div>

                                {form.target_type !== 'all' && (
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Selecione</label>
                                        <select
                                            required
                                            value={form.target_id || ''}
                                            onChange={e => setForm({ ...form, target_id: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                        >
                                            <option value="">-- Escolha --</option>
                                            {form.target_type === 'service'
                                                ? services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                                : products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                                            }
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Tipo Desconto</label>
                                    <select
                                        value={form.discount_type}
                                        onChange={e => setForm({ ...form, discount_type: e.target.value as any })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                    >
                                        <option value="percentage">Porcentagem (%)</option>
                                        <option value="fixed">Valor Fixo (R$)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Valor</label>
                                    <input
                                        type="number"
                                        required
                                        step="0.01"
                                        value={form.discount_value}
                                        onChange={e => setForm({ ...form, discount_value: parseFloat(e.target.value) })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Início</label>
                                    <input
                                        type="date"
                                        required
                                        value={form.start_date}
                                        onChange={e => setForm({ ...form, start_date: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Término</label>
                                    <input
                                        type="date"
                                        required
                                        value={form.end_date}
                                        onChange={e => setForm({ ...form, end_date: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3 border-t border-slate-100 dark:border-border-dark">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">save</span>
                                    Salvar Promoção
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Promotions;
