import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Toast from '@/components/Toast';

interface Subscription {
    id: string;
    client: { name: string; phone: string };
    plan: { name: string; service_credits: number };
    status: 'active' | 'past_due' | 'canceled' | 'paused';
    cycle_end: string;
    next_billing_date: string;
    available_credits: number;
    balances: Array<{ benefit_label: string; available_credits: number }>;
}

interface SubscriptionQueryRow {
    id: string;
    status: Subscription['status'];
    cycle_end: string;
    next_billing_date: string;
    client_id: string;
    plan_id: string;
}

const ChefClubSubscriptions: React.FC = () => {
    const { tenantId, requireModuleAccess, isModuleEnabledForTenant } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const chefClubEnabled = isModuleEnabledForTenant('chef_club');

    const fetchSubscriptions = useCallback(async () => {
        if (!tenantId || !chefClubEnabled) {
            setSubscriptions([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { tenantId: resolvedTenantId, client } = requireModuleAccess(
                'chef_club',
                'customer_subscriptions',
                'load chef club subscriptions',
            );
            const { data, error } = await client
                .from('customer_subscriptions')
                .select('id, status, cycle_end, next_billing_date, client_id, plan_id')
                .eq('tenant_id', resolvedTenantId)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            const subscriptionsData = (data || []) as SubscriptionQueryRow[];
            const clientIds = Array.from(new Set(subscriptionsData.map((subscription) => subscription.client_id).filter(Boolean)));
            const planIds = Array.from(new Set(subscriptionsData.map((subscription) => subscription.plan_id).filter(Boolean)));
            const subscriptionIds = subscriptionsData.map((subscription) => subscription.id);

            const [clientsRes, plansRes, creditsRes] = await Promise.all([
                clientIds.length > 0
                    ? client
                        .from('clients')
                        .select('id, name, phone')
                        .eq('tenant_id', resolvedTenantId)
                        .in('id', clientIds)
                    : Promise.resolve({ data: [], error: null }),
                planIds.length > 0
                    ? client
                        .from('customer_plans')
                        .select('id, name, service_credits')
                        .eq('tenant_id', resolvedTenantId)
                        .in('id', planIds)
                    : Promise.resolve({ data: [], error: null }),
                subscriptionIds.length > 0
                    ? client
                        .from('customer_credits')
                        .select('subscription_id, benefit_label, available_credits')
                        .eq('tenant_id', resolvedTenantId)
                        .in('subscription_id', subscriptionIds)
                    : Promise.resolve({ data: [], error: null }),
            ]);

            if (clientsRes.error) throw clientsRes.error;
            if (plansRes.error) throw plansRes.error;
            if (creditsRes.error) throw creditsRes.error;

            const clientsById = new Map(
                ((clientsRes.data || []) as Array<{ id: string; name: string; phone: string }>).map((clientRow) => [clientRow.id, clientRow]),
            );
            const plansById = new Map(
                ((plansRes.data || []) as Array<{ id: string; name: string; service_credits: number }>).map((planRow) => [planRow.id, planRow]),
            );
            const creditsBySubscriptionId = ((creditsRes.data || []) as Array<{
                subscription_id: string;
                benefit_label: string;
                available_credits: number | null;
            }>).reduce<Record<string, Array<{ benefit_label: string; available_credits: number | null }>>>((acc, creditRow) => {
                if (!acc[creditRow.subscription_id]) {
                    acc[creditRow.subscription_id] = [];
                }
                acc[creditRow.subscription_id].push(creditRow);
                return acc;
            }, {});

            const formatted: Subscription[] = subscriptionsData.map((subscription) => {
                const clientRelation = clientsById.get(subscription.client_id);
                const planRelation = plansById.get(subscription.plan_id);
                const subscriptionCredits = creditsBySubscriptionId[subscription.id] || [];

                return {
                    id: subscription.id,
                    client: clientRelation || { name: 'Cliente sem nome', phone: '' },
                    plan: planRelation || { name: 'Plano nao encontrado', service_credits: 0 },
                    status: subscription.status,
                    cycle_end: subscription.cycle_end,
                    next_billing_date: subscription.next_billing_date,
                    available_credits: subscriptionCredits.reduce((acc, credit) => acc + (Number(credit.available_credits) || 0), 0),
                    balances: subscriptionCredits.map((credit) => ({
                        benefit_label: credit.benefit_label || 'Beneficio',
                        available_credits: Number(credit.available_credits) || 0,
                    })),
                };
            });
            setSubscriptions(formatted);
        } catch (error) {
            console.error('Error loading chef club subscriptions:', error);
            setToast({ message: 'Erro ao carregar assinaturas.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [chefClubEnabled, requireModuleAccess, tenantId]);

    useEffect(() => {
        void fetchSubscriptions();
    }, [fetchSubscriptions]);

    useEffect(() => {
        const stateToast = (location.state as any)?.toast;
        if (stateToast?.message) {
            setToast(stateToast);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    const filtered = subscriptions.filter(s => {
        const matchesSearch = s.client.name.toLowerCase().includes(search.toLowerCase()) || s.client.phone.includes(search);
        const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'active': return 'bg-emerald-500/10 text-emerald-500';
            case 'past_due': return 'bg-amber-500/10 text-amber-500';
            case 'canceled': return 'bg-red-500/10 text-red-500';
            default: return 'bg-slate-500/10 text-slate-500';
        }
    };

    const translateStatus = (status: string) => {
        switch (status) {
            case 'active': return 'Ativo';
            case 'past_due': return 'Atrasado';
            case 'canceled': return 'Cancelado';
            case 'paused': return 'Pausado';
            default: return status;
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

    return (
        <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                        <span className="material-symbols-outlined text-primary text-3xl">group</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Assinantes do Clube</h2>
                        <p className="text-slate-500 text-sm font-medium">Controle de membros e saldo de créditos</p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/chef-club-subscriptions/new?from=subscriptions')}
                    className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-blue-600 shadow-xl shadow-primary/20 transition-all"
                >
                    <span className="material-symbols-outlined">person_add</span>
                    Novo Assinante
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome ou telefone..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        title="Buscar Assinante"
                        className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                    />
                </div>
                <div className="flex gap-2">
                    {['all', 'active', 'past_due'].map(st => (
                        <button
                            key={st}
                            onClick={() => setStatusFilter(st)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === st ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-card-dark text-slate-500 border border-slate-200 dark:border-white/10'}`}
                        >
                            {st === 'all' ? 'Todos' : translateStatus(st)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-card-dark rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Cliente</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Plano</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Créditos</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Próx. Cobrança</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {filtered.map((sub) => (
                                <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-slate-900 dark:text-white uppercase">{sub.client.name}</span>
                                            <span className="text-[10px] text-slate-500 font-bold">{sub.client.phone}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-bold text-primary">{sub.plan.name}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full">
                                            <span className="material-symbols-outlined text-sm">content_cut</span>
                                            <span className="text-sm font-black">{sub.available_credits}</span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1 justify-center">
                                            {sub.balances.slice(0, 3).map((balance) => (
                                                <span key={balance.benefit_label} className="rounded-full bg-slate-100 dark:bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                                    {balance.benefit_label}: {balance.available_credits}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusStyle(sub.status)}`}>
                                            {translateStatus(sub.status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-slate-500 font-bold">
                                            {new Date(sub.next_billing_date).toLocaleDateString('pt-BR')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-2 text-slate-400 hover:text-primary transition-colors" title="Ver Detalhes">
                                            <span className="material-symbols-outlined">visibility</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhum assinante encontrado</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default ChefClubSubscriptions;
