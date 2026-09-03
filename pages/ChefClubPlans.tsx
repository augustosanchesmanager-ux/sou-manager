import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import {
    type ServiceCreditsEntry,
    getTotalPlannedCredits,
    normalizePlanServiceCredits,
} from '../domain/chefClub';
import {
    loadPlansPage,
    savePlan,
    deletePlan,
    togglePlanStatus,
    computePlanSummary,
} from '../application/chefClub';
import type { ServiceOption } from '../application/chefClub';

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
        return 'O banco ainda não reconheceu a nova coluna de créditos por serviço. Rode um reload de schema no Supabase e tente novamente.';
    }

    return `Erro ao salvar plano: ${error.message}`;
};

const isServiceCreditMapSchemaCacheError = (error: SupabaseLikeError | null | undefined) => {
    const raw = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return raw.includes('service_credit_map') || raw.includes('schema cache');
};

const ChefClubPlans: React.FC = () => {
    const { tenantId } = useAuth();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [services, setServices] = useState<ServiceOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
    const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
    const [form, setForm] = useState(createEmptyForm);

    const availableServices = useMemo(
        () => services.filter((service) => !form.service_credit_map.some((item) => item.service_id === service.id)),
        [form.service_credit_map, services],
    );

    const planSummary = useMemo(() => computePlanSummary(plans, services), [plans, services]);

    const fetchPlans = async () => {
        setLoading(true);
        if (!tenantId) {
            setPlans([]);
            setServices([]);
            setLoading(false);
            return;
        }

        try {
            const data = await loadPlansPage(tenantId);
            setPlans(data.plans as unknown as Plan[]);
            setServices(data.services);
        } catch {
            setToast({ message: 'Erro ao carregar planos.', type: 'error' });
        }
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
            setToast({ message: 'Todos os serviços ativos já foram adicionados ao plano.', type: 'info' });
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
            setToast({ message: 'Adicione pelo menos um serviço com crédito ao plano.', type: 'info' });
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
        };

        try {
            await savePlan(tenantId, planData, editingPlan?.id);
            setToast({
                message: `Plano ${editingPlan ? 'atualizado' : 'criado'} com sucesso!`,
                type: 'success',
            });
            setShowModal(false);
            resetFormState();
            void fetchPlans();
        } catch (error: any) {
            console.error('Erro ao salvar plano do Club dos Chefes:', error);
            setToast({ message: getFriendlySaveErrorMessage(error), type: 'error' });
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
        if (!tenantId) return;

        try {
            await togglePlanStatus(tenantId, plan.id, !plan.active);
            setPlans((current) => current.map((item) => (item.id === plan.id ? { ...item, active: !item.active } : item)));
        } catch {
            setToast({ message: 'Erro ao alterar status.', type: 'error' });
        }
    };

    const handleDelete = (plan: Plan) => {
        setPlanToDelete(plan);
    };

    const confirmDelete = async () => {
        if (!planToDelete || !tenantId) return;

        setDeletingPlanId(planToDelete.id);

        try {
            await deletePlan(tenantId, planToDelete.id);
            setToast({ message: 'Plano excluído com sucesso.', type: 'info' });
            setPlans((current) => current.filter((p) => p.id !== planToDelete.id));
            setPlanToDelete(null);
        } catch (error: any) {
            setToast({ message: `Erro ao excluir plano: ${error?.message}`, type: 'error' });
        }

        setDeletingPlanId(null);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in p-4 md:p-6">
            <div className="relative overflow-hidden rounded-2xl border border-[#D9EAF5] bg-[linear-gradient(135deg,#F8FBFF_0%,#EEF7FF_58%,#F7F2EA_100%)] p-6 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,#06182F_0%,#08284D_58%,#14100A_100%)]">
                <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#007BFF,#00D2FF,#B88A44)]" />
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div className="max-w-2xl">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#B88A44]/30 bg-white/75 px-3 py-1 text-[11px] font-black text-[#7A5528] shadow-sm dark:bg-white/10 dark:text-[#E3C382]">
                            <span className="material-symbols-outlined text-sm">workspace_premium</span>
                            SMG recorrência da barbearia
                        </div>
                        <h2 className="text-2xl font-black text-slate-950 dark:text-white md:text-3xl">Club dos Chefes</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Planos mensais com créditos por serviço, prioridade de agenda e benefícios pensados para manter clientes bons voltando à cadeira.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            resetFormState();
                            setShowModal(true);
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl bg-[#007BFF] px-5 py-3 text-sm font-bold text-white shadow-sm shadow-[#007BFF]/20 transition-all hover:bg-[#006ADF]"
                    >
                        <span className="material-symbols-outlined">add_circle</span>
                        Novo plano
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Planos ativos', value: String(planSummary.activePlans), icon: 'verified', tone: 'text-[#007BFF] dark:text-[#72E7FF]', bg: 'bg-[#007BFF]/10 border-[#00D2FF]/25' },
                    { label: 'Recorrência potencial', value: `R$ ${planSummary.potentialMonthlyRevenue.toFixed(2)}`, icon: 'payments', tone: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                    { label: 'Créditos planejados', value: String(planSummary.plannedCredits), icon: 'local_activity', tone: 'text-[#9A6F2D] dark:text-[#E3C382]', bg: 'bg-[#B88A44]/15 border-[#B88A44]/30' },
                    { label: 'Serviços no catálogo', value: String(planSummary.serviceCatalog), icon: 'content_cut', tone: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10' },
                ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-card-dark">
                        <div className={`mb-3 flex size-10 items-center justify-center rounded-xl border ${item.bg}`}>
                            <span className={`material-symbols-outlined text-xl ${item.tone}`}>{item.icon}</span>
                        </div>
                        <p className="text-[11px] font-bold text-slate-500">{item.label}</p>
                        <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{item.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => {
                    const serviceCredits = normalizePlanServiceCredits(plan.service_credit_map, plan.service_credits);

                    return (
                        <div key={plan.id} className={`bg-white dark:bg-card-dark rounded-2xl border ${plan.active ? 'border-[#B88A44]/35' : 'border-slate-200 dark:border-border-dark'} overflow-hidden shadow-sm transition-all hover:border-[#007BFF]/35 hover:shadow-md`}>
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`px-3 py-1 rounded-full text-[11px] font-black ${plan.active ? 'bg-[#B88A44]/15 text-[#9A6F2D] dark:text-[#E3C382]' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        {plan.active ? 'Ativo' : 'Inativo'}
                                    </span>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEdit(plan)} className="p-2 text-slate-400 hover:text-[#007BFF] transition-colors" title="Editar plano">
                                            <span className="material-symbols-outlined text-lg">edit</span>
                                        </button>
                                        <button onClick={() => toggleStatus(plan)} className={`p-2 transition-colors ${plan.active ? 'text-red-400 hover:text-red-600' : 'text-emerald-400 hover:text-emerald-600'}`}>
                                            <span className="material-symbols-outlined text-lg">{plan.active ? 'visibility_off' : 'visibility'}</span>
                                        </button>
                                        <button onClick={() => handleDelete(plan)} className="p-2 text-rose-500 hover:text-rose-600 transition-colors" title="Excluir plano" disabled={deletingPlanId === plan.id}>
                                            <span className="material-symbols-outlined text-lg">{deletingPlanId === plan.id ? 'progress_activity' : 'delete'}</span>
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">{plan.name}</h3>
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className="text-2xl font-black text-[#007BFF] dark:text-[#72E7FF]">R$ {Number(plan.monthly_price || 0).toFixed(2)}</span>
                                    <span className="text-xs text-slate-500 font-bold">/mês</span>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
                                    <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-3 border border-slate-100 dark:border-white/10">
                                        <p className="text-[11px] font-black text-slate-500 mb-2">Créditos por serviço</p>
                                        <div className="space-y-2">
                                            {serviceCredits.length > 0 ? serviceCredits.map((entry) => (
                                                <div key={`${plan.id}-${entry.service_id || entry.service_name}`} className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                                                    <span className="font-bold">{entry.service_name}</span>
                                                    <span className="inline-flex items-center rounded-full bg-[#B88A44]/15 px-2.5 py-1 text-[11px] font-black text-[#9A6F2D] dark:text-[#E3C382]">
                                                        {entry.credits}
                                                    </span>
                                                </div>
                                            )) : (
                                                <p className="text-xs text-slate-400">Sem créditos configurados.</p>
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
                <div className="flex flex-col items-center justify-center p-12 md:p-20 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-center">
                    <span className="material-symbols-outlined text-5xl text-[#B88A44] mb-4">loyalty</span>
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Nenhum plano criado ainda</h3>
                    <p className="text-slate-500 max-w-sm mt-2">Monte o primeiro pacote mensal com créditos por serviço e benefícios da barbearia.</p>
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingPlan ? 'Editar Plano' : 'Criar Novo Plano'}
                maxWidth="md"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="text-[11px] font-black text-slate-500 mb-1.5 block">Nome do plano</label>
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
                            <label className="text-[11px] font-black text-slate-500 mb-1.5 block">Valor mensal (R$)</label>
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
                            <label className="text-[11px] font-black text-slate-500 mb-1.5 block">Total de créditos</label>
                            <div className="w-full bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm font-black text-[#9A6F2D] dark:text-[#E3C382]">
                                {getTotalPlannedCredits(form.service_credit_map)}
                            </div>
                        </div>

                        <div className="sm:col-span-2">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[11px] font-black text-slate-500 block">Créditos por serviço</label>
                                <button
                                    type="button"
                                    onClick={handleAddServiceCredit}
                                    disabled={availableServices.length === 0}
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#B88A44]/15 px-3 py-1.5 text-[11px] font-black text-[#9A6F2D] disabled:opacity-50 disabled:cursor-not-allowed dark:text-[#E3C382]"
                                >
                                    <span className="material-symbols-outlined text-sm">add</span>
                                    Adicionar serviço
                                </button>
                            </div>
                            {services.length === 0 && (
                                <p className="text-[11px] text-slate-500 mb-3">
                                    Cadastre serviços no catálogo antes de montar os créditos do plano.
                                </p>
                            )}

                            <div className="space-y-3">
                                {form.service_credit_map.length > 0 ? form.service_credit_map.map((item, index) => {
                                    const selectableServices = services.filter((service) =>
                                        service.id === item.service_id || !form.service_credit_map.some((entry) => entry.service_id === service.id),
                                    );

                                    return (
                                        <div key={`${item.service_id}-${index}`} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-3 items-end rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                                            <div>
                                                <label className="text-[11px] font-black text-slate-500 mb-1.5 block">Serviço</label>
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
                                                <label className="text-[11px] font-black text-slate-500 mb-1.5 block">Créditos</label>
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
                                                className="h-12 w-full rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center sm:w-12"
                                                title="Remover serviço"
                                            >
                                                <span className="material-symbols-outlined">delete</span>
                                            </button>
                                        </div>
                                    );
                                }) : (
                                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/10 p-4 text-sm text-slate-500 text-center">
                                        Nenhum serviço vinculado. Adicione os serviços que este plano cobre.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="sm:col-span-2">
                            <label className="text-[11px] font-black text-slate-500 mb-1.5 block">Descrição</label>
                            <textarea
                                value={form.description}
                                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                                title="Descrição"
                                rows={2}
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-500 mb-1.5 block">% desconto em produtos</label>
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
                            <label className="text-[11px] font-black text-slate-500 mb-1.5 block">Acúmulo máximo</label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={form.max_rollover_credits}
                                onChange={(e) => setForm((current) => ({ ...current, max_rollover_credits: Number(e.target.value) }))}
                                title="Acúmulo máximo"
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white"
                                placeholder="0 = não acumula"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 py-2">
                        <input
                            type="checkbox"
                            title="Prioridade de Agendamento"
                            checked={form.priority_booking}
                            onChange={(e) => setForm((current) => ({ ...current, priority_booking: e.target.checked }))}
                            className="size-4 rounded border-slate-300 text-[#007BFF] focus:ring-[#007BFF]"
                        />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Habilitar Prioridade de Agendamento</span>
                    </div>

                    <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                        <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 px-6 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-bold rounded-xl text-sm">Cancelar</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 px-6 bg-[#007BFF] text-white font-black rounded-xl text-sm shadow-sm shadow-[#007BFF]/20">
                            {loading ? 'Salvando...' : 'Salvar Plano'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={!!planToDelete}
                onClose={() => setPlanToDelete(null)}
                title="Excluir plano"
                maxWidth="sm"
            >
                {planToDelete && (
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                            <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
                                Esta ação remove o plano {planToDelete.name} do catálogo do Club dos Chefes.
                            </p>
                            <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-300/80">
                                Use somente quando o plano não fizer mais parte da estratégia comercial da barbearia.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() => setPlanToDelete(null)}
                                className="flex-1 rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                            >
                                Manter plano
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmDelete()}
                                disabled={deletingPlanId === planToDelete.id}
                                className="flex-1 rounded-xl bg-rose-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
                            >
                                {deletingPlanId === planToDelete.id ? 'Excluindo...' : 'Excluir plano'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default ChefClubPlans;
