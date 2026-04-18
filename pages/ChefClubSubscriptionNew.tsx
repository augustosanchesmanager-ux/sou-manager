import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getScopedClient, supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
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
}

const toDateOnly = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const cloneBalances = (balances: ServiceBalanceEntry[]) =>
    balances.map((balance) => ({ ...balance }));

const ChefClubSubscriptionNew: React.FC = () => {
    const { tenantId } = useAuth();
    const barberSupabase = getScopedClient('barber');
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

    const from = searchParams.get('from');
    const preselectedClientId = searchParams.get('clientId');

    useEffect(() => {
        const loadData = async () => {
            if (!tenantId) {
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
    const selectedPlanBalances = useMemo(
        () => buildServiceBalancesFromPlan(normalizePlanServiceCredits(selectedPlan?.service_credit_map, selectedPlan?.service_credits || 0)),
        [selectedPlan],
    );

    const today = new Date();
    const nextBilling = new Date(today);
    nextBilling.setDate(nextBilling.getDate() + 30);
    const [nextBillingDate, setNextBillingDate] = useState(toDateOnly(nextBilling));
    const [initialBalances, setInitialBalances] = useState<ServiceBalanceEntry[]>([]);

    useEffect(() => {
        setInitialBalances(cloneBalances(selectedPlanBalances));
    }, [selectedPlanBalances]);

    const applyCreditsForSubscription = async (
        subscriptionId: string,
        clientId: string,
        balances: ServiceBalanceEntry[],
    ) => {
        const sanitizedBalances = balances
            .map((balance) => ({
                service_id: balance.service_id,
                service_name: balance.service_name,
                available: Math.max(0, Number(balance.available) || 0),
                used: Math.max(0, Number(balance.used) || 0),
            }))
            .filter((balance) => balance.service_id && balance.service_name && (balance.available > 0 || balance.used > 0));

        const { error } = await barberSupabase
            .from('customer_credits')
            .upsert(
                {
                    subscription_id: subscriptionId,
                    tenant_id: tenantId,
                    client_id: clientId,
                    available_credits: getTotalAvailableCredits(sanitizedBalances),
                    used_credits: sanitizedBalances.reduce((total, balance) => total + balance.used, 0),
                    service_balance_map: sanitizedBalances,
                    period_start: today.toISOString(),
                    period_end: null,
                },
                { onConflict: 'subscription_id' },
            );

        return error;
    };

    const createSubscription = async () => {
        if (!tenantId || !selectedClient || !selectedPlan) return;
        const billingDate = new Date(`${nextBillingDate}T12:00:00`);

        const { data, error } = await barberSupabase
            .from('customer_subscriptions')
            .insert({
                tenant_id: tenantId,
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
            setToast({ message: `Erro ao criar assinatura: ${error?.message || 'desconhecido'}`, type: 'error' });
            return;
        }

        const creditsError = await applyCreditsForSubscription(data.id, selectedClient.id, initialBalances);
        if (creditsError) {
            setToast({ message: `Assinatura criada, mas houve erro ao lancar creditos: ${creditsError.message}`, type: 'error' });
            return;
        }

        navigate('/chef-club-subscriptions', {
            state: {
                toast: {
                    message: `Assinatura de ${selectedClient.name} criada com sucesso!`,
                    type: 'success',
                },
            },
        });
    };

    const replaceSubscriptionPlan = async () => {
        if (!tenantId || !selectedClient || !selectedPlan || !existingSubscription) return;
        const billingDate = new Date(`${nextBillingDate}T12:00:00`);

        if (existingSubscription.plan_id === selectedPlan.id) {
            setToast({ message: 'Este cliente ja esta ativo neste plano.', type: 'info' });
            return;
        }

        const { error } = await barberSupabase
            .from('customer_subscriptions')
            .update({
                plan_id: selectedPlan.id,
                status: 'active',
                cycle_start: today.toISOString(),
                cycle_end: billingDate.toISOString(),
                next_billing_date: nextBillingDate,
            })
            .eq('id', existingSubscription.id)
            .eq('tenant_id', tenantId);

        if (error) {
            setToast({ message: `Erro ao trocar plano: ${error.message}`, type: 'error' });
            return;
        }

        const creditsError = await applyCreditsForSubscription(existingSubscription.id, selectedClient.id, initialBalances);
        if (creditsError) {
            setToast({ message: `Plano trocado, mas houve erro ao atualizar creditos: ${creditsError.message}`, type: 'error' });
            return;
        }

        navigate('/chef-club-subscriptions', {
            state: {
                toast: {
                    message: `Plano de ${selectedClient.name} atualizado com sucesso!`,
                    type: 'success',
                },
            },
        });
    };

    const handleConfirm = async () => {
        if (!tenantId || !selectedClient || !selectedPlan) return;

        if (!nextBillingDate) {
            setToast({ message: 'Defina a proxima cobranca antes de confirmar.', type: 'info' });
            return;
        }

        if (initialBalances.length === 0 || getTotalAvailableCredits(initialBalances) <= 0) {
            setToast({ message: 'Configure ao menos um credito inicial por servico.', type: 'info' });
            return;
        }

        setSaving(true);
        setExistingSubscription(null);

        const { data: activeSub, error: activeSubError } = await barberSupabase
            .from('customer_subscriptions')
            .select('id, plan_id')
            .eq('tenant_id', tenantId)
            .eq('client_id', selectedClient.id)
            .eq('status', 'active')
            .maybeSingle();

        if (activeSubError) {
            setSaving(false);
            setToast({ message: `Erro ao validar assinatura existente: ${activeSubError.message}`, type: 'error' });
            return;
        }

        if (activeSub?.id) {
            setExistingSubscription(activeSub as ExistingSubscription);
            setSaving(false);
            setToast({ message: 'Cliente ja possui assinatura ativa. Voce pode trocar o plano.', type: 'info' });
            return;
        }

        await createSubscription();
        setSaving(false);
    };

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
                    {[1, 2, 3].map((currentStep) => (
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
                                onChange={(e) => setClientSearch(e.target.value)}
                                placeholder="Buscar cliente por nome ou telefone..."
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-3 pl-10 pr-4 text-sm outline-none"
                            />
                        </div>

                        <div className="max-h-[340px] overflow-auto custom-scrollbar border border-slate-200 dark:border-border-dark rounded-xl">
                            {filteredClients.map((client) => (
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
                            {plans.map((plan) => {
                                const serviceCredits = normalizePlanServiceCredits(plan.service_credit_map, plan.service_credits);
                                return (
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
                                        <p className="text-sm font-bold text-primary mt-1">R$ {Number(plan.monthly_price || 0).toFixed(2)}/mes</p>
                                        <div className="mt-3 space-y-1">
                                            {serviceCredits.map((entry) => (
                                                <p key={`${plan.id}-${entry.service_id || entry.service_name}`} className="text-xs font-bold text-amber-600">
                                                    {entry.service_name}: {entry.credits} credito(s)
                                                </p>
                                            ))}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">{plan.description || 'Sem descricao.'}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">3. Confirmacao</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                                <p className="text-[10px] uppercase font-black text-slate-500">Cliente</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{selectedClient?.name || '-'}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                                <p className="text-[10px] uppercase font-black text-slate-500">Plano</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{selectedPlan?.name || '-'}</p>
                            </div>
                            <div className="md:col-span-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                                <div className="flex items-center justify-between gap-4 mb-3">
                                    <div>
                                        <p className="text-[10px] uppercase font-black text-slate-500">Creditos Iniciais por Servico</p>
                                        <p className="text-xs text-slate-500 mt-1">Voce pode ajustar antes de ativar a assinatura.</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-amber-600">{getTotalAvailableCredits(initialBalances)}</p>
                                        <p className="text-[10px] uppercase font-black text-slate-400">Total</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {initialBalances.length > 0 ? initialBalances.map((balance, index) => (
                                        <div key={`${balance.service_id}-${index}`} className="grid grid-cols-[1fr_120px] gap-3 items-end">
                                            <div>
                                                <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Servico</label>
                                                <div className="rounded-lg border border-slate-200 dark:border-border-dark px-3 py-2 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-background-dark">
                                                    {balance.service_name}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Creditos</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={balance.available}
                                                    onChange={(e) => {
                                                        const nextValue = Math.max(0, Number(e.target.value) || 0);
                                                        setInitialBalances((current) => current.map((item, itemIndex) => (
                                                            itemIndex === index ? { ...item, available: nextValue } : item
                                                        )));
                                                    }}
                                                    className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm font-bold text-amber-600 outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/10 p-4 text-sm text-slate-500 text-center">
                                            Este plano ainda nao possui creditos por servico configurados.
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4">
                                <p className="text-[10px] uppercase font-black text-slate-500">Proxima Cobranca</p>
                                <input
                                    type="date"
                                    value={nextBillingDate}
                                    onChange={(e) => setNextBillingDate(e.target.value)}
                                    className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm font-bold text-slate-900 dark:text-white mt-2 outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>

                        {existingSubscription && (
                            <div className="border border-amber-400/40 bg-amber-500/10 rounded-xl p-4">
                                <p className="text-xs font-black uppercase text-amber-600">Cliente ja tem assinatura ativa</p>
                                <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                                    Voce pode trocar o plano atual e resetar os creditos por servico para o plano selecionado.
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
                        onClick={() => setStep((current) => Math.max(1, (current - 1) as 1 | 2 | 3))}
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-sm disabled:opacity-60"
                    >
                        Voltar
                    </button>

                    {step < 3 ? (
                        <button
                            onClick={() => {
                                if (step === 1 && !selectedClientId) {
                                    setToast({ message: 'Selecione um cliente para avancar.', type: 'info' });
                                    return;
                                }
                                if (step === 2 && !selectedPlanId) {
                                    setToast({ message: 'Selecione um plano para avancar.', type: 'info' });
                                    return;
                                }
                                setStep((current) => Math.min(3, (current + 1) as 1 | 2 | 3));
                            }}
                            className="flex-1 py-3 rounded-xl bg-primary text-white font-black uppercase tracking-wider text-sm"
                        >
                            Avancar
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
