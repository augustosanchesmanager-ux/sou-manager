import React, { useEffect, useMemo, useState } from 'react';
import { getScopedClient } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import {
    type ServiceCreditsEntry,
    getTotalPlannedCredits,
    normalizePlanServiceCredits,
} from '../src/utils/chefClubCredits';

interface Plan {
    id: string;
    name: string;
    monthly_price: number;
    service_credits: number;
    service_credit_map?: ServiceCreditsEntry[] | null;
    description: string;
    priority_booking: boolean;
    product_discount: number;
    max_rollover_credits: number;
    credit_validity_days: number;
    active: boolean;
}

interface ServiceOption {
    id: string;
    name: string;
    active?: boolean;
}

interface ServiceCreditFormItem {
    service_id: string;
    service_name: string;
    credits: number;
}

interface SupabaseLikeError {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
}

const createEmptyForm = () => ({
    name: '',
    monthly_price: 0,
    service_credit_map: [] as ServiceCreditFormItem[],
    description: '',
    priority_booking: false,
    product_discount: 0,
    max_rollover_credits: 0,
    credit_validity_days: 30,
});

const getFriendlySaveErrorMessage = (error: SupabaseLikeError) => {
    const raw = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();

    if (raw.includes('service_credit_map') || raw.includes('schema cache')) {
        return 'O banco ainda nao reconheceu a nova coluna de creditos por servico. Rode um reload de schema no Supabase e tente novamente.';
    }

    return `Erro ao salvar plano: ${error.message}`;
};

const isServiceCreditMapSchemaCacheError = (error: SupabaseLikeError | null | undefined) => {
    const raw = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return raw.includes('service_credit_map') || raw.includes('schema cache');
};

const ChefClubPlans: React.FC = () => {
    const { tenantId } = useAuth();
    const barberSupabase = getScopedClient('barber');
    const [plans, setPlans] = useState<Plan[]>([]);
    const [services, setServices] = useState<ServiceOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [form, setForm] = useState(createEmptyForm);

    const availableServices = useMemo(
        () => services.filter((service) => !form.service_credit_map.some((item) => item.service_id === service.id)),
        [form.service_credit_map, services],
    );

    const fetchPlans = async () => {
        if (!tenantId) return;

        setLoading(true);
        const [plansRes, servicesRes] = await Promise.all([
            barberSupabase
                .from('customer_plans')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('monthly_price', { ascending: true }),
            barberSupabase
                .from('services')
                .select('id, name, active')
                .eq('tenant_id', tenantId)
                .neq('active', false)
                .order('name', { ascending: true }),
        ]);

        if (plansRes.data) setPlans(plansRes.data as Plan[]);
        if (servicesRes.data) setServices(servicesRes.data as ServiceOption[]);
        if (plansRes.error) setToast({ message: 'Erro ao carregar planos.', type: 'error' });
        if (servicesRes.error) setToast({ message: 'Erro ao carregar servicos do catalogo.', type: 'error' });
        setLoading(false);
    };

    useEffect(() => {
        void fetchPlans();
    }, [tenantId]);

    const resetFormState = () => {
        setEditingPlan(null);
        setForm(createEmptyForm());
    };

    const handleAddServiceCredit = () => {
        if (availableServices.length === 0) {
            setToast({ message: 'Todos os servicos ativos ja foram adicionados ao plano.', type: 'info' });
            return;
        }

        const [service] = availableServices;
        setForm((current) => ({
            ...current,
            service_credit_map: [
                ...current.service_credit_map,
                {
                    service_id: service.id,
                    service_name: service.name,
                    credits: 1,
                },
            ],
        }));
    };

    const handleUpdateServiceCredit = (
        index: number,
        field: 'service_id' | 'credits',
        value: string | number,
    ) => {
        setForm((current) => {
            const nextItems = [...current.service_credit_map];
            const currentItem = nextItems[index];
            if (!currentItem) return current;

            if (field === 'service_id') {
                const selectedService = services.find((service) => service.id === value);
                if (!selectedService) return current;

                nextItems[index] = {
                    ...currentItem,
                    service_id: selectedService.id,
                    service_name: selectedService.name,
                };
            } else {
                nextItems[index] = {
                    ...currentItem,
                    credits: Math.max(0, Number(value) || 0),
                };
            }

            return {
                ...current,
                service_credit_map: nextItems,
            };
        });
    };

    const handleRemoveServiceCredit = (index: number) => {
        setForm((current) => ({
            ...current,
            service_credit_map: current.service_credit_map.filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantId) return;

        const normalizedCredits = form.service_credit_map
            .map((item) => ({
                service_id: item.service_id,
                service_name: item.service_name,
                credits: Math.max(0, Number(item.credits) || 0),
            }))
            .filter((item) => item.service_id && item.service_name && item.credits > 0);

        if (normalizedCredits.length === 0) {
            setToast({ message: 'Adicione pelo menos um servico com credito ao plano.', type: 'info' });
            return;
        }

        setLoading(true);

        const planData = {
            name: form.name,
            monthly_price: Number(form.monthly_price) || 0,
            service_credits: getTotalPlannedCredits(normalizedCredits),
            service_credit_map: normalizedCredits,
            description: form.description,
            priority_booking: form.priority_booking,
            product_discount: Number(form.product_discount) || 0,
            max_rollover_credits: Number(form.max_rollover_credits) || 0,
            credit_validity_days: Number(form.credit_validity_days) || 30,
            tenant_id: tenantId,
        };

        const legacyPlanData = {
            name: planData.name,
            monthly_price: planData.monthly_price,
            service_credits: planData.service_credits,
            description: planData.description,
            priority_booking: planData.priority_booking,
            product_discount: planData.product_discount,
            max_rollover_credits: planData.max_rollover_credits,
            credit_validity_days: planData.credit_validity_days,
            tenant_id: planData.tenant_id,
        };

        const savePlan = async (payload: typeof planData | typeof legacyPlanData) => (
            editingPlan
                ? barberSupabase.from('customer_plans').update(payload).eq('id', editingPlan.id)
                : barberSupabase.from('customer_plans').insert(payload)
        );

        let { error } = await savePlan(planData);
        let usedLegacyFallback = false;

        if (error && isServiceCreditMapSchemaCacheError(error as SupabaseLikeError)) {
            console.warn('Fallback para formato legado do plano por causa do schema cache:', error);
            const fallbackResult = await savePlan(legacyPlanData);
            error = fallbackResult.error;
            usedLegacyFallback = !fallbackResult.error;
        }

        if (error) {
            console.error('Erro ao salvar plano do Chef Club:', error);
            setToast({ message: getFriendlySaveErrorMessage(error as SupabaseLikeError), type: 'error' });
        } else {
            setToast({
                message: usedLegacyFallback
                    ? 'Plano salvo no modo legado. O detalhamento por servico sera ativado quando o cache do Supabase atualizar.'
                    : `Plano ${editingPlan ? 'atualizado' : 'criado'} com sucesso!`,
                type: usedLegacyFallback ? 'info' : 'success',
            });
            setShowModal(false);
            resetFormState();
            void fetchPlans();
        }

        setLoading(false);
    };

    const handleEdit = (plan: Plan) => {
        const normalizedCredits = normalizePlanServiceCredits(plan.service_credit_map, plan.service_credits)
            .filter((item) => item.service_id)
            .map((item) => ({
                service_id: item.service_id,
                service_name: item.service_name,
                credits: item.credits,
            }));

        setEditingPlan(plan);
        setForm({
            name: plan.name,
            monthly_price: plan.monthly_price,
            service_credit_map: normalizedCredits,
            description: plan.description,
            priority_booking: plan.priority_booking,
            product_discount: plan.product_discount,
            max_rollover_credits: plan.max_rollover_credits,
            credit_validity_days: plan.credit_validity_days,
        });
        setShowModal(true);
    };

    const toggleStatus = async (plan: Plan) => {
        const { error } = await barberSupabase
            .from('customer_plans')
            .update({ active: !plan.active })
            .eq('id', plan.id);

        if (error) {
            setToast({ message: 'Erro ao alterar status.', type: 'error' });
        } else {
            setPlans((current) => current.map((item) => (item.id === plan.id ? { ...item, active: !item.active } : item)));
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="size-14 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                        <span className="material-symbols-outlined text-amber-500 text-3xl">workspace_premium</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Clube do Chefe</h2>
                        <p className="text-slate-500 text-sm font-medium">Gestao de planos e creditos por servico.</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        resetFormState();
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-blue-600 shadow-xl shadow-primary/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    Novo Plano
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => {
                    const serviceCredits = normalizePlanServiceCredits(plan.service_credit_map, plan.service_credits);

                    return (
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
                                    <span className="text-2xl font-black text-primary">R$ {Number(plan.monthly_price || 0).toFixed(2)}</span>
                                    <span className="text-xs text-slate-500 font-bold uppercase">/mes</span>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
                                    <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-3 border border-slate-100 dark:border-white/10">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Creditos por servico</p>
                                        <div className="space-y-2">
                                            {serviceCredits.length > 0 ? serviceCredits.map((entry) => (
                                                <div key={`${plan.id}-${entry.service_id || entry.service_name}`} className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                                                    <span className="font-bold">{entry.service_name}</span>
                                                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-600">
                                                        {entry.credits}
                                                    </span>
                                                </div>
                                            )) : (
                                                <p className="text-xs text-slate-400">Sem creditos configurados.</p>
                                            )}
                                        </div>
                                    </div>

                                    {plan.priority_booking && (
                                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                            <span className="material-symbols-outlined text-blue-500 text-lg">schedule</span>
                                            <span className="font-bold">Prioridade na Agenda</span>
                                        </div>
                                    )}
                                    {plan.product_discount > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                            <span className="material-symbols-outlined text-emerald-500 text-lg">shopping_cart</span>
                                            <span className="font-bold">{plan.product_discount}% OFF em Produtos</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {plans.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center p-20 bg-slate-50 dark:bg-white/5 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 text-center">
                    <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">loyalty</span>
                    <h3 className="text-xl font-bold text-slate-600 dark:text-slate-400">Nenhum plano criado ainda</h3>
                    <p className="text-slate-500 max-w-xs mt-2">Crie seu primeiro plano com creditos distribuidos por servico.</p>
                </div>
            )}

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
                                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                                title="Nome do Plano"
                                placeholder="Ex: Black, Gold, Premium"
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Valor Mensal (R$)</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={form.monthly_price}
                                onChange={(e) => setForm((current) => ({ ...current, monthly_price: Number(e.target.value) }))}
                                title="Valor Mensal"
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Total de Creditos</label>
                            <div className="w-full bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm font-black text-amber-600">
                                {getTotalPlannedCredits(form.service_credit_map)}
                            </div>
                        </div>

                        <div className="col-span-2">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-black uppercase text-slate-500 block">Creditos por Servico</label>
                                <button
                                    type="button"
                                    onClick={handleAddServiceCredit}
                                    disabled={availableServices.length === 0}
                                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-symbols-outlined text-sm">add</span>
                                    Adicionar Servico
                                </button>
                            </div>
                            {services.length === 0 && (
                                <p className="text-[11px] text-slate-500 mb-3">
                                    Cadastre servicos no catalogo antes de montar os creditos do plano.
                                </p>
                            )}

                            <div className="space-y-3">
                                {form.service_credit_map.length > 0 ? form.service_credit_map.map((item, index) => {
                                    const selectableServices = services.filter((service) =>
                                        service.id === item.service_id || !form.service_credit_map.some((entry) => entry.service_id === service.id),
                                    );

                                    return (
                                        <div key={`${item.service_id}-${index}`} className="grid grid-cols-[1fr_120px_auto] gap-3 items-end rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Servico</label>
                                                <select
                                                    value={item.service_id}
                                                    onChange={(e) => handleUpdateServiceCredit(index, 'service_id', e.target.value)}
                                                    className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white"
                                                >
                                                    {selectableServices.map((service) => (
                                                        <option key={service.id} value={service.id}>
                                                            {service.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Creditos</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={item.credits}
                                                    onChange={(e) => handleUpdateServiceCredit(index, 'credits', Number(e.target.value))}
                                                    className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveServiceCredit(index)}
                                                className="h-12 w-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center"
                                                title="Remover servico"
                                            >
                                                <span className="material-symbols-outlined">delete</span>
                                            </button>
                                        </div>
                                    );
                                }) : (
                                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-4 text-sm text-slate-500 text-center">
                                        Nenhum servico vinculado. Adicione os servicos que este plano cobre.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Descricao</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                                title="Descricao"
                                rows={2}
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">% Desconto Produtos</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.product_discount}
                                onChange={(e) => setForm((current) => ({ ...current, product_discount: Number(e.target.value) }))}
                                title="Desconto em Produtos"
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Acumulo Maximo</label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={form.max_rollover_credits}
                                onChange={(e) => setForm((current) => ({ ...current, max_rollover_credits: Number(e.target.value) }))}
                                title="Acumulo Maximo"
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white"
                                placeholder="0 = nao acumula"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 py-2">
                        <input
                            type="checkbox"
                            title="Prioridade de Agendamento"
                            checked={form.priority_booking}
                            onChange={(e) => setForm((current) => ({ ...current, priority_booking: e.target.checked }))}
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
