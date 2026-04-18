import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Toast from '@/components/Toast';

interface ClientOption {
    id: string;
    name: string;
    phone: string;
}

interface PlanOption {
    id: string;
    name: string;
    monthly_price: number;
    service_credits: number;
    description: string;
    active: boolean;
}

interface ExistingSubscription {
    id: string;
    plan_id: string;
}

const toDateOnly = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const ChefClubSubscriptionNew: React.FC = () => {
    const { tenantId, requireModuleAccess, isModuleEnabledForTenant } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [plans, setPlans] = useState<PlanOption[]>([]);
    const [clientSearch, setClientSearch] = useState('');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedPlanId, setSelectedPlanId] = useState<string>('');
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [existingSubscription, setExistingSubscription] = useState<ExistingSubscription | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const chefClubEnabled = isModuleEnabledForTenant('chef_club');

    const from = searchParams.get('from');
    const preselectedClientId = searchParams.get('clientId');

    const today = new Date();
    const nextBilling = new Date(today);
    nextBilling.setDate(nextBilling.getDate() + 30);
    const [nextBillingDate, setNextBillingDate] = useState(toDateOnly(nextBilling));
    const [initialCredits, setInitialCredits] = useState(0);

    const loadData = useCallback(async () => {
        if (!tenantId || !chefClubEnabled) {
            setClients([]);
            setPlans([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { tenantId: resolvedTenantId, client } = requireModuleAccess(
                'chef_club',
                'customer_plans',
                'load chef club subscription setup',
            );
            const [clientsRes, plansRes] = await Promise.all([
                client
                    .from('clients')
                    .select('id, name, phone')
                    .eq('tenant_id', resolvedTenantId)
                    .order('name'),
                client
                    .from('customer_plans')
                    .select('id, name, monthly_price, service_credits, description, active')
                    .eq('tenant_id', resolvedTenantId)
                    .eq('active', true)
                    .order('monthly_price', { ascending: true }),
            ]);

            if (clientsRes.error) {
                throw clientsRes.error;
            }

            if (plansRes.error) {
                throw plansRes.error;
            }

            setClients((clientsRes.data || []) as ClientOption[]);
            setPlans((plansRes.data || []) as PlanOption[]);
        } catch (error) {
            console.error('Error loading chef club subscription setup:', error);
            setToast({ message: 'Erro ao carregar dados do Clube do Chefe.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [chefClubEnabled, requireModuleAccess, tenantId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useEffect(() => {
        if (!preselectedClientId || clients.length === 0) return;
        const exists = clients.some(client => client.id === preselectedClientId);
        if (exists) {
            setSelectedClientId(preselectedClientId);
            setStep(2);
        }
    }, [preselectedClientId, clients]);

    const filteredClients = useMemo(() => {
        const term = clientSearch.toLowerCase().trim();
        if (!term) return clients;
        return clients.filter(client =>
            client.name.toLowerCase().includes(term) || (client.phone || '').toLowerCase().includes(term)
        );
    }, [clients, clientSearch]);

    const selectedClient = clients.find(client => client.id === selectedClientId) || null;
    const selectedPlan = plans.find(plan => plan.id === selectedPlanId) || null;

    useEffect(() => {
        setInitialCredits(selectedPlan?.service_credits || 0);
    }, [selectedPlanId, selectedPlan]);

    const redirectWithSuccess = (message: string) => {
        navigate('/chef-club-subscriptions', {
            state: {
                toast: {
                    message,
                    type: 'success',
                },
            },
        });
    };

    const syncSubscriptionBalances = async (
        subscriptionId: string,
        clientId: string,
        planId: string,
        defaultCredits: number,
    ) => {
        const { tenantId: resolvedTenantId, client } = requireModuleAccess(
            'chef_club',
            'customer_credits',
            'sync chef club subscription balances',
        );
        const { data: planBenefits, error: planBenefitsError } = await client
            .from('customer_plan_benefits')
            .select('id, benefit_code, benefit_label, monthly_quantity, active')
            .eq('tenant_id', resolvedTenantId)
            .eq('plan_id', planId)
            .eq('active', true)
            .order('priority', { ascending: false });

        if (planBenefitsError) return planBenefitsError;

        const balancesPayload = (planBenefits || []).length > 0
            ? (planBenefits || []).map((benefit: any) => ({
                subscription_id: subscriptionId,
                tenant_id: resolvedTenantId,
                client_id: clientId,
                benefit_code: benefit.benefit_code,
                benefit_label: benefit.benefit_label,
                available_credits: Number(benefit.monthly_quantity) || 0,
                used_credits: 0,
                source_plan_benefit_id: benefit.id,
                period_start: today.toISOString(),
                period_end: null,
            }))
            : [{
                subscription_id: subscriptionId,
                tenant_id: resolvedTenantId,
                client_id: clientId,
                benefit_code: 'generic_service',
                benefit_label: 'Creditos de Servico',
                available_credits: defaultCredits,
                used_credits: 0,
                source_plan_benefit_id: null,
                period_start: today.toISOString(),
                period_end: null,
            }];

        const { error: cleanupError } = await client
            .from('customer_credits')
            .delete()
            .eq('tenant_id', resolvedTenantId)
            .eq('subscription_id', subscriptionId);

        if (cleanupError) return cleanupError;

        const { error } = await client
            .from('customer_credits')
            .upsert(balancesPayload, { onConflict: 'subscription_id,benefit_code' });

        return error;
    };

    const createSubscription = async () => {
        if (!tenantId || !selectedClient || !selectedPlan) return;

        const parsedInitialCredits = Number(initialCredits);
        const billingDate = new Date(`${nextBillingDate}T12:00:00`);

        try {
            const { tenantId: resolvedTenantId, client } = requireModuleAccess(
                'chef_club',
                'customer_subscriptions',
                'create chef club subscription',
            );
            const { data, error } = await client
                .from('customer_subscriptions')
                .insert({
                    tenant_id: resolvedTenantId,
                    client_id: selectedClient.id,
                    plan_id: selectedPlan.id,
                    status: 'active',
                    started_at: today.toISOString(),
                    cycle_start: today.toISOString(),
                    cycle_end: billingDate.toISOString(),
                    next_billing_date: nextBillingDate,
                })
                .select('id')
                .single();

            if (error || !data?.id) {
                throw error || new Error('Nao foi possivel criar a assinatura.');
            }

            const creditsError = await syncSubscriptionBalances(data.id, selectedClient.id, selectedPlan.id, parsedInitialCredits);
            if (creditsError) {
                setToast({
                    message: `Assinatura criada, mas houve erro ao lancar creditos: ${creditsError.message}`,
                    type: 'error',
                });
                return;
            }

            redirectWithSuccess(`Assinatura de ${selectedClient.name} criada com sucesso!`);
        } catch (error) {
            console.error('Error creating chef club subscription:', error);
            const message = error instanceof Error ? error.message : 'desconhecido';
            setToast({ message: `Erro ao criar assinatura: ${message}`, type: 'error' });
        }
    };

    const replaceSubscriptionPlan = async () => {
        if (!tenantId || !selectedClient || !selectedPlan || !existingSubscription) return;

        if (existingSubscription.plan_id === selectedPlan.id) {
            setToast({ message: 'Este cliente ja esta ativo neste plano.', type: 'info' });
            return;
        }

        const parsedInitialCredits = Number(initialCredits);
        const billingDate = new Date(`${nextBillingDate}T12:00:00`);

        try {
            const { tenantId: resolvedTenantId, client } = requireModuleAccess(
                'chef_club',
                'customer_subscriptions',
                'replace chef club subscription plan',
            );
            const { error } = await client
                .from('customer_subscriptions')
                .update({
                    plan_id: selectedPlan.id,
                    status: 'active',
                    cycle_start: today.toISOString(),
                    cycle_end: billingDate.toISOString(),
                    next_billing_date: nextBillingDate,
                })
                .eq('id', existingSubscription.id)
                .eq('tenant_id', resolvedTenantId);

            if (error) {
                throw error;
            }

            const creditsError = await syncSubscriptionBalances(
                existingSubscription.id,
                selectedClient.id,
                selectedPlan.id,
                parsedInitialCredits,
            );
            if (creditsError) {
                setToast({
                    message: `Plano trocado, mas houve erro ao atualizar creditos: ${creditsError.message}`,
                    type: 'error',
                });
                return;
            }

            redirectWithSuccess(`Plano de ${selectedClient.name} atualizado com sucesso!`);
        } catch (error) {
            console.error('Error replacing chef club subscription plan:', error);
            const message = error instanceof Error ? error.message : 'desconhecido';
            setToast({ message: `Erro ao trocar plano: ${message}`, type: 'error' });
        }
    };

    const handleConfirm = async () => {
        if (!tenantId || !selectedClient || !selectedPlan) return;

        const parsedInitialCredits = Number(initialCredits);
        if (!nextBillingDate) {
            setToast({ message: 'Defina a proxima cobranca antes de confirmar.', type: 'info' });
            return;
        }

        if (!Number.isFinite(parsedInitialCredits) || parsedInitialCredits < 0) {
            setToast({ message: 'Informe uma quantidade valida de creditos iniciais.', type: 'info' });
            return;
        }

        setSaving(true);
        setExistingSubscription(null);

        try {
            const { tenantId: resolvedTenantId, client } = requireModuleAccess(
                'chef_club',
                'customer_subscriptions',
                'validate chef club active subscription',
            );
            const { data: activeSubscription, error } = await client
                .from('customer_subscriptions')
                .select('id, plan_id')
                .eq('tenant_id', resolvedTenantId)
                .eq('client_id', selectedClient.id)
                .eq('status', 'active')
                .maybeSingle();

            if (error) {
                throw error;
            }

            if (activeSubscription?.id) {
                setExistingSubscription(activeSubscription as ExistingSubscription);
                setToast({ message: 'Cliente ja possui assinatura ativa. Voce pode trocar o plano.', type: 'info' });
                return;
            }

            await createSubscription();
        } catch (error) {
            console.error('Error validating chef club active subscription:', error);
            const message = error instanceof Error ? error.message : 'desconhecido';
            setToast({ message: `Erro ao validar assinatura existente: ${message}`, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

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

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto p-6">
                <div className="p-10 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-slate-500 text-sm mt-3">Carregando cadastro de assinante...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="size-14 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                        <span className="material-symbols-outlined text-amber-500 text-3xl">workspace_premium</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Novo Assinante do Clube</h2>
                        <p className="text-slate-500 text-sm font-medium">
                            Fluxo inteligente de cadastro {from ? `(origem: ${from})` : ''}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/chef-club-subscriptions')}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-sm font-bold"
                >
                    Voltar para Assinaturas
                </button>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-4 md:p-6">
                <div className="flex items-center gap-2 mb-6">
                    {[1, 2, 3].map(currentStep => (
                        <div
                            key={currentStep}
                            className={`h-2 flex-1 rounded-full transition-all ${step >= currentStep ? 'bg-primary' : 'bg-slate-200 dark:bg-white/10'}`}
                        />
                    ))}
                </div>

                {step === 1 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">1. Selecione o Cliente</h3>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                value={clientSearch}
                                onChange={event => setClientSearch(event.target.value)}
                                placeholder="Buscar cliente por nome ou telefone..."
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-3 pl-10 pr-4 text-sm outline-none"
                            />
                        </div>

                        <div className="max-h-[340px] overflow-auto custom-scrollbar border border-slate-200 dark:border-border-dark rounded-xl">
                            {filteredClients.map(client => (
                                <button
                                    key={client.id}
                                    onClick={() => setSelectedClientId(client.id)}
                                    className={`w-full px-4 py-3 flex items-center justify-between text-left border-b border-slate-100 dark:border-white/5 last:border-b-0 transition-colors ${selectedClientId === client.id
                                        ? 'bg-primary/10 text-primary'
                                        : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200'
                                    }`}
                                >
                                    <div>
                                        <p className="font-bold text-sm">{client.name}</p>
                                        <p className="text-xs opacity-70">{client.phone || 'Sem telefone'}</p>
                                    </div>
                                    {selectedClientId === client.id && <span className="material-symbols-outlined">check_circle</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">2. Escolha o Plano Ativo</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {plans.map(plan => (
                                <button
                                    key={plan.id}
                                    onClick={() => setSelectedPlanId(plan.id)}
                                    className={`text-left p-4 rounded-2xl border transition-all ${selectedPlanId === plan.id
                                        ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                                        : 'border-slate-200 dark:border-border-dark hover:border-primary/40'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-black text-slate-900 dark:text-white uppercase">{plan.name}</h4>
                                        {selectedPlanId === plan.id && <span className="material-symbols-outlined text-primary">check_circle</span>}
                                    </div>
                                    <p className="text-sm font-bold text-primary mt-1">R$ {Number(plan.monthly_price || 0).toFixed(2)}/mÃªs</p>
                                    <p className="text-xs font-bold text-amber-600 mt-2">{plan.service_credits} crÃ©ditos por ciclo</p>
                                    <p className="text-xs text-slate-500 mt-2">{plan.description || 'Sem descriÃ§Ã£o.'}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">3. ConfirmaÃ§Ã£o</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                                <p className="text-[10px] uppercase font-black text-slate-500">Cliente</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{selectedClient?.name || '-'}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                                <p className="text-[10px] uppercase font-black text-slate-500">Plano</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{selectedPlan?.name || '-'}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                                <p className="text-[10px] uppercase font-black text-slate-500">CrÃ©ditos Iniciais</p>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={initialCredits}
                                    onChange={event => setInitialCredits(Math.max(0, Number(event.target.value)))}
                                    className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm font-bold text-amber-600 mt-2 outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                                <p className="text-[10px] uppercase font-black text-slate-500">PrÃ³xima CobranÃ§a</p>
                                <input
                                    type="date"
                                    value={nextBillingDate}
                                    onChange={event => setNextBillingDate(event.target.value)}
                                    className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-white mt-2 outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>

                        {existingSubscription && (
                            <div className="border border-amber-400/40 bg-amber-500/10 rounded-xl p-4">
                                <p className="text-xs font-black uppercase text-amber-600">Cliente jÃ¡ tem assinatura ativa</p>
                                <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                                    VocÃª pode trocar o plano atual e resetar os crÃ©ditos para o plano selecionado.
                                </p>
                                <div className="flex gap-3 mt-3">
                                    <button
                                        onClick={replaceSubscriptionPlan}
                                        disabled={saving}
                                        className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-black uppercase tracking-wider disabled:opacity-60"
                                    >
                                        Trocar Plano
                                    </button>
                                    <button
                                        onClick={() => setExistingSubscription(null)}
                                        className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-sm font-bold"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex gap-3 pt-6 mt-6 border-t border-slate-200 dark:border-border-dark">
                    <button
                        disabled={step === 1 || saving}
                        onClick={() => setStep(prev => Math.max(1, (prev - 1) as 1 | 2 | 3))}
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-sm disabled:opacity-60"
                    >
                        Voltar
                    </button>

                    {step < 3 ? (
                        <button
                            onClick={() => {
                                if (step === 1 && !selectedClientId) {
                                    setToast({ message: 'Selecione um cliente para avanÃ§ar.', type: 'info' });
                                    return;
                                }
                                if (step === 2 && !selectedPlanId) {
                                    setToast({ message: 'Selecione um plano para avanÃ§ar.', type: 'info' });
                                    return;
                                }
                                setStep(prev => Math.min(3, (prev + 1) as 1 | 2 | 3));
                            }}
                            className="flex-1 py-3 rounded-xl bg-primary text-white font-black uppercase tracking-wider text-sm"
                        >
                            AvanÃ§ar
                        </button>
                    ) : (
                        <button
                            onClick={handleConfirm}
                            disabled={saving || !selectedClient || !selectedPlan}
                            className="flex-1 py-3 rounded-xl bg-primary text-white font-black uppercase tracking-wider text-sm disabled:opacity-60"
                        >
                            {saving ? 'Salvando...' : 'Confirmar Cadastro'}
                        </button>
                    )}
                </div>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default ChefClubSubscriptionNew;
