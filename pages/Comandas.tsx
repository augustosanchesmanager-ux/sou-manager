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
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import { logSupabaseError } from '../src/lib/supabase/errors';
import ComandaListItem from '../components/ComandaListItem';
import ComandaSidebar, { type ComandaFinancialHistory } from '../components/ComandaSidebar';
import ComandaFiltersModal from '../components/ComandaFiltersModal';

type ComandaStatus = 'blocked' | 'open' | 'paid' | 'cancelled';
type SortField = 'date' | 'client' | 'status' | 'total';
type SortDirection = 'asc' | 'desc';
type QuickRange = 'today' | '7d' | '30d' | 'custom' | 'all';
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
    comanda_item_id: string;
    staff_id?: string | null;
    professional_id?: string | null;
    role: string | null;
    payout_type: string | null;
    payout_value: number | null;
}

interface Comanda {
    id: string;
    client_id: string;
    staff_id?: string | null;
    appointment_id?: string | null;
    status: ComandaStatus;
    cancellation_reason?: string | null;
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

const STATUS_LABELS: Record<'all' | ComandaStatus, string> = {
    all: 'Todas',
    blocked: 'Bloqueadas',
    open: 'Abertas',
    paid: 'Pagas',
    cancelled: 'Canceladas',
};

const COMANDAS_PREFERENCES_KEY = 'soumanager:comandas:preferences:v2';
const COMANDA_ITEMS_SELECT = 'id, comanda_id, product_name, quantity, unit_price, product_id, service_id';
const CLIENT_NAME_FALLBACK = 'Cliente não informado';
const NOT_INFORMED_FALLBACK = 'Não informado';

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

const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
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
    const orderMap: Record<ComandaStatus, number> = {
        blocked: -1,
        open: 0,
        paid: 1,
        cancelled: 2,
    };
    return orderMap[status] ?? 99;
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
    const defaultPreferences: ComandasPreferences = {
        filterStatus: 'all',
        searchTerm: '',
        dateFrom: '',
        dateTo: '',
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
        return {
            filterStatus: ['all', 'blocked', 'open', 'paid', 'cancelled'].includes(parsed.filterStatus || '')
                ? (parsed.filterStatus as 'all' | ComandaStatus)
                : defaultPreferences.filterStatus,
            searchTerm: typeof parsed.searchTerm === 'string' ? parsed.searchTerm : defaultPreferences.searchTerm,
            dateFrom: typeof parsed.dateFrom === 'string' ? parsed.dateFrom : defaultPreferences.dateFrom,
            dateTo: typeof parsed.dateTo === 'string' ? parsed.dateTo : defaultPreferences.dateTo,
            quickRange: ['today', '7d', '30d', 'custom', 'all'].includes(parsed.quickRange || '')
                ? (parsed.quickRange as QuickRange)
                : defaultPreferences.quickRange,
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

const KpiCard: React.FC<{
    title: string;
    value: string;
    helper: string;
    icon: string;
    accentClassName: string;
}> = ({ title, value, helper, icon, accentClassName }) => (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm shadow-slate-900/5 dark:border-white/8 dark:bg-[#121826]">
        <div className={`absolute inset-x-0 top-0 h-1 ${accentClassName}`} />
        <div className="flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{value}</p>
            </div>
            <span className="material-symbols-outlined text-lg text-slate-400 dark:text-slate-500">{icon}</span>
        </div>
        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{helper}</p>
    </div>
);

const Comandas: React.FC = () => {
    const navigate = useNavigate();
    const { appSlug, schema, tenantId, user, canAccessSuperAdmin } = useAuth();
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
        ? { all: 'Todos', blocked: 'Bloqueados', open: 'Abertos', paid: 'Finalizados', cancelled: 'Cancelados' }
        : STATUS_LABELS;
    const preferences = loadComandasPreferences();

    const [comandas, setComandas] = useState<Comanda[]>([]);
    const [financialHistoryByComandaId, setFinancialHistoryByComandaId] = useState<Record<string, ComandaFinancialHistory>>({});
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | ComandaStatus>(preferences.filterStatus);
    const [searchTerm, setSearchTerm] = useState(preferences.searchTerm);
    const [dateFrom, setDateFrom] = useState(preferences.dateFrom);
    const [dateTo, setDateTo] = useState(preferences.dateTo);
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
    const [filtersModalOpen, setFiltersModalOpen] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

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

            const { data, error } = await query;
            if (error) {
                logSupabaseError('[Comandas] Erro ao buscar comandas', error, { tenantId: resolvedTenantId });
                throw error;
            }

            if (!data || data.length === 0) {
                setComandas([]);
                setFinancialHistoryByComandaId({});
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

            const { data: itemsData, error: itemsError } = await client
                .from('comanda_items')
                .select(COMANDA_ITEMS_SELECT)
                .in('comanda_id', comandaIds);

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
                    clientsResult = await client.from('clients').select('id, name, avatar, phone').in('id', clientIds);
                } catch (err) {
                    clientsResult = { data: null, error: err };
                }
            } else {
                clientsResult = { data: [], error: null };
            }

            if (staffIds.length > 0) {
                try {
                    staffResult = await client.from('staff').select('id, name').in('id', staffIds);
                } catch (err) {
                    staffResult = { data: null, error: err };
                }
            } else {
                staffResult = { data: [], error: null };
            }

            if (appointmentIds.length > 0) {
                try {
                    appointmentsResult = await client.from('appointments').select('id, start_time').in('id', appointmentIds);
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

            let transactionsQuery = client
                .from('transactions')
                .select('id, tenant_id, source_id, amount, payment_method, date, created_at, status')
                .eq('source_type', 'comanda')
                .in('source_id', comandaIds);

            if (resolvedTenantId) {
                transactionsQuery = transactionsQuery.eq('tenant_id', resolvedTenantId);
            }

            const { data: transactionRows, error: transactionsError } = await transactionsQuery;

            if (transactionsError) {
                logSupabaseError('[Comandas] Erro ao buscar histórico financeiro das comandas', transactionsError, {
                    comandaCount: comandaIds.length,
                    tenantId: resolvedTenantId,
                });
                setFinancialHistoryByComandaId({});
            } else {
                const transactions = ((transactionRows || []) as ComandaTransactionRow[])
                    .filter((transaction) => Boolean(transaction.id) && Boolean(transaction.source_id));
                const transactionIds = transactions.map((transaction) => transaction.id);
                const reversedByTransactionId = new Map<string, number>();
                const reversalsByTransactionId = new Map<string, ComandaFinancialHistory['reversals']>();

                if (transactionIds.length > 0) {
                    let reversalsQuery = supabase
                        .from('financial_reversals')
                        .select('original_transaction_id, reversal_transaction_id, reversal_type, amount, reason_type, created_at')
                        .in('original_transaction_id', transactionIds);

                    if (resolvedTenantId) {
                        reversalsQuery = reversalsQuery.eq('tenant_id', resolvedTenantId);
                    }

                    const { data: reversals, error: reversalsError } = await reversalsQuery;

                    if (reversalsError) {
                        logSupabaseError('[Comandas] Erro ao buscar reversoes financeiras das comandas', reversalsError, {
                            transactionCount: transactionIds.length,
                            tenantId: resolvedTenantId,
                        });
                    } else {
                        ((reversals || []) as FinancialReversalRow[]).forEach((reversal) => {
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

                const historyByComanda = transactions.reduce<Record<string, ComandaFinancialHistory>>((acc, transaction) => {
                    if (!transaction.source_id) return acc;
                    const amount = Number(transaction.amount || 0);
                    const reversedAmount = Math.min(amount, reversedByTransactionId.get(transaction.id) || 0);
                    const reversibleAmount = Math.max(amount - reversedAmount, 0);
                    const reversalStatus: ComandaFinancialHistory['reversalStatus'] = reversedAmount <= 0
                        ? 'none'
                        : reversibleAmount <= 0
                            ? 'full'
                            : 'partial';

                    const current = acc[transaction.source_id];
                    const transactionDate = transaction.date || transaction.created_at || null;
                    if (current && new Date(current.date || 0).getTime() >= new Date(transactionDate || 0).getTime()) {
                        return acc;
                    }

                    acc[transaction.source_id] = {
                        transactionId: transaction.id,
                        amount,
                        paymentMethod: transaction.payment_method || NOT_INFORMED_FALLBACK,
                        date: transactionDate,
                        status: transaction.status || null,
                        reversedAmount,
                        reversibleAmount,
                        reversalStatus,
                        reversals: reversalsByTransactionId.get(transaction.id) || [],
                    };
                    return acc;
                }, {});

                setFinancialHistoryByComandaId(historyByComanda);
            }

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
            setFinancialHistoryByComandaId({});
            setToast({ message, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [appSlug, canAccessSuperAdmin, schema, tenantId]);

    useEffect(() => { void fetchData(); }, [fetchData]);

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
                const { error } = await unblockClient
                    .from('comandas')
                    .update({ status: 'open' })
                    .in('id', commandsToUnblock);

                if (error) {
                    logSupabaseError('[Comandas] Erro ao desbloquear comandas', error, { comandaIds: commandsToUnblock });
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
        const today = new Date();
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
        const startDate = new Date(today);
        if (range === '7d') startDate.setDate(startDate.getDate() - 6);
        if (range === '30d') startDate.setDate(startDate.getDate() - 29);
        setQuickRange(range);
        setDateFrom(formatDateInputValue(range === 'today' ? today : startDate));
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

    const dateFilteredComandas = comandas.filter((c) => {
        const createdAt = new Date(c.created_at);
        if (Number.isNaN(createdAt.getTime())) return false;
        const startDate = parseDateInputValue(dateFrom);
        const endDate = parseDateInputValue(dateTo, true);
        if (startDate && createdAt < startDate) return false;
        if (endDate && createdAt > endDate) return false;
        return true;
    });

    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const statusScopeComandas = dateFilteredComandas.filter((c) => {
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
    });

    const filteredComandas = statusScopeComandas.filter((c) => {
        return filterStatus === 'all' || c.status === filterStatus;
    });

    const sortedComandas = [...filteredComandas].sort((first, second) => {
        let comparison = 0;
        if (sortField === 'date') comparison = new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
        if (sortField === 'client') comparison = (first.clients?.name || '').localeCompare(second.clients?.name || '', 'pt-BR', { sensitivity: 'base' });
        if (sortField === 'status') comparison = getStatusSortValue(first.status) - getStatusSortValue(second.status);
        if (sortField === 'total') comparison = first.total - second.total;
        if (comparison === 0) comparison = new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
        return sortDirection === 'asc' ? comparison : comparison * -1;
    });

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

    const selectedComanda = sortedComandas.find((c) => c.id === selectedComandaId) || null;
    const openComandasInView = sortedComandas.filter((c) => c.status === 'open');
    const allOpenInViewSelected = openComandasInView.length > 0 && openComandasInView.every((c) => selectedOpenComandaIds.includes(c.id));

    const tabs = [
        { key: 'all' as const, label: statusLabels.all, count: statusScopeComandas.length },
        { key: 'blocked' as const, label: statusLabels.blocked, count: statusScopeComandas.filter((c) => c.status === 'blocked').length },
        { key: 'open' as const, label: statusLabels.open, count: statusScopeComandas.filter((c) => c.status === 'open').length },
        { key: 'paid' as const, label: statusLabels.paid, count: statusScopeComandas.filter((c) => c.status === 'paid').length },
        { key: 'cancelled' as const, label: statusLabels.cancelled, count: statusScopeComandas.filter((c) => c.status === 'cancelled').length },
    ];

    const openCount = statusScopeComandas.filter((c) => c.status === 'open').length;
    const finalizedToday = comandas.filter((c) => {
        if (c.status !== 'paid') return false;
        const createdAt = new Date(c.created_at);
        const today = new Date();
        return createdAt.getDate() === today.getDate() && createdAt.getMonth() === today.getMonth() && createdAt.getFullYear() === today.getFullYear();
    }).length;

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

    const totalOpen = statusScopeComandas.filter((c) => c.status === 'open').reduce((sum, c) => sum + c.total, 0);
    const avgTicket = filteredComandas.length > 0 ? filteredComandas.reduce((sum, c) => sum + c.total, 0) / filteredComandas.length : 0;

    const staffOptions = Array.from(new Map<string, { id: string; name: string }>(
        comandas.flatMap((c) => c.staff_ids.map((staffId, index) => ({ id: staffId, name: c.staff_names[index] || 'Profissional' })))
            .map((s) => [s.id, s] as [string, { id: string; name: string }])
            .values(),
    ).values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));

    const paymentMethodOptions = Array.from(new Set<string>(
        comandas
            .map((c) => c.payment_method || '')
            .filter((method): method is string => Boolean(method.trim())),
    )).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

    const dateFilterDescription = !dateFrom && !dateTo
        ? 'Periodo completo'
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

    const getPaymentStatusLabel = (status: ComandaStatus) => {
        if (status === 'paid') return 'Pago';
        if (status === 'cancelled') return 'Cancelado';
        return 'Pendente';
    };

    const getParticipantStaffId = (participant: ServiceExecutionParticipantRow) => participant.staff_id || participant.professional_id || '';

    const normalizeParticipantPercentage = (value: number | null | undefined) => {
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric)) return 0;
        return numeric > 1 ? numeric / 100 : numeric;
    };

    const getParticipantSharedValue = (serviceValue: number, participant: ServiceExecutionParticipantRow) => {
        if (participant.payout_type === 'fixed') return Number(participant.payout_value || 0);
        return serviceValue * normalizeParticipantPercentage(participant.payout_value);
    };

    const formatParticipantPayout = (participant: ServiceExecutionParticipantRow, name: string) => {
        if (participant.payout_type === 'fixed') {
            return `${name} R$ ${formatExportMoney(Number(participant.payout_value || 0))}`;
        }
        const percent = normalizeParticipantPercentage(participant.payout_value) * 100;
        return `${name} ${percent.toFixed(2).replace('.', ',').replace(/,00$/, '')}%`;
    };

    const isSharedServiceItem = (item: ComandaItem, participants: ServiceExecutionParticipantRow[]) => {
        if (participants.length === 0) return false;
        if (participants.length > 1) return true;
        const [participant] = participants;
        const isPrimaryMainProfessional = participant.role === 'primary' && getParticipantStaffId(participant) === item.staff_id;
        const isFullPercentagePayout = participant.payout_type === 'percentage' && normalizeParticipantPercentage(participant.payout_value) === 1;
        return !isPrimaryMainProfessional || !isFullPercentagePayout;
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
            isEsteticaApp ? 'Créditos utilizados' : 'Créditos Clube do Chefe utilizados',
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
            const sharedService = services.some((item) => isSharedServiceItem(item, participantsByItem[item.id] || []));
            const serviceValue = services.reduce((sum, item) => sum + Number(item.unit_price || 0), 0);
            const sharedDetails = sharedService
                ? services.flatMap((item) => (participantsByItem[item.id] || []).map((participant) => {
                    const staffId = getParticipantStaffId(participant);
                    const name = staffId ? (staffById[staffId] || staffId) : 'Profissional';
                    const participantBase = getParticipantSharedValue(Number(item.unit_price || 0), participant);
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
            const observations = [c.closure_note, c.cancellation_reason].filter(Boolean).join(' | ');
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
        const itemsHtml = comanda.comanda_items.map((item) => `<li>${item.product_name} x${item.quantity} - ${formatCurrency(item.unit_price * item.quantity)}</li>`).join('');
        printWindow.document.write(`
            <html><head><title>${orderLabel} #${getDisplayId(comanda.id)}</title><style>body{font-family:Segoe UI,sans-serif;padding:24px;color:#111827}h1{font-size:20px;margin-bottom:16px}.line{margin:8px 0;font-size:13px}ul{padding-left:18px;margin:16px 0}li{margin-bottom:6px;font-size:13px}.total{margin-top:18px;font-size:22px;font-weight:700}</style></head>
            <body><h1>${orderLabel} #${getDisplayId(comanda.id)}</h1><div class="line"><strong>Cliente:</strong> ${comanda.clients.name}</div><div class="line"><strong>Status:</strong> ${statusLabels[comanda.status]}</div><div class="line"><strong>Abertura:</strong> ${new Date(comanda.created_at).toLocaleString('pt-BR')}</div><div class="line"><strong>Profissionais:</strong> ${comanda.staff_names.join(' / ') || 'Sem profissional'}</div><ul>${itemsHtml}</ul><div class="total">Total: ${formatCurrency(comanda.total)}</div></body></html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    const handleDelete = async (comanda: Comanda) => {
        if (!tenantId && !canAccessSuperAdmin) return;

        const reason = cancelReason === CANCEL_REASON_OTHER ? cancelReasonOther.trim() : cancelReason.trim();
        if (!reason) {
            setToast({ message: 'Informe o motivo do cancelamento.', type: 'error' });
            return;
        }

        if (comanda.status === 'paid') {
            const confirmed = window.confirm(
                `Este ${orderLabelLower} foi finalizado. Anulá-lo pode afetar ${financialImpactCopy}.\n\nTem certeza que deseja anular?`
            );
            if (!confirmed) return;
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
                cancellation_reason: reason,
                cancellation_type: cancelReason,
                cancelled_at: new Date().toISOString(),
                cancelled_by_user_id: user?.id || null,
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

    return (
        <div className="space-y-4 pb-20 animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <section className="relative overflow-hidden rounded-2xl border border-slate-900/10 bg-[#102235] p-4 text-white shadow-sm dark:border-white/10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(0,210,255,0.22),transparent_32%),linear-gradient(135deg,rgba(0,51,102,0.97),rgba(15,23,42,0.98)_56%,rgba(146,104,45,0.68))]" />
                <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
                            <span className="material-symbols-outlined text-[14px]">content_cut</span>
                            {isEsteticaApp ? 'Atendimentos da clínica' : 'Balcão de atendimento'}
                        </span>
                        <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">{isEsteticaApp ? orderPluralLabel : 'Comandas do balcão'}</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
                            {sortedComandas.length} {orderPluralLower} no recorte atual, com foco em cliente, profissional, {isEsteticaApp ? 'procedimentos, produtos e finalização real' : 'consumo e baixa real'}. {dateFilterDescription}.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => navigate('/checkout?mode=comanda')}
                                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/20 transition hover:bg-amber-300"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                Novo {orderLabelLower}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/checkout?mode=pdv')}
                                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                            >
                                <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                                {isEsteticaApp ? 'Finalizar atendimento' : 'Abrir PDV'}
                            </button>
                        </div>
                    </div>
                    <div className="grid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] sm:min-w-[420px] sm:grid-cols-3">
                        <div className="border-white/10 p-3 sm:border-r">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">{isEsteticaApp ? 'Abertos' : 'Abertas'}</p>
                            <p className="mt-1 text-2xl font-black">{loading ? '...' : String(openCount).padStart(2, '0')}</p>
                        </div>
                        <div className="border-white/10 p-3 sm:border-r">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">{isEsteticaApp ? 'Finalizados hoje' : 'Finalizadas hoje'}</p>
                            <p className="mt-1 text-2xl font-black">{loading ? '...' : String(finalizedToday).padStart(2, '0')}</p>
                        </div>
                        <div className="p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">Total em aberto</p>
                            <p className="mt-1 text-xl font-black">{loading ? '...' : formatCurrency(totalOpen)}</p>
                        </div>
                    </div>
                </div>
                <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
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
                <section className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-lg text-rose-600 dark:text-rose-300">error</span>
                        <div>
                            <p className="text-sm font-black text-rose-700 dark:text-rose-300">Falha ao carregar {orderPluralLower}</p>
                            <p className="text-xs text-rose-700/80 dark:text-rose-300/80">{loadError}</p>
                        </div>
                    </div>
                    <Button variant="secondary" leftIcon="sync" onClick={fetchData} disabled={loading}>
                        Tentar novamente
                    </Button>
                </section>
            )}

            <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <KpiCard title={isEsteticaApp ? 'Abertos' : 'Abertas'} value={loading ? '...' : String(openCount).padStart(2, '0')} helper="Em aberto" icon="schedule" accentClassName="bg-amber-400" />
                <KpiCard title="Hoje" value={loading ? '...' : String(finalizedToday).padStart(2, '0')} helper={isEsteticaApp ? 'Finalizados' : 'Finalizadas'} icon="task_alt" accentClassName="bg-emerald-400" />
                <KpiCard title="Total" value={loading ? '...' : formatCurrency(totalOpen)} helper="Pendente" icon="payments" accentClassName="bg-sky-400" />
                <KpiCard title="Ticket" value={loading ? '...' : formatCurrency(avgTicket)} helper="Média" icon="monitoring" accentClassName="bg-fuchsia-400" />
            </section>

            <section className="rounded-2xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#111827]">
                <div className="flex flex-col gap-3 p-3">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setFilterStatus(tab.key)}
                                title={tab.key === 'all' ? `Todos os ${orderPluralLower} filtrados` : getStatusContextLabel(tab.key, isEsteticaApp)}
                                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                                    filterStatus === tab.key
                                        ? 'border-amber-400/60 bg-amber-500/15 text-amber-700 dark:text-amber-100'
                                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-400'
                                }`}
                            >
                                {tab.label}
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filterStatus === tab.key ? 'bg-amber-500 text-white dark:bg-white/10' : 'bg-slate-100 dark:bg-white/5'}`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={`Buscar cliente, telefone, profissional ou #${orderLabelLower}...`}
                                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setFiltersModalOpen((open) => !open)}
                            className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                                activeFiltersCount > 0
                                    ? 'border-amber-400/60 bg-amber-500/15 text-amber-700 dark:text-amber-200'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-transparent dark:text-slate-400'
                            }`}
                        >
                            <span className="material-symbols-outlined text-sm">tune</span>
                            Filtros
                            {activeFiltersCount > 0 && (
                                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </button>
                        <select
                            value={quickRange}
                            onChange={(e) => applyQuickRange(e.target.value as QuickRange)}
                            className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs dark:border-white/10 dark:bg-[#0f172a]"
                        >
                            <option value="today">Hoje</option>
                            <option value="7d">7 dias</option>
                            <option value="30d">30 dias</option>
                            <option value="all">Todos</option>
                        </select>
                        <select
                            value={paymentMethodFilter}
                            onChange={(e) => setPaymentMethodFilter(e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs dark:border-white/10 dark:bg-[#0f172a]"
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
                            className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs dark:border-white/10 dark:bg-[#0f172a]"
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
                            className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-amber-400 hover:text-amber-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
                            title={sortDirection === 'asc' ? 'Ordenar descendente' : 'Ordenar ascendente'}
                        >
                            <span className="material-symbols-outlined text-sm">{sortDirection === 'asc' ? 'south' : 'north'}</span>
                        </button>
                        {hasAnyFilter && (
                            <button
                                type="button"
                                onClick={clearAllFilters}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition hover:text-slate-900 dark:border-white/10 dark:bg-transparent dark:text-slate-400 dark:hover:text-white"
                            >
                                Limpar
                            </button>
                        )}
                    </div>

                    {hasAnyFilter && (
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                            <span className="font-black uppercase tracking-[0.12em] text-slate-500">Filtros ativos</span>
                            <span>{statusLabels[filterStatus]}</span>
                            <span>{dateFilterDescription}</span>
                            {staffFilter && <span>Profissional selecionado</span>}
                            {paymentMethodFilter && <span>Pagamento: {paymentMethodFilter}</span>}
                            {consumptionType !== 'all' && <span>Consumo: {consumptionType}</span>}
                        </div>
                    )}

                    {selectedOpenComandaIds.length > 0 && (
                        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2">
                            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{selectedOpenComandaIds.length} {isEsteticaApp ? 'selecionado(s)' : 'selecionada(s)'}</span>
                            <button onClick={toggleSelectAllOpenInView} className="ml-auto text-xs text-amber-700 hover:underline dark:text-amber-300">
                                {allOpenInViewSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                            </button>
                            <Button size="sm" variant="warning" onClick={() => setBulkCloseModalOpen(true)}>{isEsteticaApp ? 'Finalizar em massa' : 'Baixar em massa'}</Button>
                        </div>
                    )}
                </div>

                <div className="divide-y divide-slate-200/70 dark:divide-white/8">
                    {loading ? (
                        <div className="space-y-3 p-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 animate-pulse rounded-xl bg-slate-200 dark:bg-white/10" />
                                    <div>
                                        <p className="text-sm font-black text-slate-800 dark:text-white">Carregando {orderPluralLower}...</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Buscando clientes, itens, profissionais e histórico financeiro.</p>
                                    </div>
                                </div>
                            </div>
                            {[1, 2, 3, 4].map((item) => (
                                <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
                            ))}
                        </div>
                    ) : sortedComandas.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/5">
                                <span className="material-symbols-outlined">receipt_long</span>
                            </div>
                            <p className="text-sm font-black text-slate-800 dark:text-white">
                                {hasAnyFilter ? `Nenhum ${orderLabelLower} encontrado com os filtros atuais.` : `Nenhum ${orderLabelLower} encontrado.`}
                            </p>
                            <p className="mx-auto mt-2 max-w-xl text-xs text-slate-500 dark:text-slate-400">
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
                        sortedComandas.map((comanda) => (
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
            </section>

            {selectedComanda && (
                <aside className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-white/10 dark:bg-[#121826] md:inset-x-auto md:bottom-6 md:right-6 md:top-24 md:w-[360px] md:max-h-[calc(100vh-7.5rem)] md:rounded-2xl">
                    <ComandaSidebar
                        comanda={selectedComanda}
                        financialHistory={financialHistoryByComandaId[selectedComanda.id] || null}
                        onClose={() => setSelectedComandaId(null)}
                        onCancel={() => selectedComanda && (setDeleteComanda(selectedComanda), setCancelReason(''), setCancelReasonOther(''))}
                        onPrint={() => selectedComanda && handlePrint(selectedComanda)}
                        onCheckout={() => selectedComanda && navigate(`/checkout/${selectedComanda.id}`)}
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
                            className={`flex-1 rounded-xl py-3 px-4 text-sm font-semibold transition ${
                                bulkCloseType === 'normal' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                            }`}
                        >
                            {isEsteticaApp ? 'Finalização normal' : 'Venda Normal'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setBulkCloseType('admin')}
                            className={`flex-1 rounded-xl py-3 px-4 text-sm font-semibold transition ${
                                bulkCloseType === 'admin' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                            }`}
                        >
                            Administrativa
                        </button>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        {selectedOpenComandaIds.length} {orderPluralLower} selecionado(s)
                    </p>
                    {bulkCloseType === 'admin' && (
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Mês de referência</label>
                            <input
                                type="month"
                                value={bulkLegacyReferenceMonth}
                                onChange={(e) => setBulkLegacyReferenceMonth(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#0f172a]"
                            />
                        </div>
                    )}
                    <textarea
                        value={bulkClosureNote}
                        onChange={(e) => setBulkClosureNote(e.target.value)}
                        rows={2}
                        placeholder="Observação"
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#0f172a]"
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
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs font-medium text-amber-800">
                                    ⚠️ Este {orderLabelLower} está <strong>{isEsteticaApp ? 'FINALIZADO' : 'PAGO'}</strong>. Anulá-lo pode afetar {financialImpactCopy}.
                                </p>
                            </div>
                        )}
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Anular {orderLabelLower} <strong>#{getDisplayId(deleteComanda.id)}</strong> de <strong>{deleteComanda.clients.name}</strong>?
                        </p>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Motivo</label>
                            <select
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#0f172a]"
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
                                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#0f172a]"
                                />
                            )}
                        </div>
                        {['operational_error', 'test', 'duplicate'].includes(cancelReason) && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs font-medium text-amber-800">
                                    ⚠️ Este {orderLabelLower} <strong>não será considerado no financeiro</strong>.
                                </p>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => { setDeleteComanda(null); setCancelReason(''); setCancelReasonOther(''); }} disabled={deleting} className="flex-1">Voltar</Button>
                            <Button variant="danger" onClick={() => deleteComanda && handleDelete(deleteComanda)} disabled={deleting || !(cancelReason === CANCEL_REASON_OTHER ? cancelReasonOther.trim() : cancelReason.trim())} className="flex-1">
                                {deleting ? 'Anulando...' : 'Confirmar Anulação'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Comandas;
