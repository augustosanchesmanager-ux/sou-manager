import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, XCircle, ExternalLink, Wallet } from 'lucide-react';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import EmptyStateFinance from '../components/financial/EmptyStateFinance';
import { AuditAdjustmentButton } from '../components/audit';
import { useAuth } from '../context/AuthContext';
import { useTenantOptional } from '../src/context/TenantContext';
import { supabase, getScopedClient } from '../services/supabaseClient';
import { formatCurrency } from '../shared/format/currency';
import {
    settleCheckoutComanda,
    settleCheckoutComandaAndEnqueue,
    type OutboxEnqueueData,
} from '../src/lib/finance/settlement';
import { clientWalletRepository } from '../domain/clientWallet/walletRepository';
import type { ClientWallet } from '../domain/clientWallet/types';
import {
    closeZeroAmountComanda,
    isManagerLikeRole,
    type ZeroCloseOrigin,
} from '../src/lib/finance/zeroClose';
import { fetchChefClubCreditsByClient, type ChefClubClientCredits } from '../src/lib/supabase/chefClub';
import { getAvailableCreditsForService } from '../src/utils/chefClubCredits';
import {
    AccountsReceivableKPIs,
    AccountsReceivableFilters,
    SettlementModal,
    CancelComandaModal,
    DepositWalletModal,
    LimitWalletModal,
    type ARFilters,
    type AREntry,
    type ARSource,
    type ARStatus,
    type CancelReasonType,
    type ComandaItemDetail,
    type OpenComandaDetail,
    type PaidComandaSettlement,
    type PaymentMethod,
    type ReversalStatus,
    type ReversalSummary,
    type SettlementMode,
    type SortKey,
    type SourceFilter,
    type StatusFilter,
    type ViewMode,
    CANCEL_REASON_OPTIONS,
    DEFAULT_AR_FILTERS,
    SORT_OPTIONS,
    getShortId,
} from './AccountsReceivable/index';

interface ComandaRecord {
    id: string;
    client_id?: string | null;
    appointment_id?: string | null;
    status: string;
    total: number;
    discount?: number | null;
    created_at: string;
    staff_id?: string | null;
    payment_method?: string | null;
    clients?: { name: string; phone?: string | null } | { name: string; phone?: string | null }[] | null;
    appointments?: { start_time: string } | { start_time: string }[] | null;
}

const getAppointmentStartTime = (appointments: any): string | null => {
    if (!appointments) return null;
    if (Array.isArray(appointments)) {
        return appointments[0]?.start_time || null;
    }
    return appointments.start_time || null;
};

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

interface ClubReceivableRecord {
    id: string;
    customer_id: string;
    subscription_id: string;
    plan_id: string;
    due_date: string;
    amount: number;
    status: string;
    transaction_id: string | null;
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

type ActiveTab = 'fiado' | 'creditos' | 'todos' | 'comandas' | 'clube' | 'recibos' | 'historico';

interface ARListEntry extends AREntry {
    listId: string;
    reference: string;
    receivable?: AREntry;
    settlement?: PaidComandaSettlement;
    actionKind: 'settle' | 'reverse' | 'none';
    reversalStatus?: ReversalStatus;
}
const CLIENT_FALLBACK_LABEL = 'Cliente não identificado';
const SOURCE_LABELS: Record<ARSource, string> = {
    comanda: 'Comanda',
    clube: 'Club dos Chefes',
    recibo: 'Recibo',
};
const EMPTY_STATE_COPY: Record<ActiveTab, { title: string; description: string }> = {
    fiado: {
        title: 'Nenhum fiado pendente',
        description: 'Não há clientes devedores ou comandas em fiado em aberto no momento.',
    },
    creditos: {
        title: 'Nenhum crédito positivo em carteira',
        description: 'Clientes com saldo pré-pago ou limite de crédito aparecerão nesta aba (separados dos devedores de fiado).',
    },
    todos: {
        title: 'Nenhuma conta a receber pendente',
        description: 'Não há comandas abertas, recebíveis do Clube ou recibos pendentes neste período.',
    },
    comandas: {
        title: 'Nenhuma comanda aberta',
        description: 'As comandas em aberto deste período aparecerão aqui para baixa financeira.',
    },
    clube: {
        title: 'Nenhum recebível do Clube pendente',
        description: 'Cobranças pendentes ou atrasadas do Club dos Chefes aparecerão nesta aba.',
    },
    recibos: {
        title: 'Nenhum recibo pendente',
        description: 'Recibos pendentes de pagamento aparecerão aqui quando existirem.',
    },
    historico: {
        title: 'Nenhum histórico de baixa',
        description: 'Não há baixas de comanda ou estornos registrados neste período.',
    },
};
interface FinancialReversalRecord {
    original_transaction_id: string | null;
    reversal_transaction_id?: string | null;
    reversal_type?: string | null;
    amount: number | string | null;
    reason_type?: string | null;
    created_at?: string | null;
}

const toDateTimeInputValue = (date: Date) => {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const createSettlementKey = (comandaId: string) => {
    const randomId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `finance-settle-${comandaId}-${randomId}`;
};

const createFiadoOutboxData = (
    tenantId: string,
    comandaId: string,
    clientId: string | null | undefined,
    staffId: string | null | undefined,
    paidAmount: number,
    paymentMethod: string,
    origin: string,
): OutboxEnqueueData => {
    const eventId = `evt_fiado_settle_${comandaId}_${Date.now()}`;
    return {
        eventId,
        eventType: 'CheckoutCompleted',
        payload: {
            operationType: 'create_commission_record',
            operationData: {
                tenantId,
                comandaId,
                clientId: clientId || null,
                staffId: staffId || null,
                receivedValue: paidAmount,
                paymentMethod,
                hasClubCredit: false,
            },
            sourceEvent: 'CheckoutCompleted',
            idempotencyKey: `${eventId}_create_commission_record`,
        },
        metadata: {
            tenantId,
            source: 'accounts_receivable',
            origin,
        },
        targets: [{ provider: 'finance', config: {} }],
    };
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

const AccountsReceivable: React.FC = () => {
    const { tenantId, accessRole, canAccessSuperAdmin, user } = useAuth();
    const tenantContext = useTenantOptional();
    const hasTenantContext = Boolean(tenantId);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
        const param = searchParams.get('tab');
        if (param && ['fiado', 'creditos', 'todos', 'comandas', 'clube', 'recibos', 'historico'].includes(param)) {
            return param as ActiveTab;
        }
        return 'fiado';
    });
    const [wallets, setWallets] = useState<ClientWallet[]>([]);
    const [depositWallet, setDepositWallet] = useState<ClientWallet | null>(null);
    const [depositAmount, setDepositAmount] = useState('');
    const [limitWallet, setLimitWallet] = useState<ClientWallet | null>(null);
    const [limitInput, setLimitInput] = useState('');
    const [savingWalletAction, setSavingWalletAction] = useState(false);
    const [pixKey, setPixKey] = useState<string>(() => {
        if (tenantId) {
            return localStorage.getItem(`smg_pix_key_${tenantId}`) || '';
        }
        return '';
    });
    const [consolidatedModalGroup, setConsolidatedModalGroup] = useState<null | {
        groupId: string;
        clientId?: string | null;
        clientName: string;
        clientPhone: string | null;
        total: number;
        walletDebt?: number;
        oldestDate: string;
        entries: ARListEntry[];
    }>(null);
    const [consolidatedMethod, setConsolidatedMethod] = useState<PaymentMethod>('pix');
    const [consolidatedPaymentDate, setConsolidatedPaymentDate] = useState(() => toDateTimeInputValue(new Date()));
    const [consolidatedNotes, setConsolidatedNotes] = useState('');
    const [isConsolidating, setIsConsolidating] = useState(false);
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
    const [settlementMode, setSettlementMode] = useState<SettlementMode>('payment');
    const [settlementZeroReason, setSettlementZeroReason] = useState('');
    const [settlementZeroPin, setSettlementZeroPin] = useState('');
    const [settlementClubCredits, setSettlementClubCredits] = useState<ChefClubClientCredits | null>(null);
    const [settlementClubCreditsLoading, setSettlementClubCreditsLoading] = useState(false);
    const settlementLockRef = React.useRef(false);
    const [cancelEntry, setCancelEntry] = useState<AREntry | null>(null);
    const [cancelReasonType, setCancelReasonType] = useState<CancelReasonType | ''>('');
    const [cancelReasonNote, setCancelReasonNote] = useState('');
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const cancelLockRef = React.useRef(false);
    const [paidComandaSettlements, setPaidComandaSettlements] = useState<PaidComandaSettlement[]>([]);
    const [clubReceivables, setClubReceivables] = useState<ClubReceivableRecord[]>([]);
    const [pendingReceipts, setPendingReceipts] = useState<ReceiptRecord[]>([]);

    const [clubClients, setClubClients] = useState<Record<string, { name: string; phone?: string | null }>>({});
    const [clubPlans, setClubPlans] = useState<Record<string, { name: string }>>({});
    const canRequestFinancialReversal =
        canAccessSuperAdmin || ['owner', 'admin', 'manager', 'superadmin'].includes(accessRole);
    const canUseAdministrativeZeroClose = isManagerLikeRole(accessRole, canAccessSuperAdmin);

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
                walletsData,
            ] = await Promise.all([
                barberSupabase
                    .from('comandas')
                    .select('id, client_id, status, total, discount, created_at, staff_id, payment_method, clients(name, phone), appointments(start_time)')
                    .eq('tenant_id', tenantId)
                    .eq('status', 'open'),
                barberSupabase.rpc('generate_club_receivables', { p_tenant_id: tenantId }).then(() =>
                    barberSupabase
                        .from('customer_subscription_receivables')
                        .select('id, customer_id, subscription_id, plan_id, due_date, amount, status, transaction_id')
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
                clientWalletRepository.listWallets(tenantId).catch(() => [] as ClientWallet[]),
            ]);
            setWallets(walletsData);

            if (comandasResult.error) throw comandasResult.error;
            const rawComandas = (comandasResult.data || []) as ComandaRecord[];
            const startMs = new Date(year, month - 1, 1, 0, 0, 0, 0).getTime();
            const endMs = new Date(year, month, 0, 23, 59, 59, 999).getTime();

            // Filtragem temporal por competência: prioriza start_time do agendamento, com fallback para created_at (walk-in)
            const comandasData = rawComandas.filter((comanda) => {
                const targetDate = getAppointmentStartTime(comanda.appointments) || comanda.created_at;
                const targetMs = new Date(targetDate).getTime();
                return Number.isFinite(targetMs) && targetMs >= startMs && targetMs <= endMs;
            });
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
                        serviceId: item.service_id || null,
                        productId: item.product_id || null,
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

    const openSettlementModal = async (entry: AREntry) => {
        setSettlementEntry(entry);
        setSettlementPaymentMethod('pix');
        setSettlementPaymentDate(toDateTimeInputValue(new Date()));
        setSettlementPaidAmount(Number(entry.amount || 0).toFixed(2));
        setSettlementNotes('');
        setSettlementIdempotencyKey(createSettlementKey(entry.id));
        setSettlementMode('payment');
        setSettlementZeroReason('');
        setSettlementClubCredits(null);

        if (entry.clientId && tenantId) {
            setSettlementClubCreditsLoading(true);
            try {
                const credits = await fetchChefClubCreditsByClient(entry.clientId, tenantId);
                setSettlementClubCredits(credits);
                if (Number(entry.amount || 0) <= 0 && credits?.availableCredits) {
                    setSettlementMode('club_credit');
                }
            } catch (error) {
                console.warn('Não foi possível carregar créditos do Clube para baixa:', error);
            } finally {
                setSettlementClubCreditsLoading(false);
            }
        }
    };

    const closeSettlementModal = () => {
        if (markingPaid) return;
        setSettlementEntry(null);
        setSettlementPaidAmount('');
        setSettlementNotes('');
        setSettlementIdempotencyKey(null);
        setSettlementMode('payment');
        setSettlementZeroReason('');
        setSettlementZeroPin('');
        setSettlementClubCredits(null);
        setSettlementClubCreditsLoading(false);
    };

    const handleConfirmSettlement = async () => {
        if (settlementLockRef.current) return;
        if (!tenantId || !settlementEntry) {
            setToast({ message: 'Contexto invalido para baixa financeira. Atualize a pagina e tente novamente.', type: 'error' });
            return;
        }

        const paidAmount = Number(String(settlementPaidAmount).replace(',', '.'));
        if (settlementMode === 'payment' && (!settlementPaymentMethod || !settlementPaymentDate || !Number.isFinite(paidAmount) || paidAmount <= 0)) {
            setToast({ message: 'Informe forma de pagamento, data real e valor valido para dar baixa.', type: 'error' });
            return;
        }
        if (settlementMode === 'club_credit' && !settlementClubCanCover) {
            setToast({ message: 'Crédito do Clube indisponível ou insuficiente para esta comanda.', type: 'error' });
            return;
        }
        if (settlementMode === 'administrative_adjustment' && !canUseAdministrativeZeroClose) {
            setToast({ message: 'Baixa administrativa zero exige gerente, admin ou superadmin.', type: 'error' });
            return;
        }
        if ((settlementMode === 'house_courtesy' || settlementMode === 'administrative_adjustment') && !settlementZeroReason.trim()) {
            setToast({ message: 'Informe o motivo obrigatório para fechamento zero.', type: 'error' });
            return;
        }
        if ((settlementMode === 'house_courtesy' || settlementMode === 'administrative_adjustment') && !/^\d{6,8}$/.test(settlementZeroPin.replace(/\D/g, '').trim())) {
            setToast({ message: 'Informe a senha/PIN de gerência (6 a 8 dígitos) para autorizar o fechamento zero.', type: 'error' });
            return;
        }

        settlementLockRef.current = true;
        setMarkingPaid(settlementEntry.id);
        setToast({ message: settlementMode === 'payment' ? 'Registrando baixa financeira...' : 'Registrando fechamento zero auditado...', type: 'info' });
        try {
            const barberSupabase = getScopedClient('barber');
            const detail = openComandaDetails[settlementEntry.id];
            const noteParts = [
                `Origem: accounts_receivable`,
                `Comanda: #${getShortId(settlementEntry.id)}`,
                detail?.discount ? `Desconto atual: ${formatCurrency(detail.discount)}` : null,
                settlementNotes.trim() ? `Observação: ${settlementNotes.trim()}` : null,
            ].filter(Boolean);
            if (settlementMode === 'payment') {
                const outbox = createFiadoOutboxData(
                    tenantId,
                    settlementEntry.id,
                    settlementEntry.clientId,
                    detail?.items?.[0]?.participants?.[0]?.id || null,
                    paidAmount,
                    settlementPaymentMethod,
                    'fiado_single_settlement',
                );
                await settleCheckoutComandaAndEnqueue({
                    comandaId: settlementEntry.id,
                    tenantId,
                    supabase: barberSupabase,
                    paymentMethod: settlementPaymentMethod,
                    paidAmount,
                    paymentDateReal: new Date(settlementPaymentDate).toISOString(),
                    source: 'accounts_receivable',
                    notes: noteParts.join('\n') || null,
                    idempotencyKey: settlementIdempotencyKey || createSettlementKey(settlementEntry.id),
                    recordComandaPayment: true,
                    outbox,
                });
            } else {
                await closeZeroAmountComanda({
                    comandaId: settlementEntry.id,
                    tenantId,
                    supabase: barberSupabase,
                    origin: settlementMode,
                    source: 'financial_admin',
                    authorizedBy: user?.id || (canAccessSuperAdmin ? 'superadmin' : accessRole),
                    userId: user?.id || null,
                    reason: settlementMode === 'club_credit'
                        ? `Crédito do Clube consumido pela baixa financeira: ${settlementRequiredClubCredits} crédito(s).`
                        : settlementZeroReason.trim(),
                    auditPin: settlementMode === 'club_credit' ? null : settlementZeroPin,
                });
            }
            setToast({ message: settlementMode === 'payment' ? 'Baixa realizada com sucesso.' : 'Comanda fechada sem lançamento financeiro duplicado.', type: 'success' });
            setSettlementEntry(null);
            setSettlementPaidAmount('');
            setSettlementNotes('');
            setSettlementIdempotencyKey(null);
            setSettlementMode('payment');
            setSettlementZeroReason('');
            setSettlementZeroPin('');
            setSettlementClubCredits(null);
            await fetchData();
        } catch (error: any) {
            console.error('Erro ao dar baixa via RPC:', error);
            const message = error?.message?.includes('Nenhuma alteração foi aplicada')
                ? error.message
                : 'Não foi possível registrar a baixa financeira. Nenhuma alteração foi aplicada.';
            setToast({ message, type: 'error' });
        } finally {
            settlementLockRef.current = false;
            setMarkingPaid(null);
        }
    };

    const openCancelModal = (entry: AREntry) => {
        if (entry.source !== 'comanda' || entry.status !== 'open') {
            setToast({ message: 'Somente comandas abertas podem ser canceladas por esta visão.', type: 'error' });
            return;
        }
        setCancelEntry(entry);
        setCancelReasonType('');
        setCancelReasonNote('');
    };

    const closeCancelModal = () => {
        if (cancellingId) return;
        setCancelEntry(null);
        setCancelReasonType('');
        setCancelReasonNote('');
    };

    const handleConfirmCancel = async () => {
        if (cancelLockRef.current) return;
        if (!tenantId || !cancelEntry) {
            setToast({ message: 'Contexto inválido para cancelar a comanda. Atualize a página e tente novamente.', type: 'error' });
            return;
        }
        if (cancelEntry.source !== 'comanda' || cancelEntry.status !== 'open') {
            setToast({ message: 'Não é permitido cancelar comanda já baixada ou já cancelada.', type: 'error' });
            return;
        }
        if (!cancelReasonType) {
            setToast({ message: 'Selecione o motivo do cancelamento.', type: 'error' });
            return;
        }

        const selectedReason = CANCEL_REASON_OPTIONS.find((option) => option.value === cancelReasonType);
        const note = cancelReasonNote.trim();
        if (selectedReason?.requiresNote && !note) {
            setToast({ message: 'Descreva o motivo quando selecionar Outro.', type: 'error' });
            return;
        }

        cancelLockRef.current = true;
        setCancellingId(cancelEntry.id);
        setToast({ message: 'Cancelando comanda aberta...', type: 'info' });

        try {
            const barberSupabase = getScopedClient('barber');
            const hiddenFromFinancial = ['duplicate', 'test', 'operational_error'].includes(cancelReasonType);
            const reasonText = selectedReason
                ? `${selectedReason.label}${note ? `: ${note}` : ''}`
                : note;

            const { data, error } = await barberSupabase
                .from('comandas')
                .update({
                    status: 'cancelled',
                    cancellation_type: cancelReasonType,
                    closure_note: reasonText,
                    cancelled_at: new Date().toISOString(),
                    cancelled_by_user_id: user?.id || null,
                    hidden_from_financial: hiddenFromFinancial,
                })
                .eq('id', cancelEntry.id)
                .eq('tenant_id', tenantId)
                .eq('status', 'open')
                .select('id');

            if (error) throw error;
            if (!data?.length) {
                setToast({
                    message: 'A comanda ja foi alterada ou nao esta mais em aberto. A lista sera atualizada.',
                    type: 'error',
                });
                await fetchData();
                return;
            }

            setToast({ message: 'Comanda cancelada com auditoria. Nenhuma baixa financeira foi criada.', type: 'success' });
            setCancelEntry(null);
            setCancelReasonType('');
            setCancelReasonNote('');
            await fetchData();
        } catch (error: any) {
            console.error('Erro ao cancelar comanda em contas a receber:', error);
            setToast({
                message: `Não foi possível cancelar a comanda. Nenhuma baixa ou transaction foi criada. ${error?.message || ''}`.trim(),
                type: 'error',
            });
        } finally {
            cancelLockRef.current = false;
            setCancellingId(null);
        }
    };

    const isReversalEligible = (entry: PaidComandaSettlement) => (
        canRequestFinancialReversal
        && Boolean(entry.tenantId)
        && Boolean(entry.id)
        && entry.reversibleAmount > 0
        && (entry.transactionStatus === 'paid' || entry.transactionStatus === 'Pago' || !entry.transactionStatus)
    );

    const handleOpenReversalInCashflow = (entry: PaidComandaSettlement) => {
        navigate(`/cashflow?tx=${encodeURIComponent(entry.id)}&action=reverse`);
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const allEntries: AREntry[] = useMemo(() => {
        const entries: AREntry[] = [];

        openComandas.forEach(c => {
            const detail = openComandaDetails[c.id];
            const client = detail ? { name: detail.clientName, phone: detail.clientPhone } : getClientData(c.clients);
            const targetDate = getAppointmentStartTime(c.appointments) || c.created_at;
            entries.push({
                id: c.id,
                source: 'comanda',
                clientId: c.client_id || null,
                clientName: client.name,
                clientPhone: client.phone,
                description: `Comanda #${getShortId(c.id)} · em aberto`,
                dateValue: targetDate,
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

    const receivables = useMemo<ARListEntry[]>(() => {
        return allEntries.map((entry): ARListEntry => ({
            ...entry,
            listId: `receivable-${entry.source}-${entry.id}`,
            reference: `${SOURCE_LABELS[entry.source]} ${getShortId(entry.id)} ${entry.description}`,
            receivable: entry,
            actionKind: entry.source === 'comanda' && entry.status === 'open' ? 'settle' : 'none',
        }));
    }, [allEntries]);

    const settledComandas = useMemo<ARListEntry[]>(() => {
        return paidComandaSettlements.map((entry): ARListEntry => {
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
    }, [paidComandaSettlements]);

    const [walletSearch, setWalletSearch] = useState('');

    useEffect(() => {
        const param = searchParams.get('tab');
        if (param && ['fiado', 'creditos', 'todos', 'comandas', 'clube', 'recibos', 'historico'].includes(param)) {
            setActiveTab(param as ActiveTab);
        }
    }, [searchParams]);

    const handleTabSelect = (tab: ActiveTab) => {
        setActiveTab(tab);
        if (tab === 'fiado') {
            setSearchParams({});
        } else {
            setSearchParams({ tab });
        }
    };

    const tabbedEntries = useMemo(() => {
        if (activeTab === 'historico') {
            return settledComandas;
        }
        if (activeTab === 'fiado') {
            return receivables.filter(e => e.source === 'comanda' && e.status === 'open');
        }
        if (activeTab === 'creditos') {
            return [];
        }
        if (activeTab === 'todos') {
            return receivables;
        }
        if (activeTab === 'comandas') {
            return receivables.filter(e => e.source === 'comanda');
        }
        if (activeTab === 'clube') {
            return receivables.filter(e => e.source === 'clube');
        }
        if (activeTab === 'recibos') {
            return receivables.filter(e => e.source === 'recibo');
        }
        return receivables;
    }, [receivables, settledComandas, activeTab]);

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
            oldestDate: string;
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
                    oldestDate: createdAt,
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
            if (new Date(createdAt).getTime() < new Date(current.oldestDate).getTime()) {
                current.oldestDate = createdAt;
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

    // Regra de ouro: aba Fiados exibe EXCLUSIVAMENTE clientes devedores (comandas abertas ou saldo negativo de carteira).
    // Saldos positivos (créditos pré-pagos) pertencem exclusivamente à aba Créditos / Carteira.
    const positiveCreditWallets = useMemo(() => {
        return wallets.filter((w) => Number(w.balance || 0) > 0);
    }, [wallets]);

    const filteredCreditWallets = useMemo(() => {
        const term = (walletSearch || listFilters.search).trim().toLowerCase();
        return wallets
            .filter((w) => Number(w.balance || 0) >= 0 && (Number(w.balance || 0) > 0 || Number(w.credit_limit || 0) > 0 || term.length > 0))
            .filter((w) => {
                if (!term) return true;
                return (
                    (w.client_name || '').toLowerCase().includes(term) ||
                    (w.client_phone || '').includes(term)
                );
            })
            .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));
    }, [wallets, walletSearch, listFilters.search]);

    const totalPositiveCredits = useMemo(() => {
        return positiveCreditWallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);
    }, [positiveCreditWallets]);

    const fiadoDebtorClients = useMemo(() => {
        const negativeWalletByClientId = new Map<string, ClientWallet>();
        wallets.forEach((w) => {
            if (Number(w.balance || 0) < 0) {
                negativeWalletByClientId.set(w.client_id, w);
            }
        });

        const groups = new Map<string, {
            groupId: string;
            clientId?: string | null;
            clientName: string;
            clientPhone: string | null;
            count: number;
            total: number;
            walletDebt: number;
            lastDate: string;
            oldestDate: string;
            entries: ARListEntry[];
        }>();

        receivables.filter(e => e.source === 'comanda' && e.status === 'open').forEach((entry) => {
            const groupKey = entry.clientId || `${entry.clientName || CLIENT_FALLBACK_LABEL}|${entry.clientPhone || ''}`;
            const current = groups.get(groupKey);
            const createdAt = entry.dateValue || new Date().toISOString();

            if (!current) {
                groups.set(groupKey, {
                    groupId: groupKey,
                    clientId: entry.clientId || null,
                    clientName: entry.clientName || CLIENT_FALLBACK_LABEL,
                    clientPhone: entry.clientPhone || null,
                    count: 1,
                    total: Number(entry.amount || 0),
                    walletDebt: 0,
                    lastDate: createdAt,
                    oldestDate: createdAt,
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
            if (new Date(createdAt).getTime() < new Date(current.oldestDate).getTime()) {
                current.oldestDate = createdAt;
            }
        });

        negativeWalletByClientId.forEach((wallet, clientId) => {
            const debtAmount = Math.abs(Number(wallet.balance || 0));
            const existing = groups.get(clientId);
            if (existing) {
                existing.walletDebt = debtAmount;
                return;
            }
            const movedAt = wallet.last_movement_at || new Date().toISOString();
            groups.set(clientId, {
                groupId: clientId,
                clientId,
                clientName: wallet.client_name || CLIENT_FALLBACK_LABEL,
                clientPhone: wallet.client_phone || null,
                count: 0,
                total: debtAmount,
                walletDebt: debtAmount,
                lastDate: movedAt,
                oldestDate: movedAt,
                entries: [],
            });
        });

        return Array.from(groups.values())
            .filter((g) => g.total > 0)
            .sort((a, b) => b.total - a.total);
    }, [receivables, wallets]);

    const totalFiadoDebt = useMemo(() => {
        return fiadoDebtorClients.reduce((sum, c) => sum + c.total, 0);
    }, [fiadoDebtorClients]);

    const tabs: { key: ActiveTab; label: string; count?: number }[] = [
        { key: 'fiado', label: 'Fiados (Devedores)', count: fiadoDebtorClients.length },
        { key: 'creditos', label: 'Créditos / Carteira', count: positiveCreditWallets.length },
        { key: 'todos', label: 'Pendentes (Todos)', count: allEntries.length },
        { key: 'comandas', label: 'Comandas Abertas', count: openComandas.length },
        { key: 'clube', label: 'Club dos Chefes', count: clubReceivables.filter(r => !r.transaction_id).length },
        { key: 'recibos', label: 'Recibos', count: pendingReceipts.length },
        { key: 'historico', label: 'Histórico / Baixadas', count: paidComandaSettlements.length },
    ];

    const getDaysOverdue = (dateString: string): number => {
        const past = new Date(dateString).getTime();
        if (isNaN(past)) return 0;
        const now = Date.now();
        const diffMs = now - past;
        return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    };

    const getUrgencyBadge = (days: number) => {
        if (days >= 15) {
            return {
                label: `${days}d em atraso (Crítico)`,
                classes: 'bg-rose-500/10 text-rose-600 border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-400 font-extrabold',
            };
        }
        if (days >= 7) {
            return {
                label: `${days}d em atraso (Atenção)`,
                classes: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400 font-bold',
            };
        }
        if (days > 0) {
            return {
                label: `${days}d pendente`,
                classes: 'bg-sky-500/10 text-sky-600 border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-400 font-semibold',
            };
        }
        return {
            label: 'Hoje',
            classes: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400 font-semibold',
        };
    };

    const handleSendWhatsAppCharge = (group: { clientName: string; clientPhone: string | null; total: number; entries: ARListEntry[] }) => {
        if (!group.clientPhone) {
            setToast({ message: 'Cliente não possui telefone cadastrado para cobrança via WhatsApp.', type: 'error' });
            return;
        }
        const cleanPhone = group.clientPhone.replace(/\D/g, '');
        const phoneWithCountry = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
        const firstName = group.clientName.trim().split(' ')[0] || 'Cliente';
        const formattedTotal = formatCurrency(group.total);
        const shop = tenantContext?.tenant?.name || 'sua barbearia';
        const openComandasCount = group.entries.filter(e => e.status === 'open').length;

        let msg = `Olá, *${firstName}*! Tudo bem? 💈\n\n`;
        msg += `Passando para enviar o resumo da sua conta em aberto na *${shop}*.\n`;
        msg += `📋 Comandas pendentes: *${openComandasCount}*\n`;
        msg += `💰 Saldo total em aberto: *${formattedTotal}*\n\n`;

        if (pixKey.trim()) {
            msg += `Você pode efetuar o acerto via PIX através da chave:\n`;
            msg += `🔑 Chave PIX: *${pixKey.trim()}*\n\n`;
            msg += `Assim que realizar o pagamento, por gentileza nos envie o comprovante por aqui. `;
        }

        msg += `Agradecemos a confiança e estamos à disposição! 🤝`;

        const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleConsolidatedSettlement = async () => {
        if (!consolidatedModalGroup || !tenantId) return;
        const openComandasToSettle = consolidatedModalGroup.entries.filter(
            e => e.source === 'comanda' && e.status === 'open'
        );
        const parsedDate = new Date(consolidatedPaymentDate);
        if (!consolidatedPaymentDate || Number.isNaN(parsedDate.getTime())) {
            setToast({ message: 'Informe uma data real de recebimento válida.', type: 'error' });
            return;
        }
        const walletDebt = Number(consolidatedModalGroup.walletDebt || 0);
        if (openComandasToSettle.length === 0 && walletDebt <= 0) {
            setToast({ message: 'Nenhuma comanda aberta elegível para baixa.', type: 'info' });
            setConsolidatedModalGroup(null);
            return;
        }

        setIsConsolidating(true);
        setToast({ message: `Liquidando pendências de ${consolidatedModalGroup.clientName} no caixa...`, type: 'info' });

        try {
            let settledCount = 0;
            const paymentIso = parsedDate.toISOString();
            for (const entry of openComandasToSettle) {
                const entryAmount = Number(entry.amount || 0);
                const outbox = createFiadoOutboxData(
                    tenantId,
                    entry.id,
                    consolidatedModalGroup.clientId || entry.clientId,
                    null,
                    entryAmount,
                    consolidatedMethod,
                    'fiado_consolidated_settlement',
                );
                await settleCheckoutComandaAndEnqueue({
                    comandaId: entry.id,
                    tenantId,
                    supabase,
                    paymentMethod: consolidatedMethod,
                    paidAmount: entryAmount,
                    paymentDateReal: paymentIso,
                    source: 'accounts_receivable',
                    notes: `Liquidação consolidada fiado · Cliente: ${consolidatedModalGroup.clientName}${consolidatedNotes ? ` · ${consolidatedNotes}` : ''}`,
                    idempotencyKey: createSettlementKey(entry.id),
                    recordComandaPayment: true,
                    outbox,
                });
                settledCount++;
            }

            if (walletDebt > 0 && consolidatedModalGroup.clientId) {
                await clientWalletRepository.recordTransaction({
                    tenantId,
                    clientId: consolidatedModalGroup.clientId,
                    type: 'payment_settlement',
                    amount: walletDebt,
                    description: `Quitação de fiado via ${consolidatedMethod.toUpperCase()}`,
                    paymentMethod: consolidatedMethod,
                    createdBy: user?.id || null,
                });
            }

            setToast({
                message: settledCount > 0
                    ? `Liquidação concluída! ${settledCount} comanda(s) baixada(s) na data real do recebimento.`
                    : `Quitação de fiado registrada com sucesso!`,
                type: 'success',
            });
            setConsolidatedModalGroup(null);
            setConsolidatedNotes('');
            await fetchData();
        } catch (err: any) {
            setToast({
                message: err?.message || 'Erro ao realizar liquidação consolidada.',
                type: 'error',
            });
        } finally {
            setIsConsolidating(false);
        }
    };

    const handleSaveDepositCredit = async () => {
        if (!tenantId || !depositWallet) return;
        const amount = Number(String(depositAmount).replace(',', '.'));
        if (!Number.isFinite(amount) || amount <= 0) {
            setToast({ message: 'Informe um valor positivo para recarga de crédito.', type: 'error' });
            return;
        }
        setSavingWalletAction(true);
        try {
            await clientWalletRepository.recordTransaction({
                tenantId,
                clientId: depositWallet.client_id,
                type: 'credit_deposit',
                amount,
                description: 'Recarga de crédito pré-pago em carteira',
                paymentMethod: 'pix',
                createdBy: user?.id || null,
            });
            setToast({ message: `Crédito de ${formatCurrency(amount)} adicionado para ${depositWallet.client_name || 'cliente'}.`, type: 'success' });
            setDepositWallet(null);
            setDepositAmount('');
            await fetchData();
        } catch (err: any) {
            setToast({ message: err?.message || 'Erro ao registrar recarga de crédito.', type: 'error' });
        } finally {
            setSavingWalletAction(false);
        }
    };

    const handleSaveWalletLimit = async () => {
        if (!tenantId || !limitWallet) return;
        const parsedLimit = Number(String(limitInput).replace(',', '.'));
        if (!Number.isFinite(parsedLimit) || parsedLimit < 0) {
            setToast({ message: 'Informe um limite de fiado válido (maior ou igual a zero).', type: 'error' });
            return;
        }
        setSavingWalletAction(true);
        try {
            await clientWalletRepository.updateCreditLimit(tenantId, limitWallet.client_id, parsedLimit);
            setToast({ message: `Limite de fiado atualizado para ${formatCurrency(parsedLimit)}.`, type: 'success' });
            setLimitWallet(null);
            setLimitInput('');
            await fetchData();
        } catch (err: any) {
            setToast({ message: err?.message || 'Erro ao atualizar limite de fiado.', type: 'error' });
        } finally {
            setSavingWalletAction(false);
        }
    };

    const getStatusBadge = (status: string) => {
        if (status === 'overdue') return 'bg-red-500/10 text-red-600 border-red-500/20';
        if (status === 'open') return 'bg-teal-500/10 text-teal-700 border-teal-500/20';
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
    const selectedPeriodLabel = useMemo(() => {
        const [year, month] = filterMonth.split('-').map(Number);
        if (!year || !month) return filterMonth;
        return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric',
        });
    }, [filterMonth]);
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
    const listScopeLabel = activeFilterCount > 0
        ? `${filteredEntries.length} de ${tabbedEntries.length} registro(s) na visão atual`
        : `${filteredEntries.length} registro(s) no período carregado`;
    const dateScopeLabel = listFilters.dateFrom || listFilters.dateTo
        ? `Datas filtradas dentro de ${selectedPeriodLabel}`
        : `Período carregado: ${selectedPeriodLabel}`;

    const resetListFilters = () => setListFilters({ ...DEFAULT_AR_FILTERS });

    const settlementDetail = settlementEntry ? openComandaDetails[settlementEntry.id] : null;
    const settlementGross = settlementDetail?.grossSubtotal || settlementEntry?.amount || 0;
    const settlementDiscount = settlementDetail?.discount || 0;
    const settlementNet = settlementDetail?.netTotal || settlementEntry?.amount || 0;
    const settlementRequiredClubCredits = useMemo(() => {
        if (!settlementDetail) return 0;
        return settlementDetail.items.reduce((total, item) => (
            item.serviceId ? total + Math.max(0, Number(item.quantity || 0)) : total
        ), 0);
    }, [settlementDetail]);
    const settlementClubCanCover = useMemo(() => {
        if (!settlementDetail || !settlementClubCredits || settlementRequiredClubCredits <= 0) return false;
        const requiredByService = settlementDetail.items.reduce((acc, item) => {
            if (!item.serviceId) return acc;
            acc[item.serviceId] = (acc[item.serviceId] || 0) + Math.max(0, Number(item.quantity || 0));
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(requiredByService).every(([serviceId, required]) =>
            getAvailableCreditsForService(settlementClubCredits.serviceBalances, serviceId) >= Number(required || 0),
        );
    }, [settlementClubCredits, settlementDetail, settlementRequiredClubCredits]);
    const parsedSettlementPaidAmount = Number(String(settlementPaidAmount || 0).replace(',', '.'));
    const settlementDifference = Number.isFinite(parsedSettlementPaidAmount)
        ? parsedSettlementPaidAmount - settlementNet
        : 0;
    const selectedCancelReason = CANCEL_REASON_OPTIONS.find((option) => option.value === cancelReasonType);
    const cancelRequiresNote = Boolean(selectedCancelReason?.requiresNote);
    const canConfirmCancel = Boolean(cancelEntry && cancelReasonType && (!cancelRequiresNote || cancelReasonNote.trim()));
    const emptyStateCopy = hasTenantContext
        ? EMPTY_STATE_COPY[activeTab]
        : {
            title: 'Sem contexto de barbearia',
            description: 'Selecione uma barbearia/tenant valido para carregar contas a receber.',
        };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Contas a Receber</h2>
                    <p className="text-slate-500 mt-1">Visão consolidada de valores a receber de comandas, Club dos Chefes e recibos.</p>
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
                    <Button leftIcon="sync" onClick={fetchData}>
                        Atualizar
                    </Button>
                </div>
            </div>

            <AccountsReceivableKPIs
                totals={totals}
                selectedPeriodLabel={selectedPeriodLabel}
            />

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

            <div className="flex flex-wrap gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-xl w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => handleTabSelect(tab.key)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === tab.key
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <span>{tab.label}</span>
                        {typeof tab.count === 'number' && (
                            <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                    activeTab === tab.key
                                        ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light'
                                        : 'bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-slate-400'
                                }`}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <AccountsReceivableFilters
                filterMonth={filterMonth}
                onFilterMonthChange={setFilterMonth}
                sortKey={sortKey}
                onSortKeyChange={setSortKey}
                showFilters={showFilters}
                onToggleShowFilters={() => setShowFilters((current) => !current)}
                listFilters={listFilters}
                onListFiltersChange={setListFilters}
                activeFilterCount={activeFilterCount}
                listScopeLabel={listScopeLabel}
                dateScopeLabel={dateScopeLabel}
                selectedSortLabel={selectedSortLabel}
                onResetFilters={resetListFilters}
            />

            {loading ? (
                <section className="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-10 text-center">
                    <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <h3 className="mt-4 text-base font-black text-slate-950 dark:text-white">Carregando contas a receber</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                        Buscando comandas abertas, recebíveis do Clube e recibos pendentes do período selecionado.
                    </p>
                </section>
            ) : activeTab === 'creditos' ? (
                <section className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-border-dark px-5 py-4">
                        <div>
                            <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                                <Wallet className="size-4 text-emerald-500" />
                                Créditos Pré-Pagos &amp; Limites (Carteiras)
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Clientes com saldo positivo ou limite configurado ficam aqui, separados da lista de devedores (Fiados).
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                value={walletSearch}
                                onChange={(e) => setWalletSearch(e.target.value)}
                                placeholder="Buscar cliente..."
                                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                            />
                            <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                Total em Créditos: {formatCurrency(totalPositiveCredits)}
                            </div>
                        </div>
                    </div>

                    {filteredCreditWallets.length === 0 ? (
                        <div className="p-10 text-center">
                            <Wallet className="size-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{EMPTY_STATE_COPY.creditos.title}</h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{EMPTY_STATE_COPY.creditos.description}</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                            {filteredCreditWallets.map((wallet) => (
                                <div
                                    key={wallet.client_id}
                                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                                                    {wallet.client_name || CLIENT_FALLBACK_LABEL}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {wallet.client_phone || 'Sem telefone'}
                                                </p>
                                            </div>
                                            {wallet.balance > 0 ? (
                                                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                                                    Crédito positivo
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-slate-100 dark:bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">
                                                    Limite ativo
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 space-y-1.5 text-xs">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500">Saldo disponível:</span>
                                                <span className={`font-black text-sm ${wallet.balance > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    {formatCurrency(wallet.balance)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-slate-500">
                                                <span>Limite de fiado:</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                                    {formatCurrency(wallet.credit_limit)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDepositWallet(wallet);
                                                setDepositAmount('');
                                            }}
                                            className="flex-1 py-2 px-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                                        >
                                            + Crédito
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLimitWallet(wallet);
                                                setLimitInput(String(wallet.credit_limit || 0));
                                            }}
                                            className="py-2 px-3 rounded-lg text-xs font-bold border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                        >
                                            Ajustar Limite
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            ) : (activeTab !== 'fiado' && filteredEntries.length === 0) || (activeTab === 'fiado' && fiadoDebtorClients.length === 0) ? (
                <section className="rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-10 text-center">
                    <div className="mx-auto size-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 mb-4">
                        <AlertCircle className="size-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-950 dark:text-white mb-1">{emptyStateCopy.title}</h3>
                    <p className="mx-auto max-w-md text-sm text-slate-500">
                        {emptyStateCopy.description}
                    </p>
                    {hasTenantContext && activeTab !== 'todos' && (
                        <Button type="button" variant="secondary" className="mt-5" onClick={() => handleTabSelect('todos')}>
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
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {activeTab === 'historico'
                                    ? `Comandas baixadas e estornos registrados em ${selectedPeriodLabel}.`
                                    : `Contas a receber pendentes de liquidação em ${selectedPeriodLabel}.`}
                            </p>
                        </div>
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                            {filteredEntries.length} registros
                        </div>
                    </div>

                    {activeTab === 'fiado' ? (
                        <div className="p-4 space-y-4">
                            {/* Banner de Controle de Fiado e Chave PIX */}
                            <div className="p-4 rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50/50 dark:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total em Aberto na Carteira (Fiado)</p>
                                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                                        {formatCurrency(totalFiadoDebt)}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {fiadoDebtorClients.length} cliente(s) com débitos pendentes de pagamento.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:items-end gap-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase">
                                        Chave PIX da Barbearia (Cobrança WhatsApp)
                                    </label>
                                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                                        <input
                                            type="text"
                                            value={pixKey}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setPixKey(val);
                                                if (tenantId) localStorage.setItem(`smg_pix_key_${tenantId}`, val);
                                            }}
                                            placeholder="Ex: CNPJ, celular, e-mail ou aleatória"
                                            className="px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-slate-900 dark:text-white w-full sm:w-64 focus:outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Grid de Cartões Consolidados por Cliente Devedor */}
                            {fiadoDebtorClients.length === 0 ? (
                                <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-border-dark">
                                    <CheckCircle className="size-8 text-emerald-500 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Nenhum cliente com fiado em aberto</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Todas as contas a receber dos clientes estão em dia!</p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {fiadoDebtorClients.map((client) => {
                                        const days = getDaysOverdue(client.oldestDate);
                                        const urgency = getUrgencyBadge(days);
                                        const openComandasCount = client.entries.filter(e => e.status === 'open').length;

                                        return (
                                            <div
                                                key={client.groupId}
                                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                                            >
                                                <div>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                                                                {client.clientName}
                                                            </p>
                                                            {client.clientPhone ? (
                                                                <p className="text-xs text-slate-500 mt-0.5">{client.clientPhone}</p>
                                                            ) : (
                                                                <span className="text-[10px] text-amber-600 font-semibold">Sem telefone</span>
                                                            )}
                                                        </div>
                                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase border shrink-0 ${urgency.classes}`}>
                                                            {urgency.label}
                                                        </span>
                                                    </div>

                                                    <div className="mt-3.5 p-3 rounded-xl bg-slate-50 dark:bg-white/5 space-y-1.5">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-500 font-semibold">Saldo Devedor:</span>
                                                            <span className="font-black text-sm text-rose-600 dark:text-rose-400">
                                                                {formatCurrency(client.total)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs text-slate-500">
                                                            <span>Comandas pendentes:</span>
                                                            <span className="font-bold text-slate-700 dark:text-slate-300">
                                                                {openComandasCount}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[11px] text-slate-400">
                                                            <span>Desde:</span>
                                                            <span>{new Date(client.oldestDate).toLocaleDateString('pt-BR')}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSendWhatsAppCharge(client)}
                                                        disabled={!client.clientPhone}
                                                        title={client.clientPhone ? "Cobrar via WhatsApp com Chave PIX" : "Cliente sem telefone cadastrado"}
                                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                                                    >
                                                        <ExternalLink className="size-3.5" />
                                                        Cobrar WhatsApp
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setConsolidatedPaymentDate(toDateTimeInputValue(new Date()));
                                                            setConsolidatedModalGroup(client);
                                                        }}
                                                        title="Liquidar todas as comandas pendentes deste cliente com baixa no caixa"
                                                        className="inline-flex items-center justify-center gap-1 py-2 px-3 rounded-lg text-xs font-bold bg-primary hover:brightness-105 text-night transition-all shadow-sm"
                                                    >
                                                        <CheckCircle className="size-3.5" />
                                                        Baixar no Caixa
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : listFilters.viewMode === 'grouped' ? (
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
                                            <div key={entry.listId} className="rounded-xl bg-white px-3 py-2 text-xs dark:bg-card-dark">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate font-bold text-slate-800 dark:text-slate-100">{entry.description}</p>
                                                        <p className="mt-0.5 text-slate-500">{SOURCE_LABELS[entry.source]} · {getStatusLabel(entry.status)}</p>
                                                    </div>
                                                    <p className="shrink-0 font-black text-slate-900 dark:text-white">{formatCurrency(entry.amount)}</p>
                                                </div>
                                                {entry.actionKind === 'settle' && entry.receivable && (
                                                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/checkout?comandaId=${entry.id}`)}
                                                            title="Abrir comanda no Checkout"
                                                            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-border-dark dark:bg-card-dark dark:text-slate-300 dark:hover:bg-white/5"
                                                        >
                                                            <ExternalLink className="size-3" />
                                                            Checkout
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openSettlementModal(entry.receivable!)}
                                                            disabled={Boolean(markingPaid || cancellingId)}
                                                            title="A baixa sera registrada pela RPC financeira central."
                                                            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-black text-emerald-700 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
                                                        >
                                                            {markingPaid === entry.id ? (
                                                                <span className="size-3 rounded-full border-2 border-emerald-600/30 border-t-emerald-600 animate-spin"></span>
                                                            ) : (
                                                                <CheckCircle className="size-3.5" />
                                                            )}
                                                            Dar baixa
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openCancelModal(entry.receivable!)}
                                                            disabled={Boolean(markingPaid || cancellingId)}
                                                            title="Cancelar somente comanda aberta, com motivo obrigatório e auditoria."
                                                            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-black text-rose-700 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300"
                                                        >
                                                            {cancellingId === entry.id ? (
                                                                <span className="size-3 rounded-full border-2 border-rose-600/30 border-t-rose-600 animate-spin"></span>
                                                            ) : (
                                                                <XCircle className="size-3.5" />
                                                            )}
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                )}
                                                {entry.source === 'clube' && (
                                                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate('/chef-club-receivables')}
                                                            title="Gerenciar cobranças no Clube dos Chefes"
                                                            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-border-dark dark:bg-card-dark dark:text-slate-300 dark:hover:bg-white/5"
                                                        >
                                                            <ExternalLink className="size-3" />
                                                            Ver no Clube
                                                        </button>
                                                    </div>
                                                )}
                                                {entry.source === 'recibo' && (
                                                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate('/receipts')}
                                                            title="Ver no módulo de Recibos"
                                                            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-border-dark dark:bg-card-dark dark:text-slate-300 dark:hover:bg-white/5"
                                                        >
                                                            <ExternalLink className="size-3" />
                                                            Ver Recibo
                                                        </button>
                                                    </div>
                                                )}
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
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/checkout?comandaId=${entry.id}`)}
                                                            title="Abrir comanda no Checkout"
                                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-border-dark dark:bg-card-dark dark:text-slate-300 dark:hover:bg-white/5"
                                                        >
                                                            <ExternalLink className="size-3" />
                                                            Checkout
                                                        </button>
                                                        <button
                                                            onClick={() => openSettlementModal(entry.receivable!)}
                                                            disabled={markingPaid === entry.id}
                                                            title="A baixa sera registrada pela RPC financeira central."
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-600 transition hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
                                                        >
                                                            {markingPaid === entry.id ? (
                                                                <span className="size-3 rounded-full border-2 border-emerald-600/30 border-t-emerald-600 animate-spin"></span>
                                                            ) : (
                                                                <CheckCircle className="size-3.5" />
                                                            )}
                                                            Dar baixa
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openCancelModal(entry.receivable!)}
                                                            disabled={Boolean(markingPaid || cancellingId)}
                                                            title="Cancelar somente comanda aberta, com motivo obrigatório e auditoria."
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-300"
                                                        >
                                                            {cancellingId === entry.id ? (
                                                                <span className="size-3 rounded-full border-2 border-rose-600/30 border-t-rose-600 animate-spin"></span>
                                                            ) : (
                                                                <XCircle className="size-3.5" />
                                                            )}
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                )}
                                                {entry.source === 'clube' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate('/chef-club-receivables')}
                                                        title="Gerenciar cobranças no Clube dos Chefes"
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-border-dark dark:bg-card-dark dark:text-slate-300 dark:hover:bg-white/5"
                                                    >
                                                        <ExternalLink className="size-3" />
                                                        Ver no Clube
                                                    </button>
                                                )}
                                                {entry.source === 'recibo' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate('/receipts')}
                                                        title="Visualizar no módulo de Recibos"
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-border-dark dark:bg-card-dark dark:text-slate-300 dark:hover:bg-white/5"
                                                    >
                                                        <ExternalLink className="size-3" />
                                                        Ver Recibo
                                                    </button>
                                                )}
                                                {entry.actionKind === 'reverse' && entry.settlement && isReversalEligible(entry.settlement) && (
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        className="rounded-xl text-amber-700 dark:text-amber-300"
                                                        onClick={() => handleOpenReversalInCashflow(entry.settlement!)}
                                                        title="Estornos são executados exclusivamente no Fluxo de Caixa."
                                                    >
                                                        Estornar no Fluxo
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

            <SettlementModal
                isOpen={Boolean(settlementEntry)}
                onClose={closeSettlementModal}
                entry={settlementEntry}
                detail={settlementDetail}
                settlementGross={settlementGross}
                settlementDiscount={settlementDiscount}
                settlementNet={settlementNet}
                settlementDifference={settlementDifference}
                settlementMode={settlementMode}
                onSettlementModeChange={setSettlementMode}
                settlementPaidAmount={settlementPaidAmount}
                onSettlementPaidAmountChange={setSettlementPaidAmount}
                settlementPaymentMethod={settlementPaymentMethod}
                onSettlementPaymentMethodChange={setSettlementPaymentMethod}
                settlementPaymentDate={settlementPaymentDate}
                onSettlementPaymentDateChange={setSettlementPaymentDate}
                settlementNotes={settlementNotes}
                onSettlementNotesChange={setSettlementNotes}
                settlementZeroReason={settlementZeroReason}
                onSettlementZeroReasonChange={setSettlementZeroReason}
                settlementZeroPin={settlementZeroPin}
                onSettlementZeroPinChange={setSettlementZeroPin}
                settlementClubCredits={settlementClubCredits}
                settlementClubCreditsLoading={settlementClubCreditsLoading}
                settlementClubCanCover={settlementClubCanCover}
                canUseAdministrativeZeroClose={canUseAdministrativeZeroClose}
                isSubmitting={markingPaid === settlementEntry?.id}
                onConfirm={handleConfirmSettlement}
            />

            <CancelComandaModal
                isOpen={Boolean(cancelEntry)}
                onClose={closeCancelModal}
                entry={cancelEntry}
                cancelReasonType={cancelReasonType}
                onCancelReasonTypeChange={setCancelReasonType}
                cancelReasonNote={cancelReasonNote}
                onCancelReasonNoteChange={setCancelReasonNote}
                cancelRequiresNote={cancelRequiresNote}
                canConfirmCancel={canConfirmCancel}
                isSubmitting={cancellingId === cancelEntry?.id}
                onConfirm={handleConfirmCancel}
            />

            {consolidatedModalGroup && (
                <Modal
                    isOpen={Boolean(consolidatedModalGroup)}
                    onClose={() => !isConsolidating && setConsolidatedModalGroup(null)}
                    title="Liquidação Consolidada no Caixa"
                    maxWidth="sm"
                >
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5 space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">Cliente:</span>
                                <span className="font-bold text-slate-900 dark:text-white">{consolidatedModalGroup.clientName}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">Comandas a Baixar:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                    {consolidatedModalGroup.entries.filter(e => e.source === 'comanda' && e.status === 'open').length} comanda(s)
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-200 dark:border-white/10">
                                <span className="font-bold text-slate-700 dark:text-slate-300">Valor Total a Quitar:</span>
                                <span className="font-black text-rose-600 dark:text-rose-400 text-base">
                                    {formatCurrency(consolidatedModalGroup.total)}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Forma de Pagamento Recebida
                            </label>
                            <select
                                value={consolidatedMethod}
                                onChange={(e) => setConsolidatedMethod(e.target.value as PaymentMethod)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-sm font-semibold text-slate-900 dark:text-white"
                            >
                                <option value="pix">PIX</option>
                                <option value="cash">Dinheiro</option>
                                <option value="debit">Cartão de Débito</option>
                                <option value="credit">Cartão de Crédito</option>
                                <option value="other">Outro</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Data Real do Recebimento
                            </label>
                            <input
                                type="datetime-local"
                                value={consolidatedPaymentDate}
                                onChange={(e) => setConsolidatedPaymentDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-sm font-semibold text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Observação no Caixa (Opcional)
                            </label>
                            <input
                                type="text"
                                value={consolidatedNotes}
                                onChange={(e) => setConsolidatedNotes(e.target.value)}
                                placeholder="Ex: Quitação total de fiado no balcão"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-sm text-slate-900 dark:text-white"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                className="flex-1"
                                disabled={isConsolidating}
                                onClick={() => setConsolidatedModalGroup(null)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                className="flex-1"
                                disabled={isConsolidating}
                                onClick={handleConsolidatedSettlement}
                            >
                                {isConsolidating ? 'Baixando...' : 'Confirmar Baixa'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            <DepositWalletModal
                isOpen={Boolean(depositWallet)}
                onClose={() => setDepositWallet(null)}
                wallet={depositWallet}
                depositAmount={depositAmount}
                onDepositAmountChange={setDepositAmount}
                isSaving={savingWalletAction}
                onConfirm={handleSaveDepositCredit}
            />

            <LimitWalletModal
                isOpen={Boolean(limitWallet)}
                onClose={() => setLimitWallet(null)}
                wallet={limitWallet}
                limitInput={limitInput}
                onLimitInputChange={setLimitInput}
                isSaving={savingWalletAction}
                onConfirm={handleSaveWalletLimit}
            />
        </div>
    );
};

export default AccountsReceivable;
