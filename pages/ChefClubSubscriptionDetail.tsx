import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getScopedClient } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { normalizePlanServiceCredits } from '../src/utils/chefClubCredits';
import type { ServiceBalanceEntry, ServiceCreditsEntry } from '../src/utils/chefClubCredits';

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

interface SubscriptionDetails {
    id: string;
    client_id: string;
    plan_id: string;
    status: 'active' | 'past_due' | 'canceled' | 'paused';
    started_at: string;
    cycle_start: string;
    cycle_end: string;
    next_billing_date: string;
    created_at: string;
    canceled_at?: string;
}

interface ClientInfo {
    id: string;
    name: string;
    phone: string;
}

interface CreditRecord {
    id: string;
    subscription_id: string;
    available_credits: number;
    used_credits: number;
    service_balance_map: ServiceBalanceEntry[];
    period_start: string;
    period_end?: string;
}

interface TransactionEntry {
    id: string;
    created_at: string;
    service_name: string;
    credits_used: number;
    appointment_id?: string;
    notes?: string;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(value);

const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
};

type EditTab = 'plan' | 'credits' | 'billing';

const ChefClubSubscriptionDetail: React.FC = () => {
    const { subscriptionId } = useParams<{ subscriptionId: string }>();
    const navigate = useNavigate();
    const { tenantId } = useAuth();
    const barberSupabase = getScopedClient('barber');

    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
    const [client, setClient] = useState<ClientInfo | null>(null);
    const [plan, setPlan] = useState<Plan | null>(null);
    const [credits, setCredits] = useState<CreditRecord | null>(null);
    const [transactions, setTransactions] = useState<TransactionEntry[]>([]);
    const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editTab, setEditTab] = useState<EditTab>('plan');
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [editCredits, setEditCredits] = useState<ServiceBalanceEntry[]>([]);
    const [nextBillingDate, setNextBillingDate] = useState('');
    const [saving, setSaving] = useState(false);

    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<'paused' | 'canceled' | 'active' | null>(null);

    const loadData = useCallback(async () => {
        if (!tenantId || !subscriptionId) return;

        setLoading(true);
        try {
            const [subRes, plansRes, creditsRes] = await Promise.all([
                barberSupabase
                    .from('customer_subscriptions')
                    .select('*')
                    .eq('id', subscriptionId)
                    .eq('tenant_id', tenantId)
                    .single(),
                barberSupabase
                    .from('customer_plans')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .eq('active', true)
                    .order('monthly_price', { ascending: true }),
                barberSupabase
                    .from('customer_credits')
                    .select('*')
                    .eq('subscription_id', subscriptionId)
                    .eq('tenant_id', tenantId)
                    .single(),
            ]);

            if (subRes.error) throw subRes.error;
            if (subRes.data) {
                setSubscription(subRes.data as SubscriptionDetails);

                const [clientRes] = await Promise.all([
                    import('../services/supabaseClient').then(m =>
                        m.supabase.from('clients').select('id, name, phone')
                            .eq('tenant_id', tenantId)
                            .eq('id', subRes.data.client_id)
                            .single()
                    ),
                ]);

                if (clientRes.data) setClient(clientRes.data as ClientInfo);

                if (plansRes.data) {
                    const plans = plansRes.data as Plan[];
                    setAvailablePlans(plans);
                    const currentPlan = plans.find(p => p.id === subRes.data.plan_id);
                    setPlan(currentPlan || null);
                    setSelectedPlanId(currentPlan?.id || '');
                }

                if (creditsRes.data) {
                    setCredits(creditsRes.data as CreditRecord);
                    const balanceMap = (creditsRes.data as CreditRecord).service_balance_map;
                    if (Array.isArray(balanceMap)) {
                        setEditCredits(balanceMap as ServiceBalanceEntry[]);
                    }
                }

                setNextBillingDate(subRes.data.next_billing_date || '');
            }
        } catch (err: any) {
            setToast({ message: `Erro ao carregar detalhes: ${err.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [tenantId, subscriptionId, barberSupabase]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleSaveChanges = async () => {
        if (!tenantId || !subscriptionId) return;

        setSaving(true);
        try {
            if (editTab === 'plan' && selectedPlanId !== subscription?.plan_id) {
                const { error } = await barberSupabase
                    .from('customer_subscriptions')
                    .update({ plan_id: selectedPlanId })
                    .eq('id', subscriptionId)
                    .eq('tenant_id', tenantId);

                if (error) throw error;
                setToast({ message: 'Plano atualizado com sucesso!', type: 'success' });
            }

            if (editTab === 'credits') {
                const { error } = await barberSupabase
                    .from('customer_credits')
                    .update({
                        service_balance_map: editCredits,
                        available_credits: editCredits.reduce((sum, c) => sum + (c.available || 0), 0),
                    })
                    .eq('subscription_id', subscriptionId)
                    .eq('tenant_id', tenantId);

                if (error) throw error;
                setToast({ message: 'Créditos ajustados com sucesso!', type: 'success' });
            }

            if (editTab === 'billing' && nextBillingDate) {
                const cycleEnd = new Date(nextBillingDate);
                cycleEnd.setDate(cycleEnd.getDate() + 30);

                const { error } = await barberSupabase
                    .from('customer_subscriptions')
                    .update({
                        next_billing_date: nextBillingDate,
                        cycle_end: cycleEnd.toISOString(),
                    })
                    .eq('id', subscriptionId)
                    .eq('tenant_id', tenantId);

                if (error) throw error;
                setToast({ message: 'Data de cobrança atualizada!', type: 'success' });
            }

            setEditModalOpen(false);
            void loadData();
        } catch (err: any) {
            setToast({ message: `Erro ao salvar: ${err.message}`, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async () => {
        if (!tenantId || !subscriptionId || !pendingStatus) return;

        setSaving(true);
        try {
            const updateData: Record<string, unknown> = { status: pendingStatus };
            if (pendingStatus === 'canceled') {
                updateData.canceled_at = new Date().toISOString();
            }

            const { error } = await barberSupabase
                .from('customer_subscriptions')
                .update(updateData)
                .eq('id', subscriptionId)
                .eq('tenant_id', tenantId);

            if (error) throw error;

            const statusLabels = { active: 'reativada', paused: 'pausada', canceled: 'cancelada' };
            setToast({ message: `Assinatura ${statusLabels[pendingStatus]} com sucesso!`, type: 'success' });
            setStatusModalOpen(false);
            void loadData();
        } catch (err: any) {
            setToast({ message: `Erro ao atualizar: ${err.message}`, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const openEditModal = (tab: EditTab) => {
        setEditTab(tab);
        setEditModalOpen(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!subscription) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-center">
                    <p className="font-bold">Assinatura não encontrada</p>
                    <button onClick={() => navigate('/chef-club-subscriptions')} className="mt-2 text-sm underline">
                        Voltar para Assinaturas
                    </button>
                </div>
            </div>
        );
    }

    const planServices = plan ? normalizePlanServiceCredits(plan.service_credit_map, plan.service_credits) : [];
    const totalAvailable = credits?.available_credits || 0;
    const totalUsed = credits?.used_credits || 0;

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/chef-club-subscriptions')} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                        <span className="material-symbols-outlined text-slate-500">arrow_back</span>
                    </button>
                    <div className="size-14 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                        <span className="material-symbols-outlined text-amber-500 text-3xl">workspace_premium</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{client?.name || 'Assinante'}</h2>
                        <p className="text-slate-500 text-sm font-medium">Detalhes da Assinatura</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setPendingStatus(subscription.status === 'active' ? 'paused' : 'active'); setStatusModalOpen(true); }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            subscription.status === 'active'
                                ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                        }`}
                    >
                        <span className="material-symbols-outlined text-sm mr-1">{subscription.status === 'active' ? 'pause' : 'play_arrow'}</span>
                        {subscription.status === 'active' ? 'Pausar' : 'Reativar'}
                    </button>
                    {subscription.status !== 'canceled' && (
                        <button
                            onClick={() => { setPendingStatus('canceled'); setStatusModalOpen(true); }}
                            className="px-4 py-2 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 text-sm font-bold transition-all"
                        >
                            <span className="material-symbols-outlined text-sm mr-1">cancel</span>
                            Cancelar
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</p>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            subscription.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' :
                            subscription.status === 'past_due' ? 'bg-amber-500/10 text-amber-500' :
                            subscription.status === 'paused' ? 'bg-slate-500/10 text-slate-500' :
                            'bg-red-500/10 text-red-500'
                        }`}>
                            {subscription.status === 'active' ? 'Ativo' :
                             subscription.status === 'past_due' ? 'Atrasado' :
                             subscription.status === 'paused' ? 'Pausado' : 'Cancelado'}
                        </span>
                    </div>
                    <h3 className="text-xl font-black text-primary">{plan?.name || 'Plano não encontrado'}</h3>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {formatCurrency(plan?.monthly_price || 0)}<span className="text-xs text-slate-500 font-bold">/mês</span>
                    </p>
                </div>

                <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Créditos Atuais</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-amber-500">{totalAvailable}</span>
                        <span className="text-sm text-slate-500 font-bold">disponíveis</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">{totalUsed} créditos consumidos neste ciclo</p>
                    <button onClick={() => openEditModal('credits')} className="mt-3 text-xs text-primary font-bold uppercase tracking-widest hover:underline">
                        Ajustar Créditos
                    </button>
                </div>

                <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Próxima Cobrança</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{formatDate(subscription.next_billing_date)}</p>
                    <button onClick={() => openEditModal('billing')} className="mt-3 text-xs text-primary font-bold uppercase tracking-widest hover:underline">
                        Ajustar Data
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 dark:text-white">Créditos por Serviço</h3>
                    <button onClick={() => openEditModal('plan')} className="text-xs text-primary font-bold uppercase tracking-widest hover:underline">
                        Trocar Plano
                    </button>
                </div>
                <div className="p-6">
                    {planServices.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {planServices.map((entry) => {
                                const balance = credits?.service_balance_map?.find((b: ServiceBalanceEntry) => b.service_id === entry.service_id);
                                return (
                                    <div key={entry.service_id || entry.service_name} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">{entry.service_name}</p>
                                            <p className="text-xs text-slate-500 mt-1">{entry.credits} créditos/cycle no plano</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-black text-amber-500">{balance?.available ?? entry.credits}</p>
                                            <p className="text-[10px] text-slate-500">disponíveis</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm text-center py-8">Nenhum crédito configurado neste plano.</p>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5">
                    <h3 className="font-bold text-slate-900 dark:text-white">Informações da Assinatura</h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Cliente</p>
                        <p className="font-bold text-slate-900 dark:text-white">{client?.name || 'N/A'}</p>
                        <p className="text-sm text-slate-500">{client?.phone || 'Sem telefone'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Início da Assinatura</p>
                        <p className="font-bold text-slate-900 dark:text-white">{formatDate(subscription.started_at)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Ciclo Atual</p>
                        <p className="font-bold text-slate-900 dark:text-white">{formatDate(subscription.cycle_start)} — {formatDate(subscription.cycle_end)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Criado em</p>
                        <p className="font-bold text-slate-900 dark:text-white">{formatDate(subscription.created_at)}</p>
                    </div>
                </div>
            </div>

            <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Ajustar Assinatura" maxWidth="md">
                <div className="space-y-4">
                    <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                        {(['plan', 'credits', 'billing'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setEditTab(tab)}
                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                    editTab === tab ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
                                }`}
                            >
                                {tab === 'plan' ? 'Plano' : tab === 'credits' ? 'Créditos' : 'Cobrança'}
                            </button>
                        ))}
                    </div>

                    {editTab === 'plan' && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-500">Selecione um novo plano para este assinante.</p>
                            {availablePlans.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPlanId(p.id)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                                        selectedPlanId === p.id
                                            ? 'border-primary bg-primary/5'
                                            : 'border-slate-200 dark:border-white/10 hover:border-primary/40'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                                            <p className="text-xs text-slate-500 mt-1">{p.description || 'Sem descrição'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-primary">{formatCurrency(p.monthly_price)}/mês</p>
                                            {selectedPlanId === p.id && <span className="material-symbols-outlined text-primary">check_circle</span>}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {editTab === 'credits' && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-500">Ajuste manualmente os créditos disponíveis por serviço.</p>
                            {editCredits.length > 0 ? editCredits.map((balance, index) => (
                                <div key={`${balance.serviceId}-${index}`} className="grid grid-cols-[1fr_100px] gap-3 items-end">
                                    <div>
                                        <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Serviço</label>
                                        <div className="rounded-lg border border-slate-200 dark:border-border-dark px-3 py-2 text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-background-dark">
                                            {balance.serviceName}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Disponíveis</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={balance.available}
                                            onChange={(e) => {
                                                const next = [...editCredits];
                                                next[index] = { ...next[index], available: Math.max(0, Number(e.target.value) || 0) };
                                                setEditCredits(next);
                                            }}
                                            className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm font-bold text-amber-600 outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                            )) : (
                                <p className="text-center text-slate-500 py-4">Nenhum crédito para ajustar.</p>
                            )}
                        </div>
                    )}

                    {editTab === 'billing' && (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-500">Ajuste a próxima data de cobrança.</p>
                            <div>
                                <label className="text-[10px] uppercase font-black text-slate-500 mb-1 block">Próxima Cobrança</label>
                                <input
                                    type="date"
                                    value={nextBillingDate}
                                    onChange={(e) => setNextBillingDate(e.target.value)}
                                    className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                        <button onClick={() => setEditModalOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-sm">
                            Cancelar
                        </button>
                        <button onClick={handleSaveChanges} disabled={saving} className="flex-1 py-3 rounded-xl bg-primary text-white font-black uppercase tracking-widest text-sm disabled:opacity-50">
                            {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={statusModalOpen} onClose={() => setStatusModalOpen(false)} title="Confirmar Ação" maxWidth="sm">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        {pendingStatus === 'active' && 'Tem certeza que deseja reativar esta assinatura?'}
                        {pendingStatus === 'paused' && 'Tem certeza que deseja pausar esta assinatura? O cliente perderá o acesso aos benefícios.'}
                        {pendingStatus === 'canceled' && 'Tem certeza que deseja cancelar esta assinatura? Esta ação não pode ser desfeita.'}
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setStatusModalOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold text-sm">
                            Voltar
                        </button>
                        <button onClick={handleStatusChange} disabled={saving} className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-sm text-white disabled:opacity-50 ${
                            pendingStatus === 'canceled' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-blue-600'
                        }`}>
                            {saving ? 'Aguarde...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default ChefClubSubscriptionDetail;
