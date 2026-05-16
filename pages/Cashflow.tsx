import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, CalendarRange, Wallet } from 'lucide-react';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import CashFlowChart from '../components/financial/CashFlowChart';
import FinancialSummaryCard from '../components/financial/FinancialSummaryCard';
import EmptyStateFinance from '../components/financial/EmptyStateFinance';
import { AuditAdjustmentButton } from '../components/audit';
import { EnrichedCashFlowEntry } from '../components/financial/types';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import {
    createReversalKey,
    reverseFinancialTransaction,
    type FinancialReversalType,
} from '../src/lib/finance/reversal';

type ActiveTab = 'all' | 'income' | 'expense';

interface TransactionRecord {
    id: string;
    tenant_id?: string | null;
    type: string;
    category: string | null;
    amount: number | string | null;
    description: string | null;
    payment_method: string | null;
    date: string | null;
    created_at?: string | null;
    status?: string | null;
    source_type?: string | null;
    source_id?: string | null;
}

interface FinancialReversalRecord {
    original_transaction_id: string | null;
    amount: number | string | null;
}

type CashflowEntry = EnrichedCashFlowEntry & {
    transactionType: string;
    transactionStatus: string | null;
    sourceType: string | null;
    sourceId: string | null;
    tenantId: string | null;
    reversedAmount: number;
    reversibleAmount: number;
    reversalStatus: 'none' | 'partial' | 'full';
};

type ReversalReason =
    | 'baixa_indevida'
    | 'cobranca_duplicada'
    | 'devolucao_ao_cliente'
    | 'erro_forma_pagamento'
    | 'erro_operacional'
    | 'cancelamento_administrativo'
    | 'cliente_duplicado'
    | 'outro';

type RefundMethod = 'pix' | 'cash' | 'credit' | 'debit' | 'other';

const toDateTimeInputValue = (date: Date) => {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const normalizeRefundMethod = (value?: string | null): RefundMethod => {
    const normalized = String(value || '').trim().toLowerCase();

    if (['pix', 'cash', 'credit', 'debit', 'other'].includes(normalized)) {
        return normalized as RefundMethod;
    }
    if (normalized.includes('dinheiro') || normalized.includes('cash')) return 'cash';
    if (normalized.includes('credito') || normalized.includes('credit')) return 'credit';
    if (normalized.includes('debito') || normalized.includes('debit')) return 'debit';
    if (normalized.includes('pix')) return 'pix';

    return 'pix';
};

const Cashflow: React.FC = () => {
    const { tenantId, accessRole, canAccessSuperAdmin } = useAuth();
    const hasTenantContext = Boolean(tenantId);
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
        const type = searchParams.get('type');
        if (type === 'income' || type === 'expense') return type;
        return 'all';
    });
    const [filterMonth, setFilterMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<CashflowEntry[]>([]);
    const [selectedEntry, setSelectedEntry] = useState<CashflowEntry | null>(null);
    const [reversalEntry, setReversalEntry] = useState<CashflowEntry | null>(null);
    const [reversalType, setReversalType] = useState<FinancialReversalType>('full_refund');
    const [reversalAmount, setReversalAmount] = useState('');
    const [refundMethod, setRefundMethod] = useState<RefundMethod>('pix');
    const [reversalDate, setReversalDate] = useState(() => toDateTimeInputValue(new Date()));
    const [reasonType, setReasonType] = useState<ReversalReason>('devolucao_ao_cliente');
    const [reasonNote, setReasonNote] = useState('');
    const [reversalConfirmed, setReversalConfirmed] = useState(false);
    const [reversalIdempotencyKey, setReversalIdempotencyKey] = useState<string | null>(null);
    const [reversingId, setReversingId] = useState<string | null>(null);

    const canRequestFinancialReversal =
        canAccessSuperAdmin || ['owner', 'admin', 'manager', 'superadmin'].includes(accessRole);

    const handleTabChange = (tab: ActiveTab) => {
        setActiveTab(tab);
        if (tab === 'all') {
            setSearchParams({});
        } else {
            setSearchParams({ type: tab });
        }
    };

    const fetchData = useCallback(async () => {
        if (!tenantId || !filterMonth) {
            setEntries([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const [yearStr, monthStr] = filterMonth.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        const startOfMonth = new Date(year, month - 1, 1).toISOString();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('id, tenant_id, type, category, amount, description, payment_method, date, created_at, status, source_type, source_id')
                .eq('tenant_id', tenantId)
                .gte('date', startOfMonth)
                .lte('date', endOfMonth)
                .order('date', { ascending: true });

            if (error) throw error;

            const transactions = (data || []) as TransactionRecord[];
            const transactionIds = transactions.map((transaction) => transaction.id).filter(Boolean);
            const reversedByTransactionId = new Map<string, number>();

            if (transactionIds.length > 0) {
                const { data: reversals, error: reversalsError } = await supabase
                    .from('financial_reversals')
                    .select('original_transaction_id, amount')
                    .eq('tenant_id', tenantId)
                    .in('original_transaction_id', transactionIds);

                if (reversalsError) {
                    console.warn('Nao foi possivel carregar reversoes financeiras:', reversalsError);
                } else {
                    ((reversals || []) as FinancialReversalRecord[]).forEach((reversal) => {
                        if (!reversal.original_transaction_id) return;
                        const amount = Math.abs(Number(reversal.amount || 0));
                        reversedByTransactionId.set(
                            reversal.original_transaction_id,
                            (reversedByTransactionId.get(reversal.original_transaction_id) || 0) + amount,
                        );
                    });
                }
            }

            let runningBalance = 0;
            const mappedEntries: CashflowEntry[] = transactions.map((transaction) => {
                const type = transaction.type === 'income' ? 'entrada' : 'saida';
                const value = Number(transaction.amount || 0);
                const reversedAmount = Math.min(value, reversedByTransactionId.get(transaction.id) || 0);
                const reversibleAmount = Math.max(value - reversedAmount, 0);
                const reversalStatus = reversedAmount <= 0
                    ? 'none'
                    : reversibleAmount <= 0
                        ? 'full'
                        : 'partial';
                runningBalance += type === 'entrada' ? value : -value;

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
                    runningBalance,
                    transactionType: transaction.type,
                    transactionStatus: transaction.status || null,
                    sourceType: transaction.source_type || null,
                    sourceId: transaction.source_id || null,
                    tenantId: transaction.tenant_id || tenantId,
                    reversedAmount,
                    reversibleAmount,
                    reversalStatus,
                };
            });

            setEntries(mappedEntries);
        } catch (error: any) {
            console.error('Erro ao carregar fluxo de caixa:', error);
            setToast({ message: error?.message || 'Erro ao carregar fluxo de caixa.', type: 'error' });
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [filterMonth, tenantId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totalEntradas = entries
        .filter((entry) => entry.type === 'entrada')
        .reduce((sum, entry) => sum + entry.value, 0);
    const totalSaidas = entries
        .filter((entry) => entry.type === 'saida')
        .reduce((sum, entry) => sum + entry.value, 0);
    const saldoAtual = totalEntradas - totalSaidas;
    const ticketMedioEntrada = entries.filter((entry) => entry.type === 'entrada').length > 0
        ? totalEntradas / entries.filter((entry) => entry.type === 'entrada').length
        : 0;

    const filteredEntries = entries.filter((entry) => {
        if (activeTab === 'all') return true;
        if (activeTab === 'income') return entry.type === 'entrada';
        if (activeTab === 'expense') return entry.type === 'saida';
        return true;
    });

    const isReversalEligible = (entry: CashflowEntry) => (
        canRequestFinancialReversal
        && entry.transactionType === 'income'
        && (entry.transactionStatus === 'paid' || entry.transactionStatus === 'Pago' || !entry.transactionStatus)
        && entry.sourceType === 'comanda'
        && Boolean(entry.tenantId)
        && Boolean(entry.id)
        && entry.reversibleAmount > 0
    );

    const openReversalModal = (entry: CashflowEntry) => {
        setReversalEntry(entry);
        setReversalType('full_refund');
        setReversalAmount(entry.reversibleAmount.toFixed(2));
        setRefundMethod(normalizeRefundMethod(entry.paymentMethod));
        setReversalDate(toDateTimeInputValue(new Date()));
        setReasonType('devolucao_ao_cliente');
        setReasonNote('');
        setReversalConfirmed(false);
        setReversalIdempotencyKey(createReversalKey(entry.id));
    };

    const closeReversalModal = () => {
        if (reversingId) return;
        setReversalEntry(null);
        setReasonNote('');
        setReversalConfirmed(false);
        setReversalIdempotencyKey(null);
    };

    const handleConfirmReversal = async () => {
        if (!tenantId || !reversalEntry) {
            setToast({ message: 'Contexto invalido para reversao financeira.', type: 'error' });
            return;
        }

        const amount = Number(String(reversalAmount).replace(',', '.'));
        const requiresRefundMethod = reversalType === 'full_refund' || reversalType === 'partial_refund';
        const parsedReversalDate = new Date(reversalDate);

        if (!Number.isFinite(amount) || amount <= 0 || amount > reversalEntry.reversibleAmount) {
            setToast({ message: 'Informe um valor de reversao valido.', type: 'error' });
            return;
        }
        if (!reversalDate || Number.isNaN(parsedReversalDate.getTime())) {
            setToast({ message: 'Informe uma data real de reversao valida.', type: 'error' });
            return;
        }
        if (requiresRefundMethod && !refundMethod) {
            setToast({ message: 'Informe a forma de devolucao.', type: 'error' });
            return;
        }
        if (!reasonType || !reasonNote.trim()) {
            setToast({ message: 'Informe motivo e observacao para continuar.', type: 'error' });
            return;
        }
        if (!reversalConfirmed) {
            setToast({ message: 'Confirme que a transaction original sera preservada.', type: 'error' });
            return;
        }

        setReversingId(reversalEntry.id);
        setToast({ message: 'Registrando reversao financeira...', type: 'info' });
        try {
            await reverseFinancialTransaction({
                tenantId,
                originalTransactionId: reversalEntry.id,
                supabase,
                reversalType,
                amount,
                reasonType,
                reasonNote,
                refundMethod: requiresRefundMethod ? refundMethod : null,
                reversalDate: parsedReversalDate.toISOString(),
                idempotencyKey: reversalIdempotencyKey || createReversalKey(reversalEntry.id),
            });
            setToast({ message: 'Reversao financeira registrada com sucesso.', type: 'success' });
            setReversalEntry(null);
            setReasonNote('');
            setReversalConfirmed(false);
            setReversalIdempotencyKey(null);
            await fetchData();
        } catch (error: any) {
            console.error('Erro ao registrar reversao financeira:', error);
            setToast({ message: error?.message || 'Não foi possível registrar a reversão financeira. Nenhuma alteração foi aplicada.', type: 'error' });
        } finally {
            setReversingId(null);
        }
    };

    const tabTitles: Record<ActiveTab, string> = {
        all: 'Fluxo de Caixa',
        income: 'Entradas',
        expense: 'Saídas',
    };

    const chartData = useMemo(() => {
        const grouped = entries.reduce<Record<string, { entradas: number; saidas: number; saldo: number }>>((acc, entry) => {
            const label = new Date(`${entry.date}`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            if (!acc[label]) {
                acc[label] = { entradas: 0, saidas: 0, saldo: 0 };
            }

            if (entry.type === 'entrada') {
                acc[label].entradas += entry.value;
                acc[label].saldo += entry.value;
            } else {
                acc[label].saidas += entry.value;
                acc[label].saldo -= entry.value;
            }

            return acc;
        }, {});

        let runningBalance = 0;
        const entriesData = Object.entries(grouped) as [string, { entradas: number; saidas: number; saldo: number }][];
        return entriesData.map(([label, value]) => {
            runningBalance += value.saldo;
            return {
                label,
                entradas: value.entradas,
                saidas: value.saidas,
                saldo: runningBalance,
            };
        });
    }, [entries]);

    const handleExport = () => {
        if (entries.length === 0) {
            setToast({ message: 'Nao ha dados para exportar neste periodo.', type: 'info' });
            return;
        }

        const headers = ['Data', 'Descricao', 'Categoria', 'Forma de pagamento', 'Tipo', 'Valor', 'Saldo acumulado'];
        const rows = entries.map((entry) => [
            new Date(entry.date).toLocaleDateString('pt-BR'),
            entry.description,
            entry.category,
            entry.paymentMethod,
            entry.type,
            entry.value.toFixed(2).replace('.', ','),
            entry.runningBalance.toFixed(2).replace('.', ','),
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csvContent));
        link.setAttribute('download', `fluxo-caixa-${filterMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setToast({ message: 'Fluxo exportado com sucesso.', type: 'success' });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{tabTitles[activeTab]}</h2>
                    <p className="text-slate-500 mt-1">Leitura real das transacoes financeiras registradas no periodo.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <AuditAdjustmentButton
                        context={{
                            sourceType: 'cashflow',
                            sourceLabel: 'Fluxo de Caixa',
                            beforeSnapshot: {
                                entradas: totalEntradas,
                                saidas: totalSaidas,
                                saldo: saldoAtual,
                                registros: filteredEntries.length,
                                mes: filterMonth,
                                aba: activeTab,
                            },
                            financialImpactLabel: 'Impacto potencial em classificacao, caixa e relatorios',
                            allowedAdjustmentTypes: [
                                'transaction_reclassification',
                                'payment_date_correction',
                                'payment_method_correction',
                                'hide_from_financial_with_reason',
                                'mark_for_review',
                            ],
                        }}
                        defaultAdjustmentType="transaction_reclassification"
                    />
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2.5">
                        <CalendarRange className="h-4 w-4 text-slate-400" />
                        <input
                            type="month"
                            value={filterMonth}
                            onChange={(event) => setFilterMonth(event.target.value)}
                            className="bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                        />
                    </label>
                    <Button variant="secondary" leftIcon="download" onClick={handleExport}>
                        Exportar
                    </Button>
                    <Button leftIcon="sync" onClick={fetchData}>
                        Atualizar
                    </Button>
                </div>
            </div>

            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-xl w-fit">
                <button
                    onClick={() => handleTabChange('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'all'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    Todos
                </button>
                <button
                    onClick={() => handleTabChange('income')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'income'
                            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    Entradas
                </button>
                <button
                    onClick={() => handleTabChange('expense')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'expense'
                            ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    Saídas
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <FinancialSummaryCard
                    title="Entradas"
                    value={totalEntradas}
                    changeText={`${entries.filter((entry) => entry.type === 'entrada').length} registros`}
                    trend="up"
                    tone="positive"
                    helperText="Total de receitas do periodo"
                    icon={<ArrowUpCircle size={18} />}
                />
                <FinancialSummaryCard
                    title="Saidas"
                    value={totalSaidas}
                    changeText={`${entries.filter((entry) => entry.type === 'saida').length} registros`}
                    trend="down"
                    tone="negative"
                    helperText="Total de despesas do periodo"
                    icon={<ArrowDownCircle size={18} />}
                />
                <FinancialSummaryCard
                    title="Saldo atual"
                    value={saldoAtual}
                    changeText={saldoAtual >= 0 ? 'Fechamento positivo' : 'Fechamento negativo'}
                    trend={saldoAtual >= 0 ? 'up' : 'down'}
                    tone={saldoAtual >= 0 ? 'positive' : 'negative'}
                    helperText="Entradas menos saidas no periodo"
                    icon={<Wallet size={18} />}
                />
                <FinancialSummaryCard
                    title="Ticket medio"
                    value={ticketMedioEntrada}
                    changeText="Receitas por lancamento"
                    trend="up"
                    tone="neutral"
                    helperText="Media das entradas registradas"
                    icon={<Wallet size={18} />}
                />
            </div>

            {loading ? (
                <section className="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-10 text-center">
                    <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <p className="mt-3 text-sm text-slate-500">Carregando transacoes do periodo...</p>
                </section>
            ) : filteredEntries.length === 0 ? (
                <EmptyStateFinance
                    title="Nenhuma movimentacao encontrada"
                    description={
                        hasTenantContext
                            ? 'Nao ha transacoes registradas para o periodo selecionado.'
                            : 'Esta conta nao possui contexto de tenant para consultar o financeiro.'
                    }
                    actionLabel="Atualizar"
                    onAction={fetchData}
                />
            ) : (
                <>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <CashFlowChart
                            title="Entradas x saidas"
                            subtitle="Comparativo diario das transacoes registradas"
                            variant="bar"
                            data={chartData}
                        />
                        <CashFlowChart
                            title="Saldo acumulado"
                            subtitle="Evolucao real do saldo ao longo do periodo"
                            variant="area"
                            data={chartData}
                        />
                    </div>

                    <section className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark overflow-hidden">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-border-dark px-5 py-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-950 dark:text-white">Lancamentos do periodo</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Tabela somente leitura com dados reais do financeiro.</p>
                            </div>
                            <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                                {filteredEntries.length} registros
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left">
                                <thead className="bg-slate-50/90 dark:bg-white/5">
                                    <tr>
                                        {['Data', 'Descricao', 'Categoria', 'Forma de pagamento', 'Tipo', 'Valor', 'Saldo', 'Acao'].map((column) => (
                                            <th key={column} className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                                {column}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {filteredEntries.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5">
                                            <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">{new Date(entry.date).toLocaleDateString('pt-BR')}</td>
                                            <td className="px-5 py-4 text-sm font-semibold text-slate-900 dark:text-white">{entry.description}</td>
                                            <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">{entry.category}</td>
                                            <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">{entry.paymentMethod}</td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${entry.type === 'entrada' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                                                    {entry.type}
                                                </span>
                                            </td>
                                            <td className={`px-5 py-4 text-sm font-bold ${entry.type === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {entry.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                {entry.reversalStatus !== 'none' && (
                                                    <span className="mt-1 block text-[11px] font-bold text-amber-600 dark:text-amber-300">
                                                        {entry.reversalStatus === 'full' ? 'Estornado total' : 'Estornado parcial'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                                                {entry.runningBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {isReversalEligible(entry) && (
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            className="rounded-xl text-amber-700 dark:text-amber-300"
                                                            onClick={() => openReversalModal(entry)}
                                                            disabled={Boolean(reversingId)}
                                                        >
                                                            Estornar
                                                        </Button>
                                                    )}
                                                    <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => setSelectedEntry(entry)}>
                                                        Ver detalhes
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}

            <Modal
                isOpen={!!reversalEntry}
                onClose={closeReversalModal}
                title="Estorno / devolucao auditada"
                maxWidth="lg"
            >
                {reversalEntry && (
                    <div className="space-y-5">
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                            <p className="font-bold">A transaction original nao sera apagada. O sistema criara uma movimentacao reversa auditada.</p>
                            <p className="mt-2">Use estorno apenas quando houver erro de baixa, devolucao ao cliente ou correcao financeira autorizada.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Transaction original</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{reversalEntry.description}</p>
                                <p className="mt-1 text-xs text-slate-500">{reversalEntry.id}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Valor original</p>
                                <p className="mt-2 text-lg font-black text-emerald-600 dark:text-emerald-400">
                                    {reversalEntry.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                                {reversalEntry.reversedAmount > 0 && (
                                    <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
                                        Ja revertido: {reversalEntry.reversedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                )}
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                    Saldo reversivel: {reversalEntry.reversibleAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="space-y-2">
                                <span className="text-xs font-bold uppercase text-slate-500">Tipo de reversao</span>
                                <select
                                    value={reversalType}
                                    onChange={(event) => setReversalType(event.target.value as FinancialReversalType)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white"
                                >
                                    <option value="wrong_settlement">Baixa indevida</option>
                                    <option value="full_refund">Devolucao total</option>
                                    <option value="partial_refund">Devolucao parcial</option>
                                </select>
                            </label>

                            <label className="space-y-2">
                                <span className="text-xs font-bold uppercase text-slate-500">Valor a reverter</span>
                                <input
                                    type="number"
                                    min="0.01"
                                    max={reversalEntry.reversibleAmount}
                                    step="0.01"
                                    value={reversalAmount}
                                    onChange={(event) => setReversalAmount(event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white"
                                />
                            </label>

                            <label className="space-y-2">
                                <span className="text-xs font-bold uppercase text-slate-500">Forma de devolucao</span>
                                <select
                                    value={refundMethod}
                                    onChange={(event) => setRefundMethod(event.target.value as RefundMethod)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white"
                                >
                                    <option value="pix">Pix</option>
                                    <option value="cash">Dinheiro</option>
                                    <option value="credit">Cartao de credito</option>
                                    <option value="debit">Cartao de debito</option>
                                    <option value="other">Outro</option>
                                </select>
                            </label>

                            <label className="space-y-2">
                                <span className="text-xs font-bold uppercase text-slate-500">Data real da reversao</span>
                                <input
                                    type="datetime-local"
                                    value={reversalDate}
                                    onChange={(event) => setReversalDate(event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                                />
                            </label>

                            <label className="space-y-2 md:col-span-2">
                                <span className="text-xs font-bold uppercase text-slate-500">Motivo</span>
                                <select
                                    value={reasonType}
                                    onChange={(event) => setReasonType(event.target.value as ReversalReason)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white"
                                >
                                    <option value="baixa_indevida">Baixa indevida</option>
                                    <option value="cobranca_duplicada">Cobranca duplicada</option>
                                    <option value="devolucao_ao_cliente">Devolucao ao cliente</option>
                                    <option value="erro_forma_pagamento">Erro de forma de pagamento</option>
                                    <option value="erro_operacional">Erro operacional</option>
                                    <option value="cancelamento_administrativo">Cancelamento administrativo</option>
                                    <option value="cliente_duplicado">Cliente duplicado</option>
                                    <option value="outro">Outro</option>
                                </select>
                            </label>

                            <label className="space-y-2 md:col-span-2">
                                <span className="text-xs font-bold uppercase text-slate-500">Observacao obrigatoria</span>
                                <textarea
                                    value={reasonNote}
                                    onChange={(event) => setReasonNote(event.target.value)}
                                    rows={3}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white"
                                    placeholder="Descreva o contexto do estorno/devolucao para auditoria."
                                />
                            </label>
                        </div>

                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-600 dark:border-border-dark dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={reversalConfirmed}
                                onChange={(event) => setReversalConfirmed(event.target.checked)}
                                className="mt-1 size-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span>
                                Confirmo que esta acao criara uma movimentacao reversa auditada e preservara a transaction original.
                            </span>
                        </label>

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-slate-200 pt-4 dark:border-border-dark">
                            <Button variant="secondary" onClick={closeReversalModal} disabled={Boolean(reversingId)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleConfirmReversal} disabled={reversingId === reversalEntry.id}>
                                {reversingId === reversalEntry.id ? 'Registrando...' : 'Confirmar estorno'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={!!selectedEntry}
                onClose={() => setSelectedEntry(null)}
                title={selectedEntry ? `Lancamento ${selectedEntry.type}` : 'Detalhes do lancamento'}
                maxWidth="lg"
            >
                {selectedEntry && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Descricao</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedEntry.description}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Data</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{new Date(selectedEntry.date).toLocaleString('pt-BR')}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Categoria</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedEntry.category}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Forma de pagamento</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedEntry.paymentMethod}</p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                            <p className="text-xs font-bold uppercase text-slate-500">Valor</p>
                            <p className={`mt-2 text-2xl font-black ${selectedEntry.type === 'entrada' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {selectedEntry.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            {selectedEntry.reversalStatus !== 'none' && (
                                <p className="mt-2 text-sm font-semibold text-amber-600 dark:text-amber-300">
                                    Revertido: {selectedEntry.reversedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Cashflow;
