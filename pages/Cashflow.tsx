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
import {
    getTransactionStatusBucket,
    isCancelledTransactionStatus,
} from '../src/lib/finance/transactionStatus';
import { downloadCsv } from '../src/lib/export/csv';

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
    reversal_transaction_id?: string | null;
    reversal_type?: string | null;
    amount: number | string | null;
    reason_type?: string | null;
    created_at?: string | null;
}

type CashflowReversalSummary = {
    reversalTransactionId: string | null;
    reversalType: string;
    amount: number;
    reasonType: string;
    createdAt: string | null;
};

type CashflowReversalSource = CashflowReversalSummary & {
    originalTransactionId: string | null;
};

type CashflowEntry = EnrichedCashFlowEntry & {
    transactionType: string;
    transactionStatus: string | null;
    sourceType: string | null;
    sourceId: string | null;
    tenantId: string | null;
    reversedAmount: number;
    reversibleAmount: number;
    reversalStatus: 'none' | 'partial' | 'full';
    reversals: CashflowReversalSummary[];
    isReversalTransaction: boolean;
    reversalSource: CashflowReversalSource | null;
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

const CASHFLOW_EMPTY_COPY: Record<ActiveTab, { title: string; description: string }> = {
    all: {
        title: 'Nenhuma movimentação encontrada',
        description: 'Não há transações registradas para o período selecionado.',
    },
    income: {
        title: 'Nenhuma entrada encontrada',
        description: 'Entradas registradas no período aparecerão aqui.',
    },
    expense: {
        title: 'Nenhuma saída encontrada',
        description: 'Saídas, estornos e devoluções registradas no período aparecerão aqui.',
    },
};

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

const getReversalTypeLabel = (value?: string | null) => {
    if (value === 'wrong_settlement') return 'Estorno';
    if (value === 'full_refund') return 'Devolucao total';
    if (value === 'partial_refund') return 'Devolucao parcial';
    return 'Reversao';
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
    const [loadError, setLoadError] = useState<string | null>(null);
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
            setLoadError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setLoadError(null);

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
            const reversalsByTransactionId = new Map<string, CashflowReversalSummary[]>();
            const reversalSourceByTransactionId = new Map<string, CashflowReversalSource>();

            if (transactionIds.length > 0) {
                const { data: reversals, error: reversalsError } = await supabase
                    .from('financial_reversals')
                    .select('original_transaction_id, reversal_transaction_id, reversal_type, amount, reason_type, created_at')
                    .eq('tenant_id', tenantId)
                    .in('original_transaction_id', transactionIds);

                if (reversalsError) {
                    console.warn('Não foi possível carregar reversões financeiras:', reversalsError);
                } else {
                    ((reversals || []) as FinancialReversalRecord[]).forEach((reversal) => {
                        if (!reversal.original_transaction_id) return;
                        const amount = Math.abs(Number(reversal.amount || 0));
                        reversedByTransactionId.set(
                            reversal.original_transaction_id,
                            (reversedByTransactionId.get(reversal.original_transaction_id) || 0) + amount,
                        );
                        const currentReversals = reversalsByTransactionId.get(reversal.original_transaction_id) || [];
                        currentReversals.push({
                            reversalTransactionId: reversal.reversal_transaction_id || null,
                            reversalType: reversal.reversal_type || 'reversal',
                            amount,
                            reasonType: reversal.reason_type || 'Sem motivo informado',
                            createdAt: reversal.created_at || null,
                        });
                        reversalsByTransactionId.set(reversal.original_transaction_id, currentReversals);
                    });
                }

                const { data: reversalSources, error: reversalSourcesError } = await supabase
                    .from('financial_reversals')
                    .select('original_transaction_id, reversal_transaction_id, reversal_type, amount, reason_type, created_at')
                    .eq('tenant_id', tenantId)
                    .in('reversal_transaction_id', transactionIds);

                if (reversalSourcesError) {
                    console.warn('Não foi possível carregar vínculos de movimentações reversas:', reversalSourcesError);
                } else {
                    ((reversalSources || []) as FinancialReversalRecord[]).forEach((reversal) => {
                        if (!reversal.reversal_transaction_id) return;
                        reversalSourceByTransactionId.set(reversal.reversal_transaction_id, {
                            originalTransactionId: reversal.original_transaction_id || null,
                            reversalTransactionId: reversal.reversal_transaction_id,
                            reversalType: reversal.reversal_type || 'reversal',
                            amount: Math.abs(Number(reversal.amount || 0)),
                            reasonType: reversal.reason_type || 'Sem motivo informado',
                            createdAt: reversal.created_at || null,
                        });
                    });
                }
            }

            let runningBalance = 0;
            const mappedEntries: CashflowEntry[] = transactions
                .filter((transaction) => !isCancelledTransactionStatus(transaction.status))
                .map((transaction) => {
                const type = transaction.type === 'income' ? 'entrada' : 'saida';
                const value = Number(transaction.amount || 0);
                const statusBucket = getTransactionStatusBucket(transaction.status);
                const entryStatus = statusBucket === 'realized' ? 'realizado' : 'previsto';
                const reversals = reversalsByTransactionId.get(transaction.id) || [];
                const reversalSource = reversalSourceByTransactionId.get(transaction.id) || null;
                const reversedAmount = Math.min(value, reversedByTransactionId.get(transaction.id) || 0);
                const reversibleAmount = Math.max(value - reversedAmount, 0);
                const reversalStatus = reversedAmount <= 0
                    ? 'none'
                    : reversibleAmount <= 0
                        ? 'full'
                        : 'partial';
                if (entryStatus === 'realizado') {
                    runningBalance += type === 'entrada' ? value : -value;
                }

                return {
                    id: transaction.id,
                    date: transaction.date || transaction.created_at || new Date().toISOString(),
                    description: transaction.description || transaction.category || 'Lancamento sem descricao',
                    category: transaction.category || 'Sem categoria',
                    accountId: transaction.payment_method || 'nao-informado',
                    accountName: transaction.payment_method || 'Não informado',
                    costCenter: transaction.category || 'Sem centro',
                    type,
                    paymentMethod: transaction.payment_method || 'Não informado',
                    status: entryStatus,
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
                    reversals,
                    isReversalTransaction: Boolean(reversalSource),
                    reversalSource,
                };
            });

            setEntries(mappedEntries);
        } catch (error: any) {
            console.error('Erro ao carregar fluxo de caixa:', error);
            const message = 'Não foi possível carregar o fluxo de caixa. Nenhuma movimentação foi alterada.';
            setLoadError(message);
            setToast({ message, type: 'error' });
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [filterMonth, tenantId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const realizedEntries = entries.filter((entry) => entry.status === 'realizado');
    const totalEntradas = realizedEntries
        .filter((entry) => entry.type === 'entrada')
        .reduce((sum, entry) => sum + entry.value, 0);
    const totalSaidas = realizedEntries
        .filter((entry) => entry.type === 'saida')
        .reduce((sum, entry) => sum + entry.value, 0);
    const saldoAtual = totalEntradas - totalSaidas;
    const realizedIncomeEntries = realizedEntries.filter((entry) => entry.type === 'entrada');
    const ticketMedioEntrada = realizedIncomeEntries.length > 0
        ? totalEntradas / realizedIncomeEntries.length
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
        && entry.status === 'realizado'
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
            setToast({ message: 'Contexto inválido para reversão financeira.', type: 'error' });
            return;
        }

        const amount = Number(String(reversalAmount).replace(',', '.'));
        const requiresRefundMethod = reversalType === 'full_refund' || reversalType === 'partial_refund';
        const parsedReversalDate = new Date(reversalDate);

        if (!Number.isFinite(amount) || amount <= 0 || amount > reversalEntry.reversibleAmount) {
            setToast({ message: 'Informe um valor de reversão válido.', type: 'error' });
            return;
        }
        if (!reversalDate || Number.isNaN(parsedReversalDate.getTime())) {
            setToast({ message: 'Informe uma data real de reversão válida.', type: 'error' });
            return;
        }
        if (requiresRefundMethod && !refundMethod) {
            setToast({ message: 'Informe a forma de devolução.', type: 'error' });
            return;
        }
        if (!reasonType || !reasonNote.trim()) {
            setToast({ message: 'Informe motivo e observação para continuar.', type: 'error' });
            return;
        }
        if (!reversalConfirmed) {
            setToast({ message: 'Confirme que a transaction original sera preservada.', type: 'error' });
            return;
        }

        setReversingId(reversalEntry.id);
        setToast({ message: 'Registrando reversão financeira...', type: 'info' });
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
            setToast({ message: 'Reversão financeira registrada com sucesso.', type: 'success' });
            setReversalEntry(null);
            setReasonNote('');
            setReversalConfirmed(false);
            setReversalIdempotencyKey(null);
            await fetchData();
        } catch (error: any) {
            console.error('Erro ao registrar reversão financeira:', error);
            const message = error?.message?.includes('Nenhuma alteração foi aplicada')
                ? error.message
                : 'Não foi possível registrar a reversão financeira. Nenhuma alteração foi aplicada.';
            setToast({ message, type: 'error' });
        } finally {
            setReversingId(null);
        }
    };

    const tabTitles: Record<ActiveTab, string> = {
        all: 'Fluxo de Caixa',
        income: 'Entradas',
        expense: 'Saídas',
    };

    const emptyStateCopy = hasTenantContext
        ? CASHFLOW_EMPTY_COPY[activeTab]
        : {
            title: 'Sem contexto da unidade',
            description: 'Selecione uma unidade valida para consultar o fluxo de caixa.',
        };

    const chartData = useMemo(() => {
        const grouped = realizedEntries.reduce<Record<string, { entradas: number; saidas: number; saldo: number }>>((acc, entry) => {
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
    }, [realizedEntries]);

    const handleExport = () => {
        if (filteredEntries.length === 0) {
            setToast({ message: 'Não há dados para exportar neste período.', type: 'info' });
            return;
        }

        const headers = [
            'Data',
            'Descrição',
            'Categoria',
            'Forma de pagamento',
            'Tipo',
            'Valor',
            'Saldo acumulado',
            'Status de reversão',
            'Valor revertido',
            'Saldo reversível',
            'Origem',
            'Histórico de reversões',
            'Movimentação reversa',
            'Transaction original',
        ];
        const rows = filteredEntries.map((entry) => [
            new Date(entry.date).toLocaleDateString('pt-BR'),
            entry.description,
            entry.category,
            entry.paymentMethod,
            entry.type,
            entry.value.toFixed(2).replace('.', ','),
            entry.runningBalance.toFixed(2).replace('.', ','),
            entry.reversalStatus === 'full'
                ? 'Estornado total'
                : entry.reversalStatus === 'partial'
                    ? 'Estornado parcial'
                    : 'Sem reversão',
            entry.reversedAmount.toFixed(2).replace('.', ','),
            entry.reversibleAmount.toFixed(2).replace('.', ','),
            entry.sourceType || 'Não informado',
            entry.reversals.length > 0
                ? entry.reversals
                    .map((reversal) => {
                        const date = reversal.createdAt
                            ? new Date(reversal.createdAt).toLocaleDateString('pt-BR')
                            : 'data não informada';
                        return `${reversal.amount.toFixed(2).replace('.', ',')} em ${date} (${reversal.reversalType} / ${reversal.reasonType})`;
                    })
                    .join(' | ')
                : 'Sem reversões',
            entry.isReversalTransaction ? 'Sim' : 'Não',
            entry.reversalSource?.originalTransactionId || '',
        ]);

        downloadCsv({
            filenameBase: `fluxo-caixa-${filterMonth}`,
            headers,
            rows,
        });
        setToast({ message: 'Fluxo exportado com sucesso.', type: 'success' });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{tabTitles[activeTab]}</h2>
                    <p className="text-slate-500 mt-1">Leitura real das transações financeiras registradas no período.</p>
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
                            financialImpactLabel: 'Impacto potencial em classificação, caixa e relatórios',
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
                    helperText="Total de receitas do período"
                    icon={<ArrowUpCircle size={18} />}
                />
                <FinancialSummaryCard
                    title="Saidas"
                    value={totalSaidas}
                    changeText={`${entries.filter((entry) => entry.type === 'saida').length} registros`}
                    trend="down"
                    tone="negative"
                    helperText="Total de despesas do período"
                    icon={<ArrowDownCircle size={18} />}
                />
                <FinancialSummaryCard
                    title="Saldo atual"
                    value={saldoAtual}
                    changeText={saldoAtual >= 0 ? 'Fechamento positivo' : 'Fechamento negativo'}
                    trend={saldoAtual >= 0 ? 'up' : 'down'}
                    tone={saldoAtual >= 0 ? 'positive' : 'negative'}
                    helperText="Entradas menos saídas no período"
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

            {loadError && (
                <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-black">Falha ao carregar fluxo de caixa</p>
                            <p className="mt-1">{loadError}</p>
                        </div>
                        <Button type="button" variant="secondary" onClick={fetchData}>
                            Tentar novamente
                        </Button>
                    </div>
                </section>
            )}

            {loading ? (
                <section className="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-10 text-center">
                    <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <h3 className="mt-4 text-base font-black text-slate-950 dark:text-white">Carregando fluxo de caixa</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                        Buscando entradas, saídas, estornos e devoluções do período selecionado.
                    </p>
                </section>
            ) : filteredEntries.length === 0 ? (
                <EmptyStateFinance
                    title={emptyStateCopy.title}
                    description={emptyStateCopy.description}
                    actionLabel="Atualizar"
                    onAction={fetchData}
                />
            ) : (
                <>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <CashFlowChart
                            title="Entradas x saídas"
                            subtitle="Comparativo diário das transações registradas"
                            variant="bar"
                            data={chartData}
                        />
                        <CashFlowChart
                            title="Saldo acumulado"
                            subtitle="Evolução real do saldo ao longo do período"
                            variant="area"
                            data={chartData}
                        />
                    </div>

                    <section className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark overflow-hidden">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-border-dark px-5 py-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-950 dark:text-white">Lançamentos do período</h3>
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
                                        {['Data', 'Descrição', 'Categoria', 'Forma de pagamento', 'Tipo', 'Valor', 'Saldo', 'Ação'].map((column) => (
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
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${entry.type === 'entrada' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                                                        {entry.type}
                                                    </span>
                                                    {entry.isReversalTransaction && (
                                                        <span className="inline-flex rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold uppercase text-rose-600 dark:text-rose-300">
                                                            {getReversalTypeLabel(entry.reversalSource?.reversalType)}
                                                        </span>
                                                    )}
                                                    {entry.reversalStatus !== 'none' && (
                                                        <span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300">
                                                            Original {entry.reversalStatus === 'full' ? 'revertida' : 'parcial'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={`px-5 py-4 text-sm font-bold ${entry.type === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {entry.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                {entry.reversalStatus !== 'none' && (
                                                    <span className="mt-1 block text-[11px] font-bold text-amber-600 dark:text-amber-300">
                                                        {entry.reversalStatus === 'full' ? 'Estornado total' : 'Estornado parcial'}
                                                    </span>
                                                )}
                                                {entry.isReversalTransaction && (
                                                    <span className="mt-1 block text-[11px] font-bold text-rose-600 dark:text-rose-300">
                                                        Movimentação reversa auditada
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
                                                            title="A reversão será registrada pela RPC financeira; a transaction original será preservada."
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
                title="Estorno / devolução auditada"
                maxWidth="lg"
            >
                {reversalEntry && (
                    <div className="space-y-5">
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                            <p className="font-bold">A transaction original não será apagada. O sistema criará uma movimentação reversa auditada.</p>
                            <p className="mt-2">Use estorno apenas quando houver erro de baixa, devolução ao cliente ou correção financeira autorizada.</p>
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
                                        Já revertido: {reversalEntry.reversedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                )}
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                    Saldo reversível: {reversalEntry.reversibleAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="space-y-2">
                                <span className="text-xs font-bold uppercase text-slate-500">Tipo de reversão</span>
                                <select
                                    value={reversalType}
                                    onChange={(event) => setReversalType(event.target.value as FinancialReversalType)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white"
                                >
                                    <option value="wrong_settlement">Baixa indevida</option>
                                    <option value="full_refund">Devolução total</option>
                                    <option value="partial_refund">Devolução parcial</option>
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
                                <span className="text-xs font-bold uppercase text-slate-500">Forma de devolução</span>
                                <select
                                    value={refundMethod}
                                    onChange={(event) => setRefundMethod(event.target.value as RefundMethod)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white"
                                >
                                    <option value="pix">Pix</option>
                                    <option value="cash">Dinheiro</option>
                                    <option value="credit">Cartão de crédito</option>
                                    <option value="debit">Cartão de débito</option>
                                    <option value="other">Outro</option>
                                </select>
                            </label>

                            <label className="space-y-2">
                                <span className="text-xs font-bold uppercase text-slate-500">Data real da reversão</span>
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
                                    <option value="cobranca_duplicada">Cobrança duplicada</option>
                                    <option value="devolucao_ao_cliente">Devolução ao cliente</option>
                                    <option value="erro_forma_pagamento">Erro de forma de pagamento</option>
                                    <option value="erro_operacional">Erro operacional</option>
                                    <option value="cancelamento_administrativo">Cancelamento administrativo</option>
                                    <option value="cliente_duplicado">Cliente duplicado</option>
                                    <option value="outro">Outro</option>
                                </select>
                            </label>

                            <label className="space-y-2 md:col-span-2">
                                <span className="text-xs font-bold uppercase text-slate-500">Observação obrigatória</span>
                                <textarea
                                    value={reasonNote}
                                    onChange={(event) => setReasonNote(event.target.value)}
                                    rows={3}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white"
                                    placeholder="Descreva o contexto do estorno/devolução para auditoria."
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
                                Confirmo que esta ação criará uma movimentação reversa auditada e preservará a transaction original.
                            </span>
                        </label>

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-slate-200 pt-4 dark:border-border-dark">
                            <Button variant="secondary" onClick={closeReversalModal} disabled={Boolean(reversingId)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleConfirmReversal} disabled={reversingId === reversalEntry.id}>
                                {reversingId === reversalEntry.id ? 'Registrando...' : 'Confirmar estorno auditado'}
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
                                <p className="text-xs font-bold uppercase text-slate-500">Descrição</p>
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

                        {selectedEntry.reversalSource && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
                                <p className="text-xs font-bold uppercase text-rose-700 dark:text-rose-200">Movimentação reversa auditada</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    Esta saída preserva a transaction original e registra a correção financeira.
                                </p>
                                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                                    <p>Original: {selectedEntry.reversalSource.originalTransactionId || 'Não informado'}</p>
                                    <p>Tipo: {selectedEntry.reversalSource.reversalType}</p>
                                    <p>Motivo: {selectedEntry.reversalSource.reasonType}</p>
                                    <p>Data: {selectedEntry.reversalSource.createdAt ? new Date(selectedEntry.reversalSource.createdAt).toLocaleString('pt-BR') : 'Não informada'}</p>
                                </div>
                            </div>
                        )}

                        {selectedEntry.reversals.length > 0 && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                                <p className="text-xs font-bold uppercase text-amber-700 dark:text-amber-200">Histórico de reversões</p>
                                <div className="mt-3 space-y-3">
                                    {selectedEntry.reversals.map((reversal, index) => (
                                        <div
                                            key={`${reversal.reversalTransactionId || selectedEntry.id}-${index}`}
                                            className="rounded-lg border border-amber-200 bg-white/70 p-3 text-sm dark:border-amber-500/20 dark:bg-black/10"
                                        >
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="font-bold text-slate-900 dark:text-white">
                                                    {reversal.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </p>
                                                <p className="text-xs font-semibold text-slate-500">
                                                    {reversal.createdAt ? new Date(reversal.createdAt).toLocaleString('pt-BR') : 'Data não informada'}
                                                </p>
                                            </div>
                                            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                                                Tipo: {reversal.reversalType} | Motivo: {reversal.reasonType}
                                            </p>
                                            {reversal.reversalTransactionId && (
                                                <p className="mt-1 text-[11px] text-slate-500">
                                                    Transaction reversa: {reversal.reversalTransactionId}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Cashflow;
