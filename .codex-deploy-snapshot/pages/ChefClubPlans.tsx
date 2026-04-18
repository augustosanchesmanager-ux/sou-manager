import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';

interface Plan {
    id: string;
    name: string;
    monthly_price: number;
    service_credits: number;
    description: string;
    priority_booking: boolean;
    product_discount: number;
    max_rollover_credits: number;
    credit_validity_days: number;
    active: boolean;
}

const ChefClubPlans: React.FC = () => {
    const { tenantId } = useAuth();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

    const [form, setForm] = useState({
        name: '',
        monthly_price: 0,
        service_credits: 0,
        description: '',
        priority_booking: false,
        product_discount: 0,
        max_rollover_credits: 0,
        credit_validity_days: 30
    });

    const fetchPlans = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('customer_plans')
            .select('*')
            .order('monthly_price', { ascending: true });

        if (data) setPlans(data);
        if (error) setToast({ message: 'Erro ao carregar planos.', type: 'error' });
        setLoading(false);
    };

    useEffect(() => {
        if (tenantId) fetchPlans();
    }, [tenantId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const planData = {
            ...form,
            tenant_id: tenantId
        };

        let error;
        if (editingPlan) {
            const { error: err } = await supabase
                .from('customer_plans')
                .update(planData)
                .eq('id', editingPlan.id);
            error = err;
        } else {
            const { error: err } = await supabase
                .from('customer_plans')
                .insert(planData);
            error = err;
        }

        if (error) {
            setToast({ message: `Erro ao salvar plano: ${error.message}`, type: 'error' });
        } else {
            setToast({ message: `Plano ${editingPlan ? 'atualizado' : 'criado'} com sucesso!`, type: 'success' });
            setShowModal(false);
            setEditingPlan(null);
            setForm({
                name: '',
                monthly_price: 0,
                service_credits: 0,
                description: '',
                priority_booking: false,
                product_discount: 0,
                max_rollover_credits: 0,
                credit_validity_days: 30
            });
            fetchPlans();
        }
        setLoading(false);
    };

    const handleEdit = (plan: Plan) => {
        setEditingPlan(plan);
        setForm({
            name: plan.name,
            monthly_price: plan.monthly_price,
            service_credits: plan.service_credits,
            description: plan.description,
            priority_booking: plan.priority_booking,
            product_discount: plan.product_discount,
            max_rollover_credits: plan.max_rollover_credits,
            credit_validity_days: plan.credit_validity_days
        });
        setShowModal(true);
    };

    const toggleStatus = async (plan: Plan) => {
        const { error } = await supabase
            .from('customer_plans')
            .update({ active: !plan.active })
            .eq('id', plan.id);

        if (error) {
            setToast({ message: 'Erro ao alterar status.', type: 'error' });
        } else {
            setPlans(plans.map(p => p.id === plan.id ? { ...p, active: !p.active } : p));
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="size-14 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                        <span className="material-symbols-outlined text-amber-500 text-3xl">workspace_premium</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Clube do Chefe 👑</h2>
                        <p className="text-slate-500 text-sm font-medium">Gestão de Planos e Assinaturas Recorrentes</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setEditingPlan(null);
                        setForm({ name: '', monthly_price: 0, service_credits: 0, description: '', priority_booking: false, product_discount: 0, max_rollover_credits: 0, credit_validity_days: 30 });
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-blue-600 shadow-xl shadow-primary/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    Novo Plano
                </button>
            </div>

            {/* Plans List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => (
                    <div key={plan.id} className={`bg-white dark:bg-card-dark rounded-3xl border ${plan.active ? 'border-amber-500/30' : 'border-slate-200 dark:border-border-dark'} overflow-hidden shadow-xl transition-all hover:shadow-2xl hover:translate-y-[-4px]`}>
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${plan.active ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                    {plan.active ? 'Ativo' : 'Inativo'}
                                </span>
                                <div className="flex gap-1">
                                    <button onClick={() => handleEdit(plan)} className="p-2 text-slate-400 hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined text-lg">edit</span>
                                    </button>
                                    <button onClick={() => toggleStatus(plan)} className={`p-2 transition-colors ${plan.active ? 'text-red-400 hover:text-red-600' : 'text-emerald-400 hover:text-emerald-600'}`}>
                                        <span className="material-symbols-outlined text-lg">{plan.active ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase mb-1">{plan.name}</h3>
                            <div className="flex items-baseline gap-1 mb-4">
                                <span className="text-2xl font-black text-primary">R$ {plan.monthly_price.toFixed(2)}</span>
                                <span className="text-xs text-slate-500 font-bold uppercase">/mês</span>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                    <span className="material-symbols-outlined text-emerald-500 text-lg">content_cut</span>
                                    <span className="font-bold">{plan.service_credits} Créditos de Corte</span>
                                </div>
                                {plan.priority_booking && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                        <span className="material-symbols-outlined text-blue-500 text-lg">schedule</span>
                                        <span className="font-bold">Prioridade na Agenda</span>
                                    </div>
                                )}
                                {plan.product_discount > 0 && (
                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                        <span className="material-symbols-outlined text-purple-500 text-lg">shopping_cart</span>
                                        <span className="font-bold">{plan.product_discount}% OFF em Produtos</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {plans.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center p-20 bg-slate-50 dark:bg-white/5 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 text-center">
                    <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">loyalty</span>
                    <h3 className="text-xl font-bold text-slate-600 dark:text-slate-400">Nenhum plano criado ainda</h3>
                    <p className="text-slate-500 max-w-xs mt-2">Crie seu primeiro plano de assinatura para fidelizar seus clientes.</p>
                </div>
            )}

            {/* Modal de Criação/Edição */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingPlan ? 'Editar Plano' : 'Criar Novo Plano'}
                maxWidth="md"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Nome do Plano</label>
                            <input
                                required
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                title="Nome do Plano"
                                placeholder="Ex: Black, Gold, Premium"
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Valor Mensal (R$)</label>
                            <input
                                type="number"
                                required
                                value={form.monthly_price}
                                onChange={e => setForm({ ...form, monthly_price: Number(e.target.value) })}
                                title="Valor Mensal"
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Créditos de Corte</label>
                            <input
                                type="number"
                                required
                                value={form.service_credits}
                                onChange={e => setForm({ ...form, service_credits: Number(e.target.value) })}
                                title="Créditos de Corte"
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-white"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Descrição</label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                title="Descrição"
                                rows={2}
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">% Desconto Produtos</label>
                            <input
                                type="number"
                                value={form.product_discount}
                                onChange={e => setForm({ ...form, product_discount: Number(e.target.value) })}
                                title="Desconto em Produtos"
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Acúmulo Máximo (Rollover)</label>
                            <input
                                type="number"
                                value={form.max_rollover_credits}
                                onChange={e => setForm({ ...form, max_rollover_credits: Number(e.target.value) })}
                                title="Acúmulo Máximo"
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-white"
                                placeholder="0 = Não acumula"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 py-2">
                        <input
                            type="checkbox"
                            title="Prioridade de Agendamento"
                            checked={form.priority_booking}
                            onChange={e => setForm({ ...form, priority_booking: e.target.checked })}
                            className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Habilitar Prioridade de Agendamento</span>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-6 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-bold rounded-xl text-sm">Cancelar</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 px-6 bg-primary text-white font-black uppercase tracking-widest rounded-xl text-sm shadow-lg shadow-primary/20">
                            {loading ? 'Salvando...' : 'Salvar Plano'}
                        </button>
                    </div>
                </form>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default ChefClubPlans;
