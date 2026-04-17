import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Toast from '@/components/Toast';
import Modal from '@/components/ui/Modal';

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

interface ServiceOption {
    id: string;
    name: string;
    category?: string | null;
}

interface PersistedPlanBenefit {
    id: string;
    plan_id: string;
    benefit_label: string;
    monthly_quantity: number;
    eligible_service_ids?: string[] | null;
    active?: boolean | null;
}

interface PlanBenefitFormRow {
    id: string;
    serviceId: string;
    quantity: number;
}

const createBenefitRow = (serviceId = '', quantity = 1): PlanBenefitFormRow => ({
    id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    serviceId,
    quantity,
});

const ChefClubPlans: React.FC = () => {
    const { tenantId, requireModuleAccess, isModuleEnabledForTenant } = useAuth();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [services, setServices] = useState<ServiceOption[]>([]);
    const [benefitsByPlanId, setBenefitsByPlanId] = useState<Record<string, PersistedPlanBenefit[]>>({});
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

    const [form, setForm] = useState({
        name: '',
        monthly_price: 0,
        description: '',
        priority_booking: false,
        product_discount: 0,
        max_rollover_credits: 0,
        credit_validity_days: 30,
        benefits: [createBenefitRow()],
    });

    const chefClubEnabled = isModuleEnabledForTenant('chef_club');

    const servicesById = useMemo(
        () => new Map(services.map((service) => [service.id, service])),
        [services],
    );

    const resetForm = () => {
        setForm({
            name: '',
            monthly_price: 0,
            description: '',
            priority_booking: false,
            product_discount: 0,
            max_rollover_credits: 0,
            credit_validity_days: 30,
            benefits: [createBenefitRow()],
        });
    };

    const mapPersistedBenefitsToForm = useCallback((planId: string): PlanBenefitFormRow[] => {
        const persistedBenefits = benefitsByPlanId[planId] || [];
        const rows = persistedBenefits
            .filter((benefit) => benefit.active !== false)
            .map((benefit) => createBenefitRow(benefit.eligible_service_ids?.[0] || '', Number(benefit.monthly_quantity) || 1))
            .filter((benefit) => benefit.serviceId);

        return rows.length > 0 ? rows : [createBenefitRow()];
    }, [benefitsByPlanId]);

    const buildBenefitsPayload = (
        tenantIdValue: string,
        planId: string,
        rows: PlanBenefitFormRow[],
    ) => {
        const aggregated = rows.reduce<Record<string, { serviceId: string; quantity: number }>>((acc, row) => {
            const serviceId = row.serviceId.trim();
            const quantity = Math.max(0, Number(row.quantity) || 0);

            if (!serviceId || quantity <= 0) {
                return acc;
            }

            if (!acc[serviceId]) {
                acc[serviceId] = { serviceId, quantity: 0 };
            }

            acc[serviceId].quantity += quantity;
            return acc;
        }, {});

        return Object.values(aggregated).map((entry, index) => {
            const service = servicesById.get(entry.serviceId);
            return {
                tenant_id: tenantIdValue,
                plan_id: planId,
                benefit_code: `service:${entry.serviceId}`,
                benefit_label: service?.name || 'Servico do plano',
                monthly_quantity: entry.quantity,
                benefit_scope: 'service',
                eligible_service_ids: [entry.serviceId],
                eligible_service_names: service?.name ? [service.name] : [],
                eligible_service_categories: service?.category ? [service.category] : [],
                active: true,
                priority: 100 - index,
            };
        });
    };

    const fetchPlans = useCallback(async () => {
        if (!tenantId || !chefClubEnabled) {
            setPlans([]);
            setServices([]);
            setBenefitsByPlanId({});
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { tenantId: resolvedTenantId, client } = requireModuleAccess(
                'chef_club',
                'customer_plans',
                'load chef club plans',
            );
            const { tenantId: servicesTenantId, client: servicesClient } = requireModuleAccess(
                'services',
                'services',
                'load services for chef club plans',
            );

            const [plansRes, benefitsRes, servicesRes] = await Promise.all([
                client
                    .from('customer_plans')
                    .select('*')
                    .eq('tenant_id', resolvedTenantId)
                    .order('monthly_price', { ascending: true }),
                client
                    .from('customer_plan_benefits')
                    .select('id, plan_id, benefit_label, monthly_quantity, eligible_service_ids, active')
                    .eq('tenant_id', resolvedTenantId)
                    .eq('active', true)
                    .order('priority', { ascending: false }),
                servicesClient
                    .from('services')
                    .select('id, name, category')
                    .eq('tenant_id', servicesTenantId)
                    .eq('active', true)
                    .order('name'),
            ]);

            if (plansRes.error) throw plansRes.error;
            if (benefitsRes.error) throw benefitsRes.error;
            if (servicesRes.error) throw servicesRes.error;

            setPlans((plansRes.data || []) as Plan[]);
            setServices((servicesRes.data || []) as ServiceOption[]);

            const groupedBenefits = ((benefitsRes.data || []) as PersistedPlanBenefit[]).reduce<Record<string, PersistedPlanBenefit[]>>((acc, benefit) => {
                if (!acc[benefit.plan_id]) {
                    acc[benefit.plan_id] = [];
                }
                acc[benefit.plan_id].push(benefit);
                return acc;
            }, {});

            setBenefitsByPlanId(groupedBenefits);
        } catch (error) {
            console.error('Error loading chef club plans:', error);
            setToast({ message: 'Erro ao carregar planos.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [chefClubEnabled, requireModuleAccess, tenantId]);

    useEffect(() => {
        void fetchPlans();
    }, [fetchPlans]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { tenantId: resolvedTenantId, client } = requireModuleAccess(
                'chef_club',
                'customer_plans',
                editingPlan ? 'update chef club plan' : 'create chef club plan',
            );

            const benefitsPayload = buildBenefitsPayload(resolvedTenantId, editingPlan?.id || '', form.benefits);
            const totalConfiguredCredits = benefitsPayload.reduce((acc, benefit) => acc + benefit.monthly_quantity, 0);

            const planData = {
                name: form.name,
                monthly_price: form.monthly_price,
                service_credits: totalConfiguredCredits,
                description: form.description,
                priority_booking: form.priority_booking,
                product_discount: form.product_discount,
                max_rollover_credits: form.max_rollover_credits,
                credit_validity_days: form.credit_validity_days,
                tenant_id: resolvedTenantId,
            };

            let planId = editingPlan?.id || '';

            if (editingPlan) {
                const { error } = await client
                    .from('customer_plans')
                    .update(planData)
                    .eq('id', editingPlan.id)
                    .eq('tenant_id', resolvedTenantId);

                if (error) throw error;
            } else {
                const { data: createdPlan, error } = await client
                    .from('customer_plans')
                    .insert([planData])
                    .select('id')
                    .single();

                if (error || !createdPlan?.id) {
                    throw error || new Error('Nao foi possivel criar o plano.');
                }

                planId = createdPlan.id;
            }

            const { error: deleteBenefitsError } = await client
                .from('customer_plan_benefits')
                .delete()
                .eq('tenant_id', resolvedTenantId)
                .eq('plan_id', planId);

            if (deleteBenefitsError) throw deleteBenefitsError;

            const finalBenefitsPayload = benefitsPayload.map((benefit) => ({ ...benefit, plan_id: planId }));
            if (finalBenefitsPayload.length > 0) {
                const { error: insertBenefitsError } = await client
                    .from('customer_plan_benefits')
                    .insert(finalBenefitsPayload);

                if (insertBenefitsError) throw insertBenefitsError;
            }

            setToast({ message: `Plano ${editingPlan ? 'atualizado' : 'criado'} com sucesso!`, type: 'success' });
            setShowModal(false);
            setEditingPlan(null);
            resetForm();
            await fetchPlans();
        } catch (error) {
            console.error('Error saving chef club plan:', error);
            const message = error instanceof Error ? error.message : 'Erro desconhecido ao salvar plano.';
            setToast({ message: `Erro ao salvar plano: ${message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (plan: Plan) => {
        setEditingPlan(plan);
        setForm({
            name: plan.name,
            monthly_price: plan.monthly_price,
            description: plan.description,
            priority_booking: plan.priority_booking,
            product_discount: plan.product_discount,
            max_rollover_credits: plan.max_rollover_credits,
            credit_validity_days: plan.credit_validity_days,
            benefits: mapPersistedBenefitsToForm(plan.id),
        });
        setShowModal(true);
    };

    const toggleStatus = async (plan: Plan) => {
        try {
            const { tenantId: resolvedTenantId, client } = requireModuleAccess(
                'chef_club',
                'customer_plans',
                'toggle chef club plan status',
            );
            const { error } = await client
                .from('customer_plans')
                .update({ active: !plan.active })
                .eq('id', plan.id)
                .eq('tenant_id', resolvedTenantId);

            if (error) {
                throw error;
            }

            setPlans(plans.map(p => p.id === plan.id ? { ...p, active: !plan.active } : p));
        } catch (error) {
            console.error('Error toggling chef club plan status:', error);
            setToast({ message: 'Erro ao alterar status.', type: 'error' });
        }
    };

    const updateBenefitRow = (rowId: string, patch: Partial<PlanBenefitFormRow>) => {
        setForm((current) => ({
            ...current,
            benefits: current.benefits.map((benefit) => (
                benefit.id === rowId ? { ...benefit, ...patch } : benefit
            )),
        }));
    };

    const removeBenefitRow = (rowId: string) => {
        setForm((current) => {
            const nextBenefits = current.benefits.filter((benefit) => benefit.id !== rowId);
            return {
                ...current,
                benefits: nextBenefits.length > 0 ? nextBenefits : [createBenefitRow()],
            };
        });
    };

    const configuredBenefitsCount = form.benefits.reduce((acc, benefit) => acc + Math.max(0, Number(benefit.quantity) || 0), 0);

    if (!chefClubEnabled) {
        return (
            <div className="space-y-6 max-w-4xl mx-auto w-full animate-fade-in p-4 md:p-6">
                <div className="bg-white dark:bg-card-dark rounded-3xl border border-slate-200 dark:border-white/10 shadow-xl p-8 md:p-10 text-center">
                    <div className="mx-auto size-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
                        <span className="material-symbols-outlined text-amber-500 text-3xl">workspace_premium</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        Clube do Chefe indisponivel
                    </h2>
                    <p className="text-slate-500 text-sm font-medium max-w-md mx-auto mt-3">
                        Este modulo esta habilitado apenas para o tenant Sanchez Barber no app barber.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="size-14 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                        <span className="material-symbols-outlined text-amber-500 text-3xl">workspace_premium</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Clube do Chefe</h2>
                        <p className="text-slate-500 text-sm font-medium">Planos com beneficios por servico e saldo operacional</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setEditingPlan(null);
                        resetForm();
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
                    const planBenefits = benefitsByPlanId[plan.id] || [];
                    const remainingBenefits = Math.max(0, planBenefits.length - 3);

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
                                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                                            Beneficios do plano
                                        </p>
                                        {planBenefits.length > 0 ? (
                                            <div className="mt-3 space-y-2">
                                                {planBenefits.slice(0, 3).map((benefit) => (
                                                    <div key={benefit.id} className="flex items-center justify-between gap-3 text-sm">
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">{benefit.benefit_label}</span>
                                                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-black text-amber-600 dark:bg-white/10">
                                                            {benefit.monthly_quantity}x
                                                        </span>
                                                    </div>
                                                ))}
                                                {remainingBenefits > 0 && (
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                                        + {remainingBenefits} beneficio(s)
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="mt-3 text-sm font-bold text-slate-500">
                                                {plan.service_credits > 0
                                                    ? `${plan.service_credits} credito(s) genericos legados`
                                                    : 'Nenhum beneficio configurado ainda'}
                                            </p>
                                        )}
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
                    );
                })}
            </div>

            {plans.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center p-20 bg-slate-50 dark:bg-white/5 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 text-center">
                    <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">loyalty</span>
                    <h3 className="text-xl font-bold text-slate-600 dark:text-slate-400">Nenhum plano criado ainda</h3>
                    <p className="text-slate-500 max-w-xs mt-2">Crie seu primeiro plano de assinatura e defina quantos usos mensais cada servico entrega.</p>
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingPlan ? 'Editar Plano' : 'Criar Novo Plano'}
                maxWidth="3xl"
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
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
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Beneficios mensais configurados</label>
                            <div className="w-full rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm font-black text-amber-700 dark:text-amber-300">
                                {configuredBenefitsCount} credito(s) distribuidos por servico
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Descricao</label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                title="Descricao"
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
                            <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Acumulo Maximo (Rollover)</label>
                            <input
                                type="number"
                                value={form.max_rollover_credits}
                                onChange={e => setForm({ ...form, max_rollover_credits: Number(e.target.value) })}
                                title="Acumulo Maximo"
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-white"
                                placeholder="0 = Nao acumula"
                            />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Beneficios por servico</p>
                                <p className="text-sm text-slate-500 mt-1">Defina quais servicos entram no plano e quantas vezes o cliente pode usar por ciclo.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setForm((current) => ({ ...current, benefits: [...current.benefits, createBenefitRow()] }))}
                                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-amber-600"
                            >
                                <span className="material-symbols-outlined text-sm">add</span>
                                Adicionar Servico
                            </button>
                        </div>

                        <div className="mt-4 space-y-3">
                            {form.benefits.map((benefit, index) => (
                                <div key={benefit.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px_44px] gap-3 rounded-2xl border border-slate-200 dark:border-white/10 p-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Servico {index + 1}</label>
                                        <select
                                            value={benefit.serviceId}
                                            onChange={(e) => updateBenefitRow(benefit.id, { serviceId: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                                        >
                                            <option value="">Selecione um servico</option>
                                            {services.map((service) => (
                                                <option key={service.id} value={service.id}>
                                                    {service.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">Qtd/ciclo</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={benefit.quantity}
                                            onChange={(e) => updateBenefitRow(benefit.id, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                                            className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-sm text-white"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            onClick={() => removeBenefitRow(benefit.id)}
                                            className="size-11 rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10"
                                            title="Remover servico"
                                        >
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
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
