import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarRange, FileText, Package, Users, Wallet } from 'lucide-react';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import EmptyStateFinance from '../components/financial/EmptyStateFinance';
import { AuditAdjustmentButton } from '../components/audit';
import { useAuth } from '../context/AuthContext';
import { supabase, getScopedClient } from '../services/supabaseClient';
import { settleCheckoutComanda } from '../src/lib/finance/settlement';
import {
    createReversalKey,
    reverseFinancialTransaction,
    type FinancialReversalType,
} from '../src/lib/finance/reversal';

type ARSource = 'comanda' | 'clube' | 'recibo';
type ARStatus = 'pending' | 'overdue' | 'open';

interface AREntry {
    id: string;
    source: ARSource;
    clientName: string;
    clientPhone?: string | null;
    description: string;
    dateValue: string;
    amount: number;
    status: ARStatus | string;
    originPath: string;
}

interface ComandaRecord {
    id: string;
    client_id?: string | null;
    status: string;
    total: number;
    discount?: number | null;
    created_at: string;
    staff_id?: string | null;
    payment_method?: string | null;
    clients?: { name: string; phone?: string | null } | { name: string; phone?: string | null }[] | null;
}

interface ClientLookupRecord {
    id: string;
    name?: string | null;
    phone?: string | null;
}

interface ComandaItemRecord {
    id: string;
    comanda_id: string;
    service_id?: string | null;
    product_id?: string | null;
    product_name?: string | null;
    quantity?: number | string | null;
    unit_price?: number | string | null;
    staff_id?: string | null;
}

interface ExecutionParticipantRecord {
    id: string;
    comanda_item_id: string;
    staff_id?: string | null;
    role?: string | null;
    payout_type?: string | null;
    payout_value?: number | string | null;
}

interface ComandaItemDetail {
    id: string;
    name: string;
    typeLabel: string;
    quantity: number;
    unitPrice: number;
    total: number;
    staffName: string;
    participants: {
        id: string;
        staffName: string;
        payoutType: string;
        payoutValue: number;
        role: string;
    }[];
}

interface OpenComandaDetail {
    id: string;
    shortId: string;
    clientName: string;
    clientPhone: string | null;
    status: string;
    createdAt: string;
    mainStaffName: string;
    grossSubtotal: number;
    discount: number;
    netTotal: number;
    items: ComandaItemDetail[];
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
type PaymentMethod = 'pix' | 'cash' | 'credit' | 'debit' | 'other';
type ReversalStatus = 'none' | 'partial' | 'full';
type SortKey = 'client_az' | 'client_za' | 'amount_asc' | 'amount_desc' | 'date_asc' | 'date_desc';
type SourceFilter = 'todos' | ARSource;
type StatusFilter = 'todos' | 'open' | 'pending' | 'overdue' | 'settled' | 'reversed';
type ViewMode = 'list' | 'grouped';

interface ARFilters {
    source: SourceFilter;
    status: StatusFilter;
    dateFrom: string;
    dateTo: string;
    amountMin: string;
    amountMax: string;
    search: string;
    viewMode: ViewMode;
}

interface ARListEntry extends AREntry {
    listId: string;
    reference: string;
    receivable?: AREntry;
    settlement?: PaidComandaSettlement;
    actionKind: 'settle' | 'reverse' | 'none';
    reversalStatus?: ReversalStatus;
}

const DEFAULT_AR_FILTERS: ARFilters = {
    source: 'todos',
    status: 'todos',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    search: '',
    viewMode: 'list',
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'client_az', label: 'Cliente A-Z' },
    { key: 'client_za', label: 'Cliente Z-A' },
    { key: 'amount_asc', label: 'Menor valor' },
    { key: 'amount_desc', label: 'Maior valor' },
    { key: 'date_asc', label: 'Data antiga' },
    { key: 'date_desc', label: 'Data recente' },
];

const SOURCE_FILTER_OPTIONS: { value: SourceFilter; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'comanda', label: 'Comandas' },
    { value: 'clube', label: 'Clube do Chefe' },
    { value: 'recibo', label: 'Recibos' },
];

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'open', label: 'Em aberto' },
    { value: 'pending', label: 'Pendente' },
    { value: 'overdue', label: 'Atrasado' },
    { value: 'settled', label: 'Baixada' },
    { value: 'reversed', label: 'Estornada' },
];
const CLIENT_FALLBACK_LABEL = 'Cliente não identificado';
const SOURCE_LABELS: Record<ARSource, string> = {
    comanda: 'Comanda',
    clube: 'Clube do Chefe',
    recibo: 'Recibo',
};
const EMPTY_STATE_COPY: Record<ActiveTab, { title: string; description: string }> = {
    todos: {
        title: 'Nenhuma conta a receber no filtro atual',
        description: 'Não há comandas abertas, recebíveis do Clube ou recibos pendentes neste período.',
    },
    comandas: {
        title: 'Nenhuma comanda aberta',
        description: 'As comandas em aberto deste período aparecerão aqui para baixa financeira.',
    },
    clube: {
        title: 'Nenhum recebivel do Clube pendente',
        description: 'Cobrancas pendentes ou atrasadas do Clube do Chefe aparecerao nesta aba.',
    },
    recibos: {
        title: 'Nenhum recibo pendente',
        description: 'Recibos pendentes de pagamento aparecerao aqui quando existirem.',
    },
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

interface FinancialReversalRecord {
    original_transaction_id: string | null;
    reversal_transaction_id?: string | null;
    reversal_type?: string | null;
    amount: number | string | null;
    reason_type?: string | null;
    created_at?: string | null;
}

interface ReversalSummary {
    reversalTransactionId: string | null;
    reversalType: string;
    amount: number;
    reasonType: string;
    createdAt: string | null;
}

interface PaidComandaSettlement {
    id: string;
    tenantId: string | null;
    sourceId: string | null;
    clientName: string;
    clientPhone?: string | null;
    description: string;
    dateValue: string;
    amount: number;
    paymentMethod: PaymentMethod;
    transactionStatus: string | null;
    reversedAmount: number;
    reversibleAmount: number;
    reversalStatus: ReversalStatus;
    reversals: ReversalSummary[];
}

const toDateTimeInputValue = (date: Date) => {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const createSettlementKey = (comandaId: string) => {
    const randomId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `finance-settle-${comandaId}-${randomId}`;
};

const normalizePaymentMethod = (value?: string | null): PaymentMethod => {
    const normalized = String(value || '').trim().toLowerCase();

    if (['pix', 'cash', 'credit', 'debit', 'other'].includes(normalized)) {
        return normalized as PaymentMethod;
    }
    if (normalized.includes('dinheiro') || normalized.includes('cash')) return 'cash';
    if (normalized.includes('credito') || normalized.includes('credit') || normalized.includes('cartao')) return 'credit';
    if (normalized.includes('debito') || normalized.includes('debit')) return 'debit';
    if (normalized.includes('pix')) return 'pix';

    return 'pix';
};

const getShortId = (id?: string | null) => (id ? id.slice(0, 8) : 'sem-id');

const getClientData = (clients?: ComandaRecord['clients']) => {
    const client = Array.isArray(clients) ? clients[0] : clients;
    return {
        name: client?.name || CLIENT_FALLBACK_LABEL,
        phone: client?.phone || null,
    };
};

const extractClientNameFromTransactionDescription = (description?: string | null) => {
    const rawDescription = String(description || '').trim();
    const clientMatch = rawDescription.match(/Cliente:\s*([^()\n|]+)/i);
    const clientName = clientMatch?.[1]?.trim();
    return clientName || CLIENT_FALLBACK_LABEL;
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const AccountsReceivable: React.FC = () => {
    const { tenantId, accessRole, canAccessSuperAdmin } = useAuth();
    const hasTenantContext = Boolean(tenantId);
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<ActiveTab>('todos');
    const [filterMonth, setFilterMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [sortKey, setSortKey] = useState<SortKey>('date_desc');
    const [showFilters, setShowFilters] = useState(false);
    const [listFilters, setListFilters] = useState<ARFilters>(DEFAULT_AR_FILTERS);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [openComandas, setOpenComandas] = useState<ComandaRecord[]>([]);
    const [openComandaDetails, setOpenComandaDetails] = useState<Record<string, OpenComandaDetail>>({});
    const [markingPaid, setMarkingPaid] = useState<string | null>(null);
    const [settlementEntry, setSettlementEntry] = useState<AREntry | null>(null);
    const [settlementPaymentMethod, setSettlementPaymentMethod] = useState<PaymentMethod>('pix');
    const [settlementPaymentDate, setSettlementPaymentDate] = useState(() => toDateTimeInputValue(new Date()));
    const [settlementPaidAmount, setSettlementPaidAmount] = useState('');
    const [settlementNotes, setSettlementNotes] = useState('');
    const [settlementIdempotencyKey, setSettlementIdempotencyKey] = useState<string | null>(null);
    const [paidComandaSettlements, setPaidComandaSettlements] = useState<PaidComandaSettlement[]>([]);
    const [reversalEntry, setReversalEntry] = useState<PaidComandaSettlement | null>(null);
    const [reversalType, setReversalType] = useState<FinancialReversalType>('full_refund');
    const [reversalAmount, setReversalAmount] = useState('');
    const [refundMethod, setRefundMethod] = useState<PaymentMethod>('pix');
    const [reversalDate, setReversalDate] = useState(() => toDateTimeInputValue(new Date()));
    const [reasonType, setReasonType] = useState<ReversalReason>('devolucao_ao_cliente');
    const [reasonNote, setReasonNote] = useState('');
    const [reversalConfirmed, setReversalConfirmed] = useState(false);
    const [reversalIdempotencyKey, setReversalIdempotencyKey] = useState<string | null>(null);
    const [reversingId, setReversingId] = useState<string | null>(null);
    const [clubReceivables, setClubReceivables] = useState<ClubReceivableRecord[]>([]);
    const [pendingReceipts, setPendingReceipts] = useState<ReceiptRecord[]>([]);

    const [clubClients, setClubClients] = useState<Record<string, { name: string; phone?: string | null }>>({});
    const [clubPlans, setClubPlans] = useState<Record<string, { name: string }>>({});
    const canRequestFinancialReversal =
        canAccessSuperAdmin || ['owner', 'admin', 'manager', 'superadmin'].includes(accessRole);

    const fetchData = useCallback(async () => {
        if (!tenantId || !filterMonth) {
            setLoadError(null);
            setOpenComandas([]);
            setOpenComandaDetails({});
            setPaidComandaSettlements([]);
            setClubReceivables([]);
            setPendingReceipts([]);
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

        const barberSupabase = getScopedClient('barber');

        try {
            const [
                comandasResult,
                clubResult,
                transactionsResult,
            ] = await Promise.all([
                barberSupabase
                    .from('comandas')
                    .select('id, client_id, status, total, discount, created_at, staff_id, payment_method, clients(name, phone)')
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
                    .select('id, tenant_id, status, category, amount, description, date, payment_method, type, source_type, source_id')
                    .eq('tenant_id', tenantId)
                    .eq('type', 'income')
                    .gte('date', startOfMonth)
                    .lte('date', endOfMonth)
                    .order('date', { ascending: false }),
            ]);

            if (comandasResult.error) throw comandasResult.error;
            const comandasData = (comandasResult.data || []) as ComandaRecord[];
            setOpenComandas(comandasData);

            const comandaIds = comandasData.map((comanda) => comanda.id).filter(Boolean);
            const clientIds = Array.from(new Set(comandasData.map((comanda) => comanda.client_id).filter(Boolean))) as string[];
            const { data: clientRowsData, error: clientRowsError } = clientIds.length > 0
                ? await barberSupabase
                    .from('clients')
                    .select('id, name, phone')
                    .eq('tenant_id', tenantId)
                    .in('id', clientIds)
                : { data: [] as ClientLookupRecord[], error: null };

            if (clientRowsError) {
                console.warn('Não foi possível carregar os clientes das comandas em aberto:', clientRowsError);
            }

            const clientById = ((clientRowsData || []) as ClientLookupRecord[]).reduce((acc, client) => {
                acc[client.id] = {
                    name: client.name || CLIENT_FALLBACK_LABEL,
                    phone: client.phone || null,
                };
                return acc;
            }, {} as Record<string, { name: string; phone: string | null }>);

            const { data: comandaItemsData, error: comandaItemsError } = comandaIds.length > 0
                ? await barberSupabase
                    .from('comanda_items')
                    .select('id, comanda_id, service_id, product_id, product_name, quantity, unit_price, staff_id')
                    .eq('tenant_id', tenantId)
                    .in('comanda_id', comandaIds)
                : { data: [] as ComandaItemRecord[], error: null };

            if (comandaItemsError) throw comandaItemsError;

            const comandaItems = (comandaItemsData || []) as ComandaItemRecord[];
            const itemIds = comandaItems.map((item) => item.id).filter(Boolean);
            const { data: participantRowsData, error: participantRowsError } = itemIds.length > 0
                ? await barberSupabase
                    .from('service_execution_participants')
                    .select('id, comanda_item_id, staff_id, role, payout_type, payout_value')
                    .eq('tenant_id', tenantId)
                    .in('comanda_item_id', itemIds)
                : { data: [] as ExecutionParticipantRecord[], error: null };

            if (participantRowsError) throw participantRowsError;

            const participantRows = (participantRowsData || []) as ExecutionParticipantRecord[];
            const staffIds = Array.from(new Set([
                ...comandasData.map((comanda) => comanda.staff_id).filter(Boolean),
                ...comandaItems.map((item) => item.staff_id).filter(Boolean),
                ...participantRows.map((participant) => participant.staff_id).filter(Boolean),
            ])) as string[];
            const { data: staffRowsData, error: staffRowsError } = staffIds.length > 0
                ? await barberSupabase
                    .from('staff')
                    .select('id, name')
                    .eq('tenant_id', tenantId)
                    .in('id', staffIds)
                : { data: [] as { id: string; name: string }[], error: null };

            if (staffRowsError) throw staffRowsError;

            const staffNameById = ((staffRowsData || []) as { id: string; name: string }[]).reduce((acc, staff) => {
                acc[staff.id] = staff.name;
                return acc;
            }, {} as Record<string, string>);
            const participantsByItemId = participantRows.reduce((acc, participant) => {
                if (!acc[participant.comanda_item_id]) acc[participant.comanda_item_id] = [];
                acc[participant.comanda_item_id].push(participant);
                return acc;
            }, {} as Record<string, ExecutionParticipantRecord[]>);
            const itemsByComandaId = comandaItems.reduce((acc, item) => {
                if (!acc[item.comanda_id]) acc[item.comanda_id] = [];
                acc[item.comanda_id].push(item);
                return acc;
            }, {} as Record<string, ComandaItemRecord[]>);

            const detailsByComandaId = comandasData.reduce((acc, comanda) => {
                const client = comanda.client_id && clientById[comanda.client_id]
                    ? clientById[comanda.client_id]
                    : getClientData(comanda.clients);
                const items = (itemsByComandaId[comanda.id] || []).map((item) => {
                    const quantity = Number(item.quantity || 0);
                    const unitPrice = Number(item.unit_price || 0);
                    const itemParticipants = (participantsByItemId[item.id] || []).map((participant) => ({
                        id: participant.id,
                        staffName: participant.staff_id ? staffNameById[participant.staff_id] || 'Profissional não encontrado' : 'Profissional não informado',
                        payoutType: participant.payout_type || 'percentage',
                        payoutValue: Number(participant.payout_value || 0),
                        role: participant.role || 'participante',
                    }));

                    return {
                        id: item.id,
                        name: item.product_name || (item.service_id ? 'Serviço sem nome' : 'Produto sem nome'),
                        typeLabel: item.service_id ? 'Serviço' : item.product_id ? 'Produto' : 'Item',
                        quantity,
                        unitPrice,
                        total: quantity * unitPrice,
                        staffName: item.staff_id ? staffNameById[item.staff_id] || 'Profissional não encontrado' : 'Sem profissional',
                        participants: itemParticipants,
                    };
                });
                const grossSubtotal = items.reduce((sum, item) => sum + item.total, 0);

                acc[comanda.id] = {
                    id: comanda.id,
                    shortId: getShortId(comanda.id),
                    clientName: client.name,
                    clientPhone: client.phone,
                    status: comanda.status,
                    createdAt: comanda.created_at,
                    mainStaffName: comanda.staff_id ? staffNameById[comanda.staff_id] || 'Profissional não encontrado' : 'Sem profissional principal',
                    grossSubtotal,
                    discount: Number(comanda.discount || 0),
                    netTotal: Number(comanda.total || 0),
                    items,
                };
                return acc;
            }, {} as Record<string, OpenComandaDetail>);
            setOpenComandaDetails(detailsByComandaId);

            if (clubResult.error) throw clubResult.error;
            const clubData = (clubResult.data || []) as ClubReceivableRecord[];
            setClubReceivables(clubData);

            if (transactionsResult.error) throw transactionsResult.error;
            const txData = transactionsResult.data || [];
            const paidComandaTransactions = txData.filter((tx: any) => {
                const normalizedStatus = tx.status || 'paid';
                return tx.source_type === 'comanda'
                    && tx.type === 'income'
                    && (normalizedStatus === 'paid' || normalizedStatus === 'Pago' || !tx.status)
                    && Number(tx.amount || 0) > 0;
            });
            const paidComandaTransactionIds = paidComandaTransactions.map((tx: any) => tx.id).filter(Boolean);
            const paidComandaSourceIds = Array.from(new Set(paidComandaTransactions.map((tx: any) => tx.source_id).filter(Boolean))) as string[];
            let paidClientBySourceId: Record<string, { name: string; phone?: string | null }> = {};
            const reversedByTransactionId = new Map<string, number>();
            const reversalsByTransactionId = new Map<string, ReversalSummary[]>();

            if (paidComandaSourceIds.length > 0) {
                const { data: paidComandasData, error: paidComandasError } = await barberSupabase
                    .from('comandas')
                    .select('id, client_id, clients(name, phone)')
                    .eq('tenant_id', tenantId)
                    .in('id', paidComandaSourceIds);

                if (paidComandasError) {
                    console.warn('Não foi possível carregar clientes das baixas recentes:', paidComandasError);
                } else {
                    const paidComandas = (paidComandasData || []) as ComandaRecord[];
                    const paidClientIds = Array.from(new Set(paidComandas.map((comanda) => comanda.client_id).filter(Boolean))) as string[];
                    const { data: paidClientRowsData, error: paidClientRowsError } = paidClientIds.length > 0
                        ? await barberSupabase
                            .from('clients')
                            .select('id, name, phone')
                            .eq('tenant_id', tenantId)
                            .in('id', paidClientIds)
                        : { data: [] as ClientLookupRecord[], error: null };

                    if (paidClientRowsError) {
                        console.warn('Não foi possível carregar clientes vinculados às baixas recentes:', paidClientRowsError);
                    }

                    const paidClientById = ((paidClientRowsData || []) as ClientLookupRecord[]).reduce((acc, client) => {
                        acc[client.id] = {
                            name: client.name || CLIENT_FALLBACK_LABEL,
                            phone: client.phone || null,
                        };
                        return acc;
                    }, {} as Record<string, { name: string; phone?: string | null }>);

                    paidClientBySourceId = paidComandas.reduce((acc, comanda) => {
                        const relatedClient = comanda.client_id ? paidClientById[comanda.client_id] : null;
                        const fallbackClient = getClientData(comanda.clients);
                        acc[comanda.id] = relatedClient || fallbackClient;
                        return acc;
                    }, {} as Record<string, { name: string; phone?: string | null }>);
                }
            }

            if (paidComandaTransactionIds.length > 0) {
                const { data: reversals, error: reversalsError } = await supabase
                    .from('financial_reversals')
                    .select('original_transaction_id, reversal_transaction_id, reversal_type, amount, reason_type, created_at')
                    .eq('tenant_id', tenantId)
                    .in('original_transaction_id', paidComandaTransactionIds);

                if (reversalsError) {
                    console.warn('Não foi possível carregar reversões de contas a receber:', reversalsError);
                } else {
                    ((reversals || []) as FinancialReversalRecord[]).forEach((reversal) => {
                        if (!reversal.original_transaction_id) return;
                        const amount = Math.abs(Number(reversal.amount || 0));
                        reversedByTransactionId.set(
                            reversal.original_transaction_id,
                            (reversedByTransactionId.get(reversal.original_transaction_id) || 0) + amount,
                        );
                        const current = reversalsByTransactionId.get(reversal.original_transaction_id) || [];
                        current.push({
                            reversalTransactionId: reversal.reversal_transaction_id || null,
                            reversalType: reversal.reversal_type || 'reversal',
                            amount,
                            reasonType: reversal.reason_type || 'Sem motivo informado',
                            createdAt: reversal.created_at || null,
                        });
                        reversalsByTransactionId.set(reversal.original_transaction_id, current);
                    });
                }
            }

            const paidSettlements: PaidComandaSettlement[] = paidComandaTransactions.map((tx: any) => {
                const amount = Number(tx.amount || 0);
                const reversedAmount = Math.min(amount, reversedByTransactionId.get(tx.id) || 0);
                const reversibleAmount = Math.max(amount - reversedAmount, 0);
                const reversalStatus: ReversalStatus = reversedAmount <= 0
                    ? 'none'
                    : reversibleAmount <= 0
                        ? 'full'
                        : 'partial';

                return {
                    id: tx.id,
                    tenantId: tx.tenant_id || tenantId,
                    sourceId: tx.source_id || null,
                    clientName: paidClientBySourceId[tx.source_id]?.name || extractClientNameFromTransactionDescription(tx.description),
                    clientPhone: paidClientBySourceId[tx.source_id]?.phone || null,
                    description: tx.category || 'Receita de Comanda',
                    dateValue: tx.date || new Date().toISOString(),
                    amount,
                    paymentMethod: normalizePaymentMethod(tx.payment_method),
                    transactionStatus: tx.status || null,
                    reversedAmount,
                    reversibleAmount,
                    reversalStatus,
                    reversals: reversalsByTransactionId.get(tx.id) || [],
                };
            });
            setPaidComandaSettlements(paidSettlements);

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
                    name: tx.description || 'Transação',
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
                    ? barberSupabase.from('clients').select('id, name, phone').eq('tenant_id', tenantId).in('id', customerIds)
                    : Promise.resolve({ data: [], error: null }),
                planIds.length > 0
                    ? barberSupabase.from('customer_plans').select('id, name').eq('tenant_id', tenantId).in('id', planIds)
                    : Promise.resolve({ data: [], error: null }),
            ]);
            if (clientsRes.error) console.error('Error loading club clients:', clientsRes.error);
            if (plansRes.error) console.error('Error loading club plans:', plansRes.error);
            const clientsMap: Record<string, { name: string; phone?: string | null }> = {};
            const plansMap: Record<string, { name: string }> = {};
            (clientsRes.data || []).forEach((c: any) => { clientsMap[c.id] = c; });
            (plansRes.data || []).forEach((p: any) => { plansMap[p.id] = p; });
            setClubClients(clientsMap);
            setClubPlans(plansMap);

        } catch (error: any) {
            console.error('Erro ao carregar contas a receber:', error);
            const message = 'Não foi possível carregar as contas a receber. Verifique a conexão e tente atualizar.';
            setLoadError(message);
            setToast({ message, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [tenantId, filterMonth]);

    const openSettlementModal = (entry: AREntry) => {
        setSettlementEntry(entry);
        setSettlementPaymentMethod('pix');
        setSettlementPaymentDate(toDateTimeInputValue(new Date()));
        setSettlementPaidAmount(Number(entry.amount || 0).toFixed(2));
        setSettlementNotes('');
        setSettlementIdempotencyKey(createSettlementKey(entry.id));
    };

    const closeSettlementModal = () => {
        if (markingPaid) return;
        setSettlementEntry(null);
        setSettlementPaidAmount('');
        setSettlementNotes('');
        setSettlementIdempotencyKey(null);
    };

    const handleConfirmSettlement = async () => {
        if (!tenantId || !settlementEntry) {
            setToast({ message: 'Contexto invalido para baixa financeira. Atualize a pagina e tente novamente.', type: 'error' });
            return;
        }

        const paidAmount = Number(String(settlementPaidAmount).replace(',', '.'));
        if (!settlementPaymentMethod || !settlementPaymentDate || !Number.isFinite(paidAmount) || paidAmount <= 0) {
            setToast({ message: 'Informe forma de pagamento, data real e valor valido para dar baixa.', type: 'error' });
            return;
        }

        setMarkingPaid(settlementEntry.id);
        setToast({ message: 'Registrando baixa financeira...', type: 'info' });
        try {
            const barberSupabase = getScopedClient('barber');
            const detail = openComandaDetails[settlementEntry.id];
            const noteParts = [
                `Origem: accounts_receivable`,
                `Comanda: #${getShortId(settlementEntry.id)}`,
                detail?.discount ? `Desconto atual: ${formatCurrency(detail.discount)}` : null,
                settlementNotes.trim() ? `Observação: ${settlementNotes.trim()}` : null,
            ].filter(Boolean);
            await settleCheckoutComanda({
                comandaId: settlementEntry.id,
                tenantId,
                supabase: barberSupabase,
                paymentMethod: settlementPaymentMethod,
                paidAmount,
                paymentDateReal: new Date(settlementPaymentDate).toISOString(),
                source: 'accounts_receivable',
                notes: noteParts.join('\n') || null,
                idempotencyKey: settlementIdempotencyKey || createSettlementKey(settlementEntry.id),
            });
            setToast({ message: 'Baixa realizada com sucesso.', type: 'success' });
            setSettlementEntry(null);
            setSettlementPaidAmount('');
            setSettlementNotes('');
            setSettlementIdempotencyKey(null);
            await fetchData();
        } catch (error: any) {
            console.error('Erro ao dar baixa via RPC:', error);
            const message = error?.message?.includes('Nenhuma alteração foi aplicada')
                ? error.message
                : 'Não foi possível registrar a baixa financeira. Nenhuma alteração foi aplicada.';
            setToast({ message, type: 'error' });
        } finally {
            setMarkingPaid(null);
        }
    };

    const isReversalEligible = (entry: PaidComandaSettlement) => (
        canRequestFinancialReversal
        && Boolean(entry.tenantId)
        && Boolean(entry.id)
        && entry.reversibleAmount > 0
        && (entry.transactionStatus === 'paid' || entry.transactionStatus === 'Pago' || !entry.transactionStatus)
    );

    const openReversalModal = (entry: PaidComandaSettlement) => {
        setReversalEntry(entry);
        setReversalType('full_refund');
        setReversalAmount(entry.reversibleAmount.toFixed(2));
        setRefundMethod(entry.paymentMethod);
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
            console.error('Erro ao registrar reversão em contas a receber:', error);
            setToast({ message: error?.message || 'Não foi possível registrar a reversão financeira. Nenhuma alteração foi aplicada.', type: 'error' });
        } finally {
            setReversingId(null);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const allEntries: AREntry[] = useMemo(() => {
        const entries: AREntry[] = [];

        openComandas.forEach(c => {
            const detail = openComandaDetails[c.id];
            const client = detail ? { name: detail.clientName, phone: detail.clientPhone } : getClientData(c.clients);
            entries.push({
                id: c.id,
                source: 'comanda',
                clientName: client.name,
                clientPhone: client.phone,
                description: `Comanda #${getShortId(c.id)} · em aberto`,
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
                clientName: clubClients[r.customer_id]?.name || CLIENT_FALLBACK_LABEL,
                clientPhone: clubClients[r.customer_id]?.phone || null,
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
                clientName: r.name || CLIENT_FALLBACK_LABEL,
                description: r.type || 'Receita',
                dateValue: r.date,
                amount: r.amount,
                status: 'pending',
                originPath: '/receipts',
            });
        });

        return entries;
    }, [openComandas, openComandaDetails, clubReceivables, pendingReceipts, clubClients, clubPlans]);

    const combinedEntries = useMemo<ARListEntry[]>(() => {
        const receivables = allEntries.map((entry): ARListEntry => ({
            ...entry,
            listId: `receivable-${entry.source}-${entry.id}`,
            reference: `${SOURCE_LABELS[entry.source]} ${getShortId(entry.id)} ${entry.description}`,
            receivable: entry,
            actionKind: entry.source === 'comanda' && entry.status === 'open' ? 'settle' : 'none',
        }));

        const settledComandas = paidComandaSettlements.map((entry): ARListEntry => {
            const referenceId = entry.sourceId || entry.id;
            const hasReversal = entry.reversalStatus !== 'none';
            return {
                id: entry.id,
                source: 'comanda',
                clientName: entry.clientName || CLIENT_FALLBACK_LABEL,
                clientPhone: entry.clientPhone || null,
                description: `Baixa de comanda #${getShortId(referenceId)}`,
                dateValue: entry.dateValue,
                amount: entry.amount,
                status: hasReversal ? 'reversed' : 'settled',
                originPath: '/comandas',
                listId: `settlement-comanda-${entry.id}`,
                reference: `Comanda ${getShortId(referenceId)} baixa ${getShortId(entry.id)} ${entry.description}`,
                settlement: entry,
                actionKind: 'reverse',
                reversalStatus: entry.reversalStatus,
            };
        });

        return [...receivables, ...settledComandas];
    }, [allEntries, paidComandaSettlements]);

    const tabbedEntries = useMemo(() => {
        if (activeTab === 'todos') return combinedEntries;
        return combinedEntries.filter(e => {
            if (activeTab === 'comandas') return e.source === 'comanda';
            if (activeTab === 'clube') return e.source === 'clube';
            if (activeTab === 'recibos') return e.source === 'recibo';
            return true;
        });
    }, [combinedEntries, activeTab]);

    const filteredEntries = useMemo(() => {
        const amountMin = Number(String(listFilters.amountMin || '').replace(',', '.'));
        const amountMax = Number(String(listFilters.amountMax || '').replace(',', '.'));
        const hasMin = listFilters.amountMin.trim() !== '' && Number.isFinite(amountMin);
        const hasMax = listFilters.amountMax.trim() !== '' && Number.isFinite(amountMax);
        const searchTerm = listFilters.search.trim().toLowerCase();

        const filtered = tabbedEntries.filter((entry) => {
            if (listFilters.source !== 'todos' && entry.source !== listFilters.source) return false;
            if (listFilters.status !== 'todos' && entry.status !== listFilters.status) return false;

            const entryDate = String(entry.dateValue || '').slice(0, 10);
            if (listFilters.dateFrom && entryDate < listFilters.dateFrom) return false;
            if (listFilters.dateTo && entryDate > listFilters.dateTo) return false;
            if (hasMin && entry.amount < amountMin) return false;
            if (hasMax && entry.amount > amountMax) return false;

            if (searchTerm) {
                const haystack = [
                    entry.clientName,
                    entry.clientPhone,
                    entry.description,
                    entry.reference,
                    entry.id,
                    entry.settlement?.sourceId,
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(searchTerm)) return false;
            }

            return true;
        });

        return [...filtered].sort((first, second) => {
            if (sortKey === 'client_az') return first.clientName.localeCompare(second.clientName, 'pt-BR');
            if (sortKey === 'client_za') return second.clientName.localeCompare(first.clientName, 'pt-BR');
            if (sortKey === 'amount_asc') return first.amount - second.amount;
            if (sortKey === 'amount_desc') return second.amount - first.amount;
            const firstDate = new Date(first.dateValue).getTime() || 0;
            const secondDate = new Date(second.dateValue).getTime() || 0;
            if (sortKey === 'date_asc') return firstDate - secondDate;
            return secondDate - firstDate;
        });
    }, [tabbedEntries, listFilters, sortKey]);

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

    const groupedEntries = useMemo(() => {
        const groups = new Map<string, {
            groupId: string;
            clientName: string;
            clientPhone: string | null;
            count: number;
            total: number;
            lastDate: string;
            entries: ARListEntry[];
        }>();

        filteredEntries.forEach((entry) => {
            const groupKey = `${entry.clientName || CLIENT_FALLBACK_LABEL}|${entry.clientPhone || ''}`;
            const current = groups.get(groupKey);
            const createdAt = entry.dateValue || new Date().toISOString();

            if (!current) {
                groups.set(groupKey, {
                    groupId: groupKey,
                    clientName: entry.clientName || CLIENT_FALLBACK_LABEL,
                    clientPhone: entry.clientPhone || null,
                    count: 1,
                    total: Number(entry.amount || 0),
                    lastDate: createdAt,
                    entries: [entry],
                });
                return;
            }

            current.count += 1;
            current.total += Number(entry.amount || 0);
            current.entries.push(entry);
            if (new Date(createdAt).getTime() > new Date(current.lastDate).getTime()) {
                current.lastDate = createdAt;
            }
        });

        return Array.from(groups.values())
            .sort((first, second) => {
                if (sortKey === 'client_za') return second.clientName.localeCompare(first.clientName, 'pt-BR');
                if (sortKey === 'amount_asc') return first.total - second.total;
                if (sortKey === 'amount_desc') return second.total - first.total;
                if (sortKey === 'date_asc') return new Date(first.lastDate).getTime() - new Date(second.lastDate).getTime();
                if (sortKey === 'date_desc') return new Date(second.lastDate).getTime() - new Date(first.lastDate).getTime();
                return first.clientName.localeCompare(second.clientName, 'pt-BR');
            });
    }, [filteredEntries, sortKey]);

    const tabs: { key: ActiveTab; label: string }[] = [
        { key: 'todos', label: 'Todos' },
        { key: 'comandas', label: 'Comandas' },
        { key: 'clube', label: 'Clube do Chefe' },
        { key: 'recibos', label: 'Recibos' },
    ];

    const getStatusBadge = (status: string) => {
        if (status === 'overdue') return 'bg-red-500/10 text-red-600 border-red-500/20';
        if (status === 'open') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
        if (status === 'pending') return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
        if (status === 'settled') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        if (status === 'reversed') return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
        return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    };

    const getStatusLabel = (status: string) => {
        if (status === 'overdue') return 'Atrasado';
        if (status === 'open') return 'Em aberto';
        if (status === 'pending') return 'Pendente';
        if (status === 'settled') return 'Baixada';
        if (status === 'reversed') return 'Estornada';
        return status;
    };

    const selectedSortLabel = SORT_OPTIONS.find(option => option.key === sortKey)?.label || 'Data recente';
    const activeFilterCount = [
        listFilters.source !== 'todos',
        listFilters.status !== 'todos',
        Boolean(listFilters.dateFrom),
        Boolean(listFilters.dateTo),
        Boolean(listFilters.amountMin),
        Boolean(listFilters.amountMax),
        Boolean(listFilters.search.trim()),
        listFilters.viewMode !== 'list',
    ].filter(Boolean).length;

    const resetListFilters = () => setListFilters({ ...DEFAULT_AR_FILTERS });

    const settlementDetail = settlementEntry ? openComandaDetails[settlementEntry.id] : null;
    const settlementGross = settlementDetail?.grossSubtotal || settlementEntry?.amount || 0;
    const settlementDiscount = settlementDetail?.discount || 0;
    const settlementNet = settlementDetail?.netTotal || settlementEntry?.amount || 0;
    const parsedSettlementPaidAmount = Number(String(settlementPaidAmount || 0).replace(',', '.'));
    const settlementDifference = Number.isFinite(parsedSettlementPaidAmount)
        ? parsedSettlementPaidAmount - settlementNet
        : 0;
    const emptyStateCopy = hasTenantContext
        ? EMPTY_STATE_COPY[activeTab]
        : {
            title: 'Sem contexto de barbearia',
            description: 'Selecione uma barbearia/tenant valido para carregar contas a receber.',
        };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {settlementEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4">
                    <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-black text-slate-950 dark:text-white">Dar baixa financeira</h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    A baixa será registrada pela RPC financeira central.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeSettlementModal}
                                disabled={Boolean(markingPaid)}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5"
                            >
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>

                        <div className="mt-5 rounded-xl bg-slate-50 dark:bg-white/5 p-4 text-sm">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Cliente</p>
                                    <strong className="mt-1 block text-base text-slate-900 dark:text-white">{settlementEntry.clientName}</strong>
                                    {settlementEntry.clientPhone && (
                                        <p className="mt-1 text-xs font-semibold text-slate-500">{settlementEntry.clientPhone}</p>
                                    )}
                                    <p className="mt-2 text-xs text-slate-500">
                                        Comanda #{getShortId(settlementEntry.id)} · {settlementDetail?.status || settlementEntry.status}
                                    </p>
                                </div>
                                <div className="text-left md:text-right">
                                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Abertura</p>
                                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                                        {new Date(settlementEntry.dateValue).toLocaleString('pt-BR')}
                                    </p>
                                    <p className="mt-2 text-xs text-slate-500">
                                        Profissional principal: {settlementDetail?.mainStaffName || 'Não informado'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-4">
                                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-border-dark dark:bg-background-dark">
                                    <p className="text-[11px] font-bold uppercase text-slate-400">Subtotal bruto</p>
                                    <p className="mt-1 font-black text-slate-900 dark:text-white">{formatCurrency(settlementGross)}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-border-dark dark:bg-background-dark">
                                    <p className="text-[11px] font-bold uppercase text-slate-400">Desconto</p>
                                    <p className={`mt-1 font-black ${settlementDiscount > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
                                        {formatCurrency(settlementDiscount)}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-border-dark dark:bg-background-dark">
                                    <p className="text-[11px] font-bold uppercase text-slate-400">Valor líquido</p>
                                    <p className="mt-1 font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(settlementNet)}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-border-dark dark:bg-background-dark">
                                    <p className="text-[11px] font-bold uppercase text-slate-400">Diferença do pago</p>
                                    <p className={`mt-1 font-black ${Math.abs(settlementDifference) > 0.009 ? 'text-amber-600 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
                                        {formatCurrency(settlementDifference)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 rounded-xl border border-slate-200 dark:border-border-dark">
                            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-border-dark">
                                <div>
                                    <p className="text-sm font-black text-slate-900 dark:text-white">Itens da comanda</p>
                                    <p className="text-xs text-slate-500">Visualização apenas para conferência antes da baixa.</p>
                                </div>
                                <button
                                    type="button"
                                    disabled
                                    title="Para alterar itens da comanda, use o Checkout/Comanda antes da baixa."
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-400 opacity-70 dark:border-border-dark"
                                >
                                    Adicionar serviço/produto
                                </button>
                            </div>
                            <p className="border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 dark:border-border-dark">
                                Para alterar itens, descontos ou profissionais, ajuste a comanda no Checkout antes da baixa financeira.
                            </p>

                            {settlementDetail?.items.length ? (
                                <div className="divide-y divide-slate-100 dark:divide-white/5">
                                    {settlementDetail.items.map((item) => (
                                        <div key={item.id} className="p-4">
                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500 dark:bg-white/5">
                                                            {item.typeLabel}
                                                        </span>
                                                        {item.participants.length > 0 && (
                                                            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">
                                                                Compartilhado
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                                                    <p className="mt-1 text-xs text-slate-500">Responsável: {item.staffName}</p>
                                                </div>
                                                <div className="text-left md:text-right">
                                                    <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(item.total)}</p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {item.quantity} x {formatCurrency(item.unitPrice)}
                                                    </p>
                                                </div>
                                            </div>

                                            {item.participants.length > 0 && (
                                                <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
                                                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Participação lançada</p>
                                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                        {item.participants.map((participant) => (
                                                            <div key={participant.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-border-dark dark:bg-background-dark">
                                                                <p className="font-bold text-slate-900 dark:text-white">{participant.staffName}</p>
                                                                <p className="mt-1 text-slate-500">
                                                                    {participant.payoutType} · {participant.payoutValue}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 text-sm text-slate-500">
                                    Nenhum item encontrado para esta comanda.
                                </div>
                            )}
                        </div>

                        <div className="mt-5 grid gap-4">
                            <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                                Valor pago
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={settlementPaidAmount}
                                    onChange={(event) => setSettlementPaidAmount(event.target.value)}
                                    className="rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2.5 text-sm outline-none focus:border-primary"
                                    placeholder="0,00"
                                />
                                <span className="text-xs font-medium text-slate-500">
                                    Pode ser diferente do total; a diferença fica registrada na auditoria financeira.
                                </span>
                            </label>

                            <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                                Forma de pagamento
                                <select
                                    value={settlementPaymentMethod}
                                    onChange={(event) => setSettlementPaymentMethod(event.target.value as PaymentMethod)}
                                    className="rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2.5 text-sm outline-none focus:border-primary"
                                >
                                    <option value="pix">Pix</option>
                                    <option value="cash">Dinheiro</option>
                                    <option value="credit">Cartão de crédito</option>
                                    <option value="debit">Cartão de débito</option>
                                    <option value="other">Outro</option>
                                </select>
                            </label>

                            <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                                Data real do pagamento
                                <input
                                    type="datetime-local"
                                    value={settlementPaymentDate}
                                    onChange={(event) => setSettlementPaymentDate(event.target.value)}
                                    className="rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2.5 text-sm outline-none focus:border-primary"
                                />
                            </label>

                            <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                                Observacao
                                <textarea
                                    value={settlementNotes}
                                    onChange={(event) => setSettlementNotes(event.target.value)}
                                    rows={3}
                                    className="resize-none rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2.5 text-sm outline-none focus:border-primary"
                                    placeholder="Opcional"
                                />
                            </label>
                        </div>

                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <Button type="button" variant="secondary" onClick={closeSettlementModal} disabled={Boolean(markingPaid)}>
                                Cancelar
                            </Button>
                            <Button type="button" onClick={handleConfirmSettlement} isLoading={markingPaid === settlementEntry.id}>
                                {markingPaid === settlementEntry.id ? 'Registrando...' : 'Confirmar baixa'}
                            </Button>
                        </div>
                    </div>
                </div>
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
                                <p className="text-xs font-bold uppercase text-slate-500">Baixa original</p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{reversalEntry.clientName}</p>
                                <p className="mt-1 text-xs text-slate-500">{reversalEntry.id}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Valor original</p>
                                <p className="mt-2 text-lg font-black text-emerald-600 dark:text-emerald-400">
                                    {reversalEntry.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                                    onChange={(event) => setRefundMethod(event.target.value as PaymentMethod)}
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
                                {reversingId === reversalEntry.id ? 'Registrando...' : 'Confirmar estorno'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Contas a Receber</h2>
                    <p className="text-slate-500 mt-1">Visão consolidada de valores a receber de comandas, Clube do Chefe e recibos.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <AuditAdjustmentButton
                        context={{
                            sourceType: 'accounts_receivable',
                            sourceLabel: 'Contas a Receber',
                            beforeSnapshot: {
                                total_em_aberto: totals.open,
                                comandas_abertas: totals.comandas.count,
                                recibos_pendentes: totals.recibos.count,
                                clube_pendente_ou_atrasado: totals.clube.count,
                                mes: filterMonth,
                            },
                            financialImpactLabel: 'Impacto potencial em baixa, recebíveis e fluxo de caixa',
                            allowedAdjustmentTypes: [
                                'payment_date_correction',
                                'payment_method_correction',
                                'settlement_reversal',
                                'wrong_charge_cancellation',
                                'mark_for_review',
                            ],
                        }}
                        defaultAdjustmentType="mark_for_review"
                    />
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

            {loadError && (
                <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="mt-0.5 size-5 flex-none" />
                            <div>
                                <p className="font-black">Falha ao carregar contas a receber</p>
                                <p className="mt-1">{loadError}</p>
                            </div>
                        </div>
                        <Button type="button" variant="secondary" onClick={fetchData}>
                            Tentar novamente
                        </Button>
                    </div>
                </section>
            )}

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

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Lista operacional</p>
                        <h3 className="text-base font-black text-slate-950 dark:text-white">
                            {filteredEntries.length} registro(s), ordenado por {selectedSortLabel.toLowerCase()}
                        </h3>
                    </div>

                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                        <div className="flex flex-wrap gap-2">
                            {SORT_OPTIONS.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => setSortKey(option.key)}
                                    className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                                        sortKey === option.key
                                            ? 'border-[#00D2FF]/30 bg-[#00D2FF]/10 text-[#006CA3] dark:text-[#80E8FF]'
                                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowFilters((current) => !current)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                        >
                            <span className="material-symbols-outlined text-base">tune</span>
                            Filtros
                            {activeFilterCount > 0 && (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 dark:border-white/10 md:grid-cols-2 xl:grid-cols-4">
                        <label className="space-y-1.5">
                            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Origem</span>
                            <select
                                value={listFilters.source}
                                onChange={(event) => setListFilters((current) => ({ ...current, source: event.target.value as SourceFilter }))}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                            >
                                {SOURCE_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Status</span>
                            <select
                                value={listFilters.status}
                                onChange={(event) => setListFilters((current) => ({ ...current, status: event.target.value as StatusFilter }))}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                            >
                                {STATUS_FILTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Data inicial</span>
                            <input
                                type="date"
                                value={listFilters.dateFrom}
                                onChange={(event) => setListFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                            />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Data final</span>
                            <input
                                type="date"
                                value={listFilters.dateTo}
                                onChange={(event) => setListFilters((current) => ({ ...current, dateTo: event.target.value }))}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                            />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Valor mínimo</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={listFilters.amountMin}
                                onChange={(event) => setListFilters((current) => ({ ...current, amountMin: event.target.value }))}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                            />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Valor máximo</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={listFilters.amountMax}
                                onChange={(event) => setListFilters((current) => ({ ...current, amountMax: event.target.value }))}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                            />
                        </label>
                        <label className="space-y-1.5 md:col-span-2">
                            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Cliente, telefone ou referência</span>
                            <input
                                type="search"
                                value={listFilters.search}
                                onChange={(event) => setListFilters((current) => ({ ...current, search: event.target.value }))}
                                placeholder="Buscar cliente, telefone ou comanda"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                            />
                        </label>
                        <div className="space-y-1.5">
                            <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Visualização</span>
                            <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/5">
                                {[
                                    { value: 'list' as ViewMode, label: 'Lista' },
                                    { value: 'grouped' as ViewMode, label: 'Por cliente' },
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setListFilters((current) => ({ ...current, viewMode: option.value }))}
                                        className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                                            listFilters.viewMode === option.value
                                                ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white'
                                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={resetListFilters}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                            >
                                Limpar filtros
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {loading ? (
                <section className="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-10 text-center">
                    <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <h3 className="mt-4 text-base font-black text-slate-950 dark:text-white">Carregando contas a receber</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                        Buscando comandas abertas, recebíveis do Clube e recibos pendentes do período selecionado.
                    </p>
                </section>
            ) : filteredEntries.length === 0 ? (
                <section className="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-10 text-center">
                    <div className="mx-auto size-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 mb-4">
                        <AlertCircle className="size-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-950 dark:text-white mb-1">{emptyStateCopy.title}</h3>
                    <p className="mx-auto max-w-md text-sm text-slate-500">
                        {emptyStateCopy.description}
                    </p>
                    {hasTenantContext && activeTab !== 'todos' && (
                        <Button type="button" variant="secondary" className="mt-5" onClick={() => setActiveTab('todos')}>
                            Ver todas as origens
                        </Button>
                    )}
                </section>
            ) : (
                <section className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-border-dark px-5 py-4">
                        <div>
                            <h3 className="text-base font-bold text-slate-950 dark:text-white">
                                {tabs.find(t => t.key === activeTab)?.label}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Comandas abertas e baixadas, Clube do Chefe e recibos no período.</p>
                        </div>
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                            {filteredEntries.length} registros
                        </div>
                    </div>

                    {listFilters.viewMode === 'grouped' ? (
                        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                            {groupedEntries.map((group) => (
                                <div key={group.groupId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-slate-900 dark:text-white">{group.clientName}</p>
                                            {group.clientPhone && <p className="mt-1 text-xs text-slate-500">{group.clientPhone}</p>}
                                        </div>
                                        <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-[11px] font-black text-slate-600 dark:bg-white/10 dark:text-slate-300">
                                            {group.count} itens
                                        </span>
                                    </div>
                                    <div className="mt-4 flex items-end justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Total filtrado</p>
                                            <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                                                {formatCurrency(group.total)}
                                            </p>
                                        </div>
                                        <p className="text-xs font-semibold text-slate-500">
                                            Última: {new Date(group.lastDate).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        {group.entries.slice(0, 4).map((entry) => (
                                            <div key={entry.listId} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs dark:bg-card-dark">
                                                <div className="min-w-0">
                                                    <p className="truncate font-bold text-slate-800 dark:text-slate-100">{entry.description}</p>
                                                    <p className="mt-0.5 text-slate-500">{SOURCE_LABELS[entry.source]} · {getStatusLabel(entry.status)}</p>
                                                </div>
                                                <p className="shrink-0 font-black text-slate-900 dark:text-white">{formatCurrency(entry.amount)}</p>
                                            </div>
                                        ))}
                                        {group.entries.length > 4 && (
                                            <p className="text-xs font-semibold text-slate-500">+ {group.entries.length - 4} item(ns) no mesmo cliente</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left">
                                <thead className="bg-slate-50/90 dark:bg-white/5">
                                    <tr>
                                        {['Origem', 'Cliente', 'Descrição', 'Data / Vencimento', 'Valor', 'Status', ''].map(col => (
                                            <th key={col} className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {filteredEntries.map(entry => (
                                        <tr key={entry.listId} className="hover:bg-slate-50/80 dark:hover:bg-white/5">
                                            <td className="px-5 py-4">
                                                <span className="text-xs font-bold text-slate-500 uppercase">
                                                    {SOURCE_LABELS[entry.source]}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.clientName || CLIENT_FALLBACK_LABEL}</p>
                                                {entry.clientPhone && (
                                                    <p className="mt-1 text-xs text-slate-500">{entry.clientPhone}</p>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm text-slate-700 dark:text-slate-200">{entry.description}</p>
                                                {entry.source === 'comanda' && (
                                                    <p className="mt-1 text-[11px] text-slate-400">Referência: {entry.settlement?.sourceId ? getShortId(entry.settlement.sourceId) : getShortId(entry.id)}</p>
                                                )}
                                                {entry.reversalStatus && entry.reversalStatus !== 'none' && (
                                                    <p className="mt-1 text-[11px] font-bold text-amber-600 dark:text-amber-300">
                                                        {entry.reversalStatus === 'full' ? 'Estorno total registrado' : 'Estorno parcial registrado'}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">
                                                {new Date(entry.dateValue).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white">
                                                {formatCurrency(entry.amount)}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase border ${getStatusBadge(entry.status)}`}>
                                                    {getStatusLabel(entry.status)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                {entry.actionKind === 'settle' && entry.receivable && (
                                                    <button
                                                        onClick={() => openSettlementModal(entry.receivable!)}
                                                        disabled={markingPaid === entry.id}
                                                        title="A baixa sera registrada pela RPC financeira central."
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-600 transition hover:bg-emerald-500/20 disabled:opacity-50"
                                                    >
                                                        {markingPaid === entry.id ? (
                                                            <span className="size-3 rounded-full border-2 border-emerald-600/30 border-t-emerald-600 animate-spin"></span>
                                                        ) : (
                                                            <span className="material-symbols-outlined text-sm">check_circle</span>
                                                        )}
                                                        Dar baixa
                                                    </button>
                                                )}
                                                {entry.actionKind === 'reverse' && entry.settlement && isReversalEligible(entry.settlement) && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        className="rounded-xl text-amber-700 dark:text-amber-300"
                                                        onClick={() => openReversalModal(entry.settlement!)}
                                                        disabled={Boolean(reversingId)}
                                                    >
                                                        Estornar
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

export default AccountsReceivable;
