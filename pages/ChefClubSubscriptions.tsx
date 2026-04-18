import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getScopedClient, supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import {
    type ServiceBalanceEntry,
    normalizeCreditBalances,
    normalizePlanServiceCredits,
} from '../src/utils/chefClubCredits';

interface Subscription {
    id: string;
    client: { name: string; phone: string };
    plan: { name: string; service_credits: number; service_credit_map?: unknown };
    status: 'active' | 'past_due' | 'canceled' | 'paused';
    cycle_end: string;
    next_billing_date: string;
    available_credits: number;
    service_balances: ServiceBalanceEntry[];
}

const ChefClubSubscriptions: React.FC = () => {
    const { tenantId } = useAuth();
    const barberSupabase = getScopedClient('barber');
    const location = useLocation();
    const navigate = useNavigate();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchSubscriptions = async () => {
        if (!tenantId) {
            setSubscriptions([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const { data, error } = await barberSupabase
            .from('customer_subscriptions')
            .select('id, status, cycle_end, next_billing_date, client_id, plan_id')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao carregar assinaturas:', error);
            setToast({ message: `Erro ao carregar assinaturas: ${error.message}`, type: 'error' });
            setLoading(false);
            return;
        }

        const rawSubscriptions = data || [];
        const clientIds = Array.from(new Set(rawSubscriptions.map((subscription: any) => subscription.client_id).filter(Boolean)));
        const planIds = Array.from(new Set(rawSubscriptions.map((subscription: any) => subscription.plan_id).filter(Boolean)));
        const subscriptionIds = Array.from(new Set(rawSubscriptions.map((subscription: any) => subscription.id).filter(Boolean)));

        const [clientsRes, plansRes, creditsRes] = await Promise.all([
            clientIds.length > 0
                ? supabase.from('clients').select('id, name, phone').eq('tenant_id', tenantId).in('id', clientIds)
                : Promise.resolve({ data: [], error: null }),
            planIds.length > 0
                ? barberSupabase
                    .from('customer_plans')
                    .select('id, name, service_credits, service_credit_map')
                    .eq('tenant_id', tenantId)
                    .in('id', planIds)
                : Promise.resolve({ data: [], error: null }),
            subscriptionIds.length > 0
                ? barberSupabase
                    .from('customer_credits')
                    .select('subscription_id, available_credits, used_credits, service_balance_map')
                    .eq('tenant_id', tenantId)
                    .in('subscription_id', subscriptionIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

        if (clientsRes.error || plansRes.error || creditsRes.error) {
            const details = [clientsRes.error, plansRes.error, creditsRes.error].filter(Boolean);
            console.error('Erro ao resolver dados das assinaturas:', details);
            setToast({ message: 'Erro ao resolver dados complementares das assinaturas.', type: 'error' });
            setLoading(false);
            return;
        }

        const clientsMap = new Map((clientsRes.data || []).map((client: any) => [client.id, client]));
        const plansMap = new Map((plansRes.data || []).map((plan: any) => [plan.id, plan]));
        const creditsMap = new Map((creditsRes.data || []).map((credit: any) => [credit.subscription_id, credit]));

        const formatted: Subscription[] = rawSubscriptions.map((subscription: any) => {
            const creditRecord = creditsMap.get(subscription.id);
            return {
                id: subscription.id,
                client: clientsMap.get(subscription.client_id) || { name: 'Cliente nao encontrado', phone: '' },
                plan: plansMap.get(subscription.plan_id) || { name: 'Plano nao encontrado', service_credits: 0, service_credit_map: [] },
                status: subscription.status || 'active',
                cycle_end: subscription.cycle_end || '',
                next_billing_date: subscription.next_billing_date || '',
                available_credits: creditRecord?.available_credits || 0,
                service_balances: normalizeCreditBalances(
                    creditRecord?.service_balance_map,
                    creditRecord?.available_credits || 0,
                    creditRecord?.used_credits || 0,
                ),
            };
        });

        setSubscriptions(formatted);
        setLoading(false);
    };

    useEffect(() => {
        void fetchSubscriptions();
    }, [tenantId]);

    useEffect(() => {
        const stateToast = (location.state as any)?.toast;
        if (stateToast?.message) {
            setToast(stateToast);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    const filtered = subscriptions.filter((subscription) => {
        const matchesSearch =
            subscription.client.name.toLowerCase().includes(search.toLowerCase()) ||
            subscription.client.phone.includes(search);
        const matchesStatus = statusFilter === 'all' || subscription.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-emerald-500/10 text-emerald-500';
            case 'past_due':
                return 'bg-amber-500/10 text-amber-500';
            case 'canceled':
                return 'bg-red-500/10 text-red-500';
            default:
                return 'bg-slate-500/10 text-slate-500';
        }
    };

    const translateStatus = (status: string) => {
        switch (status) {
            case 'active':
                return 'Ativo';
            case 'past_due':
                return 'Atrasado';
            case 'canceled':
                return 'Cancelado';
            case 'paused':
                return 'Pausado';
            default:
                return status;
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                        <span className="material-symbols-outlined text-primary text-3xl">group</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Assinantes do Clube</h2>
                        <p className="text-slate-500 text-sm font-medium">Controle de membros e saldo de creditos por servico</p>
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

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome ou telefone..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        title="Buscar Assinante"
                        className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                    />
                </div>
                <div className="flex gap-2">
                    {['all', 'active', 'past_due'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === status ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-card-dark text-slate-500 border border-slate-200 dark:border-white/10'}`}
                        >
                            {status === 'all' ? 'Todos' : translateStatus(status)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Cliente</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Plano</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Creditos</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Prox. Cobranca</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Acoes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {filtered.map((subscription) => {
                                const planServices = normalizePlanServiceCredits(
                                    subscription.plan.service_credit_map,
                                    subscription.plan.service_credits,
                                );

                                return (
                                    <tr key={subscription.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-900 dark:text-white uppercase">{subscription.client.name}</span>
                                                <span className="text-[10px] text-slate-500 font-bold">{subscription.client.phone}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-primary">{subscription.plan.name}</span>
                                            <div className="mt-2 space-y-1">
                                                {planServices.map((entry) => (
                                                    <div key={`${subscription.id}-${entry.service_id || entry.service_name}`} className="text-[10px] font-bold text-slate-500">
                                                        {entry.service_name}: {entry.credits}/ciclo
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full">
                                                <span className="material-symbols-outlined text-sm">workspace_premium</span>
                                                <span className="text-sm font-black">{subscription.available_credits}</span>
                                            </div>
                                            <div className="mt-2 space-y-1">
                                                {subscription.service_balances.map((balance) => (
                                                    <div key={`${subscription.id}-${balance.service_id || balance.service_name}`} className="text-[10px] font-bold text-slate-500">
                                                        {balance.service_name}: {balance.available}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusStyle(subscription.status)}`}>
                                                {translateStatus(subscription.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-500 font-bold">
                                                {new Date(subscription.next_billing_date).toLocaleDateString('pt-BR')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 text-slate-400 hover:text-primary transition-colors" title="Ver Detalhes">
                                                <span className="material-symbols-outlined">visibility</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
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
