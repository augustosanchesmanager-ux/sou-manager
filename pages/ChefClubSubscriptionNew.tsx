import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { getScopedClient, supabase } from '../services/supabaseClient';
import {
    type ServiceBalanceEntry,
    type ServiceCreditsEntry,
    buildServiceBalancesFromPlan,
    getTotalAvailableCredits,
    normalizePlanServiceCredits,
} from '../src/utils/chefClubCredits';

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
    service_credit_map?: ServiceCreditsEntry[] | null;
    description: string;
    active: boolean;
}

interface ExistingSubscription {
    id: string;
    plan_id: string;
    status: string;
}

const stepLabels = {
    1: 'Cliente',
    2: 'Plano',
    3: 'Confirmação',
} as const;

const originLabels: Record<string, string> = {
    clients: 'Clientes',
    subscriptions: 'Assinaturas',
};

const formatCurrency = (value: number | string | null | undefined) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const toDateOnly = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const cloneBalances = (balances: ServiceBalanceEntry[]) =>
    balances.map((balance) => ({ ...balance }));

const getNextStep = (current: 1 | 2 | 3): 1 | 2 | 3 => (current === 1 ? 2 : 3);
const getPreviousStep = (current: 1 | 2 | 3): 1 | 2 | 3 => (current === 3 ? 2 : 1);

const ChefClubSubscriptionNew: React.FC = () => {
    const { tenantId } = useAuth();
    const barberSupabase = getScopedClient('barber');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [plans, setPlans] = useState<PlanOption[]>([]);
    const [clientSearch, setClientSearch] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [existingSubscription, setExistingSubscription] = useState<ExistingSubscription | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const from = searchParams.get('from');
    const preselectedClientId = searchParams.get('clientId');
    const originLabel = from ? originLabels[from] || from : null;

    useEffect(() => {
        const loadData = async () => {
            if (!tenantId) {
                setClients([]);
                setPlans([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            const [clientsRes, plansRes] = await Promise.all([
                supabase.from('clients').select('id, name, phone').eq('tenant_id', tenantId).order('name'),
                barberSupabase
                    .from('customer_plans')
                    .select('id, name, monthly_price, service_credits, service_credit_map, description, active')
                    .eq('tenant_id', tenantId)
                    .eq('active', true)
                    .order('monthly_price', { ascending: true }),
            ]);

            if (clientsRes.data) setClients(clientsRes.data as ClientOption[]);
            if (plansRes.data) setPlans(plansRes.data as PlanOption[]);

            if (clientsRes.error) setToast({ message: 'Erro ao carregar clientes.', type: 'error' });
            if (plansRes.error) setToast({ message: 'Erro ao carregar planos ativos.', type: 'error' });

            setLoading(false);
        };

        void loadData();
    }, [tenantId]);

    useEffect(() => {
        if (!preselectedClientId || clients.length === 0) return;
        const exists = clients.some((client) => client.id === preselectedClientId);
        if (exists) {
            setSelectedClientId(preselectedClientId);
            setStep(2);
        }
    }, [preselectedClientId, clients]);

    const filteredClients = useMemo(() => {
        const term = clientSearch.toLowerCase().trim();
        if (!term) return clients;
        return clients.filter((client) =>
            client.name.toLowerCase().includes(term) || (client.phone || '').toLowerCase().includes(term),
        );
    }, [clients, clientSearch]);

    const selectedClient = clients.find((client) => client.id === selectedClientId) || null;
    const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || null;
    const selectedPlanServices = useMemo(
        () => normalizePlanServiceCredits(selectedPlan?.service_credit_map, selectedPlan?.service_credits || 0),
        [selectedPlan],
    );
    const selectedPlanBalances = useMemo(
        () => buildServiceBalancesFromPlan(selectedPlanServices),
        [selectedPlanServices],
    );

    const today = new Date();
    const nextBilling = new Date(today);
    nextBilling.setDate(nextBilling.getDate() + 30);
    const [nextBillingDate, setNextBillingDate] = useState(toDateOnly(nextBilling));
    const [initialBalances, setInitialBalances] = useState<ServiceBalanceEntry[]>([]);
    const [isLegacyMemberOnboarding, setIsLegacyMemberOnboarding] = useState(false);

    useEffect(() => {
        setInitialBalances(cloneBalances(selectedPlanBalances));
    }, [selectedPlanBalances]);

    const createOrReplaceSubscription = async (replaceExisting: boolean) => {
        if (!tenantId || !selectedClient || !selectedPlan) return;

        const { error } = await barberSupabase.rpc('create_chef_club_subscription', {
            p_tenant_id: tenantId,
            p_client_id: selectedClient.id,
            p_plan_id: selectedPlan.id,
            p_next_billing_date: nextBillingDate,
            p_replace_existing: replaceExisting,
        });

        if (error) {
            setToast({ message: `Erro ao ${replaceExisting ? 'trocar plano' : 'criar assinatura'}: ${error.message}`, type: 'error' });
            return;
        }

        navigate('/chef-club-subscriptions', {
            state: {
                toast: {
                    message: replaceExisting
                        ? `Plano de ${selectedClient.name} atualizado com sucesso.`
                        : `Assinatura de ${selectedClient.name} criada com sucesso.`,
                    type: 'success',
                },
            },
        });
    };

    const replaceSubscriptionPlan = async () => {
        if (!tenantId || !selectedClient || !selectedPlan || !existingSubscription) return;

        if (existingSubscription.plan_id === selectedPlan.id) {
            setToast({ message: 'Este cliente já está ativo neste plano.', type: 'info' });
            return;
        }

        setSaving(true);
        await createOrReplaceSubscription(true);
        setSaving(false);
    };

    const handleConfirm = async () => {
        if (!tenantId || !selectedClient || !selectedPlan) return;

        if (!nextBillingDate) {
            setToast({ message: 'Defina a próxima cobrança antes de confirmar.', type: 'info' });
            return;
        }

        if (initialBalances.length === 0 || getTotalAvailableCredits(initialBalances) <= 0) {
            setToast({ message: 'Configure ao menos um crédito inicial por serviço.', type: 'info' });
            return;
        }

        setSaving(true);
        setExistingSubscription(null);

        const { data: activeSub, error: activeSubError } = await barberSupabase
            .from('customer_subscriptions')
            .select('id, plan_id, status')
            .eq('tenant_id', tenantId)
            .eq('client_id', selectedClient.id)
            .in('status', ['active', 'past_due', 'paused'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (activeSubError) {
            setSaving(false);
            setToast({ message: `Erro ao validar assinatura existente: ${activeSubError.message}`, type: 'error' });
            return;
        }

        if (activeSub?.id) {
            setExistingSubscription(activeSub as ExistingSubscription);
            setSaving(false);
            setToast({ message: 'Cliente já possui assinatura aberta. Você pode trocar o plano.', type: 'info' });
            return;
        }

        await createOrReplaceSubscription(false);
        setSaving(false);
    };

    const advanceStep = () => {
        if (step === 1 && !selectedClientId) {
            setToast({ message: 'Selecione um cliente para avançar.', type: 'info' });
            return;
        }

        if (step === 2 && !selectedPlanId) {
            setToast({ message: 'Selecione um plano para avançar.', type: 'info' });
            return;
        }

        setStep((current) => getNextStep(current));
    };

    if (loading) {
        return (
            <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-white/10 dark:bg-card-dark">
                    <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-b-[#007BFF] dark:border-white/10 dark:border-b-[#00D2FF]" />
                    <p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">Carregando cadastro de assinante</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-20 md:p-6">
            <section className="overflow-hidden rounded-2xl border border-[#D8E8F3] bg-[#003366] text-white shadow-sm dark:border-[#14304A]">
                <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-end md:p-6">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-[#BFEFFF]">
                            <span className="material-symbols-outlined text-sm">workspace_premium</span>
                            Ativação do Clube do Chefe
                        </div>
                        <h1 className="mt-4 text-2xl font-black leading-tight md:text-3xl">Novo assinante do Clube</h1>
                        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-200">
                            Escolha o cliente, aplique um plano ativo e confirme os créditos que entram no ciclo da barbearia.
                        </p>
                        {originLabel && (
                            <p className="mt-3 text-xs font-semibold text-[#BFEFFF]">Origem: {originLabel}</p>
                        )}
                    </div>

                    <button
                        onClick={() => navigate('/chef-club-subscriptions')}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-[#00D2FF]/40"
                    >
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                        Assinaturas
                    </button>
                </div>
            </section>

            <section className="grid gap-3 md:grid-cols-3">
                {([1, 2, 3] as const).map((currentStep) => {
                    const isActive = step === currentStep;
                    const isComplete = step > currentStep;
                    return (
                        <button
                            key={currentStep}
                            type="button"
                            onClick={() => {
                                if (currentStep === 1 || (currentStep === 2 && selectedClientId) || (currentStep === 3 && selectedClientId && selectedPlanId)) {
                                    setStep(currentStep);
                                }
                            }}
                            className={`rounded-2xl border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#007BFF]/20 ${
                                isActive
                                    ? 'border-[#003366] bg-[#F1F8FC] dark:border-[#00D2FF] dark:bg-[#071426]'
                                    : 'border-slate-200 bg-white hover:border-[#007BFF]/40 dark:border-white/10 dark:bg-card-dark'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`flex size-9 items-center justify-center rounded-xl text-sm font-black ${
                                    isComplete
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                        : isActive
                                            ? 'bg-[#003366] text-white dark:bg-[#00D2FF] dark:text-[#06111F]'
                                            : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
                                }`}>
                                    {isComplete ? <span className="material-symbols-outlined text-base">check</span> : currentStep}
                                </span>
                                <div>
                                    <p className="text-sm font-black text-slate-900 dark:text-white">{stepLabels[currentStep]}</p>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                        {currentStep === 1 ? 'Quem entra no Clube' : currentStep === 2 ? 'Benefícios e valor' : 'Ciclo e cobrança'}
                                    </p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-card-dark">
                <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-base font-black text-slate-900 dark:text-white">{stepLabels[step]}</h2>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                {step === 1 && 'Selecione um cliente real da base para iniciar a recorrência.'}
                                {step === 2 && 'Use apenas planos ativos configurados no Clube do Chefe.'}
                                {step === 3 && 'Confira créditos, data de cobrança e regra de substituição antes de salvar.'}
                            </p>
                        </div>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Etapa {step} de 3</span>
                    </div>
                </div>

                <div className="p-4 md:p-5">
                    {step === 1 && (
                        <div className="space-y-4">
                            <label className="relative block">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                <input
                                    value={clientSearch}
                                    onChange={(event) => setClientSearch(event.target.value)}
                                    placeholder="Buscar cliente por nome ou telefone"
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
                                />
                            </label>

                            <div className="max-h-[420px] overflow-auto rounded-2xl border border-slate-200 dark:border-white/10">
                                {filteredClients.length > 0 ? (
                                    filteredClients.map((client) => {
                                        const isSelected = selectedClientId === client.id;
                                        return (
                                            <button
                                                key={client.id}
                                                onClick={() => setSelectedClientId(client.id)}
                                                className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 dark:border-white/5 ${
                                                    isSelected
                                                        ? 'bg-[#F1F8FC] text-[#003366] dark:bg-[#071426] dark:text-[#00D2FF]'
                                                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5'
                                                }`}
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-black">{client.name}</p>
                                                    <p className="mt-1 text-xs font-medium opacity-70">{client.phone || 'Telefone não cadastrado'}</p>
                                                </div>
                                                {isSelected && <span className="material-symbols-outlined">check_circle</span>}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="p-8 text-center">
                                        <span className="material-symbols-outlined rounded-2xl border border-[#D8E8F3] bg-[#F1F8FC] p-3 text-3xl text-[#003366] dark:border-[#14304A] dark:bg-[#071426] dark:text-[#00D2FF]">
                                            person_search
                                        </span>
                                        <p className="mt-4 text-base font-black text-slate-900 dark:text-white">Nenhum cliente encontrado</p>
                                        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                                            Ajuste a busca ou cadastre o cliente antes de ativar a recorrência.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            {plans.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {plans.map((plan) => {
                                        const isSelected = selectedPlanId === plan.id;
                                        const serviceCredits = normalizePlanServiceCredits(plan.service_credit_map, plan.service_credits);
                                        const totalCredits = serviceCredits.reduce((sum, entry) => sum + entry.credits, 0);

                                        return (
                                            <button
                                                key={plan.id}
                                                onClick={() => setSelectedPlanId(plan.id)}
                                                className={`rounded-2xl border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#007BFF]/20 ${
                                                    isSelected
                                                        ? 'border-[#003366] bg-[#F1F8FC] dark:border-[#00D2FF] dark:bg-[#071426]'
                                                        : 'border-slate-200 bg-white hover:border-[#007BFF]/40 dark:border-white/10 dark:bg-white/5'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <h3 className="truncate text-base font-black text-slate-900 dark:text-white">{plan.name}</h3>
                                                        <p className="mt-1 text-sm font-black text-[#003366] dark:text-[#00D2FF]">
                                                            {formatCurrency(plan.monthly_price)} por mês
                                                        </p>
                                                    </div>
                                                    {isSelected && <span className="material-symbols-outlined text-[#003366] dark:text-[#00D2FF]">check_circle</span>}
                                                </div>

                                                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-card-dark">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Créditos por ciclo</span>
                                                        <span className="text-sm font-black text-[#E5A158]">{totalCredits}</span>
                                                    </div>
                                                    <div className="mt-3 space-y-1">
                                                        {serviceCredits.length > 0 ? (
                                                            serviceCredits.slice(0, 3).map((entry) => (
                                                                <p key={`${plan.id}-${entry.service_id || entry.service_name}`} className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                                                    {entry.service_name}: {entry.credits}
                                                                </p>
                                                            ))
                                                        ) : (
                                                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sem créditos por serviço configurados.</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <p className="mt-3 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                                    {plan.description || 'Plano sem descrição cadastrada.'}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-white/10">
                                    <span className="material-symbols-outlined rounded-2xl border border-[#D8E8F3] bg-[#F1F8FC] p-3 text-3xl text-[#003366] dark:border-[#14304A] dark:bg-[#071426] dark:text-[#00D2FF]">
                                        workspace_premium
                                    </span>
                                    <p className="mt-4 text-base font-black text-slate-900 dark:text-white">Nenhum plano ativo</p>
                                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                                        Ative um plano do Clube para cadastrar novos assinantes.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Cliente</p>
                                    <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{selectedClient?.name || '-'}</p>
                                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{selectedClient?.phone || 'Telefone não cadastrado'}</p>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Plano</p>
                                    <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{selectedPlan?.name || '-'}</p>
                                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        {selectedPlan ? `${formatCurrency(selectedPlan.monthly_price)} por mês` : '-'}
                                    </p>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Próxima cobrança</p>
                                    <input
                                        type="date"
                                        value={nextBillingDate}
                                        onChange={(event) => setNextBillingDate(event.target.value)}
                                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none [color-scheme:light] focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/10 dark:border-white/10 dark:bg-card-dark dark:text-white dark:[color-scheme:dark]"
                                    />
                                </div>

                                <div className="rounded-xl border border-[#D8E8F3] bg-[#F1F8FC] p-4 dark:border-[#14304A] dark:bg-[#071426]">
                                    <p className="text-xs font-bold text-[#003366] dark:text-[#00D2FF]">Total de créditos iniciais</p>
                                    <p className="mt-2 text-3xl font-black text-[#E5A158]">{getTotalAvailableCredits(initialBalances)}</p>
                                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">Gerados pelo plano na ativação.</p>
                                </div>

                                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-sm font-black text-slate-900 dark:text-white">Créditos iniciais por serviço</p>
                                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                                Os créditos serão gerados pelo plano na ativação da assinatura.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        {initialBalances.length > 0 ? initialBalances.map((balance, index) => (
                                            <div
                                                key={`${balance.service_id}-${index}`}
                                                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-card-dark"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{balance.service_name}</p>
                                                </div>
                                                <span className="rounded-lg bg-[#E5A158]/15 px-3 py-1 text-sm font-black text-[#A16207] dark:text-[#FDE68A]">
                                                    {balance.available}
                                                </span>
                                            </div>
                                        )) : (
                                            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm font-medium text-slate-500 dark:border-white/10 dark:text-slate-400">
                                                Este plano ainda não possui créditos por serviço configurados.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                                    <label className="flex cursor-pointer items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={isLegacyMemberOnboarding}
                                            onChange={(event) => setIsLegacyMemberOnboarding(event.target.checked)}
                                            className="mt-1 size-4 rounded border-amber-300 text-[#E5A158] focus:ring-[#E5A158]"
                                        />
                                        <div>
                                            <p className="text-sm font-black text-slate-900 dark:text-white">Cliente já fazia parte do Clube no mês passado</p>
                                            <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                                                Use quando estiver trazendo um assinante recorrente para dentro do sistema no ciclo atual.
                                            </p>
                                        </div>
                                    </label>

                                    {isLegacyMemberOnboarding && (
                                        <div className="mt-3 rounded-xl border border-amber-200 bg-white/80 px-4 py-3 text-xs font-medium leading-5 text-slate-700 dark:border-amber-500/20 dark:bg-white/5 dark:text-slate-200">
                                            Depois de ativar a assinatura, use o fluxo de baixa administrativa nas comandas abertas desse cliente.
                                            Assim você fecha o legado sem duplicar receita e sem consumir os créditos atuais do plano.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {existingSubscription && (
                                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                                    <p className="text-sm font-black text-amber-900 dark:text-amber-100">Cliente já tem assinatura aberta</p>
                                    <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                                        Você pode trocar o plano atual e resetar os créditos por serviço para o plano selecionado.
                                    </p>
                                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                        <button
                                            onClick={replaceSubscriptionPlan}
                                            disabled={saving}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E5A158] px-4 py-3 text-sm font-black text-[#171717] transition-colors hover:bg-[#D97706] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <span className="material-symbols-outlined text-base">{saving ? 'progress_activity' : 'swap_horiz'}</span>
                                            Trocar plano
                                        </button>
                                        <button
                                            onClick={() => setExistingSubscription(null)}
                                            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                                        >
                                            Manter assinatura atual
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 p-4 dark:border-white/10 sm:flex-row md:p-5">
                    <button
                        disabled={step === 1 || saving}
                        onClick={() => setStep((current) => getPreviousStep(current))}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    >
                        Voltar
                    </button>

                    {step < 3 ? (
                        <button
                            onClick={advanceStep}
                            className="flex-1 rounded-xl bg-[#003366] px-4 py-3 text-sm font-black text-white transition-colors hover:bg-[#007BFF] focus:outline-none focus:ring-2 focus:ring-[#007BFF]/30 dark:bg-[#00D2FF] dark:text-[#06111F] dark:hover:bg-[#38DFFF]"
                        >
                            Avançar
                        </button>
                    ) : (
                        <button
                            onClick={handleConfirm}
                            disabled={saving || !selectedClient || !selectedPlan}
                            className="flex-1 rounded-xl bg-[#003366] px-4 py-3 text-sm font-black text-white transition-colors hover:bg-[#007BFF] focus:outline-none focus:ring-2 focus:ring-[#007BFF]/30 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#00D2FF] dark:text-[#06111F] dark:hover:bg-[#38DFFF]"
                        >
                            {saving ? 'Salvando...' : 'Confirmar cadastro'}
                        </button>
                    )}
                </div>
            </section>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default ChefClubSubscriptionNew;
