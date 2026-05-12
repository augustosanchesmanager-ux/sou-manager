import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarRange, FileText, Package, Users, Wallet } from 'lucide-react';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import EmptyStateFinance from '../components/financial/EmptyStateFinance';
import { useAuth } from '../context/AuthContext';
import { supabase, getScopedClient } from '../services/supabaseClient';

type ARSource = 'comanda' | 'clube' | 'recibo';
type ARStatus = 'pending' | 'overdue' | 'open' | 'Pendente';

interface AREntry {
    id: string;
    source: ARSource;
    clientName: string;
    description: string;
    dateValue: string;
    amount: number;
    status: ARStatus | string;
    originPath: string;
}

interface ComandaRecord {
    id: string;
    client_id: string;
    status: string;
    total: number;
    created_at: string;
    clients: { name: string } | { name: string }[];
}

interface ClubReceivableRecord {
    id: string;
    customer_id: string;
    subscription_id: string;
    plan_id: string;
    due_date: string;
    amount: number;
    status: string;
}

interface ReceiptRecord {
    id: string;
    number: string;
    date: string;
    type: string;
    name: string;
    amount: number;
    paymentMethod: string;
    status: string;
}

type ActiveTab = 'todos' | 'comandas' | 'clube' | 'recibos';

const AccountsReceivable: React.FC = () => {
    const { tenantId } = useAuth();
    const hasTenantContext = Boolean(tenantId);
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<ActiveTab>('todos');
    const [filterMonth, setFilterMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [loading, setLoading] = useState(true);

    const [openComandas, setOpenComandas] = useState<ComandaRecord[]>([]);
    const [markingPaid, setMarkingPaid] = useState<string | null>(null);
    const [clubReceivables, setClubReceivables] = useState<ClubReceivableRecord[]>([]);
    const [pendingReceipts, setPendingReceipts] = useState<ReceiptRecord[]>([]);

    const [clubClients, setClubClients] = useState<Record<string, { name: string }>>({});
    const [clubPlans, setClubPlans] = useState<Record<string, { name: string }>>({});

    const fetchData = useCallback(async () => {
        if (!tenantId || !filterMonth) {
            setOpenComandas([]);
            setClubReceivables([]);
            setPendingReceipts([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const [yearStr, monthStr] = filterMonth.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        const startOfMonth = new Date(year, month - 1, 1).toISOString();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

        const barberSupabase = getScopedClient('barber');

        try {
            const [
                comandasResult,
                clubResult,
                transactionsResult,
            ] = await Promise.all([
                barberSupabase
                    .from('comandas')
                    .select('id, client_id, status, total, created_at, clients(name)')
                    .eq('tenant_id', tenantId)
                    .eq('status', 'open'),
                barberSupabase.rpc('generate_club_receivables', { p_tenant_id: tenantId }).then(() =>
                    barberSupabase
                        .from('customer_subscription_receivables')
                        .select('id, customer_id, subscription_id, plan_id, due_date, amount, status')
                        .eq('tenant_id', tenantId)
                        .in('status', ['pending', 'overdue'])
                ),
                barberSupabase
                    .from('transactions')
                    .select('id, status, category, amount, description, date, payment_method, type')
                    .eq('tenant_id', tenantId)
                    .eq('type', 'income')
                    .gte('date', startOfMonth)
                    .lte('date', endOfMonth)
                    .order('date', { ascending: false }),
            ]);

            if (comandasResult.error) throw comandasResult.error;
            const comandasData = (comandasResult.data || []) as ComandaRecord[];
            setOpenComandas(comandasData);

            if (clubResult.error) throw clubResult.error;
            const clubData = (clubResult.data || []) as ClubReceivableRecord[];
            setClubReceivables(clubData);

            if (transactionsResult.error) throw transactionsResult.error;
            const txData = transactionsResult.data || [];
            const normalizedReceipts: ReceiptRecord[] = txData.map((tx: any) => {
                let status: any = tx.status || 'Pago';
                if (status !== 'Pago' && status !== 'Pendente' && status !== 'Cancelado') {
                    status = status === 'paid' ? 'Pago' : (status === 'pending' ? 'Pendente' : 'Pago');
                }
                const safeType = tx.category || (tx.type === 'income' ? 'Receita' : 'Despesa');
                const shortId = tx.id ? tx.id.substring(0, 6) : String(Math.floor(Math.random() * 999999));
                const recYear = new Date(tx.date || new Date()).getFullYear();
                return {
                    id: tx.id,
                    number: `REC-${recYear}-${shortId.toUpperCase()}`,
                    date: tx.date || new Date().toISOString(),
                    type: safeType,
                    name: tx.description || 'Transacao',
                    amount: Number(tx.amount || 0),
                    paymentMethod: tx.payment_method || 'Dinheiro',
                    status,
                };
            });
            const pendentes = normalizedReceipts.filter(r => r.status === 'Pendente');
            setPendingReceipts(pendentes);

            const customerIds = Array.from(new Set(clubData.map(r => r.customer_id).filter(Boolean)));
            const planIds = Array.from(new Set(clubData.map(r => r.plan_id).filter(Boolean)));
            const [clientsRes, plansRes] = await Promise.all([
                customerIds.length > 0
                    ? barberSupabase.from('clients').select('id, name').eq('tenant_id', tenantId).in('id', customerIds)
                    : Promise.resolve({ data: [], error: null }),
                planIds.length > 0
                    ? barberSupabase.from('customer_plans').select('id, name').eq('tenant_id', tenantId).in('id', planIds)
                    : Promise.resolve({ data: [], error: null }),
            ]);
            if (clientsRes.error) console.error('Error loading club clients:', clientsRes.error);
            if (plansRes.error) console.error('Error loading club plans:', plansRes.error);
            const clientsMap: Record<string, { name: string }> = {};
            const plansMap: Record<string, { name: string }> = {};
            (clientsRes.data || []).forEach((c: any) => { clientsMap[c.id] = c; });
            (plansRes.data || []).forEach((p: any) => { plansMap[p.id] = p; });
            setClubClients(clientsMap);
            setClubPlans(plansMap);

        } catch (error: any) {
            console.error('Erro ao carregar contas a receber:', error);
            setToast({ message: error?.message || 'Erro ao carregar contas a receber.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [tenantId, filterMonth]);

    const handleMarkPaid = async (comandaId: string) => {
        if (!tenantId) return;
        setMarkingPaid(comandaId);
        try {
            const barberSupabase = getScopedClient('barber');
            const { error } = await barberSupabase
                .from('comandas')
                .update({ status: 'paid', closed_at: new Date().toISOString() })
                .eq('id', comandaId)
                .eq('tenant_id', tenantId);
            if (error) throw error;
            setToast({ message: 'Baixa realizada com sucesso.', type: 'success' });
            await fetchData();
        } catch (error: any) {
            setToast({ message: error?.message || 'Erro ao dar baixa.', type: 'error' });
        } finally {
            setMarkingPaid(null);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const allEntries: AREntry[] = useMemo(() => {
        const entries: AREntry[] = [];

        openComandas.forEach(c => {
            const clients = c.clients as { name: string } | { name: string }[];
            const clientName = Array.isArray(clients) ? clients[0]?.name : clients?.name;
            entries.push({
                id: c.id,
                source: 'comanda',
                clientName: clientName || 'Cliente',
                description: 'Comanda em aberto',
                dateValue: c.created_at,
                amount: Number(c.total || 0),
                status: 'open',
                originPath: '/comandas',
            });
        });

        const today = new Date().toISOString().split('T')[0];
        clubReceivables.forEach(r => {
            if (r.transaction_id) return;
            const displayStatus = r.status === 'pending' && r.due_date < today ? 'overdue' : r.status;
            entries.push({
                id: r.id,
                source: 'clube',
                clientName: clubClients[r.customer_id]?.name || 'Cliente',
                description: `Plano: ${clubPlans[r.plan_id]?.name || 'N/D'}`,
                dateValue: r.due_date,
                amount: Number(r.amount || 0),
                status: displayStatus,
                originPath: '/chef-club-receivables',
            });
        });

        pendingReceipts.forEach(r => {
            entries.push({
                id: r.id,
                source: 'recibo',
                clientName: r.name,
                description: r.type || 'Receita',
                dateValue: r.date,
                amount: r.amount,
                status: 'Pendente',
                originPath: '/receipts',
            });
        });

        return entries;
    }, [openComandas, clubReceivables, pendingReceipts, clubClients, clubPlans]);

    const filteredEntries = useMemo(() => {
        if (activeTab === 'todos') return allEntries;
        return allEntries.filter(e => {
            if (activeTab === 'comandas') return e.source === 'comanda';
            if (activeTab === 'clube') return e.source === 'clube';
            if (activeTab === 'recibos') return e.source === 'recibo';
            return true;
        });
    }, [allEntries, activeTab]);

    const totals = useMemo(() => {
        const openComandaTotal = openComandas.reduce((sum, c) => sum + Number(c.total || 0), 0);
        const clubTotal = clubReceivables.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const receiptTotal = pendingReceipts.reduce((sum, r) => sum + r.amount, 0);
        return {
            open: openComandaTotal + clubTotal + receiptTotal,
            comandas: { count: openComandas.length, total: openComandaTotal },
            clube: {
                count: clubReceivables.filter(r => r.status === 'overdue').length,
                total: clubTotal,
            },
            recibos: { count: pendingReceipts.length, total: receiptTotal },
        };
    }, [openComandas, clubReceivables, pendingReceipts]);

    const tabs: { key: ActiveTab; label: string }[] = [
        { key: 'todos', label: 'Todos' },
        { key: 'comandas', label: 'Comandas' },
        { key: 'clube', label: 'Clube do Chefe' },
        { key: 'recibos', label: 'Recibos' },
    ];

    const getStatusBadge = (status: string) => {
        if (status === 'overdue') return 'bg-red-500/10 text-red-600 border-red-500/20';
        if (status === 'open' || status === 'Pendente') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
        return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    };

    const getStatusLabel = (status: string) => {
        if (status === 'overdue') return 'Atrasado';
        if (status === 'open') return 'Pendente';
        if (status === 'Pendente') return 'Pendente';
        return status;
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Contas a Receber</h2>
                    <p className="text-slate-500 mt-1">Visão consolidada de valores a receber de comandas, Clube do Chefe e recibos.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2.5">
                        <CalendarRange className="h-4 w-4 text-slate-400" />
                        <input
                            type="month"
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                        />
                    </label>
                    <Button leftIcon="sync" onClick={fetchData}>
                        Atualizar
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 dark:text-slate-400">Total em Aberto</span>
                        <div className="size-9 rounded-xl border border-current/10 grid place-items-center bg-primary/10 text-primary">
                            <Wallet size={18} />
                        </div>
                    </div>
                    <p className="mt-4 text-[1.7rem] leading-none font-black text-slate-900 dark:text-white">
                        {totals.open.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 dark:text-slate-400">Comandas Abertas</span>
                        <div className="size-9 rounded-xl border border-current/10 grid place-items-center bg-amber-500/10 text-amber-600">
                            <Package size={18} />
                        </div>
                    </div>
                    <p className="mt-4 text-[1.7rem] leading-none font-black text-slate-900 dark:text-white">
                        {totals.comandas.count}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        {totals.comandas.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em aberto
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 dark:text-slate-400">Planos Atrasados</span>
                        <div className="size-9 rounded-xl border border-current/10 grid place-items-center bg-red-500/10 text-red-600">
                            <Users size={18} />
                        </div>
                    </div>
                    <p className="mt-4 text-[1.7rem] leading-none font-black text-slate-900 dark:text-white">
                        {totals.clube.count}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        {totals.clube.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em atraso
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 dark:text-slate-400">Recibos Pendentes</span>
                        <div className="size-9 rounded-xl border border-current/10 grid place-items-center bg-blue-500/10 text-blue-600">
                            <FileText size={18} />
                        </div>
                    </div>
                    <p className="mt-4 text-[1.7rem] leading-none font-black text-slate-900 dark:text-white">
                        {totals.recibos.count}
                    </p>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        {totals.recibos.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} pendente
                    </p>
                </div>
            </div>

            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-xl w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === tab.key
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <section className="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-10 text-center">
                    <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <p className="mt-3 text-sm text-slate-500">Carregando contas a receber...</p>
                </section>
            ) : filteredEntries.length === 0 ? (
                <section className="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-10 text-center">
                    <div className="mx-auto size-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 mb-4">
                        <AlertCircle className="size-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-950 dark:text-white mb-1">Nenhuma conta a receber</h3>
                    <p className="text-sm text-slate-500">
                        {hasTenantContext ? 'Nao ha itens pendentes no periodo selecionado.' : 'Sem contexto de tenant.'}
                    </p>
                </section>
            ) : (
                <section className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-border-dark px-5 py-4">
                        <div>
                            <h3 className="text-base font-bold text-slate-950 dark:text-white">
                                {tabs.find(t => t.key === activeTab)?.label}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Itens pendentes no periodo selecionado.</p>
                        </div>
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                            {filteredEntries.length} registros
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                            <thead className="bg-slate-50/90 dark:bg-white/5">
                                <tr>
                                    {['Origem', 'Cliente', 'Descricao', 'Data / Vencimento', 'Valor', 'Status', ''].map(col => (
                                        <th key={col} className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {filteredEntries.map(entry => (
                                    <tr key={`${entry.source}-${entry.id}`} className="hover:bg-slate-50/80 dark:hover:bg-white/5">
                                        <td className="px-5 py-4">
                                            <span className="text-xs font-bold text-slate-500 uppercase">
                                                {entry.source === 'comanda' ? 'Comanda' : entry.source === 'clube' ? 'Clube' : 'Recibo'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-sm font-semibold text-slate-900 dark:text-white">{entry.clientName}</td>
                                        <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">{entry.description}</td>
                                        <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">
                                            {new Date(entry.dateValue).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white">
                                            {entry.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase border ${getStatusBadge(entry.status)}`}>
                                                {getStatusLabel(entry.status)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            {entry.source === 'comanda' && entry.status === 'open' && (
                                                <button
                                                    onClick={() => handleMarkPaid(entry.id)}
                                                    disabled={markingPaid === entry.id}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-500/20 transition disabled:opacity-50"
                                                >
                                                    {markingPaid === entry.id ? (
                                                        <span className="size-3 rounded-full border-2 border-emerald-600/30 border-t-emerald-600 animate-spin"></span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                                    )}
                                                    Dar baixa
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
};

export default AccountsReceivable;
