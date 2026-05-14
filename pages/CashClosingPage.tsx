import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    CalendarRange,
    CheckCircle,
    AlertTriangle,
    FileText,
    Package,
    Users,
    Save,
    RotateCcw,
    Wallet,
} from 'lucide-react';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FinancialSummaryCard from '../components/financial/FinancialSummaryCard';
import { EnrichedCashFlowEntry } from '../components/financial/types';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

interface TransactionRecord {
    id: string;
    type: string;
    category: string | null;
    amount: number | string | null;
    description: string | null;
    payment_method: string | null;
    date: string | null;
    created_at?: string | null;
}

interface AppointmentRecord {
    id: string;
    status: string;
    price: number;
    start_time: string;
    appointment_id?: string | null;
}

interface ComandaRecord {
    id: string;
    appointment_id: string | null;
    status: string;
    total: number;
}

interface AgendaSummary {
    scheduled: { count: number; total: number };
    completed: { count: number; total: number };
    received: { count: number; total: number };
    cancelled: { count: number; total: number };
    pending: { count: number; total: number };
    no_show: { count: number; total: number };
}

const CashClosingPage: React.FC = () => {
    const { tenantId, user } = useAuth();
    const hasTenantContext = Boolean(tenantId);

    const [filterDate, setFilterDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [entries, setEntries] = useState<EnrichedCashFlowEntry[]>([]);
    const [showSummary, setShowSummary] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);

    const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
    const [comandas, setComandas] = useState<ComandaRecord[]>([]);
    const [openComandasCount, setOpenComandasCount] = useState(0);
    const [openComandasTotal, setOpenComandasTotal] = useState(0);
    const [clubOverdueCount, setClubOverdueCount] = useState(0);
    const [clubOverdueTotal, setClubOverdueTotal] = useState(0);
    const [pendingReceiptsCount, setPendingReceiptsCount] = useState(0);
    const [pendingReceiptsTotal, setPendingReceiptsTotal] = useState(0);

    const getDayRange = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        const start = d.toISOString();
        const end = new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
        return { start, end };
    };

    const fetchData = useCallback(async () => {
        if (!tenantId || !filterDate) {
            setEntries([]);
            setAppointments([]);
            setComandas([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { start, end } = getDayRange(filterDate);

        try {
            const [
                transactionsResult,
                appointmentsResult,
                comandasResult,
                clubResult,
                receiptsResult,
            ] = await Promise.all([
                supabase
                    .from('transactions')
                    .select('id, type, category, amount, description, payment_method, date, created_at')
                    .eq('tenant_id', tenantId)
                    .gte('date', start)
                    .lte('date', end)
                    .order('date', { ascending: true }),
                supabase
                    .from('appointments')
                    .select('id, status, price, start_time')
                    .eq('tenant_id', tenantId)
                    .gte('start_time', start)
                    .lte('start_time', end),
                supabase
                    .from('comandas')
                    .select('id, appointment_id, status, total')
                    .eq('tenant_id', tenantId),
                supabase.rpc('generate_club_receivables', { p_tenant_id: tenantId }).then(() =>
                    supabase
                        .from('customer_subscription_receivables')
                        .select('id, amount, status')
                        .eq('tenant_id', tenantId)
                        .in('status', ['pending', 'overdue'])
                ),
                supabase
                    .from('transactions')
                    .select('id, status, amount')
                    .eq('tenant_id', tenantId)
                    .gte('date', start)
                    .lte('date', end),
            ]);

            if (transactionsResult.error) throw transactionsResult.error;

            const txData = (transactionsResult.data || []) as TransactionRecord[];
            const mappedEntries: EnrichedCashFlowEntry[] = txData.map(transaction => {
                const type = transaction.type === 'income' ? 'entrada' : 'saida';
                const value = Number(transaction.amount || 0);
                return {
                    id: transaction.id,
                    date: transaction.date || transaction.created_at || new Date().toISOString(),
                    description: transaction.description || transaction.category || 'Lancamento sem descricao',
                    category: transaction.category || 'Sem categoria',
                    accountId: transaction.payment_method || 'nao-informado',
                    accountName: transaction.payment_method || 'Nao informado',
                    costCenter: transaction.category || 'Sem centro',
                    type,
                    paymentMethod: transaction.payment_method || 'Nao informado',
                    status: 'realizado',
                    value,
                    runningBalance: 0,
                };
            });
            setEntries(mappedEntries);

            if (appointmentsResult.data) {
                setAppointments(appointmentsResult.data as AppointmentRecord[]);
            }

            if (comandasResult.data) {
                const allComandas = comandasResult.data as ComandaRecord[];
                const openCmds = allComandas.filter(c => c.status === 'open');
                setOpenComandasCount(openCmds.length);
                setOpenComandasTotal(openCmds.reduce((sum, c) => sum + Number(c.total || 0), 0));
                setComandas(allComandas);
            }

            if (clubResult.data) {
                const clubData = (clubResult.data as any[]).filter((r: any) => !r.transaction_id);
                const overdue = clubData.filter((r: any) => r.status === 'overdue');
                setClubOverdueCount(overdue.length);
                setClubOverdueTotal(overdue.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0));
            }

            if (receiptsResult.data) {
                const txAll = receiptsResult.data as any[];
                const pendentes = txAll.filter((tx: any) => {
                    let status = tx.status || 'Pago';
                    if (status !== 'Pago' && status !== 'Pendente' && status !== 'Cancelado') {
                        status = status === 'paid' ? 'Pago' : (status === 'pending' ? 'Pendente' : 'Pago');
                    }
                    return status === 'Pendente';
                });
                setPendingReceiptsCount(pendentes.length);
                setPendingReceiptsTotal(pendentes.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0));
            }

        } catch (error: any) {
            console.error('Erro ao carregar conferencia de caixa:', error);
            setToast({ message: error?.message || 'Erro ao carregar conferencia de caixa.', type: 'error' });
            setEntries([]);
            setAppointments([]);
            setComandas([]);
        } finally {
            setLoading(false);
        }
    }, [tenantId, filterDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totalEntradas = entries
        .filter(e => e.type === 'entrada')
        .reduce((sum, e) => sum + e.value, 0);
    const totalSaidas = entries
        .filter(e => e.type === 'saida')
        .reduce((sum, e) => sum + e.value, 0);
    const saldoAtual = totalEntradas - totalSaidas;
    const entradasCount = entries.filter(e => e.type === 'entrada').length;
    const saidasCount = entries.filter(e => e.type === 'saida').length;

    const agendaSummary = useMemo((): AgendaSummary => {
        const apptIds = new Set(appointments.map(a => a.id));

        const paidComandas = comandas.filter(
            c => c.appointment_id && apptIds.has(c.appointment_id) && c.status === 'paid'
        );

        const receivedTotal = paidComandas.reduce((sum, c) => sum + Number(c.total || 0), 0);
        const receivedCount = paidComandas.length;

        const scheduled = appointments.filter(a => ['scheduled', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(a.status));
        const completed = appointments.filter(a => a.status === 'completed');
        const cancelled = appointments.filter(a => a.status === 'cancelled');
        const pending = appointments.filter(a => ['scheduled', 'pending', 'confirmed', 'in_progress'].includes(a.status));
        const no_show = appointments.filter(a => a.status === 'no_show');

        return {
            scheduled: {
                count: scheduled.length,
                total: scheduled.reduce((sum, a) => sum + Number(a.price || 0), 0),
            },
            completed: {
                count: completed.length,
                total: completed.reduce((sum, a) => sum + Number(a.price || 0), 0),
            },
            received: {
                count: receivedCount,
                total: receivedTotal,
            },
            cancelled: {
                count: cancelled.length,
                total: cancelled.reduce((sum, a) => sum + Number(a.price || 0), 0),
            },
            pending: {
                count: pending.length,
                total: pending.reduce((sum, a) => sum + Number(a.price || 0), 0),
            },
            no_show: {
                count: no_show.length,
                total: no_show.reduce((sum, a) => sum + Number(a.price || 0), 0),
            },
        };
    }, [appointments, comandas]);

    const paymentMethodBreakdown = useMemo(() => {
        const map: Record<string, { entradas: number; saidas: number; count: number }> = {};
        entries.forEach(e => {
            if (!map[e.paymentMethod]) map[e.paymentMethod] = { entradas: 0, saidas: 0, count: 0 };
            if (e.type === 'entrada') map[e.paymentMethod].entradas += e.value;
            else map[e.paymentMethod].saidas += e.value;
            map[e.paymentMethod].count += 1;
        });
        return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
    }, [entries]);

    const handleSaveConference = async () => {
        if (!tenantId) return;
        setSaving(true);

        const { start, end } = getDayRange(filterDate);
        const businessDate = filterDate;

        try {
            const { error } = await supabase
                .from('cash_closings')
                .upsert({
                    tenant_id: tenantId,
                    business_date: businessDate,
                    period_start: start,
                    period_end: end,
                    status: 'draft',
                    created_by_user_id: user?.id,
                    expected_income: totalEntradas,
                    expected_expense: totalSaidas,
                    expected_balance: saldoAtual,
                    total_counted: 0,
                    total_difference: 0,
                    appointments_scheduled_count: agendaSummary.scheduled.count,
                    appointments_completed_count: agendaSummary.completed.count,
                    appointments_received_count: agendaSummary.received.count,
                    appointments_cancelled_count: agendaSummary.cancelled.count,
                    appointments_pending_count: agendaSummary.pending.count,
                    appointments_no_show_count: agendaSummary.no_show.count,
                    appointments_summary: JSON.stringify(agendaSummary),
                    financial_summary: JSON.stringify({
                        entradas: totalEntradas,
                        entradas_count: entradasCount,
                        saidas: totalSaidas,
                        saidas_count: saidasCount,
                        saldo: saldoAtual,
                        payment_methods: paymentMethodBreakdown,
                    }),
                }, {
                    onConflict: 'tenant_id,business_date',
                });

            if (error) throw error;

            setToast({
                message: 'Conferencia do dia salva com sucesso. Nenhum valor financeiro foi alterado.',
                type: 'success',
            });
            setShowSaveConfirm(false);
            setShowSummary(false);
        } catch (error: any) {
            setToast({
                message: error?.message || 'Erro ao salvar conferencia.',
                type: 'error',
            });
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Conferencia de Caixa</h2>
                    <p className="text-slate-500 mt-1">Resumo operacional e financeiro do dia selecionado.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2.5">
                        <CalendarRange className="h-4 w-4 text-slate-400" />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            className="bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                        />
                    </label>
                    <Button leftIcon="sync" onClick={fetchData}>
                        Atualizar
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-500/10">
                <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                    <strong>Conferencia operacional.</strong> Esta tela faz a leitura dos lancamentos registrados. O fechamento definitivo exigira persistencia no banco de dados.
                </p>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5 h-32 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <FinancialSummaryCard
                        title="Entradas"
                        value={totalEntradas}
                        changeText={`${entradasCount} registros`}
                        trend="up"
                        tone="positive"
                        helperText="Receitas do dia"
                        icon={<ArrowUpCircle size={18} />}
                    />
                    <FinancialSummaryCard
                        title="Saidas"
                        value={totalSaidas}
                        changeText={`${saidasCount} registros`}
                        trend="down"
                        tone="negative"
                        helperText="Despesas do dia"
                        icon={<ArrowDownCircle size={18} />}
                    />
                    <FinancialSummaryCard
                        title="Saldo Operacional"
                        value={saldoAtual}
                        changeText={saldoAtual >= 0 ? 'Conferencia positiva' : 'Conferencia negativa'}
                        trend={saldoAtual >= 0 ? 'up' : 'down'}
                        tone={saldoAtual >= 0 ? 'positive' : 'negative'}
                        helperText="Entradas menos saidas"
                        icon={<CheckCircle size={18} />}
                    />
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 dark:text-slate-400">Agendados</span>
                        <div className="size-9 rounded-xl border border-current/10 grid place-items-center bg-slate-100 dark:bg-white/5 text-slate-500">
                            <CalendarRange size={18} />
                        </div>
                    </div>
                    <p className="mt-4 text-[1.7rem] leading-none font-black text-slate-900 dark:text-white">{agendaSummary.scheduled.count}</p>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        {agendaSummary.scheduled.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} estimado
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 dark:text-slate-400">Concluidos</span>
                        <div className="size-9 rounded-xl border border-current/10 grid place-items-center bg-emerald-500/10 text-emerald-600">
                            <CheckCircle size={18} />
                        </div>
                    </div>
                    <p className="mt-4 text-[1.7rem] leading-none font-black text-slate-900 dark:text-white">{agendaSummary.completed.count}</p>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        {agendaSummary.completed.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} estimado
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 dark:text-slate-400">Recebidos</span>
                        <div className="size-9 rounded-xl border border-current/10 grid place-items-center bg-primary/10 text-primary">
                            <Wallet size={18} />
                        </div>
                    </div>
                    <p className="mt-4 text-[1.7rem] leading-none font-black text-slate-900 dark:text-white">{agendaSummary.received.count}</p>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        {agendaSummary.received.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} receitas
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 dark:text-slate-400">Cancelados</span>
                        <div className="size-9 rounded-xl border border-current/10 grid place-items-center bg-rose-500/10 text-rose-600">
                            <AlertTriangle size={18} />
                        </div>
                    </div>
                    <p className="mt-4 text-[1.7rem] leading-none font-black text-slate-900 dark:text-white">{agendaSummary.cancelled.count}</p>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        {agendaSummary.cancelled.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} perdido
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 dark:text-slate-400">Pendentes</span>
                        <div className="size-9 rounded-xl border border-current/10 grid place-items-center bg-amber-500/10 text-amber-600">
                            <Package size={18} />
                        </div>
                    </div>
                    <p className="mt-4 text-[1.7rem] leading-none font-black text-slate-900 dark:text-white">{agendaSummary.pending.count}</p>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        {agendaSummary.pending.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em aberto
                    </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 dark:text-slate-400">Nao compareceu</span>
                        <div className="size-9 rounded-xl border border-current/10 grid place-items-center bg-slate-500/10 text-slate-500">
                            <Users size={18} />
                        </div>
                    </div>
                    <p className="mt-4 text-[1.7rem] leading-none font-black text-slate-900 dark:text-white">{agendaSummary.no_show.count}</p>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        {agendaSummary.no_show.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} perdido
                    </p>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark p-8">
                <div className="flex items-start gap-4 mb-6">
                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-2xl">fact_check</span>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-950 dark:text-white mb-1">Resumo de Conferencia</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Revise os valores antes de salvar. Nenhum lancamento financeiro e alterado.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 p-4">
                        <p className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1">Total Entradas</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            {totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">{entradasCount} lancamentos</p>
                    </div>
                    <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800 p-4">
                        <p className="text-xs font-black uppercase text-rose-600 dark:text-rose-400 mb-1">Total Saidas</p>
                        <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                            {totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        <p className="text-xs text-rose-600/70 dark:text-rose-400/70 mt-1">{saidasCount} lancamentos</p>
                    </div>
                </div>

                <div className="border-t border-slate-200 dark:border-border-dark pt-6 flex flex-col sm:flex-row gap-3">
                    <Button
                        leftIcon="fact_check"
                        onClick={() => setShowSummary(prev => !prev)}
                        className="flex-1"
                    >
                        {showSummary ? 'Ocultar Resumo' : 'Ver Resumo Detalhado'}
                    </Button>
                    <Button
                        leftIcon="save"
                        variant="secondary"
                        onClick={() => setShowSaveConfirm(true)}
                        className="flex-1"
                    >
                        Salvar Conferencia do Dia
                    </Button>
                    <Button
                        leftIcon="print"
                        variant="secondary"
                        onClick={handlePrint}
                        className="flex-1"
                    >
                        Imprimir Relatorio
                    </Button>
                </div>
            </div>

            <Modal
                isOpen={showSummary}
                onClose={() => setShowSummary(false)}
                title="Resumo Detalhado"
                maxWidth="lg"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 p-4 text-center">
                            <p className="text-xs font-black uppercase text-emerald-600 mb-1">Entradas</p>
                            <p className="text-xl font-black text-emerald-600">
                                {totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-[10px] text-emerald-600/70 mt-1">{entradasCount} registros</p>
                        </div>
                        <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800 p-4 text-center">
                            <p className="text-xs font-black uppercase text-rose-600 mb-1">Saidas</p>
                            <p className="text-xl font-black text-rose-600">
                                {totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-[10px] text-rose-600/70 mt-1">{saidasCount} registros</p>
                        </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark p-4 text-center">
                        <p className="text-xs font-black uppercase text-slate-500 mb-1">Saldo Operacional Esperado</p>
                        <p className={`text-2xl font-black ${saldoAtual >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {saldoAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>

                    <div className="border-t border-slate-200 dark:border-border-dark pt-4">
                        <h4 className="text-xs font-black uppercase text-slate-500 mb-3">Agenda do Dia</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark">
                                <CalendarRange className="size-4 text-slate-500 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-slate-600">{agendaSummary.scheduled.count} agendados</p>
                                    <p className="text-[10px] text-slate-400">
                                        {agendaSummary.scheduled.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle className="size-4 text-emerald-600 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-emerald-600">{agendaSummary.completed.count} conclusdos</p>
                                    <p className="text-[10px] text-emerald-600/70">
                                        {agendaSummary.completed.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                                <Save className="size-4 text-primary shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-primary">{agendaSummary.received.count} recebidos</p>
                                    <p className="text-[10px] text-primary/70">
                                        {agendaSummary.received.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800">
                                <AlertTriangle className="size-4 text-rose-600 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-rose-600">{agendaSummary.cancelled.count} cancelados</p>
                                    <p className="text-[10px] text-rose-600/70">
                                        {agendaSummary.cancelled.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800">
                                <Package className="size-4 text-amber-600 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-amber-600">{agendaSummary.pending.count} pendentes</p>
                                    <p className="text-[10px] text-amber-600/70">
                                        {agendaSummary.pending.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark">
                                <Users className="size-4 text-slate-500 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-slate-500">{agendaSummary.no_show.count} nao compareceram</p>
                                    <p className="text-[10px] text-slate-400">
                                        {agendaSummary.no_show.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 dark:border-border-dark pt-4">
                        <h4 className="text-xs font-black uppercase text-slate-500 mb-3">Pendencias antes do fechamento</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800">
                                <Package className="size-4 text-amber-600 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-amber-600">{openComandasCount} comandas abertas</p>
                                    <p className="text-[10px] text-amber-600/70">
                                        {openComandasTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800">
                                <Users className="size-4 text-red-600 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-red-600">{clubOverdueCount} planos atrasados</p>
                                    <p className="text-[10px] text-red-600/70">
                                        {clubOverdueTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800">
                                <FileText className="size-4 text-blue-600 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-blue-600">{pendingReceiptsCount} recibos pendentes</p>
                                    <p className="text-[10px] text-blue-600/70">
                                        {pendingReceiptsTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {paymentMethodBreakdown.length > 0 && (
                        <div className="border-t border-slate-200 dark:border-border-dark pt-4">
                            <h4 className="text-xs font-black uppercase text-slate-500 mb-3">Por forma de pagamento</h4>
                            <div className="space-y-2">
                                {paymentMethodBreakdown.map(([method, data]) => (
                                    <div key={method} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{method}</span>
                                        <div className="flex gap-4">
                                            <span className="text-xs text-emerald-600 font-bold">
                                                +{data.entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                            <span className="text-xs text-rose-600 font-bold">
                                                -{data.saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={showSaveConfirm}
                onClose={() => setShowSaveConfirm(false)}
                title="Salvar Conferencia do Dia"
                maxWidth="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Confirma o salvamento da conferencia do dia <strong>{filterDate}</strong>?
                    </p>
                    <p className="text-xs text-slate-500">
                        Este registro salva apenas um resumo operacional. Nenhum lancamento financeiro e alterado.
                    </p>
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="secondary"
                            leftIcon="rotate-ccw"
                            onClick={() => setShowSaveConfirm(false)}
                            className="flex-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            leftIcon="save"
                            onClick={handleSaveConference}
                            disabled={saving}
                            className="flex-1"
                        >
                            {saving ? 'Salvando...' : 'Confirmar'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CashClosingPage;
