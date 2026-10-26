import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ensureAppSupportsModule,
    getScopedClient,
    requireTenantContext,
    supabase,
} from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { AuditAdjustmentButton } from '../components/audit';
import { DEFAULT_APP_SLUG } from '../src/lib/supabase/schemas';
import { fetchChefClubCreditsByClients, type ChefClubClientCredits } from '../src/lib/supabase/chefClub';
import { formatCurrency } from '../shared/format/currency';
import { escapeHtml } from '../shared/strings';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import { logSupabaseError } from '../src/lib/supabase/errors';
import ComandaListItem from '../components/ComandaListItem';
import ComandaSidebar, { type ComandaFinancialHistory } from '../components/ComandaSidebar';
import ComandaFiltersModal from '../components/ComandaFiltersModal';
import {
  comandaStatusLabels,
  comandaStatusLabelsEstetica,
  comandaStatusSortOrder,
  getPaymentStatusLabel,
} from '../shared/status/comanda';
import type { ComandaStatus } from '../shared/status/comanda';
import { isSharedServiceItem, calculateParticipantBaseValue } from '../domain/commission';
import type { ParticipantRow as DomainParticipantRow } from '../domain/commission/types';
import { createReversalKey, reverseFinancialTransaction } from '../src/lib/finance/reversal';
import { isManagerLikeRole } from '../src/lib/finance/zeroClose';
import { getQuickPeriodDateRange, calculateComandaKpiSummary } from '../src/utils/comandaFilters';
import { QuickOpenComandaModal, type QuickOpenComandaPayload } from '@/src/components/comandas/QuickOpenComandaModal';
import { type CatalogItem } from '@/src/utils/comandaQuickActions';
import { comandaQuickService } from '@/services/comandaQuickService';

type SortField = 'date' | 'client' | 'status' | 'total';
type SortDirection = 'asc' | 'desc';
type QuickRange = 'today' | 'yesterday' | 'this_week' | 'this_month' | '7d' | '30d' | 'custom' | 'all';
type ConsumptionType = 'all' | 'service' | 'product' | 'mixed';

interface ComandaItem {
    id: string;
    staff_id?: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    product_id?: string | null;
    service_id?: string | null;
}

interface ServiceExecutionParticipantRow {
    id: string;
    comanda_item_id: string;
    staff_id?: string | null;
    professional_id?: string | null;
    role: string | null;
    payout_type: string | null;
    payout_value: number | null;
    affects_commission?: boolean | null;
}

interface Comanda {
    id: string;
    tenant_id?: string | null;
    client_id: string;
    staff_id?: string | null;
    appointment_id?: string | null;
    status: ComandaStatus;
    cancellation_type?: string | null;
    cancelled_at?: string | null;
    cancelled_by_user_id?: string | null;
    hidden_from_financial?: boolean | null;
    closure_mode?: 'standard' | 'legacy_membership' | null;
    closure_note?: string | null;
    financial_effect?: boolean | null;
    membership_credit_effect?: boolean | null;
    legacy_reference_month?: string | null;
    closed_at?: string | null;
    discount?: number | null;
    payment_method?: string | null;
    total: number;
    created_at: string;
    clients: {
        name: string;
        avatar: string;
        phone?: string | null;
    };
    staff?: {
        name: string;
    };
    appointment?: {
        start_time: string | null;
    };
    comanda_items: ComandaItem[];
    staff_ids: string[];
    staff_names: string[];
    chefClubInfo?: ChefClubClientCredits | null;
}

interface ClientLookup {
    id: string;
    name: string;
    avatar: string | null;
    phone?: string | null;
}

interface StaffLookup {
    id: string;
    name: string;
}

interface AppointmentLookup {
    id: string;
    start_time: string;
}

interface ComandaTransactionRow {
    id: string;
    tenant_id?: string | null;
    source_id?: string | null;
    type?: string | null;
    amount: number | string | null;
    payment_method?: string | null;
    date?: string | null;
    created_at?: string | null;
    status?: string | null;
}

interface FinancialReversalRow {
    original_transaction_id: string | null;
    reversal_transaction_id?: string | null;
    reversal_type?: string | null;
    amount: number | string | null;
    reason_type?: string | null;
    created_at?: string | null;
}

interface ComandaItemRow {
    id: string;
    comanda_id: string;
    staff_id?: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    product_id?: string | null;
    service_id?: string | null;
}

interface ComandasPreferences {
    filterStatus: 'all' | ComandaStatus;
    searchTerm: string;
    dateFrom: string;
    dateTo: string;
    quickRange: QuickRange;
    sortField: SortField;
    sortDirection: SortDirection;
    staffFilter: string;
    paymentMethodFilter: string;
    minTotal: string;
    maxTotal: string;
    consumptionType: ConsumptionType;
}

const CANCEL_REASON_OTHER = '__other__';
const CANCEL_TYPE_OPTIONS = [
    { value: 'operational_error', label: 'Erro operacional' },
    { value: 'test', label: 'Teste' },
    { value: 'duplicate', label: 'Duplicidade' },
    { value: 'client_gave_up', label: 'Cliente desistiu' },
    { value: 'appointment_cancelled', label: 'Agendamento cancelado' },
    { value: 'other', label: 'Outro' },
] as const;

const REOPEN_REASON_OPTIONS = [
    { value: 'baixa_indevida', label: 'Baixa indevida' },
    { value: 'erro_forma_pagamento', label: 'Erro na forma de pagamento' },
    { value: 'erro_operacional', label: 'Erro operacional (itens/profissional/valor)' },
    { value: 'cobranca_duplicada', label: 'Cobrança duplicada' },
    { value: 'outro', label: 'Outro motivo auditado' },
] as const;

const COMANDAS_PREFERENCES_KEY = 'soumanager:comandas:preferences:v2';
const COMANDA_ITEMS_SELECT = 'id, comanda_id, product_name, quantity, unit_price, product_id, service_id';
const CLIENT_NAME_FALLBACK = 'Cliente não informado';
const NOT_INFORMED_FALLBACK = 'Não informado';
const BATCH_SIZE = 80;

// logSupabaseError is imported from src/lib/supabase/errors.ts

const formatDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value: string, endOfDay = false) => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    const parsedDate = new Date(
        year,
        month - 1,
        day,
        endOfDay ? 23 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 59 : 0,
        endOfDay ? 999 : 0,
    );
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

type SupabaseQueryBuilder = ReturnType<ReturnType<typeof import('../src/lib/supabase/client').getScopedClient>['from']>;

type FilterableQuery = { eq: (column: string, value: unknown) => FilterableQuery };

const batchedIn = async <T extends object>(
    client: ReturnType<typeof import('../src/lib/supabase/client').getScopedClient>,
    table: string,
    select: string,
    column: string,
    ids: string[],
    extraFilters?: (q: FilterableQuery) => FilterableQuery,
): Promise<{ data: T[] | null; error: unknown }> => {
    if (ids.length === 0) return { data: [], error: null };
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        batches.push(ids.slice(i, i + BATCH_SIZE));
    }
    const allData: T[] = [];
    let lastError: unknown = null;
    for (const batch of batches) {
        const raw = client.from(table).select(select).in(column, batch);
        const q: FilterableQuery = extraFilters ? extraFilters(raw as unknown as FilterableQuery) : raw as unknown as FilterableQuery;
        const { data, error } = await q as unknown as { data: T[] | null; error: unknown };
        if (error) { lastError = error; break; }
        if (data) allData.push(...data);
    }
    return { data: lastError ? null : allData, error: lastError };
};

const formatDateLabel = (value: string) => new Date(value).toLocaleDateString('pt-BR');
const getShortComandaRef = (id: string) => `#${getDisplayId(id)}`;
const formatMonthInputValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const getDefaultLegacyReferenceMonth = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return formatMonthInputValue(date);
};

const getDisplayId = (id: string) => {
    const hexStr = id.replace(/-/g, '').slice(0, 8);
    const num = parseInt(hexStr, 16);
    return Number.isNaN(num) ? 1000 : (num % 89999) + 1000;
};

const getStatusSortValue = (status: ComandaStatus) => {
    return comandaStatusSortOrder[status] ?? 99;
};

const getStatusContextLabel = (status: ComandaStatus, isEsteticaApp = false) => {
    if (status === 'open') return isEsteticaApp ? 'Aberto para procedimento, produto ou finalização.' : 'Aberta para consumo ou baixa no checkout.';
    if (status === 'blocked') return 'Bloqueada para baixa financeira segura.';
    if (status === 'paid') return 'Baixada/fechada no financeiro.';
    return 'Anulada/cancelada com motivo operacional.';
};

const getConsumptionSummary = (comanda: Comanda) => {
    if (comanda.comanda_items.length === 0) {
        return { title: 'Sem consumo', detail: '0 itens' };
    }
    const sortedItems = [...comanda.comanda_items].sort(
        (first, second) => (second.quantity * second.unit_price) - (first.quantity * first.unit_price),
    );
    const primaryItem = sortedItems[0];
    const remainingItems = comanda.comanda_items.length - 1;
    return {
        title: primaryItem.product_name,
        detail: remainingItems > 0 ? `+${remainingItems}` : `${primaryItem.quantity}x`,
    };
};

const getConsumptionTypeForFilter = (comanda: Comanda): ConsumptionType => {
    const hasServices = comanda.comanda_items.some((item) => Boolean(item.service_id));
    const hasProducts = comanda.comanda_items.some((item) => Boolean(item.product_id));
    if (hasServices && hasProducts) return 'mixed';
    if (hasServices) return 'service';
    if (hasProducts) return 'product';
    return 'all';
};

const loadComandasPreferences = (): ComandasPreferences => {
    const today = new Date();
    const todayStr = formatDateInputValue(today);
    const defaultPreferences: ComandasPreferences = {
        filterStatus: 'all',
        searchTerm: '',
        dateFrom: todayStr,
        dateTo: todayStr,
        quickRange: 'today',
        sortField: 'date',
        sortDirection: 'desc',
        staffFilter: '',
        paymentMethodFilter: '',
        minTotal: '',
        maxTotal: '',
        consumptionType: 'all',
    };

    if (typeof window === 'undefined') return defaultPreferences;

    try {
        const rawValue = window.localStorage.getItem(COMANDAS_PREFERENCES_KEY);
        if (!rawValue) return defaultPreferences;
        const parsed = JSON.parse(rawValue) as Partial<ComandasPreferences>;
        const parsedRange = ['today', '7d', '30d', 'custom', 'all'].includes(parsed.quickRange || '')
            ? (parsed.quickRange as QuickRange)
            : defaultPreferences.quickRange;

        let computedDateFrom = typeof parsed.dateFrom === 'string' ? parsed.dateFrom : '';
        let computedDateTo = typeof parsed.dateTo === 'string' ? parsed.dateTo : '';

        if (!computedDateFrom && !computedDateTo) {
            if (parsedRange === 'today') {
                computedDateFrom = todayStr;
                computedDateTo = todayStr;
            } else if (parsedRange === '7d') {
                const start7d = new Date(today);
                start7d.setDate(start7d.getDate() - 6);
                computedDateFrom = formatDateInputValue(start7d);
                computedDateTo = todayStr;
            } else if (parsedRange === '30d') {
                const start30d = new Date(today);
                start30d.setDate(start30d.getDate() - 29);
                computedDateFrom = formatDateInputValue(start30d);
                computedDateTo = todayStr;
            }
        }

        return {
            filterStatus: ['all', 'blocked', 'open', 'paid', 'cancelled'].includes(parsed.filterStatus || '')
                ? (parsed.filterStatus as 'all' | ComandaStatus)
                : defaultPreferences.filterStatus,
            searchTerm: typeof parsed.searchTerm === 'string' ? parsed.searchTerm : defaultPreferences.searchTerm,
            dateFrom: computedDateFrom || defaultPreferences.dateFrom,
            dateTo: computedDateTo || defaultPreferences.dateTo,
            quickRange: parsedRange,
            sortField: ['date', 'client', 'status', 'total'].includes(parsed.sortField || '')
                ? (parsed.sortField as SortField)
                : defaultPreferences.sortField,
            sortDirection: ['asc', 'desc'].includes(parsed.sortDirection || '')
                ? (parsed.sortDirection as SortDirection)
                : defaultPreferences.sortDirection,
            staffFilter: typeof parsed.staffFilter === 'string' ? parsed.staffFilter : defaultPreferences.staffFilter,
            paymentMethodFilter: typeof parsed.paymentMethodFilter === 'string' ? parsed.paymentMethodFilter : defaultPreferences.paymentMethodFilter,
            minTotal: typeof parsed.minTotal === 'string' ? parsed.minTotal : defaultPreferences.minTotal,
            maxTotal: typeof parsed.maxTotal === 'string' ? parsed.maxTotal : defaultPreferences.maxTotal,
            consumptionType: ['all', 'service', 'product', 'mixed'].includes(parsed.consumptionType || '')
                ? (parsed.consumptionType as ConsumptionType)
                : defaultPreferences.consumptionType,
        };
    } catch {
        return defaultPreferences;
    }
};

const fetchSingleComandaFinancialHistory = async (
    comandaId: string,
    resolvedTenantId: string | null,
): Promise<ComandaFinancialHistory | null> => {
    try {
        const client = getScopedClient('barber');
        let transactionsQuery = client
            .from('transactions')
            .select('id, tenant_id, source_id, type, amount, payment_method, date, created_at, status')
            .eq('source_type', 'comanda')
            .eq('source_id', comandaId)
            .eq('type', 'income');

        if (resolvedTenantId) {
            transactionsQuery = transactionsQuery.eq('tenant_id', resolvedTenantId);
        }

        const { data: transactionRows, error: transactionsError } = await transactionsQuery;
        if (transactionsError || !transactionRows || transactionRows.length === 0) {
            return null;
        }

        const transactions = (transactionRows as ComandaTransactionRow[])
            .filter((transaction) => Boolean(transaction.id) && (!transaction.type || transaction.type === 'income'));

        if (transactions.length === 0) return null;

        const transactionIds = transactions.map((t) => t.id);
        const reversedByTransactionId = new Map<string, number>();
        const reversalsByTransactionId = new Map<string, ComandaFinancialHistory['reversals']>();

        let reversalsQuery = supabase
            .from('financial_reversals')
            .select('original_transaction_id, reversal_transaction_id, reversal_type, amount, reason_type, created_at')
            .in('original_transaction_id', transactionIds);

        if (resolvedTenantId) {
            reversalsQuery = reversalsQuery.eq('tenant_id', resolvedTenantId);
        }

        const { data: reversals, error: reversalsError } = await reversalsQuery;
        if (!reversalsError && reversals) {
            (reversals as FinancialReversalRow[]).forEach((reversal) => {
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

        let latestTransaction: ComandaTransactionRow | null = null;
        for (const transaction of transactions) {
            if (!latestTransaction) {
                latestTransaction = transaction;
                continue;
            }
            const curDate = new Date(transaction.date || transaction.created_at || 0).getTime();
            const prevDate = new Date(latestTransaction.date || latestTransaction.created_at || 0).getTime();
            if (curDate >= prevDate) {
                latestTransaction = transaction;
            }
        }

        if (!latestTransaction) return null;

        const amount = Number(latestTransaction.amount || 0);
        const reversedAmount = Math.min(amount, reversedByTransactionId.get(latestTransaction.id) || 0);
        const reversibleAmount = Math.max(amount - reversedAmount, 0);
        const reversalStatus: ComandaFinancialHistory['reversalStatus'] = reversedAmount <= 0
            ? 'none'
            : reversibleAmount <= 0
                ? 'full'
                : 'partial';

        return {
            transactionId: latestTransaction.id,
            amount,
            paymentMethod: latestTransaction.payment_method || NOT_INFORMED_FALLBACK,
            date: latestTransaction.date || latestTransaction.created_at || null,
            status: latestTransaction.status || null,
            reversedAmount,
            reversibleAmount,
            reversalStatus,
            reversals: reversalsByTransactionId.get(latestTransaction.id) || [],
        };
    } catch (err) {
        logSupabaseError('[Comandas] Erro ao carregar historico financeiro sob demanda', err, { comandaId });
        return null;
    }
};

const Comandas: React.FC = () => {
    const navigate = useNavigate();
    const { appSlug, schema, tenantId, user, accessRole, canAccessSuperAdmin } = useAuth();
    const labels = getBusinessLabels(appSlug);
    const isEsteticaApp = appSlug === 'estetica';
    const orderLabel = labels.order;
    const orderLabelLower = orderLabel.toLowerCase();
    const orderPluralLabel = labels.orderPlural;
    const orderPluralLower = orderPluralLabel.toLowerCase();
    const servicePluralLabel = labels.servicePlural;
    const servicePluralLower = servicePluralLabel.toLowerCase();
    const financialImpactCopy = isEsteticaApp ? 'o financeiro e repasses' : 'o financeiro e comissões';
    const statusLabels: Record<'all' | ComandaStatus, string> = isEsteticaApp
        ? comandaStatusLabelsEstetica
        : comandaStatusLabels;
    const preferences = loadComandasPreferences();

    const [comandas, setComandas] = useState<Comanda[]>([]);
    const [financialHistoryByComandaId, setFinancialHistoryByComandaId] = useState<Record<string, ComandaFinancialHistory>>({});
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | ComandaStatus>(preferences.filterStatus);
    const [searchTerm, setSearchTerm] = useState(preferences.searchTerm);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(preferences.searchTerm);
    const [dateFrom, setDateFrom] = useState(preferences.dateFrom);
    const [dateTo, setDateTo] = useState(preferences.dateTo);

    // Debounce da busca textual (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);
    const [quickRange, setQuickRange] = useState<QuickRange>(preferences.quickRange);
    const [sortField, setSortField] = useState<SortField>(preferences.sortField);
    const [sortDirection, setSortDirection] = useState<SortDirection>(preferences.sortDirection);
    const [staffFilter, setStaffFilter] = useState(preferences.staffFilter);
    const [paymentMethodFilter, setPaymentMethodFilter] = useState(preferences.paymentMethodFilter);
    const [minTotal, setMinTotal] = useState(preferences.minTotal);
    const [maxTotal, setMaxTotal] = useState(preferences.maxTotal);
    const [consumptionType, setConsumptionType] = useState<ConsumptionType>(preferences.consumptionType);
    const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null);
    const [selectedOpenComandaIds, setSelectedOpenComandaIds] = useState<string[]>([]);
    const [bulkCloseModalOpen, setBulkCloseModalOpen] = useState(false);
    const [bulkClosing, setBulkClosing] = useState(false);
    const [bulkClosureNote, setBulkClosureNote] = useState('');
    const [bulkLegacyReferenceMonth, setBulkLegacyReferenceMonth] = useState(getDefaultLegacyReferenceMonth);
    const [bulkCloseType, setBulkCloseType] = useState<'admin' | 'normal'>('normal');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [deleteComanda, setDeleteComanda] = useState<Comanda | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelReasonOther, setCancelReasonOther] = useState('');
    const [reopenComanda, setReopenComanda] = useState<Comanda | null>(null);
    const [reopenReasonType, setReopenReasonType] = useState<string>('baixa_indevida');
    const [reopenReasonNote, setReopenReasonNote] = useState('');
    const [reopenConfirmed, setReopenConfirmed] = useState(false);
    const [reopenIdempotencyKey, setReopenIdempotencyKey] = useState<string | null>(null);
    const [reopening, setReopening] = useState(false);
    const [filtersModalOpen, setFiltersModalOpen] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const canManageFinancialReversal = isManagerLikeRole(accessRole, canAccessSuperAdmin);

    // Frente 1.G: Estado e dados do Modal de Abertura Rápida
    const [isQuickOpenModalOpen, setIsQuickOpenModalOpen] = useState(false);
    const [quickClients, setQuickClients] = useState<Array<{ id: string; name: string; avatar?: string; phone?: string }>>([]);
    const [quickStaff, setQuickStaff] = useState<Array<{ id: string; name: string; role?: string }>>([]);
    const [quickCatalogItems, setQuickCatalogItems] = useState<CatalogItem[]>([]);

    const fetchData = useCallback(async () => {
        if (!tenantId && !canAccessSuperAdmin) {
            setComandas([]);
            setFinancialHistoryByComandaId({});
            setLoadError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setLoadError(null);
        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug || DEFAULT_APP_SLUG, 'comandas', ['barber']);
            const client = getScopedClient('barber');
            const resolvedTenantId = canAccessSuperAdmin
                ? null
                : requireTenantContext({
                    tenantId,
                    appSlug: currentAppSlug,
                    schema,
                    table: 'comandas',
                    operation: 'load comandas',
                }).tenantId;

            let query = client.from('comandas').select('*').order('created_at', { ascending: false });
            if (resolvedTenantId) query = query.eq('tenant_id', resolvedTenantId);
            if (accessRole === 'barber' && user?.id) query = query.eq('staff_id', user.id);

            const startDate = parseDateInputValue(dateFrom);
            const endDate = parseDateInputValue(dateTo, true);

            if (startDate) {
                query = query.gte('created_at', startDate.toISOString());
            }
            if (endDate) {
                query = query.lte('created_at', endDate.toISOString());
            }
            if (!startDate && !endDate) {
                query = query.limit(200);
            }

            const { data, error } = await query;
            if (error) {
                logSupabaseError('[Comandas] Erro ao buscar comandas', error, { tenantId: resolvedTenantId });
                throw error;
            }

            if (!data || data.length === 0) {
                setComandas([]);
                return;
            }

            const comandasRows = data as Array<Comanda & { staff_id?: string | null }>;
            const comandaIds = comandasRows.map((c) => c.id);
            const appointmentIds = Array.from(new Set(
                comandasRows.map((c) => c.appointment_id).filter((id): id is string => Boolean(id)),
            ));
            const clientIds = Array.from(new Set(
                comandasRows.map((c) => c.client_id).filter((id): id is string => Boolean(id)),
            ));

            const { data: itemsData, error: itemsError } = await batchedIn<ComandaItemRow>(
                client, 'comanda_items', COMANDA_ITEMS_SELECT, 'comanda_id', comandaIds,
            );

            const itemRows = (itemsData || []) as ComandaItemRow[];
            if (itemsError) {
                logSupabaseError('[Comandas] Erro ao buscar itens das comandas', itemsError, {
                    select: COMANDA_ITEMS_SELECT,
                    comandaCount: comandaIds.length,
                });
            }

            const staffIds = Array.from(new Set([
                ...comandasRows.map((c) => c.staff_id ?? null),
                ...itemRows.map((i) => i.staff_id ?? null),
            ].filter((id): id is string => Boolean(id))));

            let clientsResult: { data: ClientLookup[] | null; error: unknown } = { data: null, error: null };
            let staffResult: { data: StaffLookup[] | null; error: unknown } = { data: null, error: null };
            let appointmentsResult: { data: AppointmentLookup[] | null; error: unknown } = { data: null, error: null };

            if (clientIds.length > 0) {
                try {
                    clientsResult = await batchedIn<ClientLookup>(client, 'clients', 'id, name, avatar, phone', 'id', clientIds);
                } catch (err) {
                    clientsResult = { data: null, error: err };
                }
            } else {
                clientsResult = { data: [], error: null };
            }

            if (staffIds.length > 0) {
                try {
                    staffResult = await batchedIn<StaffLookup>(client, 'staff', 'id, name', 'id', staffIds);
                } catch (err) {
                    staffResult = { data: null, error: err };
                }
            } else {
                staffResult = { data: [], error: null };
            }

            if (appointmentIds.length > 0) {
                try {
                    appointmentsResult = await batchedIn<AppointmentLookup>(client, 'appointments', 'id, start_time', 'id', appointmentIds);
                } catch (err) {
                    appointmentsResult = { data: null, error: err };
                }
            } else {
                appointmentsResult = { data: [], error: null };
            }

            if (clientsResult.error) {
                logSupabaseError('[Comandas] Erro ao buscar clientes das comandas', clientsResult.error, { clientCount: clientIds.length });
            }
            if (staffResult.error) {
                logSupabaseError('[Comandas] Erro ao buscar profissionais das comandas', staffResult.error, { staffCount: staffIds.length });
            }
            if (appointmentsResult.error) {
                logSupabaseError('[Comandas] Erro ao buscar agendamentos das comandas', appointmentsResult.error, { appointmentCount: appointmentIds.length });
            }

            const clientsById = ((clientsResult.error ? [] : clientsResult.data) || [] as ClientLookup[]).reduce((acc, c) => { acc[c.id] = c; return acc; }, {} as Record<string, ClientLookup>);
            const staffById = ((staffResult.error ? [] : staffResult.data) || [] as StaffLookup[]).reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, StaffLookup>);
            const appointmentsById = ((appointmentsResult.error ? [] : appointmentsResult.data) || [] as AppointmentLookup[]).reduce((acc, a) => { acc[a.id] = a; return acc; }, {} as Record<string, AppointmentLookup>);

            const itemsByComanda = itemRows.reduce((acc, item) => {
                if (!acc[item.comanda_id]) acc[item.comanda_id] = [];
                acc[item.comanda_id].push(item);
                return acc;
            }, {} as Record<string, ComandaItem[]>);

            const hydratedComandas = comandasRows.map((comanda) => {
                const mappedItems = itemsByComanda[comanda.id] || [];
                const mappedStaffIds = Array.from(new Set([
                    comanda.staff_id, ...mappedItems.map((i) => i.staff_id)
                ].filter((id): id is string => Boolean(id))));
                const mappedStaffNames = mappedStaffIds
                    .map((id) => staffById[id]?.name || NOT_INFORMED_FALLBACK)
                    .filter((name): name is string => Boolean(name));

                return {
                    ...comanda,
                    clients: {
                        name: clientsById[comanda.client_id]?.name || CLIENT_NAME_FALLBACK,
                        avatar: clientsById[comanda.client_id]?.avatar || '',
                        phone: clientsById[comanda.client_id]?.phone || null,
                    },
                    staff: { name: comanda.staff_id ? staffById[comanda.staff_id]?.name || NOT_INFORMED_FALLBACK : NOT_INFORMED_FALLBACK },
                    appointment: comanda.appointment_id ? { start_time: appointmentsById[comanda.appointment_id]?.start_time || null } : undefined,
                    comanda_items: mappedItems,
                    staff_ids: mappedStaffIds,
                    staff_names: mappedStaffNames,
                    chefClubInfo: undefined,
                };
            });

            if (clientIds.length > 0 && resolvedTenantId) {
                try {
                    const chefClubCreditsMap = await fetchChefClubCreditsByClients(clientIds, resolvedTenantId);
                    const enrichedComandas = hydratedComandas.map((c) => ({
                        ...c,
                        chefClubInfo: chefClubCreditsMap.get(c.client_id) || null,
                    }));
                    setComandas(enrichedComandas);
                    return;
                } catch (chefClubError) {
                    logSupabaseError('[Comandas] Erro ao buscar info do Clube', chefClubError, {
                        clientCount: clientIds.length,
                        tenantId: resolvedTenantId,
                    });
                }
            }

            setComandas(hydratedComandas);
        } catch (error) {
            logSupabaseError('[Comandas] Falha critica ao carregar pagina', error, {
                tenantId,
                appSlug,
                canAccessSuperAdmin,
            });
            const message = `Não foi possível carregar ${orderPluralLower}. Nenhuma ação financeira foi aplicada.`;
            setLoadError(message);
            setComandas([]);
            setToast({ message, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [appSlug, canAccessSuperAdmin, schema, tenantId, accessRole, user?.id, dateFrom, dateTo]);

    useEffect(() => { void fetchData(); }, [fetchData]);

    // Frente 1.G: Carrega catálogo de serviços/produtos, staff e clientes para abertura rápida
    const loadQuickOpenAuxiliaryData = useCallback(async () => {
        if (!tenantId) return;
        try {
            const data = await comandaQuickService.loadAuxiliaryData(tenantId);
            setQuickCatalogItems(data.catalogItems);
            setQuickClients(data.clients);
            setQuickStaff(data.staff);
        } catch (err) {
            console.warn('[Comandas] Erro ao carregar dados para abertura rápida:', err);
        }
    }, [tenantId]);

    // Frente 1.G: Atalho de teclado 'N' para Abertura Rápida (quando não estiver digitando em inputs)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'n' || e.key === 'N') {
                const target = e.target as HTMLElement;
                const isInputActive =
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.tagName === 'SELECT' ||
                    target.isContentEditable;

                if (!isInputActive && !isQuickOpenModalOpen && !selectedComandaId) {
                    e.preventDefault();
                    void loadQuickOpenAuxiliaryData();
                    setIsQuickOpenModalOpen(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isQuickOpenModalOpen, selectedComandaId, loadQuickOpenAuxiliaryData]);

    // Lazy load do histórico financeiro e reversals sob demanda (apenas quando uma comanda é aberta)
    useEffect(() => {
        const targetId = selectedComandaId || reopenComanda?.id;
        if (!targetId || financialHistoryByComandaId[targetId]) return;

        let isMounted = true;
        const loadHistory = async () => {
            const currentAppSlug = ensureAppSupportsModule(appSlug || DEFAULT_APP_SLUG, 'comandas', ['barber']);
            const resolvedTenantId = canAccessSuperAdmin
                ? null
                : requireTenantContext({
                    tenantId,
                    appSlug: currentAppSlug,
                    schema,
                    table: 'comandas',
                    operation: 'load financial history',
                }).tenantId;

            const history = await fetchSingleComandaFinancialHistory(targetId, resolvedTenantId);
            if (isMounted && history) {
                setFinancialHistoryByComandaId((prev) => ({
                    ...prev,
                    [targetId]: history,
                }));
            }
        };

        void loadHistory();
        return () => { isMounted = false; };
    }, [selectedComandaId, reopenComanda?.id, tenantId, canAccessSuperAdmin, appSlug, schema, financialHistoryByComandaId]);

    useEffect(() => {
        if (comandas.length === 0 || !tenantId) return;

        const blockedComandas = comandas.filter((c) => c.status === 'blocked' && c.appointment_id);
        if (blockedComandas.length === 0) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const commandsToUnblock: string[] = [];

        blockedComandas.forEach((comanda) => {
            if (comanda.appointment?.start_time) {
                const appointmentDate = new Date(comanda.appointment.start_time);
                appointmentDate.setHours(0, 0, 0, 0);
                if (appointmentDate <= today) {
                    commandsToUnblock.push(comanda.id);
                }
            }
        });

        if (commandsToUnblock.length === 0) return;

        const unblockComandas = async () => {
            try {
                const unblockClient = getScopedClient('barber');
                const { data, error } = await unblockClient.rpc('batch_unblock_comandas', {
                    p_tenant_id: tenantId,
                    p_comanda_ids: commandsToUnblock,
                });

                if (error) {
                    logSupabaseError('[Comandas] Erro ao desbloquear comandas', error, { comandaIds: commandsToUnblock });
                    return;
                }

                const result = (data || {}) as { success?: boolean; unblocked_count?: number };
                if (result.success !== true) {
                    logSupabaseError('[Comandas] batch_unblock_comandas retornou resultado invalido', new Error('unblocked_count ausente'), {
                        comandaIds: commandsToUnblock,
                        result,
                    });
                    return;
                }

                setComandas((prev) =>
                    prev.map((c) =>
                        commandsToUnblock.includes(c.id) ? { ...c, status: 'open' as const } : c
                    )
                );
            } catch (err) {
                logSupabaseError('[Comandas] Erro ao desbloquear comandas (catch)', err, { comandaIds: commandsToUnblock });
            }
        };

        unblockComandas();
    }, [comandas, tenantId]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const nextPrefs = { filterStatus, searchTerm, dateFrom, dateTo, quickRange, sortField, sortDirection, staffFilter, paymentMethodFilter, minTotal, maxTotal, consumptionType };
        window.localStorage.setItem(COMANDAS_PREFERENCES_KEY, JSON.stringify(nextPrefs));
    }, [filterStatus, searchTerm, dateFrom, dateTo, quickRange, sortField, sortDirection, staffFilter, paymentMethodFilter, minTotal, maxTotal, consumptionType]);

    const applyQuickRange = (range: QuickRange) => {
        if (range === 'all') {
            setQuickRange('all');
            setDateFrom('');
            setDateTo('');
            return;
        }
        if (range === 'custom') {
            setQuickRange('custom');
            return;
        }

        if (range === 'today' || range === 'yesterday' || range === 'this_week' || range === 'this_month') {
            const calculated = getQuickPeriodDateRange(range);
            setQuickRange(range);
            setDateFrom(calculated.startDate);
            setDateTo(calculated.endDate);
            return;
        }

        const today = new Date();
        const startDate = new Date(today);
        if (range === '7d') startDate.setDate(startDate.getDate() - 6);
        if (range === '30d') startDate.setDate(startDate.getDate() - 29);
        setQuickRange(range);
        setDateFrom(formatDateInputValue(startDate));
        setDateTo(formatDateInputValue(today));
    };

    useEffect(() => {
        if (preferences.dateFrom || preferences.dateTo) return;
        applyQuickRange(preferences.quickRange || 'today');
    }, []);

    const todayInputValue = formatDateInputValue(new Date());
    const hasCustomDateFilter = quickRange !== 'today' || dateFrom !== todayInputValue || dateTo !== todayInputValue;
    const activeFiltersCount = [
        filterStatus !== 'all',
        Boolean(searchTerm.trim()),
        hasCustomDateFilter,
        Boolean(staffFilter),
        Boolean(paymentMethodFilter),
        Boolean(minTotal),
        Boolean(maxTotal),
        consumptionType !== 'all',
    ].filter(Boolean).length;
    const hasAdvancedFilters = Boolean(staffFilter || paymentMethodFilter || minTotal || maxTotal || consumptionType !== 'all');
    const hasAnyFilter = activeFiltersCount > 0 || hasAdvancedFilters;

    const dateFilteredComandas = React.useMemo(() => comandas.filter((c) => {
        const createdAt = new Date(c.created_at);
        if (Number.isNaN(createdAt.getTime())) return false;
        const startDate = parseDateInputValue(dateFrom);
        const endDate = parseDateInputValue(dateTo, true);
        if (startDate && createdAt < startDate) return false;
        if (endDate && createdAt > endDate) return false;
        return true;
    }), [comandas, dateFrom, dateTo]);

    const normalizedSearchTerm = debouncedSearchTerm.trim().toLowerCase();
    const statusScopeComandas = React.useMemo(() => dateFilteredComandas.filter((c) => {
        const matchesSearch = !normalizedSearchTerm
            || c.clients.name.toLowerCase().includes(normalizedSearchTerm)
            || (c.clients.phone || '').toLowerCase().includes(normalizedSearchTerm)
            || c.id.toLowerCase().includes(normalizedSearchTerm)
            || String(getDisplayId(c.id)).includes(normalizedSearchTerm)
            || c.staff_names.some((name) => name.toLowerCase().includes(normalizedSearchTerm));
        const matchesStaff = !staffFilter || c.staff_ids.includes(staffFilter);
        const matchesPaymentMethod = !paymentMethodFilter || (c.payment_method || NOT_INFORMED_FALLBACK) === paymentMethodFilter;
        const matchesMin = !minTotal || c.total >= Number(minTotal);
        const matchesMax = !maxTotal || c.total <= Number(maxTotal);
        const matchesConsumption = consumptionType === 'all' || getConsumptionTypeForFilter(c) === consumptionType;
        return matchesSearch && matchesStaff && matchesPaymentMethod && matchesMin && matchesMax && matchesConsumption;
    }), [dateFilteredComandas, normalizedSearchTerm, staffFilter, paymentMethodFilter, minTotal, maxTotal, consumptionType]);

    const filteredComandas = React.useMemo(() => statusScopeComandas.filter((c) => {
        return filterStatus === 'all' || c.status === filterStatus;
    }), [statusScopeComandas, filterStatus]);

    const sortedComandas = React.useMemo(() => [...filteredComandas].sort((first, second) => {
        let comparison = 0;
        if (sortField === 'date') comparison = new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
        if (sortField === 'client') comparison = (first.clients?.name || '').localeCompare(second.clients?.name || '', 'pt-BR', { sensitivity: 'base' });
        if (sortField === 'status') comparison = getStatusSortValue(first.status) - getStatusSortValue(second.status);
        if (sortField === 'total') comparison = first.total - second.total;
        if (comparison === 0) comparison = new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
        return sortDirection === 'asc' ? comparison : comparison * -1;
    }), [filteredComandas, sortField, sortDirection]);

    const [pageSize, setPageSize] = useState<number>(50);
    const [currentPage, setCurrentPage] = useState<number>(1);

    const totalPages = Math.max(1, Math.ceil(sortedComandas.length / pageSize));

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(1);
        }
    }, [totalPages, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterStatus, searchTerm, dateFrom, dateTo, staffFilter, paymentMethodFilter, minTotal, maxTotal, consumptionType]);

    const paginatedComandas = React.useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return sortedComandas.slice(startIndex, startIndex + pageSize);
    }, [sortedComandas, currentPage, pageSize]);

    useEffect(() => {
        if (!selectedComandaId) {
            return;
        }

        if (!sortedComandas.some((c) => c.id === selectedComandaId)) {
            setSelectedComandaId(null);
        }
    }, [selectedComandaId, sortedComandas]);

    useEffect(() => {
        setSelectedOpenComandaIds((current) => current.filter((id) => comandas.some((c) => c.id === id && c.status === 'open')));
    }, [comandas]);

    const selectedComanda = React.useMemo(() => sortedComandas.find((c) => c.id === selectedComandaId) || null, [sortedComandas, selectedComandaId]);
    const openComandasInView = React.useMemo(() => paginatedComandas.filter((c) => c.status === 'open'), [paginatedComandas]);
    const allOpenInViewSelected = React.useMemo(() => openComandasInView.length > 0 && openComandasInView.every((c) => selectedOpenComandaIds.includes(c.id)), [openComandasInView, selectedOpenComandaIds]);

    const tabs = React.useMemo(() => [
        { key: 'all' as const, label: statusLabels.all, count: statusScopeComandas.length },
        { key: 'blocked' as const, label: statusLabels.blocked, count: statusScopeComandas.filter((c) => c.status === 'blocked').length },
        { key: 'open' as const, label: statusLabels.open, count: statusScopeComandas.filter((c) => c.status === 'open').length },
        { key: 'paid' as const, label: statusLabels.paid, count: statusScopeComandas.filter((c) => c.status === 'paid').length },
        { key: 'cancelled' as const, label: statusLabels.cancelled, count: statusScopeComandas.filter((c) => c.status === 'cancelled').length },
    ], [statusScopeComandas, statusLabels]);

    const toggleOpenComandaSelection = (comandaId: string) => {
        setSelectedOpenComandaIds((current) =>
            current.includes(comandaId) ? current.filter((id) => id !== comandaId) : [...current, comandaId],
        );
    };

    const toggleSelectAllOpenInView = () => {
        if (allOpenInViewSelected) {
            setSelectedOpenComandaIds((current) => current.filter((id) => !openComandasInView.some((c) => c.id === id)));
            return;
        }
        setSelectedOpenComandaIds((current) => Array.from(new Set([...current, ...openComandasInView.map((c) => c.id)])));
    };

    const kpiSummary = React.useMemo(() => {
        return calculateComandaKpiSummary(filteredComandas);
    }, [filteredComandas]);

    const openCount = kpiSummary.openCount;
    const paidCount = kpiSummary.paidCount;
    const totalOpen = kpiSummary.openTotal;
    const totalPaid = kpiSummary.paidTotal;
    const avgTicket = kpiSummary.averageTicket;

    const finalizedToday = React.useMemo(() => comandas.filter((c) => {
        if (c.status !== 'paid') return false;
        const createdAt = new Date(c.created_at);
        const today = new Date();
        return createdAt.getDate() === today.getDate() && createdAt.getMonth() === today.getMonth() && createdAt.getFullYear() === today.getFullYear();
    }).length, [comandas]);

    const staffOptions = React.useMemo(() => Array.from(new Map<string, { id: string; name: string }>(
        comandas.flatMap((c) => c.staff_ids.map((staffId, index) => ({ id: staffId, name: c.staff_names[index] || 'Profissional' })))
            .map((s) => [s.id, s] as [string, { id: string; name: string }])
            .values(),
    ).values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })), [comandas]);

    const paymentMethodOptions = React.useMemo(() => Array.from(new Set<string>(
        comandas
            .map((c) => c.payment_method || '')
            .filter((method): method is string => Boolean(method.trim())),
    )).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })), [comandas]);

    const dateFilterDescription = !dateFrom && !dateTo
        ? 'Período completo'
        : dateFrom && dateTo
        ? `${formatDateLabel(`${dateFrom}T00:00:00`)} ate ${formatDateLabel(`${dateTo}T00:00:00`)}`
        : dateFrom ? `A partir de ${formatDateLabel(`${dateFrom}T00:00:00`)}` : `Ate ${formatDateLabel(`${dateTo}T00:00:00`)}`;

    const clearAllFilters = () => {
        setFilterStatus('all');
        setSearchTerm('');
        setStaffFilter('');
        setPaymentMethodFilter('');
        setMinTotal('');
        setMaxTotal('');
        setConsumptionType('all');
        setSortField('date');
        setSortDirection('desc');
        applyQuickRange('today');
    };

    const escapeCSV = (value: string | number | null | undefined) => {
        const normalized = value == null ? '' : String(value);
        return `"${normalized.replace(/"/g, '""')}"`;
    };

    const formatExportMoney = (value: number) => Number(value || 0).toFixed(2).replace('.', ',');

    const getParticipantStaffId = (participant: ServiceExecutionParticipantRow) => participant.staff_id || participant.professional_id || '';

    const normalizeParticipantPercentage = (value: number | null | undefined) => {
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric)) return 0;
        return numeric > 1 ? numeric / 100 : numeric;
    };

    const formatParticipantPayout = (participant: ServiceExecutionParticipantRow, name: string) => {
        if (participant.payout_type === 'fixed') {
            return `${name} R$ ${formatExportMoney(Number(participant.payout_value || 0))}`;
        }
        const percent = normalizeParticipantPercentage(participant.payout_value) * 100;
        return `${name} ${percent.toFixed(2).replace('.', ',').replace(/,00$/, '')}%`;
    };

    const generateCSV = async () => {
        if (sortedComandas.length === 0) {
            setToast({ message: `Não há ${orderPluralLower} filtrados para exportar.`, type: 'info' });
            return;
        }
        if (!tenantId) {
            setToast({ message: `Tenant inválido para exportar ${orderPluralLower}.`, type: 'error' });
            return;
        }

        const currentAppSlug = ensureAppSupportsModule(appSlug || DEFAULT_APP_SLUG, 'comandas', ['barber']);
        const client = getScopedClient('barber');
        const resolvedTenantId = requireTenantContext({
            tenantId,
            appSlug: currentAppSlug,
            schema,
            table: 'comandas',
            operation: 'export comandas',
        }).tenantId;
        const itemIds = sortedComandas.flatMap((comanda) => comanda.comanda_items.map((item) => item.id));
        const { data: participants, error: participantsError } = itemIds.length > 0
            ? await client
                .from('service_execution_participants')
                .select('*')
                .eq('tenant_id', resolvedTenantId)
                .in('comanda_item_id', itemIds)
            : { data: [] as ServiceExecutionParticipantRow[], error: null };

        if (participantsError) {
            logSupabaseError('[Comandas] Erro ao carregar compartilhamentos para exportação', participantsError);
            setToast({ message: 'Não foi possível carregar compartilhamentos para exportar.', type: 'error' });
            return;
        }

        const participantRows = (participants || []) as ServiceExecutionParticipantRow[];
        const participantStaffIds = participantRows.map(getParticipantStaffId).filter((id): id is string => Boolean(id));
        const { data: participantStaffRows } = participantStaffIds.length > 0
            ? await client.from('staff').select('id, name').eq('tenant_id', resolvedTenantId).in('id', Array.from(new Set(participantStaffIds)))
            : { data: [] as StaffLookup[] };
        const staffById = ((participantStaffRows || []) as StaffLookup[]).reduce((acc, staff) => {
            acc[staff.id] = staff.name;
            return acc;
        }, {} as Record<string, string>);
        const participantsByItem = participantRows.reduce((acc, participant) => {
            if (!acc[participant.comanda_item_id]) acc[participant.comanda_item_id] = [];
            acc[participant.comanda_item_id].push(participant);
            return acc;
        }, {} as Record<string, ServiceExecutionParticipantRow[]>);

        const headers = [
            `ID do ${orderLabelLower}`,
            'Data de abertura',
            'Data de fechamento',
            'Cliente',
            'Telefone',
            `Status do ${orderLabelLower}`,
            'Profissional principal',
            servicePluralLabel,
            'Produtos',
            `Subtotal ${servicePluralLower}`,
            'Subtotal produtos',
            'Desconto',
            isEsteticaApp ? 'Créditos utilizados' : 'Créditos Club dos Chefes utilizados',
            'Valor total',
            'Valor pago',
            'Saldo pendente',
            'Forma de pagamento',
            'Status de pagamento',
            `${labels.service} compartilhado`,
            `Valor do ${labels.service.toLowerCase()}`,
            'Valor compartilhado',
            'Profissionais participantes',
            'Divisão lançada',
            'Base por participante',
            'Observações',
            'Usuário responsável',
        ];
        const rows = sortedComandas.map((c) => {
            const services = c.comanda_items.filter((item) => Boolean(item.service_id));
            const products = c.comanda_items.filter((item) => Boolean(item.product_id) || !item.service_id);
            const serviceSubtotal = services.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0);
            const productSubtotal = products.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0);
            const sharedService = services.some((item) => isSharedServiceItem(item, (participantsByItem[item.id] || []) as unknown as DomainParticipantRow[]));
            const serviceValue = services.reduce((sum, item) => sum + Number(item.unit_price || 0), 0);
            const sharedDetails = sharedService
                ? services.flatMap((item) => (participantsByItem[item.id] || []).map((participant) => {
                    const staffId = getParticipantStaffId(participant);
                    const name = staffId ? (staffById[staffId] || staffId) : 'Profissional';
                    const participantBase = calculateParticipantBaseValue(Number(item.unit_price || 0), participant as unknown as DomainParticipantRow);
                    return { participant, name, participantBase };
                }))
                : [];
            const participantNames = Array.from(new Set(sharedDetails.map((detail) => detail.name).filter(Boolean)));
            const divisionLaunched = sharedDetails
                .map((detail) => formatParticipantPayout(detail.participant, detail.name))
                .join(' / ');
            const baseByParticipant = sharedDetails
                .map((detail) => `${detail.name} R$ ${formatExportMoney(detail.participantBase)}`)
                .join(' / ');
            const sharedValue = sharedDetails.reduce((sum, detail) => sum + detail.participantBase, 0);
            const paidValue = c.status === 'paid' ? Number(c.total || 0) : 0;
            const pendingValue = c.status === 'paid' || c.status === 'cancelled' ? 0 : Number(c.total || 0);
            const observations = [c.closure_note].filter(Boolean).join(' | ');
            return [
                escapeCSV(getShortComandaRef(c.id)),
                escapeCSV(new Date(c.created_at).toLocaleString('pt-BR')),
                escapeCSV(c.closed_at ? new Date(c.closed_at).toLocaleString('pt-BR') : ''),
                escapeCSV(c.clients.name),
                escapeCSV(c.clients.phone || ''),
                escapeCSV(statusLabels[c.status]),
                escapeCSV(c.staff?.name || c.staff_names[0] || 'Sem profissional'),
                escapeCSV(services.map((item) => `${item.product_name} x${item.quantity}`).join(' | ')),
                escapeCSV(products.map((item) => `${item.product_name} x${item.quantity}`).join(' | ')),
                formatExportMoney(serviceSubtotal),
                formatExportMoney(productSubtotal),
                formatExportMoney(Number(c.discount || 0)),
                formatExportMoney(0),
                formatExportMoney(Number(c.total || 0)),
                formatExportMoney(paidValue),
                formatExportMoney(pendingValue),
                escapeCSV(c.payment_method || 'Não informado'),
                escapeCSV(getPaymentStatusLabel(c.status)),
                escapeCSV(sharedService ? 'Sim' : 'Não'),
                formatExportMoney(serviceValue),
                sharedService ? formatExportMoney(sharedValue) : '-',
                escapeCSV(sharedService ? participantNames.join(' / ') : ''),
                escapeCSV(sharedService ? divisionLaunched || '-' : '-'),
                escapeCSV(sharedService ? baseByParticipant || '-' : '-'),
                escapeCSV(observations || '-'),
                escapeCSV('Não registrado'),
            ];
        });
        const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(';'), ...rows.map((r) => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${orderPluralLower.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setToast({ message: `${sortedComandas.length} ${orderPluralLower} exportado(s) da lista filtrada.`, type: 'success' });
    };

    const copyToClipboard = async () => {
        if (sortedComandas.length === 0) {
            setToast({ message: `Não há ${orderPluralLower} filtrados para copiar.`, type: 'info' });
            return;
        }
        const headers = ['Codigo', 'Cliente', 'Consumo', 'Total', 'Status', 'Abertura'];
        const rows = sortedComandas.map((c) => [getShortComandaRef(c.id), c.clients.name, getConsumptionSummary(c).title, c.total.toFixed(2).replace('.', ','), statusLabels[c.status], new Date(c.created_at).toLocaleString('pt-BR')]);
        try {
            await navigator.clipboard.writeText([headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n'));
            setToast({ message: `${sortedComandas.length} ${orderPluralLower} copiado(s) da lista filtrada.`, type: 'success' });
        } catch {
            setToast({ message: 'Não foi possível copiar a lista filtrada.', type: 'error' });
        }
    };

    const handlePrint = (comanda: Comanda) => {
        const printWindow = window.open('', '_blank', 'width=420,height=640');
        if (!printWindow) return;
        printWindow.opener = null;
        const itemsHtml = comanda.comanda_items.map((item) => `<li>${escapeHtml(item.product_name)} x${item.quantity} - ${formatCurrency(item.unit_price * item.quantity)}</li>`).join('');
        printWindow.document.write(`
            <html><head><title>${escapeHtml(orderLabel)} #${escapeHtml(getDisplayId(comanda.id))}</title><style>body{font-family:Segoe UI,sans-serif;padding:24px;color:#191611}h1{font-size:20px;margin-bottom:16px}.line{margin:8px 0;font-size:13px}ul{padding-left:18px;margin:16px 0}li{margin-bottom:6px;font-size:13px}.total{margin-top:18px;font-size:22px;font-weight:700}</style></head>
            <body><h1>${escapeHtml(orderLabel)} #${escapeHtml(getDisplayId(comanda.id))}</h1><div class="line"><strong>Cliente:</strong> ${escapeHtml(comanda.clients.name)}</div><div class="line"><strong>Status:</strong> ${escapeHtml(statusLabels[comanda.status])}</div><div class="line"><strong>Abertura:</strong> ${escapeHtml(new Date(comanda.created_at).toLocaleString('pt-BR'))}</div><div class="line"><strong>Profissionais:</strong> ${escapeHtml(comanda.staff_names.join(' / ') || 'Sem profissional')}</div><ul>${itemsHtml}</ul><div class="total">Total: ${escapeHtml(formatCurrency(comanda.total))}</div></body></html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    const handleDelete = async (comanda: Comanda) => {
        if (!tenantId && !canAccessSuperAdmin) return;

        if (comanda.status === 'paid') {
            setToast({
                message: `${orderLabel} já ${isEsteticaApp ? 'finalizado' : 'pago'} não pode ser anulado diretamente. Utilize o fluxo de Estorno e Reabertura.`,
                type: 'error',
            });
            return;
        }

        const reason = cancelReason === CANCEL_REASON_OTHER ? cancelReasonOther.trim() : cancelReason.trim();
        if (!reason) {
            setToast({ message: 'Informe o motivo do cancelamento.', type: 'error' });
            return;
        }

        const isHiddenFinancial = ['operational_error', 'test', 'duplicate'].includes(cancelReason);

        setDeleting(true);
        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug || DEFAULT_APP_SLUG, 'comandas', ['barber']);
            const client = getScopedClient('barber');
            const resolvedTenantId = canAccessSuperAdmin
                ? null
                : requireTenantContext({ tenantId, appSlug: currentAppSlug, schema, table: 'comandas', operation: 'cancel comanda' }).tenantId;

            const updatePayload: Record<string, unknown> = {
                status: 'cancelled',
                cancellation_type: cancelReason,
                cancelled_at: new Date().toISOString(),
                cancelled_by_user_id: user?.id || null,
                closure_note: reason,
                hidden_from_financial: isHiddenFinancial,
            };

            let cancelQuery = client.from('comandas').update(updatePayload).eq('id', comanda.id);
            if (resolvedTenantId) cancelQuery = cancelQuery.eq('tenant_id', resolvedTenantId);
            let { error } = await cancelQuery;

            if (error) {
                if (`${error.message}`.toLowerCase().includes('cancellation_type')) {
                    delete updatePayload.cancellation_type;
                    delete updatePayload.cancelled_at;
                    delete updatePayload.cancelled_by_user_id;
                    delete updatePayload.hidden_from_financial;
                    let fallbackQuery = client.from('comandas').update(updatePayload).eq('id', comanda.id);
                    if (resolvedTenantId) fallbackQuery = fallbackQuery.eq('tenant_id', resolvedTenantId);
                    const fallbackResult = await fallbackQuery;
                    error = fallbackResult.error;
                    if (!error) setToast({ message: 'Cancelada, mas campos de auditoria não foram salvos.', type: 'info' });
                }
                if (error) throw error;
            }

            setToast({ message: `${orderLabel} anulado com sucesso.`, type: 'success' });
            setDeleteComanda(null);
            setCancelReason('');
            setCancelReasonOther('');
            await fetchData();
        } catch (error: any) {
            logSupabaseError('[Comandas] Erro ao anular comanda', error, { comandaId: comanda?.id });
            setToast({ message: `Não foi possível anular o ${orderLabelLower}. Nenhuma baixa ou transaction foi criada. ${error.message || ''}`.trim(), type: 'error' });
        } finally {
            setDeleting(false);
        }
    };

    const openReopenPaidModal = async (comanda: Comanda) => {
        if (!canManageFinancialReversal) {
            setToast({ message: `Apenas gestores podem estornar e reabrir um ${orderLabelLower} finalizado.`, type: 'error' });
            return;
        }
        let history = financialHistoryByComandaId[comanda.id];
        if (!history) {
            const currentAppSlug = ensureAppSupportsModule(appSlug || DEFAULT_APP_SLUG, 'comandas', ['barber']);
            const resolvedTenantId = canAccessSuperAdmin
                ? null
                : requireTenantContext({
                    tenantId,
                    appSlug: currentAppSlug,
                    schema,
                    table: 'comandas',
                    operation: 'load financial history for reopen',
                }).tenantId;
            history = (await fetchSingleComandaFinancialHistory(comanda.id, resolvedTenantId)) || undefined;
            if (history) {
                setFinancialHistoryByComandaId((prev) => ({ ...prev, [comanda.id]: history! }));
            }
        }
        if (!history || !history.transactionId || history.reversibleAmount <= 0 || history.reversalStatus !== 'none') {
            setToast({
                message: `Este ${orderLabelLower} não possui lançamento financeiro integral disponível para estorno automático.`,
                type: 'error',
            });
            return;
        }
        setReopenComanda(comanda);
        setReopenReasonType('baixa_indevida');
        setReopenReasonNote('');
        setReopenConfirmed(false);
        setReopenIdempotencyKey(createReversalKey(history.transactionId));
    };

    const closeReopenPaidModal = () => {
        if (reopening) return;
        setReopenComanda(null);
        setReopenReasonType('baixa_indevida');
        setReopenReasonNote('');
        setReopenConfirmed(false);
        setReopenIdempotencyKey(null);
    };

    const handleConfirmReopenPaidComanda = async (openCheckoutAfter: boolean) => {
        if (!reopenComanda) return;
        if (!canManageFinancialReversal) {
            setToast({ message: `Apenas gestores podem estornar e reabrir ${orderPluralLower} finalizados.`, type: 'error' });
            return;
        }

        const history = financialHistoryByComandaId[reopenComanda.id];
        if (!history || !history.transactionId || history.reversibleAmount <= 0 || history.reversalStatus !== 'none') {
            setToast({
                message: 'Transação financeira original não encontrada ou sem saldo integral para estorno.',
                type: 'error',
            });
            return;
        }

        if (!reopenReasonType || !reopenReasonNote.trim()) {
            setToast({ message: 'Informe o motivo e a observação obrigatória para auditoria do estorno.', type: 'error' });
            return;
        }

        if (!reopenConfirmed) {
            setToast({ message: 'Confirme a ciência do estorno financeiro auditado antes de continuar.', type: 'error' });
            return;
        }

        setReopening(true);
        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug || DEFAULT_APP_SLUG, 'comandas', ['barber']);
            const effectiveTenantId = canAccessSuperAdmin
                ? (tenantId || reopenComanda.tenant_id || null)
                : requireTenantContext({
                    tenantId,
                    appSlug: currentAppSlug,
                    schema,
                    table: 'comandas',
                    operation: 'reverse and reopen comanda',
                }).tenantId;

            if (!effectiveTenantId) {
                setToast({ message: 'Contexto de tenant inválido para estorno financeiro.', type: 'error' });
                return;
            }

            const targetComandaId = reopenComanda.id;
            await reverseFinancialTransaction({
                tenantId: effectiveTenantId,
                originalTransactionId: history.transactionId,
                supabase,
                reversalType: 'wrong_settlement',
                amount: history.reversibleAmount,
                reasonType: reopenReasonType,
                reasonNote: reopenReasonNote.trim(),
                refundMethod: null,
                reversalDate: new Date().toISOString(),
                idempotencyKey: reopenIdempotencyKey || createReversalKey(history.transactionId),
            });

            setReopenComanda(null);
            setReopenReasonType('baixa_indevida');
            setReopenReasonNote('');
            setReopenConfirmed(false);
            setReopenIdempotencyKey(null);

            if (openCheckoutAfter) {
                setToast({
                    message: `Baixa estornada com sucesso. Redirecionando para o checkout do ${orderLabelLower}...`,
                    type: 'success',
                });
                navigate(`/checkout/${targetComandaId}`);
                return;
            }

            setToast({
                message: `Baixa estornada e ${orderLabelLower} reaberto para edição.`,
                type: 'success',
            });
            await fetchData();
        } catch (error: any) {
            logSupabaseError('[Comandas] Erro ao estornar e reabrir comanda paga', error, {
                comandaId: reopenComanda.id,
                transactionId: history.transactionId,
            });
            setToast({
                message: error?.message || `Não foi possível estornar a baixa do ${orderLabelLower}. Nenhuma alteração foi aplicada.`,
                type: 'error',
            });
        } finally {
            setReopening(false);
        }
    };

    const handleBulkClose = async () => {
        if (selectedOpenComandaIds.length === 0) {
            setToast({ message: `Selecione pelo menos um ${orderLabelLower} aberto.`, type: 'info' });
            return;
        }
        if (bulkCloseType === 'admin' && !bulkLegacyReferenceMonth) {
            setToast({ message: 'Informe o mês de referência.', type: 'info' });
            return;
        }
        setBulkClosing(true);
        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug || DEFAULT_APP_SLUG, 'comandas', ['barber']);
            const resolvedTenantId = canAccessSuperAdmin
                ? null
                : requireTenantContext({ tenantId, appSlug: currentAppSlug, schema, table: 'comandas', operation: 'bulk close' }).tenantId;

            let data, error;
            if (bulkCloseType === 'normal') {
                ({ data, error } = await supabase.rpc('bulk_close_comandas_with_credits', {
                    p_comanda_ids: selectedOpenComandaIds,
                    p_tenant_id: resolvedTenantId,
                    p_closure_note: bulkClosureNote.trim() || null,
                    p_payment_method: 'Dinheiro',
                    p_apply_credits: true,
                }));
            } else {
                ({ data, error } = await supabase.rpc('bulk_close_comandas_admin', {
                    p_comanda_ids: selectedOpenComandaIds,
                    p_tenant_id: resolvedTenantId,
                    p_closure_note: bulkClosureNote.trim() || null,
                    p_legacy_reference_month: `${bulkLegacyReferenceMonth}-01`,
                }));
            }

            if (error) throw error;
            const updatedCount = Number((data as { updated_count?: number } | null)?.updated_count || selectedOpenComandaIds.length);
            setToast({
                message: bulkCloseType === 'normal'
                    ? `${updatedCount} ${orderPluralLower} finalizado(s) com impacto financeiro`
                    : `${updatedCount} ${orderPluralLower} finalizado(s) em modo administrativo`,
                type: 'success',
            });
            setSelectedOpenComandaIds([]);
            setBulkCloseModalOpen(false);
            setBulkClosureNote('');
            setBulkLegacyReferenceMonth(getDefaultLegacyReferenceMonth());
            await fetchData();
        } catch (error: any) {
            logSupabaseError('[Comandas] Erro ao fechar comandas em massa', error, {
                comandaCount: selectedOpenComandaIds.length,
                bulkCloseType,
            });
            setToast({ message: `Não foi possível concluir a baixa em massa. Nenhuma baixa local falsa foi criada. ${error.message || ''}`.trim(), type: 'error' });
        } finally {
            setBulkClosing(false);
        }
    };

    // Frente 1.G: Submissão da Abertura Rápida de Comanda
    const handleQuickOpenSubmit = async (payload: QuickOpenComandaPayload) => {
        if (!tenantId) {
            setToast({ message: 'Tenant inválido para abrir comanda.', type: 'error' });
            return;
        }

        try {
            const createdComandaId = await comandaQuickService.createQuickComanda(tenantId, payload);
            setToast({ message: `${orderLabel} aberta com sucesso!`, type: 'success' });
            await fetchData();
            setSelectedComandaId(createdComandaId);
        } catch (err: any) {
            console.error('[Comandas] Erro ao abrir comanda rápida:', err);
            setToast({ message: err?.message || 'Erro ao abrir comanda rápida.', type: 'error' });
            throw err;
        }
    };

    return (
        <div className="space-y-4 pb-20 animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <section className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-cream via-card to-gold-pale p-5 text-ink shadow-smg-shell">
                <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-primary/10 blur-3xl" />
                <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="max-w-2xl">
                        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-gold-soft px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary-dark">
                            <span className="material-symbols-outlined text-[14px]">content_cut</span>
                            {isEsteticaApp ? 'Atendimentos da clínica' : 'Balcão de atendimento'}
                        </span>
                        <h1 className="mt-3 text-2xl font-black tracking-tight text-ink sm:text-3xl">{isEsteticaApp ? orderPluralLabel : 'Comandas do balcão'}</h1>
                        <p className="mt-2 text-sm leading-6 text-ink-soft">
                            <span className="tabular-nums font-semibold">{sortedComandas.length}</span> {orderPluralLower} no recorte atual, com foco em cliente, profissional, {isEsteticaApp ? 'procedimentos, produtos e finalização real' : 'consumo e baixa real'}. {dateFilterDescription}.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    void loadQuickOpenAuxiliaryData();
                                    setIsQuickOpenModalOpen(true);
                                }}
                                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-sm font-black text-night shadow-smg-glow transition hover:brightness-105 active:scale-[0.98] touch-manipulation"
                                title="Abertura rápida com atalho [N]"
                            >
                                <span className="material-symbols-outlined text-[18px]">bolt</span>
                                <span>Abertura Rápida</span>
                                <span className="rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-mono">N</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/checkout?mode=comanda')}
                                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-card/80 px-4 py-2 text-sm font-bold text-ink transition hover:bg-gold-pale active:scale-[0.98] touch-manipulation"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                {isEsteticaApp ? 'Novo atendimento' : 'Nova comanda'}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/checkout?mode=pdv')}
                                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-card/80 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gold-pale active:scale-[0.98] touch-manipulation"
                            >
                                <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                                {isEsteticaApp ? 'Finalizar atendimento' : 'Abrir PDV'}
                            </button>
                        </div>
                    </div>

                    {/* Bloco 2x2 de métricas integrado ao Hero */}
                    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-card/85 shadow-sm divide-x divide-y divide-line sm:min-w-[400px] lg:min-w-[440px]">
                        <div className="p-3.5 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-dark">
                                    {isEsteticaApp ? 'Abertos' : 'Abertas'}
                                </span>
                                <span className="material-symbols-outlined text-base text-primary">schedule</span>
                            </div>
                            <p className="text-2xl font-black tabular-nums tracking-[-0.02em] text-ink">
                                {loading ? '...' : String(openCount).padStart(2, '0')}
                            </p>
                            <p className="text-[11px] tabular-nums text-ink-soft">
                                Pendente: {formatCurrency(totalOpen)}
                            </p>
                        </div>
                        <div className="p-3.5 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-success">
                                    Liquidadas
                                </span>
                                <span className="material-symbols-outlined text-base text-success">task_alt</span>
                            </div>
                            <p className="text-2xl font-black tabular-nums tracking-[-0.02em] text-ink">
                                {loading ? '...' : String(paidCount).padStart(2, '0')}
                            </p>
                            <p className="text-[11px] tabular-nums text-ink-soft">
                                Total: {formatCurrency(totalPaid)}
                            </p>
                        </div>
                        <div className="p-3.5 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-dark">
                                    Total Geral
                                </span>
                                <span className="material-symbols-outlined text-base text-primary-dark">payments</span>
                            </div>
                            <p className="text-xl font-black tabular-nums tracking-[-0.02em] whitespace-nowrap text-ink">
                                {loading ? '...' : formatCurrency(totalOpen + totalPaid)}
                            </p>
                            <p className="text-[11px] tabular-nums text-ink-soft">
                                {kpiSummary.totalCount} {orderPluralLower}
                            </p>
                        </div>
                        <div className="p-3.5 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-ink-soft">
                                    Ticket Médio
                                </span>
                                <span className="material-symbols-outlined text-base text-ink-soft">monitoring</span>
                            </div>
                            <p className="text-xl font-black tabular-nums tracking-[-0.02em] whitespace-nowrap text-ink">
                                {loading ? '...' : formatCurrency(avgTicket)}
                            </p>
                            <p className="text-[11px] tabular-nums text-ink-soft">
                                Por atendimento
                            </p>
                        </div>
                    </div>
                </div>
                <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        <AuditAdjustmentButton
                            context={{
                                sourceType: 'comanda',
                                sourceLabel: isEsteticaApp ? orderPluralLabel : 'Comandas do balcão',
                                beforeSnapshot: {
                                    total_filtrado: sortedComandas.length,
                                    abertas: openCount,
                                    total_aberto: totalOpen,
                                    periodo: dateFilterDescription,
                                },
                                financialImpactLabel: isEsteticaApp
                                    ? 'Possível impacto em baixa, repasses e contas a receber'
                                    : 'Possível impacto em baixa, comissão e contas a receber',
                                allowedAdjustmentTypes: [
                                    'service_participation_correction',
                                    'settlement_reversal',
                                    'payment_date_correction',
                                    'payment_method_correction',
                                    'hide_from_financial_with_reason',
                                    'mark_for_review',
                                ],
                            }}
                            defaultAdjustmentType="mark_for_review"
                        />
                        <Button size="sm" variant="secondary" onClick={generateCSV} leftIcon="download" disabled={loading}>
                            CSV
                        </Button>
                        <Button size="sm" variant="secondary" onClick={copyToClipboard} leftIcon="content_copy" disabled={loading}>
                            Copiar
                        </Button>
                </div>
            </section>

            {loadError && (
                <section className="flex flex-col gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-lg text-danger">error</span>
                        <div>
                            <p className="text-sm font-black text-danger">Falha ao carregar {orderPluralLower}</p>
                            <p className="text-xs text-danger/80">{loadError}</p>
                        </div>
                    </div>
                    <Button variant="secondary" leftIcon="sync" onClick={fetchData} disabled={loading}>
                        Tentar novamente
                    </Button>
                </section>
            )}

            <section className="rounded-2xl border border-line bg-card shadow-sm">
                <div className="flex flex-col gap-3 p-3 sm:p-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setFilterStatus(tab.key)}
                                title={tab.key === 'all' ? `Todos os ${orderPluralLower} filtrados` : getStatusContextLabel(tab.key, isEsteticaApp)}
                                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition active:scale-[0.98] touch-manipulation ${
                                    filterStatus === tab.key
                                        ? 'border-primary/60 bg-gold-soft text-primary-dark'
                                        : 'border-line text-ink-soft hover:border-primary/40 hover:text-ink'
                                }`}
                            >
                                {tab.label}
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums font-bold ${filterStatus === tab.key ? 'bg-primary text-night' : 'bg-gold-pale text-ink-soft'}`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/70 text-sm">search</span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={`Buscar cliente, telefone, profissional ou #${orderLabelLower}...`}
                                className="w-full rounded-xl border border-line bg-card py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-soft/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setFiltersModalOpen((open) => !open)}
                            className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold transition active:scale-[0.98] touch-manipulation ${
                                activeFiltersCount > 0
                                    ? 'border-primary/60 bg-gold-soft text-primary-dark'
                                    : 'border-line bg-card text-ink-soft hover:border-primary/40 hover:text-ink'
                            }`}
                        >
                            <span className="material-symbols-outlined text-sm">tune</span>
                            Filtros
                            {activeFiltersCount > 0 && (
                                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black leading-none text-night tabular-nums">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </button>
                        <select
                            value={quickRange}
                            onChange={(e) => applyQuickRange(e.target.value as QuickRange)}
                            className="rounded-xl border border-line bg-card px-2 py-2 text-xs text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                            title="Filtrar por período"
                        >
                            <option value="today">Hoje</option>
                            <option value="yesterday">Ontem</option>
                            <option value="this_week">Esta Semana</option>
                            <option value="this_month">Este Mês</option>
                            <option value="7d">Últimos 7 dias</option>
                            <option value="30d">Últimos 30 dias</option>
                            <option value="all">Todo o período</option>
                        </select>
                        <select
                            value={staffFilter}
                            onChange={(e) => setStaffFilter(e.target.value)}
                            className="rounded-xl border border-line bg-card px-2 py-2 text-xs text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                            title="Filtrar por profissional"
                        >
                            <option value="">Profissional (Todos)</option>
                            {staffOptions.map((staff) => (
                                <option key={staff.id} value={staff.id}>{staff.name}</option>
                            ))}
                        </select>
                        <select
                            value={paymentMethodFilter}
                            onChange={(e) => setPaymentMethodFilter(e.target.value)}
                            className="rounded-xl border border-line bg-card px-2 py-2 text-xs text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                            title="Filtrar por forma de pagamento já registrada"
                        >
                            <option value="">Pagamento</option>
                            {paymentMethodOptions.map((method) => (
                                <option key={method} value={method}>{method}</option>
                            ))}
                        </select>
                        <select
                            value={`${sortField}:${sortDirection}`}
                            onChange={(e) => {
                                const [nextField, nextDirection] = e.target.value.split(':') as [SortField, SortDirection];
                                setSortField(nextField);
                                setSortDirection(nextDirection);
                            }}
                            className="rounded-xl border border-line bg-card px-2 py-2 text-xs text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                        >
                            <option value="date:desc">Mais recentes</option>
                            <option value="date:asc">Mais antigas</option>
                            <option value="total:desc">Maior valor</option>
                            <option value="total:asc">Menor valor</option>
                            <option value="client:asc">Cliente A-Z</option>
                            <option value="client:desc">Cliente Z-A</option>
                            <option value="status:asc">Status</option>
                            <option value="status:desc">Status invertido</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => setSortDirection((d) => d === 'asc' ? 'desc' : 'asc')}
                            className="flex size-10 items-center justify-center rounded-xl border border-line bg-card text-ink-soft transition hover:border-primary/40 hover:text-ink active:scale-[0.98] touch-manipulation"
                            title={sortDirection === 'asc' ? 'Ordenar descendente' : 'Ordenar ascendente'}
                        >
                            <span className="material-symbols-outlined text-sm">{sortDirection === 'asc' ? 'south' : 'north'}</span>
                        </button>
                        {hasAnyFilter && (
                            <button
                                type="button"
                                onClick={clearAllFilters}
                                className="rounded-xl border border-line bg-card px-3 py-2 text-xs font-semibold text-ink-soft transition hover:text-ink active:scale-[0.98] touch-manipulation"
                            >
                                Limpar
                            </button>
                        )}
                    </div>

                    {hasAnyFilter && (
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-gold-pale px-3 py-2 text-xs text-ink-soft">
                            <span className="font-black uppercase tracking-[0.12em] text-primary-dark">Filtros ativos</span>
                            <span>{statusLabels[filterStatus]}</span>
                            <span>•</span>
                            <span>{dateFilterDescription}</span>
                            {staffFilter && <><span>•</span><span>Profissional selecionado</span></>}
                            {paymentMethodFilter && <><span>•</span><span>Pagamento: {paymentMethodFilter}</span></>}
                            {consumptionType !== 'all' && <><span>•</span><span>Consumo: {consumptionType}</span></>}
                        </div>
                    )}

                    {selectedOpenComandaIds.length > 0 && (
                        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-gold-soft p-2.5">
                            <span className="text-xs font-semibold tabular-nums text-primary-dark">{selectedOpenComandaIds.length} {isEsteticaApp ? 'selecionado(s)' : 'selecionada(s)'}</span>
                            <button onClick={toggleSelectAllOpenInView} className="ml-auto text-xs text-primary-dark hover:underline font-medium">
                                {allOpenInViewSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                            </button>
                            <Button size="sm" variant="warning" onClick={() => setBulkCloseModalOpen(true)}>{isEsteticaApp ? 'Finalizar em massa' : 'Baixar em massa'}</Button>
                        </div>
                    )}
                </div>

                <div className="divide-y divide-line">
                    {loading ? (
                        <div className="space-y-3 p-4">
                            <div className="rounded-2xl border border-line bg-gold-pale/50 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 animate-pulse rounded-xl bg-gold-soft/50" />
                                    <div>
                                        <p className="text-sm font-black text-ink">Carregando {orderPluralLower}...</p>
                                        <p className="text-xs text-ink-soft">Buscando clientes, itens, profissionais e histórico financeiro.</p>
                                    </div>
                                </div>
                            </div>
                            {[1, 2, 3, 4].map((item) => (
                                <div key={item} className="h-20 animate-pulse rounded-xl bg-card border border-line/60" />
                            ))}
                        </div>
                    ) : sortedComandas.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl border border-line bg-gold-pale text-primary-dark">
                                <span className="material-symbols-outlined">receipt_long</span>
                            </div>
                            <p className="text-sm font-black text-ink">
                                {hasAnyFilter ? `Nenhum ${orderLabelLower} encontrado com os filtros atuais.` : `Nenhum ${orderLabelLower} encontrado.`}
                            </p>
                            <p className="mx-auto mt-2 max-w-xl text-xs text-ink-soft">
                                {hasAnyFilter
                                    ? 'Revise status, período, cliente, profissional ou forma de pagamento. Nenhuma regra financeira foi alterada.'
                                    : `Quando houver ${orderPluralLower} abertos ou finalizados, eles aparecerão aqui com referência curta, cliente e status operacional.`}
                            </p>
                            <div className="mt-4 flex flex-wrap justify-center gap-2">
                                {hasAnyFilter && (
                                    <Button variant="secondary" onClick={clearAllFilters} leftIcon="filter_alt_off">
                                        Limpar filtros
                                    </Button>
                                )}
                                <Button onClick={() => navigate('/checkout?mode=comanda')} leftIcon="add">Abrir {orderLabelLower}</Button>
                            </div>
                        </div>
                    ) : (
                        paginatedComandas.map((comanda) => (
                            <ComandaListItem
                                key={comanda.id}
                                comanda={comanda}
                                isSelected={selectedComandaId === comanda.id}
                                isBulkSelected={selectedOpenComandaIds.includes(comanda.id)}
                                onSelect={() => setSelectedComandaId(comanda.id)}
                                onToggleBulk={() => toggleOpenComandaSelection(comanda.id)}
                                onSelectForSidebar={() => setSelectedComandaId(comanda.id)}
                                onCancel={() => { setDeleteComanda(comanda); setCancelReason(''); setCancelReasonOther(''); }}
                            />
                        ))
                    )}
                </div>

                {sortedComandas.length > pageSize && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-line px-4 py-3 text-xs text-ink-soft">
                        <div className="flex items-center gap-2">
                            <span>
                                Exibindo <strong className="text-ink font-semibold tabular-nums">{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedComandas.length)}</strong> de <strong className="text-ink font-semibold tabular-nums">{sortedComandas.length}</strong> {orderPluralLower}
                            </span>
                            <span className="text-line">|</span>
                            <div className="flex items-center gap-1.5">
                                <span>Por página:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="rounded-lg border border-line bg-card px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary/40 tabular-nums"
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="flex items-center gap-1 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink hover:bg-gold-pale disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.98] touch-manipulation"
                            >
                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                                Anterior
                            </button>
                            <span className="px-2 font-medium text-ink tabular-nums">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="flex items-center gap-1 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink hover:bg-gold-pale disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.98] touch-manipulation"
                            >
                                Próxima
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {selectedComanda && (
                <aside className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-2xl border border-line bg-card shadow-2xl shadow-black/20 md:inset-x-auto md:bottom-6 md:right-6 md:top-24 md:w-[360px] md:max-h-[calc(100vh-7.5rem)] md:rounded-2xl">
                    <ComandaSidebar
                        comanda={selectedComanda}
                        financialHistory={financialHistoryByComandaId[selectedComanda.id] || null}
                        canManageFinancialReversal={canManageFinancialReversal}
                        onClose={() => setSelectedComandaId(null)}
                        onCancel={() => selectedComanda && (setDeleteComanda(selectedComanda), setCancelReason(''), setCancelReasonOther(''))}
                        onPrint={() => selectedComanda && handlePrint(selectedComanda)}
                        onCheckout={() => selectedComanda && navigate(`/checkout/${selectedComanda.id}`)}
                        onReopenPaid={() => selectedComanda && openReopenPaidModal(selectedComanda)}
                    />
                </aside>
            )}

            <ComandaFiltersModal
                isOpen={filtersModalOpen}
                onClose={() => setFiltersModalOpen(false)}
                dateFrom={dateFrom}
                dateTo={dateTo}
                quickRange={quickRange}
                onApplyQuickRange={applyQuickRange}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                staffFilter={staffFilter}
                onStaffFilterChange={setStaffFilter}
                staffOptions={staffOptions}
                minTotal={minTotal}
                maxTotal={maxTotal}
                onMinTotalChange={setMinTotal}
                onMaxTotalChange={setMaxTotal}
                consumptionType={consumptionType}
                onConsumptionTypeChange={setConsumptionType}
                sortField={sortField}
                onSortFieldChange={setSortField}
                sortDirection={sortDirection}
                onSortDirectionChange={setSortDirection}
                activeFiltersCount={activeFiltersCount}
                onClearAll={clearAllFilters}
            />

            <Modal
                isOpen={bulkCloseModalOpen}
                onClose={() => !bulkClosing && setBulkCloseModalOpen(false)}
                title="Baixa em Massa"
                maxWidth="sm"
            >
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setBulkCloseType('normal')}
                            className={`flex-1 rounded-xl py-3 px-4 text-sm font-bold transition active:scale-[0.98] touch-manipulation ${
                                bulkCloseType === 'normal' ? 'bg-primary text-night shadow-smg-glow' : 'bg-gold-pale text-ink-soft hover:text-ink'
                            }`}
                        >
                            {isEsteticaApp ? 'Finalização normal' : 'Venda Normal'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setBulkCloseType('admin')}
                            className={`flex-1 rounded-xl py-3 px-4 text-sm font-bold transition active:scale-[0.98] touch-manipulation ${
                                bulkCloseType === 'admin' ? 'bg-primary-dark text-white shadow-smg-glow' : 'bg-gold-pale text-ink-soft hover:text-ink'
                            }`}
                        >
                            Administrativa
                        </button>
                    </div>
                    <p className="text-sm text-ink-soft">
                        <strong className="text-ink tabular-nums">{selectedOpenComandaIds.length}</strong> {orderPluralLower} selecionado(s)
                    </p>
                    {bulkCloseType === 'admin' && (
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-ink-soft">Mês de referência</label>
                            <input
                                type="month"
                                value={bulkLegacyReferenceMonth}
                                onChange={(e) => setBulkLegacyReferenceMonth(e.target.value)}
                                className="w-full rounded-xl border border-line bg-card p-3 text-sm text-ink focus:border-primary focus:outline-none"
                            />
                        </div>
                    )}
                    <textarea
                        value={bulkClosureNote}
                        onChange={(e) => setBulkClosureNote(e.target.value)}
                        rows={2}
                        placeholder="Observação"
                        className="w-full rounded-xl border border-line bg-card p-3 text-sm text-ink placeholder:text-ink-soft/60 focus:border-primary focus:outline-none"
                    />
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setBulkCloseModalOpen(false)} disabled={bulkClosing} className="flex-1">Voltar</Button>
                        <Button onClick={handleBulkClose} disabled={bulkClosing} className="flex-1">Confirmar</Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={!!deleteComanda}
                onClose={() => { setDeleteComanda(null); setCancelReason(''); setCancelReasonOther(''); }}
                title={`Anular ${orderLabel}`}
                maxWidth="sm"
            >
                {deleteComanda && (
                    <div className="space-y-4">
                        {deleteComanda.status === 'paid' && (
                            <div className="rounded-lg border border-danger/30 bg-danger/10 p-3">
                                <p className="text-xs font-medium text-danger">
                                    Este {orderLabelLower} está <strong>{isEsteticaApp ? 'FINALIZADO' : 'PAGO'}</strong> e não pode ser anulado diretamente. Utilize o fluxo de <strong>Estornar e reabrir</strong>.
                                </p>
                            </div>
                        )}
                        <p className="text-sm text-ink-soft">
                            Anular {orderLabelLower} <strong className="text-ink">#{getDisplayId(deleteComanda.id)}</strong> de <strong className="text-ink">{deleteComanda.clients.name}</strong>?
                        </p>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-ink-soft">Motivo</label>
                            <select
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                className="w-full rounded-xl border border-line bg-card p-3 text-sm text-ink focus:border-primary focus:outline-none"
                            >
                                <option value="">Selecione...</option>
                                {CANCEL_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                <option value={CANCEL_REASON_OTHER}>Outro</option>
                            </select>
                            {cancelReason === CANCEL_REASON_OTHER && (
                                <textarea
                                    value={cancelReasonOther}
                                    onChange={(e) => setCancelReasonOther(e.target.value)}
                                    rows={2}
                                    placeholder="Descreva o motivo"
                                    className="mt-2 w-full rounded-xl border border-line bg-card p-3 text-sm text-ink placeholder:text-ink-soft/60 focus:border-primary focus:outline-none"
                                />
                            )}
                        </div>
                        {['operational_error', 'test', 'duplicate'].includes(cancelReason) && (
                            <div className="rounded-lg border border-primary/30 bg-gold-pale p-3">
                                <p className="text-xs font-medium text-primary-dark">
                                    ⚠️ Este {orderLabelLower} <strong>não será considerado no financeiro</strong>.
                                </p>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => { setDeleteComanda(null); setCancelReason(''); setCancelReasonOther(''); }} disabled={deleting} className="flex-1">Voltar</Button>
                            <Button variant="danger" onClick={() => deleteComanda && handleDelete(deleteComanda)} disabled={deleting || deleteComanda.status === 'paid' || !(cancelReason === CANCEL_REASON_OTHER ? cancelReasonOther.trim() : cancelReason.trim())} className="flex-1">
                                {deleting ? 'Anulando...' : 'Confirmar Anulação'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={!!reopenComanda}
                onClose={closeReopenPaidModal}
                title={`Estornar Baixa e Reabrir ${orderLabel}`}
                maxWidth="lg"
            >
                {reopenComanda && (() => {
                    const reopenHistory = financialHistoryByComandaId[reopenComanda.id] || null;
                    return (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-primary/30 bg-gold-pale p-4 text-xs text-primary-dark">
                                <p className="font-bold">Reversão contábil auditada (wrong_settlement)</p>
                                <p className="mt-1 leading-relaxed">
                                    A transação original de entrada será preservada. O sistema registrará uma saída reversa no Fluxo de Caixa, estornará comissões vinculadas e reabrirá o {orderLabelLower} com status <strong>{isEsteticaApp ? 'Aberto' : 'Aberta'}</strong>.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-line bg-card p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">
                                        {orderLabel} e Cliente
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-ink">
                                        #{getDisplayId(reopenComanda.id)} — {reopenComanda.clients.name}
                                    </p>
                                    {reopenHistory && (
                                        <p className="mt-1 font-mono text-[11px] text-ink-soft">
                                            Tx: {reopenHistory.transactionId}
                                        </p>
                                    )}
                                </div>
                                <div className="rounded-xl border border-line bg-card p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">
                                        Valor do Estorno
                                    </p>
                                    <p className="mt-1 text-lg font-black tabular-nums tracking-[-0.02em] whitespace-nowrap text-primary-dark">
                                        {formatCurrency(reopenHistory ? reopenHistory.reversibleAmount : reopenComanda.total)}
                                    </p>
                                    <p className="mt-0.5 text-xs text-ink-soft">
                                        Forma original: {reopenHistory?.paymentMethod || reopenComanda.payment_method || NOT_INFORMED_FALLBACK}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase text-ink-soft">
                                        Motivo do estorno
                                    </label>
                                    <select
                                        value={reopenReasonType}
                                        onChange={(e) => setReopenReasonType(e.target.value)}
                                        disabled={reopening}
                                        className="w-full rounded-xl border border-line bg-card p-3 text-sm font-semibold text-ink focus:border-primary focus:outline-none"
                                    >
                                        {REOPEN_REASON_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-bold uppercase text-ink-soft">
                                        Observação obrigatória para auditoria
                                    </label>
                                    <textarea
                                        value={reopenReasonNote}
                                        onChange={(e) => setReopenReasonNote(e.target.value)}
                                        disabled={reopening}
                                        rows={3}
                                        placeholder={`Descreva por que a baixa deste ${orderLabelLower} está sendo estornada e reaberta...`}
                                        className="w-full rounded-xl border border-line bg-card p-3 text-sm text-ink placeholder:text-ink-soft/60 focus:border-primary focus:outline-none"
                                    />
                                </div>
                            </div>

                            <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-xs text-ink-soft">
                                <input
                                    type="checkbox"
                                    checked={reopenConfirmed}
                                    onChange={(e) => setReopenConfirmed(e.target.checked)}
                                    disabled={reopening}
                                    className="mt-0.5 size-4 rounded border-line text-primary focus:ring-primary/40"
                                />
                                <span>
                                    Confirmo que esta ação registrará uma saída reversa auditada no financeiro, reverterá comissões geradas pela baixa anterior e reabrirá o {orderLabelLower} para edição.
                                </span>
                            </label>

                            <div className="flex flex-col-reverse gap-2 border-t border-line pt-3 sm:flex-row sm:justify-end">
                                <Button
                                    variant="secondary"
                                    onClick={closeReopenPaidModal}
                                    disabled={reopening}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant="secondary"
                                    leftIcon="lock_open"
                                    onClick={() => handleConfirmReopenPaidComanda(false)}
                                    disabled={reopening || !reopenReasonNote.trim() || !reopenConfirmed}
                                >
                                    {reopening ? 'Processando...' : 'Apenas Estornar e Reabrir'}
                                </Button>
                                <Button
                                    leftIcon="point_of_sale"
                                    onClick={() => handleConfirmReopenPaidComanda(true)}
                                    disabled={reopening || !reopenReasonNote.trim() || !reopenConfirmed}
                                >
                                    {reopening ? 'Processando...' : 'Estornar e Abrir Checkout'}
                                </Button>
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            {/* Frente 1.G: Modal de Abertura Rápida de Comandas */}
            <QuickOpenComandaModal
                isOpen={isQuickOpenModalOpen}
                onClose={() => setIsQuickOpenModalOpen(false)}
                clients={quickClients}
                staffList={quickStaff}
                currentUserId={user?.id}
                currentUserRole={accessRole}
                existingOpenComandas={comandas.filter((c) => c.status === 'open')}
                catalogItems={quickCatalogItems}
                itemsHistory={comandas.flatMap((c) => c.comanda_items)}
                onSubmit={handleQuickOpenSubmit}
                onRedirectToExistingComanda={(existingId) => {
                    setIsQuickOpenModalOpen(false);
                    setSelectedComandaId(existingId);
                }}
                orderLabel={orderLabel}
            />
        </div>
    );
};

export default Comandas;
