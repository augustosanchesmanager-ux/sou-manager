import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../components/ui/Modal';
import DatePickerInput from '../components/ui/DatePickerInput';
import { AuditAdjustmentButton } from '../components/audit';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import {
    createReversalKey,
    reverseFinancialTransaction,
    type FinancialReversalType,
} from '../src/lib/finance/reversal';

type ReversalStatus = 'none' | 'partial' | 'full';

type ReceiptReversalSummary = {
    reversalTransactionId: string | null;
    originalTransactionId?: string | null;
    reversalType: string;
    amount: number;
    reasonType: string;
    createdAt: string | null;
};

interface Receipt {
    id: string;
    number: string;
    date: string;
    type: string;
    name: string;
    amount: number;
    paymentMethod: string;
    status: 'Pago' | 'Pendente' | 'Cancelado';
    transactionType: string;
    transactionStatus: string | null;
    sourceType: string | null;
    tenantId: string | null;
    reversedAmount: number;
    reversibleAmount: number;
    reversalStatus: ReversalStatus;
    reversals: ReceiptReversalSummary[];
    isReversalTransaction: boolean;
    reversalSource: ReceiptReversalSummary | null;
}

interface FinancialReversalRecord {
    original_transaction_id: string | null;
    reversal_transaction_id?: string | null;
    reversal_type?: string | null;
    amount: number | string | null;
    reason_type?: string | null;
    created_at?: string | null;
}

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
type ActionMessage = { type: 'success' | 'error' | 'info'; message: string };

const getReversalTypeLabel = (value?: string | null) => {
    if (value === 'wrong_settlement') return 'Estorno';
    if (value === 'full_refund') return 'Devolucao total';
    if (value === 'partial_refund') return 'Devolucao parcial';
    return 'Reversao';
};

const buildShopAddress = (metadata: Record<string, any> | undefined) => {
    if (!metadata) return [];

    const streetLine = [metadata.street, metadata.number ? `, ${metadata.number}` : '', metadata.complement ? ` - ${metadata.complement}` : '']
        .join('')
        .trim();

    const neighborhoodLine = [metadata.neighborhood, metadata.city, metadata.state]
        .filter(Boolean)
        .join(' - ');

    const zipLine = metadata.zip_code ? `CEP ${metadata.zip_code}` : '';

    return [streetLine, neighborhoodLine, zipLine].filter(Boolean);
};

const getInitials = (value: string) =>
    value
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'SM';

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
    if (normalized.includes('credito') || normalized.includes('credit') || normalized.includes('cartao')) return 'credit';
    if (normalized.includes('debito') || normalized.includes('debit')) return 'debit';
    if (normalized.includes('pix')) return 'pix';

    return 'pix';
};

const Receipts: React.FC = () => {
    const { user, tenantId, accessRole, canAccessSuperAdmin } = useAuth();
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);

    // Filters State
    const [filterType, setFilterType] = useState('Todos');
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [filterPeriodStart, setFilterPeriodStart] = useState('');
    const [filterPeriodEnd, setFilterPeriodEnd] = useState('');
    const [searchName, setSearchName] = useState('');

    // Modal / View State
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
    const [reversalReceipt, setReversalReceipt] = useState<Receipt | null>(null);
    const [reversalType, setReversalType] = useState<FinancialReversalType>('full_refund');
    const [reversalAmount, setReversalAmount] = useState('');
    const [refundMethod, setRefundMethod] = useState<RefundMethod>('pix');
    const [reversalDate, setReversalDate] = useState(() => toDateTimeInputValue(new Date()));
    const [reasonType, setReasonType] = useState<ReversalReason>('devolucao_ao_cliente');
    const [reasonNote, setReasonNote] = useState('');
    const [reversalConfirmed, setReversalConfirmed] = useState(false);
    const [reversalIdempotencyKey, setReversalIdempotencyKey] = useState<string | null>(null);
    const [reversingId, setReversingId] = useState<string | null>(null);
    const [reversalError, setReversalError] = useState('');
    
    // Create Receipt Modal
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newReceipt, setNewReceipt] = useState({
        name: '',
        type: 'Receita',
        amount: '',
        paymentMethod: 'Dinheiro',
        description: '',
        signature: ''
    });

    const shopName = user?.user_metadata?.shop_name || user?.user_metadata?.company_name || 'Minha Barbearia';
    const businessType = user?.user_metadata?.business_type || 'Barbearia';
    const shopDocument = user?.user_metadata?.document || user?.user_metadata?.cnpj || '';
    const shopAddressLines = buildShopAddress(user?.user_metadata);
    const shopInitials = getInitials(shopName);
    const canRequestFinancialReversal =
        canAccessSuperAdmin || ['owner', 'admin', 'manager', 'superadmin'].includes(accessRole);

    const fetchReceipts = useCallback(async () => {
        if (!tenantId) {
            setReceipts([]);
            setLoadError('');
            setLoading(false);
            return;
        }
        setLoading(true);
        setLoadError('');

        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('date', { ascending: false });

            if (error) throw error;
            const transactionIds = data.map((tx: any) => tx.id).filter(Boolean);
            const reversedByTransactionId = new Map<string, number>();
            const reversalsByTransactionId = new Map<string, ReceiptReversalSummary[]>();
            const reversalSourceByTransactionId = new Map<string, ReceiptReversalSummary>();

            if (transactionIds.length > 0) {
                // Single query for all reversals (avoids 2 sequential queries)
                const { data: allReversals, error: reversalsError } = await supabase
                    .from('financial_reversals')
                    .select('original_transaction_id, reversal_transaction_id, reversal_type, amount, reason_type, created_at')
                    .eq('tenant_id', tenantId)
                    .or(`original_transaction_id.in.(${transactionIds}),reversal_transaction_id.in.(${transactionIds})`);

                if (reversalsError) {
                    console.warn('Nao foi possivel carregar reversoes dos recibos:', reversalsError);
                } else {
                    ((allReversals || []) as FinancialReversalRecord[]).forEach((reversal) => {
                        // Build reversedByTransactionId and reversalsByTransactionId (original direction)
                        if (reversal.original_transaction_id && transactionIds.includes(reversal.original_transaction_id)) {
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
                        }

                        // Build reversalSourceByTransactionId (reverse direction)
                        if (reversal.reversal_transaction_id && transactionIds.includes(reversal.reversal_transaction_id)) {
                            reversalSourceByTransactionId.set(reversal.reversal_transaction_id, {
                                originalTransactionId: reversal.original_transaction_id || null,
                                reversalTransactionId: reversal.reversal_transaction_id,
                                reversalType: reversal.reversal_type || 'reversal',
                                amount: Math.abs(Number(reversal.amount || 0)),
                                reasonType: reversal.reason_type || 'Sem motivo informado',
                                createdAt: reversal.created_at || null,
                            });
                        }
                    });
                }
            }

            const mappedReceipts: Receipt[] = data.map((tx: any) => {
                let status: any = tx.status || 'Pago';
                if (status !== 'Pago' && status !== 'Pendente' && status !== 'Cancelado') {
                    status = status === 'paid' ? 'Pago' : (status === 'pending' ? 'Pendente' : 'Pago');
                }

                // Generates a short receipt number based on ID or date
                const shortId = tx.id ? tx.id.substring(0, 6) : String(Math.floor(Math.random() * 999999));
                const year = new Date(tx.date || new Date()).getFullYear();

                let safeType = tx.category || (tx.type === 'income' ? 'Receita' : 'Despesa');
                if (safeType === 'Pessoal') safeType = 'Salário';
                const amount = Number(tx.amount || tx.val || 0);
                const reversals = reversalsByTransactionId.get(tx.id) || [];
                const reversalSource = reversalSourceByTransactionId.get(tx.id) || null;
                const reversedAmount = Math.min(amount, reversedByTransactionId.get(tx.id) || 0);
                const reversibleAmount = Math.max(amount - reversedAmount, 0);
                const reversalStatus: ReversalStatus = reversedAmount <= 0
                    ? 'none'
                    : reversibleAmount <= 0
                        ? 'full'
                        : 'partial';

                return {
                    id: tx.id,
                    number: `REC-${year}-${shortId.toUpperCase()}`,
                    date: tx.date || new Date().toISOString(),
                    type: safeType,
                    name: tx.description || 'Transação',
                    amount,
                    paymentMethod: tx.payment_method || tx.method || 'Dinheiro',
                    status: status,
                    transactionType: tx.type || '',
                    transactionStatus: tx.status || null,
                    sourceType: tx.source_type || null,
                    tenantId: tx.tenant_id || tenantId,
                    reversedAmount,
                    reversibleAmount,
                    reversalStatus,
                    reversals,
                    isReversalTransaction: Boolean(reversalSource),
                    reversalSource,
                };
            });
            setReceipts(mappedReceipts);
        } catch (error: any) {
            console.error('Error fetching receipts:', error);
            setReceipts([]);
            setLoadError('Nao foi possivel carregar recibos e transactions. Nenhum dado financeiro foi alterado.');
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        fetchReceipts();
    }, [fetchReceipts]);

    // Filter Logic
    const filteredReceipts = receipts.filter(receipt => {
        const matchType = filterType === 'Todos' ||
            (filterType === 'Salário' && receipt.type === 'Salário') ||
            (filterType === 'Receita' && receipt.type === 'Venda de Balcão') ||
            (filterType === 'Despesa' && receipt.type !== 'Salário' && receipt.type !== 'Venda de Balcão');
        const matchStatus = filterStatus === 'Todos' || receipt.status === filterStatus;
        const matchName = receipt.name.toLowerCase().includes(searchName.toLowerCase()) ||
            receipt.number.toLowerCase().includes(searchName.toLowerCase());

        let matchPeriod = true;
        if (filterPeriodStart) {
            matchPeriod = matchPeriod && new Date(receipt.date) >= new Date(filterPeriodStart);
        }
        if (filterPeriodEnd) {
            matchPeriod = matchPeriod && new Date(receipt.date) <= new Date(filterPeriodEnd);
        }

        return matchType && matchStatus && matchName && matchPeriod;
    });

    const openViewModal = (receipt: Receipt) => {
        setSelectedReceipt(receipt);
        setIsViewModalOpen(true);
    };

    const isReversalEligible = (receipt: Receipt) => (
        canRequestFinancialReversal
        && receipt.transactionType === 'income'
        && receipt.status === 'Pago'
        && !receipt.isReversalTransaction
        && Boolean(receipt.tenantId)
        && Boolean(receipt.id)
        && receipt.reversibleAmount > 0
    );

    const openReversalModal = (receipt: Receipt) => {
        setReversalReceipt(receipt);
        setReversalType('full_refund');
        setReversalAmount(receipt.reversibleAmount.toFixed(2));
        setRefundMethod(normalizeRefundMethod(receipt.paymentMethod));
        setReversalDate(toDateTimeInputValue(new Date()));
        setReasonType('devolucao_ao_cliente');
        setReasonNote('');
        setReversalConfirmed(false);
        setReversalError('');
        setReversalIdempotencyKey(createReversalKey(receipt.id));
    };

    const closeReversalModal = () => {
        if (reversingId) return;
        setReversalReceipt(null);
        setReasonNote('');
        setReversalConfirmed(false);
        setReversalError('');
        setReversalIdempotencyKey(null);
    };

    const handleConfirmReversal = async () => {
        if (!tenantId || !reversalReceipt) {
            setReversalError('Contexto invalido para reversao financeira.');
            return;
        }

        const amount = Number(String(reversalAmount).replace(',', '.'));
        const requiresRefundMethod = reversalType === 'full_refund' || reversalType === 'partial_refund';
        const parsedReversalDate = new Date(reversalDate);

        if (!Number.isFinite(amount) || amount <= 0 || amount > reversalReceipt.reversibleAmount) {
            setReversalError('Informe um valor de reversao valido.');
            return;
        }
        if (!reversalDate || Number.isNaN(parsedReversalDate.getTime())) {
            setReversalError('Informe uma data real de reversao valida.');
            return;
        }
        if (requiresRefundMethod && !refundMethod) {
            setReversalError('Informe a forma de devolucao.');
            return;
        }
        if (!reasonType || !reasonNote.trim()) {
            setReversalError('Informe motivo e observacao para continuar.');
            return;
        }
        if (!reversalConfirmed) {
            setReversalError('Confirme que o recibo e a transaction original serao preservados.');
            return;
        }

        setReversingId(reversalReceipt.id);
        setReversalError('');
        try {
            await reverseFinancialTransaction({
                tenantId,
                originalTransactionId: reversalReceipt.id,
                supabase,
                reversalType,
                amount,
                reasonType,
                reasonNote,
                refundMethod: requiresRefundMethod ? refundMethod : null,
                reversalDate: parsedReversalDate.toISOString(),
                idempotencyKey: reversalIdempotencyKey || createReversalKey(reversalReceipt.id),
            });
            setReversalReceipt(null);
            setReasonNote('');
            setReversalConfirmed(false);
            setReversalError('');
            setReversalIdempotencyKey(null);
            await fetchReceipts();
            setActionMessage({
                type: 'success',
                message: 'Reversao financeira registrada com sucesso. O recibo original foi preservado.',
            });
        } catch (error: any) {
            console.error('Erro ao registrar reversao pelo recibo:', error);
            setReversalError(error?.message || 'Nao foi possivel registrar a reversao financeira. Nenhuma alteracao foi aplicada.');
            setActionMessage({
                type: 'error',
                message: 'Nao foi possivel registrar a reversao financeira. Nenhuma alteracao foi aplicada.',
            });
        } finally {
            setReversingId(null);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleCreateReceipt = async () => {
        if (!tenantId || !newReceipt.name || !newReceipt.amount) {
            setActionMessage({ type: 'error', message: 'Preencha o nome do recebedor e o valor.' });
            return;
        }

        const { error } = await supabase.from('transactions').insert({
            tenant_id: tenantId,
            description: `${newReceipt.name} - ${newReceipt.description || newReceipt.type}`,
            amount: parseFloat(newReceipt.amount),
            type: newReceipt.type === 'Receita' ? 'income' : 'expense',
            category: newReceipt.type,
            date: new Date().toISOString(),
            payment_method: newReceipt.paymentMethod,
            status: 'paid'
        });

        if (error) {
            console.error('Error creating receipt:', error);
            setActionMessage({
                type: 'error',
                message: `Erro ao criar recibo financeiro: ${error.message}`,
            });
            return;
        }
        
        setIsCreateModalOpen(false);
        setNewReceipt({ name: '', type: 'Receita', amount: '', paymentMethod: 'Dinheiro', description: '', signature: '' });
        await fetchReceipts();
        setActionMessage({ type: 'success', message: 'Recibo financeiro criado com transaction real.' });
    };

    return (
        <div className="space-y-8 animate-fade-in relative pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gestão de Recibos</h2>
                    <p className="text-slate-500 mt-1">Emissão, controle e impressão de recibos da barbearia.</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <AuditAdjustmentButton
                        context={{
                            sourceType: 'receipt',
                            sourceLabel: 'Gestao de Recibos',
                            beforeSnapshot: {
                                total_recibos: receipts.length,
                                filtrados: filteredReceipts.length,
                                status: filterStatus,
                                tipo: filterType,
                                periodo_inicio: filterPeriodStart,
                                periodo_fim: filterPeriodEnd,
                            },
                            financialImpactLabel: 'Impacto potencial em recibos e transacoes vinculadas',
                            allowedAdjustmentTypes: [
                                'wrong_charge_cancellation',
                                'payment_method_correction',
                                'transaction_reclassification',
                                'receipt_review',
                                'mark_for_review',
                            ],
                        }}
                        defaultAdjustmentType="mark_for_review"
                        size="md"
                    />
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all"
                    >
                        <span className="material-symbols-outlined">receipt_long</span>
                        + EMITIR NOVO RECIBO
                    </button>
                </div>
            </div>

            {actionMessage && (
                <div className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${
                    actionMessage.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200'
                        : actionMessage.type === 'error'
                            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200'
                            : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-border-dark dark:bg-white/5 dark:text-slate-200'
                }`}>
                    <div className="flex items-start justify-between gap-3">
                        <p>{actionMessage.message}</p>
                        <button type="button" onClick={() => setActionMessage(null)} className="text-xs font-black uppercase opacity-70 hover:opacity-100">
                            Fechar
                        </button>
                    </div>
                </div>
            )}

            {loadError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-black">Falha ao carregar recibos</p>
                            <p className="mt-1">{loadError}</p>
                        </div>
                        <button
                            type="button"
                            onClick={fetchReceipts}
                            className="rounded-lg bg-white px-4 py-2 text-xs font-black uppercase text-red-700 shadow-sm dark:bg-red-500/10 dark:text-red-200"
                        >
                            Tentar novamente
                        </button>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Search */}
                    <div className="lg:col-span-2 relative">
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Buscar (Nome / Nº)</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                type="text"
                                placeholder="Buscar recibo..."
                                value={searchName}
                                onChange={(e) => setSearchName(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Type Filter */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Tipo</label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            title="Filtrar por Tipo"
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 px-4 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                        >
                            <option value="Todos">Todos os Tipos</option>
                            <option value="Salário">Salário</option>
                            <option value="Receita">Receita</option>
                            <option value="Despesa">Despesa</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Status</label>
                        <select
                            value={filterStatus}
                            title="Filtrar por Status"
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 px-4 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                        >
                            <option value="Todos">Todos os Status</option>
                            <option value="Pago">Pago</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Cancelado">Cancelado</option>
                        </select>
                    </div>

                    {/* Button */}
                    <div className="flex items-end">
                        <button className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-slate-900 font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">filter_list</span>
                            Filtrar
                        </button>
                    </div>
                </div>

                {/* Period - optional second row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                      <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Data Inicial</label>
                          <DatePickerInput
                              title="Data Inicial"
                              value={filterPeriodStart}
                              onChange={(e) => setFilterPeriodStart(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary outline-none [color-scheme:light] dark:[color-scheme:dark]"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Data Final</label>
                          <DatePickerInput
                              title="Data Final"
                              value={filterPeriodEnd}
                              onChange={(e) => setFilterPeriodEnd(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary outline-none [color-scheme:light] dark:[color-scheme:dark]"
                          />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                <div className="sm:hidden px-4 py-2 border-b border-slate-100 dark:border-border-dark bg-slate-50/70 dark:bg-white/[0.02] text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Deslize para ver toda a tabela
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                            <tr>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Nº do Recibo</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Data</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Tipo</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Nome</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Forma de Pgto</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Valor</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Status</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark text-slate-900 dark:text-white">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <span className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
                                            <div>
                                                <p className="font-black text-slate-900 dark:text-white">Carregando recibos</p>
                                                <p className="mt-1">Buscando transactions reais, reversoes e vinculos auditados.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredReceipts.length > 0 ? filteredReceipts.map((receipt) => (
                                <tr key={receipt.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-start gap-2">
                                            <span className="material-symbols-outlined mt-0.5 text-slate-300 dark:text-slate-600">receipt</span>
                                            <div>
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">{receipt.number}</span>
                                                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                    Transaction real
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                                        {new Date(receipt.date).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${receipt.type === 'Salário' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' :
                                            receipt.type === 'Fornecedor' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20' :
                                                receipt.type === 'Compra' ? 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100 dark:bg-fuchsia-500/10 dark:text-fuchsia-400 dark:border-fuchsia-500/20' :
                                                    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/20'
                                            }`}>
                                            {receipt.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[120px] sm:max-w-[150px]">{receipt.name}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[16px] opacity-70">
                                                {receipt.paymentMethod.includes('Cartão') ? 'credit_card' :
                                                    receipt.paymentMethod === 'PIX' ? 'pix' : 'payments'}
                                            </span>
                                            {receipt.paymentMethod}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-[15px] font-black text-slate-900 dark:text-white">
                                            R$ {receipt.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                        {receipt.reversalStatus !== 'none' && (
                                            <span className="mt-1 block text-[11px] font-bold text-amber-600 dark:text-amber-300">
                                                {receipt.reversalStatus === 'full' ? 'Estornado total' : 'Estornado parcial'}
                                            </span>
                                        )}
                                        {receipt.isReversalTransaction && (
                                            <span className="mt-1 block text-[11px] font-bold text-rose-600 dark:text-rose-300">
                                                {getReversalTypeLabel(receipt.reversalSource?.reversalType)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${receipt.status === 'Pago' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-500 dark:border-emerald-500/20' :
                                            receipt.status === 'Pendente' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20' :
                                                'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-500 dark:border-red-500/20'
                                            }`}>
                                            <span className={`size-1.5 rounded-full ${receipt.status === 'Pago' ? 'bg-emerald-500' :
                                                receipt.status === 'Pendente' ? 'bg-amber-500' : 'bg-red-500'
                                                }`}></span>
                                            {receipt.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                                            {isReversalEligible(receipt) && (
                                                <button
                                                    onClick={() => openReversalModal(receipt)}
                                                    className="p-1.5 sm:p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 dark:hover:text-amber-400 rounded-lg transition-colors"
                                                    title="Estornar"
                                                    disabled={Boolean(reversingId)}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">undo</span>
                                                </button>
                                            )}
                                            <button onClick={() => openViewModal(receipt)} className="p-1.5 sm:p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="Visualizar">
                                                <span className="material-symbols-outlined text-[20px]">visibility</span>
                                            </button>
                                            <button disabled className="p-1.5 sm:p-2 text-slate-300 dark:text-slate-600 rounded-lg cursor-not-allowed" title="Abra o recibo para imprimir pela visualizacao.">
                                                <span className="material-symbols-outlined text-[20px]">print</span>
                                            </button>
                                            <button disabled className="p-1.5 sm:p-2 text-slate-300 dark:text-slate-600 rounded-lg cursor-not-allowed" title="Exportacao PDF direta fica para fase futura.">
                                                <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                                            </button>
                                            <button disabled className="p-1.5 sm:p-2 text-slate-300 dark:text-slate-600 rounded-lg cursor-not-allowed" title="Reemissao auditada fica para fase futura.">
                                                <span className="material-symbols-outlined text-[20px]">cached</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700">receipt_long</span>
                                            <div>
                                                <p className="font-black text-slate-900 dark:text-white">Nenhum recibo encontrado</p>
                                                <p className="mt-1">Ajuste os filtros ou emita um recibo quando houver uma transaction real.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/[0.02]">
                    <p className="text-xs font-medium text-slate-500">Mostrando {filteredReceipts.length} de {receipts.length} registros</p>
                </div>
            </div>

            {/* View Receipt Modal */}
            <Modal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                title="Visualização do Recibo"
                maxWidth="3xl"
            >
                {/* Visualização Realista do Recibo */}
                <div className="bg-white p-8 md:p-12 border border-slate-200 shadow-xl relative w-full mx-auto text-slate-800 font-sans print:shadow-none print:border-none">
                    {/* Top border decorativo */}
                    <div className="absolute top-0 left-0 w-full h-3 bg-slate-900 print:bg-black"></div>

                    {/* Watermark/Marca D'água */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] print:opacity-[0.05] z-0 overflow-hidden">
                        <span className="text-7xl font-black text-slate-900 -rotate-45 whitespace-nowrap select-none">
                            DOCUMENTO GERADO PELO SMG | SOU.MANAGER | BARBER
                        </span>
                    </div>

                    {/* Conteúdo com position relative para ficar acima da marca d'água */}
                    <div className="relative z-10">
                        {/* Cabeçalho */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 pb-8 border-b-2 border-slate-100 gap-6">
                            <div className="flex items-center gap-4">
                                {user?.user_metadata?.logo_url ? (
                                    <img src={user.user_metadata.logo_url} alt="Logo" className="w-20 h-20 object-contain rounded-lg shadow-sm print:shadow-none bg-white" />
                                ) : (
                                    <div className="bg-slate-900 text-white w-16 h-16 flex items-center justify-center font-black text-2xl tracking-tighter shrink-0 print:border print:border-black print:text-black print:bg-transparent">
                                        {shopInitials}
                                    </div>
                                )}
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-wider text-slate-900">{shopName}</h2>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{businessType}</p>
                                    <div className="text-xs text-slate-500 mt-2 space-y-0.5 opacity-80">
                                        {shopDocument && (
                                            <p>{user?.user_metadata?.person_type === 'pf' ? 'CPF' : 'CNPJ'}: {shopDocument}</p>
                                        )}
                                        {shopAddressLines.length > 0 ? (
                                            shopAddressLines.map((line) => <p key={line}>{line}</p>)
                                        ) : (
                                            <p>Complete os dados cadastrais da barbearia nas configurações.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="sm:text-right w-full sm:w-auto p-4 sm:p-0 bg-slate-50 sm:bg-transparent rounded-lg sm:rounded-none border sm:border-none border-slate-100">
                                <h1 className="text-3xl font-light text-slate-300 tracking-widest uppercase mb-1 print:text-slate-400">Recibo</h1>
                                <p className="text-xl font-bold text-slate-900">{selectedReceipt?.number || 'REC-000000'}</p>
                                <p className="text-sm text-slate-500 mt-2"><b>Data:</b> {selectedReceipt ? new Date(selectedReceipt.date).toLocaleDateString('pt-BR') : '--/--/----'}</p>
                            </div>
                        </div>

                        {/* Área de Valor */}
                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Valor do Recibo</span>
                                <span className="text-4xl font-black text-slate-900 tabular-nums">
                                    R$ {selectedReceipt?.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="text-left sm:text-right max-w-xs">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Status</span>
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border ${selectedReceipt?.status === 'Pago' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                    selectedReceipt?.status === 'Pendente' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                        'bg-red-50 text-red-600 border-red-200'
                                    }`}>
                                    <span className={`size-1.5 rounded-full ${selectedReceipt?.status === 'Pago' ? 'bg-emerald-500' :
                                        selectedReceipt?.status === 'Pendente' ? 'bg-amber-500' : 'bg-red-500'
                                        }`}></span>
                                    {selectedReceipt?.status}
                                </span>
                            </div>
                        </div>

                        {/* Corpo */}
                        <div className="space-y-6 text-[15px] leading-relaxed text-slate-700 bg-white">
                            <p className="text-lg">
                                Recebi(emos) de <span className="font-bold text-slate-900 text-lg uppercase px-1">{shopName}</span>, a quantia de <span className="font-bold text-slate-900 text-lg underline decoration-slate-200 underline-offset-4 px-1">R$ {selectedReceipt?.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> (valor por extenso).
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                                <div>
                                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Referente a (Tipo)</span>
                                    <span className="font-medium text-slate-900 text-lg">{selectedReceipt?.type}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nome do Recebedor</span>
                                    <span className="font-medium text-slate-900 text-lg">{selectedReceipt?.name}</span>
                                </div>
                                <div className="sm:col-span-2">
                                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Forma de Pagamento</span>
                                    <div className="flex items-center gap-2 font-medium text-slate-900">
                                        <span className="material-symbols-outlined text-slate-400 text-[20px]">
                                            {selectedReceipt?.paymentMethod.includes('Cartão') ? 'credit_card' :
                                                selectedReceipt?.paymentMethod === 'PIX' ? 'pix' : 'payments'}
                                        </span>
                                        {selectedReceipt?.paymentMethod}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rodapé / Assinatura */}
                        <div className="mt-24 pt-10 flex flex-col md:flex-row justify-between items-center gap-12">
                            <div className="text-center w-full max-w-xs relative">
                                {/* Assinatura Digital do Recebedor (Simulação) */}
                                {selectedReceipt?.status === 'Pago' && (
                                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                        <div className="font-[Sriracha] text-3xl text-slate-700 opacity-80 -rotate-3 select-none">
                                            {selectedReceipt?.name}
                                        </div>
                                        <div className="border border-emerald-500 text-emerald-600 bg-emerald-50 text-[8px] font-bold px-2 py-0.5 rounded-sm mt-2 uppercase tracking-widest shadow-sm rotate-2">
                                            ✔ Assinado Eletronicamente
                                        </div>
                                    </div>
                                )}
                                <div className="border-t border-slate-300 mb-3 relative z-10"></div>
                                <p className="font-bold text-slate-900 uppercase text-sm relative z-10">{selectedReceipt?.name}</p>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mt-1 relative z-10">Assinatura do Recebedor</p>
                            </div>
                            <div className="text-center w-full max-w-xs relative">
                                {/* Assinatura Digital do Emissor (Simulação logada) */}
                                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                    <div className="border border-blue-500 text-blue-600 bg-blue-50 text-[8px] font-bold px-2 py-0.5 rounded-sm mt-2 uppercase tracking-widest shadow-sm -rotate-2">
                                        ✔ Autenticado: {shopName}
                                        <br /> IP: 192.168.1.1
                                    </div>
                                </div>
                                <div className="border-t border-slate-300 mb-3 relative z-10"></div>
                                <p className="font-bold text-slate-900 uppercase text-sm relative z-10">{shopName}</p>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mt-1 relative z-10">Emissor</p>
                            </div>
                        </div>
                    </div>
                </div>

                {selectedReceipt && (selectedReceipt.reversalStatus !== 'none' || selectedReceipt.isReversalTransaction) && (
                    <div className="mt-6 space-y-4 print:hidden">
                        {selectedReceipt.reversalStatus !== 'none' && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                                <p className="text-xs font-bold uppercase text-amber-700 dark:text-amber-200">Historico de reversoes</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    Revertido: {selectedReceipt.reversedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                                <div className="mt-3 space-y-3">
                                    {selectedReceipt.reversals.map((reversal, index) => (
                                        <div
                                            key={`${reversal.reversalTransactionId || selectedReceipt.id}-${index}`}
                                            className="rounded-lg border border-amber-200 bg-white/70 p-3 text-sm dark:border-amber-500/20 dark:bg-black/10"
                                        >
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="font-bold text-slate-900 dark:text-white">
                                                    {reversal.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </p>
                                                <p className="text-xs font-semibold text-slate-500">
                                                    {reversal.createdAt ? new Date(reversal.createdAt).toLocaleString('pt-BR') : 'Data nao informada'}
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

                        {selectedReceipt.reversalSource && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
                                <p className="text-xs font-bold uppercase text-rose-700 dark:text-rose-200">Movimentacao reversa auditada</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    Este recibo representa uma movimentacao reversa e preserva a transaction original.
                                </p>
                                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                                    <p>Original: {selectedReceipt.reversalSource.originalTransactionId || 'Nao informado'}</p>
                                    <p>Tipo: {selectedReceipt.reversalSource.reversalType}</p>
                                    <p>Motivo: {selectedReceipt.reversalSource.reasonType}</p>
                                    <p>Data: {selectedReceipt.reversalSource.createdAt ? new Date(selectedReceipt.reversalSource.createdAt).toLocaleString('pt-BR') : 'Nao informada'}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Modal Actions */}
                <div className="mt-6 flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-border-dark print:hidden">
                    <button
                        onClick={() => setIsViewModalOpen(false)}
                        className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                        Fechar
                    </button>
                    <button
                        disabled
                        title="Exportacao PDF estruturada fica para fase futura."
                        className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-emerald-600/50 transition-colors flex items-center gap-2 cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                        Exportar PDF
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">print</span>
                        Imprimir Recibo
                    </button>
                </div>
            </Modal>

            {/* Reversal Modal */}
            <Modal
                isOpen={!!reversalReceipt}
                onClose={closeReversalModal}
                title="Estorno / devolucao auditada"
                maxWidth="lg"
            >
                {reversalReceipt && (
                    <div className="space-y-5">
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                            <p className="font-bold">O recibo e a transaction original nao serao apagados. O sistema criara uma movimentacao reversa auditada.</p>
                            <p className="mt-2">Use estorno apenas quando houver erro de baixa, devolucao ao cliente ou correcao financeira autorizada.</p>
                        </div>

                        {reversalError && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                                {reversalError}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Recibo original</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{reversalReceipt.number}</p>
                                <p className="mt-1 text-xs text-slate-500">{reversalReceipt.name}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Valor original</p>
                                <p className="mt-2 text-lg font-black text-emerald-600 dark:text-emerald-400">
                                    {reversalReceipt.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                                {reversalReceipt.reversedAmount > 0 && (
                                    <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
                                        Ja revertido: {reversalReceipt.reversedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                )}
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                    Saldo reversivel: {reversalReceipt.reversibleAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                                    max={reversalReceipt.reversibleAmount}
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
                                Confirmo que esta acao criara uma movimentacao reversa auditada e preservara o recibo e a transaction original.
                            </span>
                        </label>

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-slate-200 pt-4 dark:border-border-dark">
                            <button
                                onClick={closeReversalModal}
                                disabled={Boolean(reversingId)}
                                className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmReversal}
                                disabled={reversingId === reversalReceipt.id}
                                className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50"
                            >
                                {reversingId === reversalReceipt.id ? 'Registrando...' : 'Confirmar estorno'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Create Receipt Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Emitir Novo Recibo"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Recebedor</label>
                        <input
                            type="text"
                            value={newReceipt.name}
                            onChange={(e) => setNewReceipt({...newReceipt, name: e.target.value})}
                            placeholder="Nome completo"
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
                            <select
                                value={newReceipt.type}
                                onChange={(e) => setNewReceipt({...newReceipt, type: e.target.value})}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                            >
                                <option value="Receita">Receita</option>
                                <option value="Despesa">Despesa</option>
                                <option value="Salário">Salário</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Valor (R$)</label>
                            <input
                                type="number"
                                value={newReceipt.amount}
                                onChange={(e) => setNewReceipt({...newReceipt, amount: e.target.value})}
                                placeholder="0,00"
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Forma de Pagamento</label>
                        <select
                            value={newReceipt.paymentMethod}
                            onChange={(e) => setNewReceipt({...newReceipt, paymentMethod: e.target.value})}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                        >
                            <option value="Dinheiro">Dinheiro</option>
                            <option value="PIX">PIX</option>
                            <option value="Cartão de Débito">Cartão de Débito</option>
                            <option value="Cartão de Crédito">Cartão de Crédito</option>
                            <option value="Transferência">Transferência</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Descrição / Serviço</label>
                        <textarea
                            value={newReceipt.description}
                            onChange={(e) => setNewReceipt({...newReceipt, description: e.target.value})}
                            placeholder="Descrição do serviço ou produto"
                            rows={3}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary outline-none resize-none"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Assinatura do Recebedor</label>
                        <input
                            type="text"
                            value={newReceipt.signature}
                            onChange={(e) => setNewReceipt({...newReceipt, signature: e.target.value})}
                            placeholder="Nome para assinatura"
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={() => setIsCreateModalOpen(false)}
                            className="flex-1 px-6 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreateReceipt}
                            className="flex-1 px-6 py-3 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px]">check</span>
                            Emitir Recibo
                        </button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default Receipts;
