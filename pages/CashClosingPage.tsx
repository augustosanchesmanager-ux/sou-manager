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
    Plus,
    Trash2,
    Download,
    Eye,
} from 'lucide-react';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FinancialSummaryCard from '../components/financial/FinancialSummaryCard';
import CashCloseFiltersBar from '../components/financial/CashCloseFilters';
import { AuditAdjustmentButton } from '../components/audit';
import { EnrichedCashFlowEntry } from '../components/financial/types';
import {
    CashCloseFilters,
    SangriaSuprimento,
    PaymentMethodRow,
    CashCloseValidation,
    CashClosingEntryExtended,
    formatCurrency,
    generateId,
    validateCashClose,
    buildPaymentMethodRows,
    filterEntries,
    generateCSVContent,
    downloadCSV,
    generatePreviewText,
} from '../components/financial/cashCloseUtils';
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
    source_type?: string | null;
    source_id?: string | null;
    user_id?: string | null;
}

interface FinancialReversalRecord {
    original_transaction_id: string | null;
    reversal_transaction_id?: string | null;
    reversal_type?: string | null;
    amount: number | string | null;
    reason_type?: string | null;
    created_at?: string | null;
}

interface AppointmentRecord {
    id: string;
    status: string;
    price: number;
    start_time: string;
}

interface ComandaRecord {
    id: string;
    appointment_id: string | null;
    status: string;
    total: number;
}

interface StaffRecord {
    id: string;
    name: string;
    role: string | null;
}

interface AgendaSummary {
    scheduled: { count: number; total: number };
    completed: { count: number; total: number };
    received: { count: number; total: number };
    cancelled: { count: number; total: number };
    pending: { count: number; total: number };
    no_show: { count: number; total: number };
}

const getReversalTypeLabel = (type?: string | null) => {
    switch (type) {
        case 'wrong_settlement': return 'Estorno de baixa';
        case 'full_refund': return 'Devolucao total';
        case 'partial_refund': return 'Devolucao parcial';
        default: return 'Reversao auditada';
    }
};

const CashClosingPage: React.FC = () => {
    const { tenantId, user } = useAuth();
    const hasTenantContext = Boolean(tenantId);

    const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [closing, setClosing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

    const [entries, setEntries] = useState<CashClosingEntryExtended[]>([]);
    const [showSummary, setShowSummary] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
    const [comandas, setComandas] = useState<ComandaRecord[]>([]);
    const [staffList, setStaffList] = useState<StaffRecord[]>([]);
    const [openComandasCount, setOpenComandasCount] = useState(0);
    const [openComandasTotal, setOpenComandasTotal] = useState(0);
    const [clubOverdueCount, setClubOverdueCount] = useState(0);
    const [clubOverdueTotal, setClubOverdueTotal] = useState(0);
    const [pendingReceiptsCount, setPendingReceiptsCount] = useState(0);
    const [pendingReceiptsTotal, setPendingReceiptsTotal] = useState(0);

    const [filters, setFilters] = useState<CashCloseFilters>({
        operatorId: null,
        showOnlyOpenComandas: false,
        onlyClubMembers: false,
    });

    const [extras, setExtras] = useState<SangriaSuprimento[]>([]);
    const [observations, setObservations] = useState('');
    const [newExtraType, setNewExtraType] = useState<'sangria' | 'suprimento'>('sangria');
    const [newExtraValue, setNewExtraValue] = useState('');
    const [newExtraDesc, setNewExtraDesc] = useState('');

    const [paymentMethodAdjustments, setPaymentMethodAdjustments] = useState<Record<string, number>>({});

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
            setStaffList([]);
            setOpenComandasCount(0);
            setOpenComandasTotal(0);
            setClubOverdueCount(0);
            setClubOverdueTotal(0);
            setPendingReceiptsCount(0);
            setPendingReceiptsTotal(0);
            setLoadError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setLoadError(null);
        const { start, end } = getDayRange(filterDate);

        try {
            const [
                transactionsResult,
                appointmentsResult,
                comandasResult,
                clubResult,
                receiptsResult,
                staffResult,
            ] = await Promise.all([
                supabase
                    .from('transactions')
                    .select('id, type, category, amount, description, payment_method, date, created_at, source_type, source_id, user_id')
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
                supabase
                    .from('staff')
                    .select('id, name, role')
                    .eq('tenant_id', tenantId)
                    .eq('status', 'active'),
            ]);

            if (transactionsResult.error) throw transactionsResult.error;

            const txData = (transactionsResult.data || []) as TransactionRecord[];
            const transactionIds = txData.map((t) => t.id).filter(Boolean);
            const reversalSourceByTransactionId = new Map<string, CashClosingEntryExtended['reversalSource']>();

            if (transactionIds.length > 0) {
                const { data: reversalSources, error: reversalSourcesError } = await supabase
                    .from('financial_reversals')
                    .select('original_transaction_id, reversal_transaction_id, reversal_type, amount, reason_type, created_at')
                    .eq('tenant_id', tenantId)
                    .in('reversal_transaction_id', transactionIds);

                if (!reversalSourcesError) {
                    ((reversalSources || []) as FinancialReversalRecord[]).forEach((rev) => {
                        if (!rev.reversal_transaction_id) return;
                        reversalSourceByTransactionId.set(rev.reversal_transaction_id, {
                            originalTransactionId: rev.original_transaction_id || null,
                            reversalType: rev.reversal_type || 'reversal',
                            reasonType: rev.reason_type || 'Sem motivo informado',
                            amount: Math.abs(Number(rev.amount || 0)),
                            createdAt: rev.created_at || null,
                        });
                    });
                }
            }

            const openComandaIds = new Set(
                (comandasResult.data || []).filter((c: any) => c.status === 'open').map((c: any) => c.id)
            );

            const clubSourceIds = new Set(
                (clubResult.data || [])
                    .filter((r: any) => !r.transaction_id && r.status === 'overdue')
                    .map((r: any) => r.id)
            );

            const mappedEntries: CashClosingEntryExtended[] = txData.map(transaction => {
                const reversalSource = reversalSourceByTransactionId.get(transaction.id) || null;
                return {
                    id: transaction.id,
                    date: transaction.date || transaction.created_at || new Date().toISOString(),
                    description: transaction.description || transaction.category || 'Lancamento sem descricao',
                    category: transaction.category || 'Sem categoria',
                    accountId: transaction.payment_method || 'nao-informado',
                    accountName: transaction.payment_method || 'Nao informado',
                    costCenter: transaction.category || 'Sem centro',
                    type: transaction.type === 'income' ? 'entrada' : 'saida',
                    paymentMethod: transaction.payment_method || 'Nao informado',
                    status: 'realizado',
                    value: Number(transaction.amount || 0),
                    runningBalance: 0,
                    sourceType: transaction.source_type || null,
                    sourceId: transaction.source_id || null,
                    isReversalTransaction: Boolean(reversalSource),
                    reversalSource,
                    operatorId: transaction.user_id || null,
                    comandaStatus: transaction.source_id
                        ? (openComandaIds.has(transaction.source_id) ? 'open' : 'closed')
                        : null,
                    isClubMember: clubSourceIds.has(transaction.source_id || ''),
                };
            });
            setEntries(mappedEntries);

            if (appointmentsResult.data) setAppointments(appointmentsResult.data as AppointmentRecord[]);

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

            if (staffResult.data) {
                setStaffList(staffResult.data as StaffRecord[]);
            }

        } catch (error: any) {
            console.error('Erro ao carregar conferencia de caixa:', error);
            const message = error?.message || 'Nao foi possivel carregar a conferencia de caixa.';
            setLoadError(message);
            setToast({ message, type: 'error' });
            setEntries([]);
            setAppointments([]);
            setComandas([]);
            setStaffList([]);
        } finally {
            setLoading(false);
        }
    }, [tenantId, filterDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const openComandaIds = useMemo(
        () => new Set(comandas.filter(c => c.status === 'open').map(c => c.id)),
        [comandas]
    );

    const filteredEntries = useMemo(
        () => filterEntries(entries, filters, openComandaIds),
        [entries, filters, openComandaIds]
    );

    const totalEntradas = filteredEntries.filter(e => e.type === 'entrada').reduce((sum, e) => sum + e.value, 0);
    const totalSaidas = filteredEntries.filter(e => e.type === 'saida').reduce((sum, e) => sum + e.value, 0);
    const reversalEntries = filteredEntries.filter(e => e.isReversalTransaction);
    const totalReversals = reversalEntries.reduce((sum, e) => sum + e.value, 0);
    const reversalCount = reversalEntries.length;
    const regularSaidas = Math.max(totalSaidas - totalReversals, 0);
    const saldoAtual = totalEntradas - totalSaidas;
    const entradasCount = filteredEntries.filter(e => e.type === 'entrada').length;
    const saidasCount = filteredEntries.filter(e => e.type === 'saida').length;

    const totalExtrasSuprimento = extras.filter(e => e.type === 'suprimento').reduce((s, e) => s + e.value, 0);
    const totalExtrasSangria = extras.filter(e => e.type === 'sangria').reduce((s, e) => s + e.value, 0);

    const totalExpected = saldoAtual;
    const totalReceived = totalEntradas + totalExtrasSuprimento - totalExtrasSangria;
    const validation = useMemo(() => validateCashClose(totalExpected, totalReceived), [totalExpected, totalReceived]);

    const paymentRows = useMemo(() => buildPaymentMethodRows(filteredEntries, extras), [filteredEntries, extras]);

    const paymentMethodBreakdown = useMemo(() => {
        const map: Record<string, { entradas: number; saidas: number; count: number }> = {};
        filteredEntries.forEach(e => {
            if (!map[e.paymentMethod]) map[e.paymentMethod] = { entradas: 0, saidas: 0, count: 0 };
            if (e.type === 'entrada') map[e.paymentMethod].entradas += e.value;
            else map[e.paymentMethod].saidas += e.value;
            map[e.paymentMethod].count += 1;
        });
        return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
    }, [filteredEntries]);

    const agendaSummary = useMemo((): AgendaSummary => {
        const apptIds = new Set(appointments.map(a => a.id));
        const paidComandas = comandas.filter(c => c.appointment_id && apptIds.has(c.appointment_id) && c.status === 'paid');
        const receivedTotal = paidComandas.reduce((sum, c) => sum + Number(c.total || 0), 0);
        const completed = appointments.filter(a => a.status === 'completed');
        const cancelled = appointments.filter(a => a.status === 'cancelled');
        const pending = appointments.filter(a => ['scheduled', 'pending', 'confirmed', 'in_progress'].includes(a.status));
        const no_show = appointments.filter(a => a.status === 'no_show');
        const scheduled = appointments.filter(a => ['scheduled', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(a.status));

        return {
            scheduled: { count: scheduled.length, total: scheduled.reduce((s, a) => s + Number(a.price || 0), 0) },
            completed: { count: completed.length, total: completed.reduce((s, a) => s + Number(a.price || 0), 0) },
            received: { count: paidComandas.length, total: receivedTotal },
            cancelled: { count: cancelled.length, total: cancelled.reduce((s, a) => s + Number(a.price || 0), 0) },
            pending: { count: pending.length, total: pending.reduce((s, a) => s + Number(a.price || 0), 0) },
            no_show: { count: no_show.length, total: no_show.reduce((s, a) => s + Number(a.price || 0), 0) },
        };
    }, [appointments, comandas]);

    const hasPendingAlerts = openComandasCount > 0 || clubOverdueCount > 0 || pendingReceiptsCount > 0;
    const hasDailyFinancialData = entries.length > 0;
    const formattedFilterDate = filterDate ? new Date(`${filterDate}T00:00:00`).toLocaleDateString('pt-BR') : 'Data nao informada';
    const lastSavedLabel = lastSavedAt ? new Date(lastSavedAt).toLocaleString('pt-BR') : 'Ainda nao salvo nesta sessao';
    const closingStatus = loading ? 'Carregando' : saving ? 'Salvando' : loadError ? 'Erro' : hasPendingAlerts ? 'Pendencias' : hasDailyFinancialData ? 'Conferido' : 'Vazio';
    const closingStatusClasses = loadError
        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20'
        : hasPendingAlerts
            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
            : hasDailyFinancialData
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-border-dark';

    const getOperatorName = (operatorId?: string | null) => {
        if (!operatorId) return 'Todos';
        return staffList.find(s => s.id === operatorId)?.name || 'Desconhecido';
    };

    const handleAddExtra = () => {
        const value = parseFloat(newExtraValue);
        if (!value || value <= 0) {
            setToast({ message: 'Informe um valor valido.', type: 'error' });
            return;
        }
        const newExtra: SangriaSuprimento = {
            id: generateId(),
            type: newExtraType,
            value,
            description: newExtraDesc.trim(),
            createdAt: new Date().toISOString(),
        };
        setExtras(prev => [...prev, newExtra]);
        setNewExtraValue('');
        setNewExtraDesc('');
        setToast({ message: `${newExtraType === 'sangria' ? 'Sangria' : 'Suprimento'} adicionado.`, type: 'success' });
    };

    const handleRemoveExtra = (id: string) => {
        setExtras(prev => prev.filter(e => e.id !== id));
    };

    const handleSaveConference = async () => {
        if (!tenantId) return;
        setSaving(true);
        const { start, end } = getDayRange(filterDate);

        try {
            const { error } = await supabase
                .from('cash_closings')
                .upsert({
                    tenant_id: tenantId,
                    business_date: filterDate,
                    period_start: start,
                    period_end: end,
                    status: 'draft',
                    created_by_user_id: user?.id,
                    expected_income: totalEntradas,
                    expected_expense: totalSaidas,
                    expected_balance: saldoAtual,
                    total_counted: totalReceived,
                    total_difference: validation.difference,
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
                        saidas_operacionais: regularSaidas,
                        estornos_devolucoes: totalReversals,
                        estornos_devolucoes_count: reversalCount,
                        saldo: saldoAtual,
                        payment_methods: paymentMethodBreakdown,
                        extras: extras,
                        observations: observations,
                        total_expected: totalExpected,
                        total_received: totalReceived,
                        difference: validation.difference,
                        filters: filters,
                    }),
                }, { onConflict: 'tenant_id,business_date' });

            if (error) throw error;
            setLastSavedAt(new Date().toISOString());
            setToast({ message: 'Conferencia do dia salva com sucesso.', type: 'success' });
            setShowSaveConfirm(false);
        } catch (error: any) {
            console.error('Erro ao salvar conferencia:', error);
            setToast({ message: error?.message || 'Nao foi possivel salvar a conferencia.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleCloseCash = async () => {
        if (!tenantId) return;
        setClosing(true);
        const { start, end } = getDayRange(filterDate);

        try {
            for (const extra of extras) {
                const txType = extra.type === 'sangria' ? 'expense' : 'income';
                const txCategory = extra.type === 'sangria' ? 'Sangria - Fechamento' : 'Suprimento - Fechamento';
                await supabase.from('transactions').insert({
                    tenant_id: tenantId,
                    type: txType,
                    category: txCategory,
                    amount: extra.value,
                    description: extra.description || `${txCategory} - ${formattedFilterDate}`,
                    payment_method: 'Dinheiro',
                    date: new Date().toISOString(),
                    status: 'completed',
                    source_type: 'cash_closing',
                    user_id: user?.id,
                });
            }

            const { error } = await supabase
                .from('cash_closings')
                .upsert({
                    tenant_id: tenantId,
                    business_date: filterDate,
                    period_start: start,
                    period_end: end,
                    status: 'confirmed',
                    created_by_user_id: user?.id,
                    expected_income: totalEntradas,
                    expected_expense: totalSaidas,
                    expected_balance: saldoAtual,
                    total_counted: totalReceived,
                    total_difference: validation.difference,
                    appointments_summary: JSON.stringify(agendaSummary),
                    financial_summary: JSON.stringify({
                        entradas: totalEntradas,
                        saidas: totalSaidas,
                        saldo: saldoAtual,
                        payment_methods: paymentMethodBreakdown,
                        extras: extras,
                        observations: observations,
                        total_expected: totalExpected,
                        total_received: totalReceived,
                        difference: validation.difference,
                        filters: filters,
                        closed_at: new Date().toISOString(),
                        closed_by: user?.id,
                    }),
                }, { onConflict: 'tenant_id,business_date' });

            if (error) throw error;
            setLastSavedAt(new Date().toISOString());
            setToast({ message: 'Caixa fechado com sucesso!', type: 'success' });
            setShowCloseConfirm(false);
        } catch (error: any) {
            console.error('Erro ao fechar caixa:', error);
            setToast({ message: error?.message || 'Nao foi possivel fechar o caixa.', type: 'error' });
        } finally {
            setClosing(false);
        }
    };

    const handleExportCSV = () => {
        const csv = generateCSVContent(
            formattedFilterDate,
            filters,
            validation,
            extras,
            paymentRows,
            observations,
            getOperatorName(filters.operatorId),
            agendaSummary,
        );
        const dateStr = filterDate.replace(/-/g, '');
        downloadCSV(csv, `fechamento-caixa-${dateStr}.csv`);
        setToast({ message: 'CSV exportado com sucesso.', type: 'success' });
    };

    const handlePreview = () => {
        setShowPreview(true);
    };

    const previewText = useMemo(() => generatePreviewText(
        formattedFilterDate,
        validation,
        extras,
        paymentRows,
        observations,
        user?.email || 'Nao informado',
        agendaSummary,
    ), [formattedFilterDate, validation, extras, paymentRows, observations, user, agendaSummary]);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <html><head><title>Fechamento Caixa - ${formattedFilterDate}</title>
            <style>
                body { font-family: monospace; padding: 20px; white-space: pre-wrap; font-size: 13px; }
                @media print { body { padding: 10px; } }
            </style></head><body>${previewText.replace(/\n/g, '<br>')}</body></html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Fechamento de Caixa</h2>
                    <p className="text-slate-500 mt-1">Conferencia, ajustes e fechamento do caixa diario.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${closingStatusClasses}`}>
                            {closingStatus}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {formattedFilterDate}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Salvo: {lastSavedLabel}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <AuditAdjustmentButton
                        context={{
                            sourceType: 'cash_closing',
                            sourceLabel: 'Fechamento de Caixa',
                            beforeSnapshot: {
                                data: filterDate,
                                entradas: totalEntradas,
                                saidas: totalSaidas,
                                estornos_devolucoes: totalReversals,
                                saldo: saldoAtual,
                            },
                            financialImpactLabel: 'Impacto em fechamento de caixa',
                            allowedAdjustmentTypes: ['cash_difference_correction', 'mark_for_review'],
                        }}
                        defaultAdjustmentType="mark_for_review"
                    />
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2.5">
                        <CalendarRange className="h-4 w-4 text-slate-400" />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => setFilterDate(e.target.value)}
                            className="bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                        />
                    </label>
                    <Button leftIcon="sync" onClick={fetchData} disabled={loading}>
                        {loading ? 'Atualizando...' : 'Atualizar'}
                    </Button>
                </div>
            </div>

            <CashCloseFiltersBar
                filters={filters}
                onFiltersChange={(f) => setFilters(prev => ({ ...prev, ...f }))}
                operators={staffList}
                filteredCount={filteredEntries.length}
                totalCount={entries.length}
            />

            {loadError && (
                <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="size-5 text-rose-600 dark:text-rose-300 shrink-0" />
                        <div>
                            <p className="text-sm font-black text-rose-700 dark:text-rose-300">Erro ao carregar dados.</p>
                            <p className="text-xs text-rose-700/80 dark:text-rose-300/80">{loadError}</p>
                        </div>
                    </div>
                    <Button variant="secondary" leftIcon="sync" onClick={fetchData} disabled={loading}>Tentar novamente</Button>
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5 h-32 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <FinancialSummaryCard title="Entradas" value={totalEntradas} changeText={`${entradasCount} registros`} trend="up" tone="positive" helperText="Receitas do dia" icon={<ArrowUpCircle size={18} />} />
                    <FinancialSummaryCard title="Saidas" value={totalSaidas} changeText={`${saidasCount} registros`} trend="down" tone="negative" helperText="Despesas do dia" icon={<ArrowDownCircle size={18} />} />
                    <FinancialSummaryCard title="Estornos" value={totalReversals} changeText={`${reversalCount} reversoes`} trend="down" tone={totalReversals > 0 ? 'negative' : 'neutral'} helperText="Reversoes auditadas" icon={<RotateCcw size={18} />} />
                    <FinancialSummaryCard title="Saldo Operacional" value={saldoAtual} changeText={saldoAtual >= 0 ? 'Positivo' : 'Negativo'} trend={saldoAtual >= 0 ? 'up' : 'down'} tone={saldoAtual >= 0 ? 'positive' : 'negative'} helperText="Entradas menos saidas" icon={<CheckCircle size={18} />} />
                </div>
            )}

            {!loading && !loadError && (
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Validacao do Fechamento</h3>
                        {validation.isValid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 px-3 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                                <CheckCircle size={12} /> Conferido
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800 px-3 py-1 text-xs font-black text-rose-700 dark:text-rose-300">
                                <AlertTriangle size={12} /> Divergencia
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Total Esperado</p>
                            <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{formatCurrency(totalExpected)}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Saldo operacional</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Total Recebido</p>
                            <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{formatCurrency(totalReceived)}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Entradas + Suprimentos - Sangrias</p>
                        </div>
                        <div className={`rounded-xl border p-4 ${validation.isValid ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-800'}`}>
                            <p className={`text-[10px] font-black uppercase tracking-[0.12em] ${validation.isValid ? 'text-emerald-600' : 'text-rose-600'}`}>Diferenca</p>
                            <p className={`mt-1 text-xl font-black ${validation.isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatCurrency(validation.difference)}</p>
                            <p className={`text-[10px] mt-1 ${validation.isValid ? 'text-emerald-600/70' : 'text-rose-600/70'}`}>{validation.isValid ? 'Dentro da tolerancia' : 'Ajuste necessario'}</p>
                        </div>
                    </div>
                </div>
            )}

            {!loading && paymentMethodBreakdown.length > 0 && (
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5">
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 mb-4">Recebimentos por Forma de Pagamento</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-white/5">
                                    <th className="text-left py-2 text-xs font-bold text-slate-500">Forma</th>
                                    <th className="text-right py-2 text-xs font-bold text-slate-500">Lancado</th>
                                    <th className="text-right py-2 text-xs font-bold text-slate-500">Saidas</th>
                                    <th className="text-right py-2 text-xs font-bold text-slate-500">Liquido</th>
                                    <th className="text-center py-2 text-xs font-bold text-slate-500">Registros</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paymentMethodBreakdown.map(([method, data]) => {
                                    const net = data.entradas - data.saidas;
                                    return (
                                        <tr key={method} className="border-b border-slate-100 dark:border-white/5 last:border-0">
                                            <td className="py-2.5 font-semibold text-slate-700 dark:text-slate-200">{method}</td>
                                            <td className="text-right py-2.5 text-emerald-600 font-bold">{formatCurrency(data.entradas)}</td>
                                            <td className="text-right py-2.5 text-rose-600 font-bold">{formatCurrency(data.saidas)}</td>
                                            <td className={`text-right py-2.5 font-black ${net >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>{formatCurrency(net)}</td>
                                            <td className="text-center py-2.5 text-slate-500">{data.count}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!loading && (
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Wallet size={16} className="text-slate-400" />
                        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Sangria e Suprimento</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="flex gap-2">
                            <select
                                value={newExtraType}
                                onChange={e => setNewExtraType(e.target.value as 'sangria' | 'suprimento')}
                                className="rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none"
                            >
                                <option value="sangria">Sangria</option>
                                <option value="suprimento">Suprimento</option>
                            </select>
                        </div>
                        <div>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Valor (R$)"
                                value={newExtraValue}
                                onChange={e => setNewExtraValue(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Descricao (opcional)"
                                value={newExtraDesc}
                                onChange={e => setNewExtraDesc(e.target.value)}
                                maxLength={200}
                                className="flex-1 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <Button leftIcon="add" onClick={handleAddExtra} disabled={!newExtraValue || parseFloat(newExtraValue) <= 0}>
                                Adicionar
                            </Button>
                        </div>
                    </div>

                    {extras.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-white/5">
                                        <th className="text-left py-2 text-xs font-bold text-slate-500">Tipo</th>
                                        <th className="text-right py-2 text-xs font-bold text-slate-500">Valor</th>
                                        <th className="text-left py-2 text-xs font-bold text-slate-500">Descricao</th>
                                        <th className="text-left py-2 text-xs font-bold text-slate-500">Data/Hora</th>
                                        <th className="text-center py-2 text-xs font-bold text-slate-500">Remover</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {extras.map(ext => (
                                        <tr key={ext.id} className="border-b border-slate-100 dark:border-white/5 last:border-0">
                                            <td className="py-2">
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${ext.type === 'sangria' ? 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
                                                    {ext.type === 'sangria' ? 'Sangria' : 'Suprimento'}
                                                </span>
                                            </td>
                                            <td className={`text-right py-2 font-bold ${ext.type === 'sangria' ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(ext.value)}</td>
                                            <td className="py-2 text-slate-600 dark:text-slate-300">{ext.description || '-'}</td>
                                            <td className="py-2 text-xs text-slate-400">{new Date(ext.createdAt).toLocaleString('pt-BR')}</td>
                                            <td className="text-center py-2">
                                                <button onClick={() => handleRemoveExtra(ext.id)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {extras.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-4">Nenhuma sangria ou suprimento registrado.</p>
                    )}
                </div>
            )}

            {!loading && (
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5">
                    <label htmlFor="cash-close-observations" className="text-sm font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 mb-2 block">
                        Observacoes do Fechamento
                    </label>
                    <textarea
                        id="cash-close-observations"
                        rows={3}
                        maxLength={200}
                        placeholder="Anotar divergencias, notas ou justificativas..."
                        value={observations}
                        onChange={e => setObservations(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 text-right">{observations.length}/200</p>
                </div>
            )}

            {!loading && !validation.isValid && observations.trim() === '' && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                    <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-black text-amber-700 dark:text-amber-300">Divergencia detectada</p>
                        <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                            O total recebido ({formatCurrency(totalReceived)}) difere do esperado ({formatCurrency(totalExpected)}).
                            Ajuste os valores ou justifique no campo de observacoes para permitir o fechamento.
                        </p>
                    </div>
                </div>
            )}

            {!loading && !loadError && !hasDailyFinancialData && extras.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-border-dark dark:bg-card-dark">
                    <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5">
                        <Wallet size={20} />
                    </div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">Nenhuma movimentacao registrada</h3>
                    <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                        Nao encontramos lancamentos para {formattedFilterDate}. Adicione sangrias/suprimentos ou selecione outra data.
                    </p>
                </div>
            )}

            {!loading && (
                <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark p-8">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <span className="material-symbols-outlined text-2xl">fact_check</span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base font-bold text-slate-950 dark:text-white">Resumo do Fechamento</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Revise os valores antes de confirmar.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 p-4">
                            <p className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1">Entradas</p>
                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(totalEntradas)}</p>
                        </div>
                        <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800 p-4">
                            <p className="text-xs font-black uppercase text-rose-600 dark:text-rose-400 mb-1">Saidas</p>
                            <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{formatCurrency(totalSaidas)}</p>
                        </div>
                        <div className={`rounded-xl border p-4 ${validation.isValid ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-800'}`}>
                            <p className={`text-xs font-black uppercase mb-1 ${validation.isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>Diferenca</p>
                            <p className={`text-2xl font-black ${validation.isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatCurrency(validation.difference)}</p>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 dark:border-border-dark pt-6 flex flex-wrap gap-3">
                        <Button leftIcon="visibility" onClick={handlePreview} className="flex-1 min-w-[140px]">Pre-visualizar</Button>
                        <Button leftIcon="save" variant="secondary" onClick={() => setShowSaveConfirm(true)} disabled={loading || saving || !hasTenantContext} className="flex-1 min-w-[140px]">
                            {saving ? 'Salvando...' : 'Salvar Conferencia'}
                        </Button>
                        <Button
                            leftIcon="lock"
                            variant="success"
                            onClick={() => setShowCloseConfirm(true)}
                            disabled={loading || closing || !hasTenantContext || (!validation.isValid && observations.trim() === '')}
                            className="flex-1 min-w-[140px]"
                        >
                            {closing ? 'Fechando...' : 'Fechar Caixa'}
                        </Button>
                        <Button leftIcon="download" variant="secondary" onClick={handleExportCSV} className="flex-1 min-w-[140px]">Exportar CSV</Button>
                        <Button leftIcon="print" variant="secondary" onClick={handlePrint} className="flex-1 min-w-[140px]">Imprimir</Button>
                    </div>
                </div>
            )}

            <Modal isOpen={showSummary} onClose={() => setShowSummary(false)} title="Resumo Detalhado" maxWidth="lg">
                <div className="space-y-6">
                    {reversalEntries.length > 0 && (
                        <div>
                            <h4 className="text-xs font-black uppercase text-slate-500 mb-3">Estornos e devolucoes</h4>
                            <div className="space-y-2">
                                {reversalEntries.map((entry) => (
                                    <div key={entry.id} className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{entry.description}</p>
                                                <p className="text-xs text-slate-500">{getReversalTypeLabel(entry.reversalSource?.reversalType)}</p>
                                            </div>
                                            <p className="text-sm font-black text-amber-700 dark:text-amber-300">-{formatCurrency(entry.value)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <h4 className="text-xs font-black uppercase text-slate-500 mb-3">Agenda do Dia</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {Object.entries(agendaSummary).map(([key, val]) => (
                                <div key={key} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark">
                                    <div>
                                        <p className="text-xs font-bold text-slate-600">{key}: {val.count}</p>
                                        <p className="text-[10px] text-slate-400">{formatCurrency(val.total)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-500">
                        <span>Status: <strong className="text-slate-700 dark:text-slate-200">{closingStatus}</strong></span>
                        <span>Data: <strong className="text-slate-700 dark:text-slate-200">{formattedFilterDate}</strong></span>
                        <span>Operador: <strong className="text-slate-700 dark:text-slate-200">{getOperatorName(filters.operatorId)}</strong></span>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showPreview} onClose={() => setShowPreview(false)} title="Comprovante de Fechamento" maxWidth="lg">
                <div className="space-y-4">
                    <pre className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark rounded-xl p-4 text-xs font-mono whitespace-pre-wrap text-slate-700 dark:text-slate-200 max-h-[60vh] overflow-y-auto">
                        {previewText}
                    </pre>
                    <div className="flex gap-3">
                        <Button variant="secondary" leftIcon="print" onClick={handlePrint} className="flex-1">Imprimir</Button>
                        <Button leftIcon="download" onClick={handleExportCSV} className="flex-1">Exportar CSV</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showSaveConfirm} onClose={() => setShowSaveConfirm(false)} title="Salvar Conferencia" maxWidth="sm">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Confirma o salvamento da conferencia do dia <strong>{formattedFilterDate}</strong>?
                    </p>
                    <p className="text-xs text-slate-500">Este registro salva apenas um resumo. Nenhum lancamento e alterado.</p>
                    <div className="flex gap-3 pt-2">
                        <Button variant="secondary" leftIcon="rotate-ccw" onClick={() => setShowSaveConfirm(false)} className="flex-1">Cancelar</Button>
                        <Button leftIcon="save" onClick={handleSaveConference} disabled={saving} className="flex-1">{saving ? 'Salvando...' : 'Confirmar'}</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showCloseConfirm} onClose={() => setShowCloseConfirm(false)} title="Fechar Caixa" maxWidth="sm">
                <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-border-dark dark:bg-white/5">
                        <p className="text-xs font-black uppercase text-slate-500 mb-2">Resumo do Fechamento</p>
                        <div className="space-y-1 text-xs">
                            <p>Data: <strong className="text-slate-700 dark:text-slate-200">{formattedFilterDate}</strong></p>
                            <p>Total Esperado: <strong className="text-slate-700 dark:text-slate-200">{formatCurrency(totalExpected)}</strong></p>
                            <p>Total Recebido: <strong className="text-slate-700 dark:text-slate-200">{formatCurrency(totalReceived)}</strong></p>
                            <p>Diferenca: <strong className={validation.isValid ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(validation.difference)}</strong></p>
                            <p>Sangrias: <strong className="text-rose-600">{extras.filter(e => e.type === 'sangria').length} ({formatCurrency(totalExtrasSangria)})</strong></p>
                            <p>Suprimentos: <strong className="text-emerald-600">{extras.filter(e => e.type === 'suprimento').length} ({formatCurrency(totalExtrasSuprimento)})</strong></p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Ao fechar, as sangrias e suprimentos serao registrados como transacoes no sistema.
                    </p>
                    <div className="flex gap-3 pt-2">
                        <Button variant="secondary" leftIcon="rotate-ccw" onClick={() => setShowCloseConfirm(false)} className="flex-1">Cancelar</Button>
                        <Button leftIcon="lock" variant="success" onClick={handleCloseCash} disabled={closing} className="flex-1">{closing ? 'Fechando...' : 'Confirmar Fechamento'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CashClosingPage;
