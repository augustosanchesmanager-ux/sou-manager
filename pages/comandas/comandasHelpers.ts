import type { ChefClubClientCredits } from '../../src/lib/supabase/chefClub';
import { comandaStatusSortOrder } from '../../shared/status/comanda';
import type { ComandaStatus } from '../../shared/status/comanda';
import { deriveComandaDateRange, isRelativeComandaRange } from '../../src/utils/comandaFilters';

export type SortField = 'date' | 'client' | 'status' | 'total';
export type SortDirection = 'asc' | 'desc';
export type QuickRange = 'today' | 'yesterday' | 'this_week' | 'this_month' | '7d' | '30d' | 'custom' | 'all';
export type ConsumptionType = 'all' | 'service' | 'product' | 'mixed';

export interface ComandaItem {
    id: string;
    staff_id?: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    product_id?: string | null;
    service_id?: string | null;
}

export interface ServiceExecutionParticipantRow {
    id: string;
    comanda_item_id: string;
    staff_id?: string | null;
    professional_id?: string | null;
    role: string | null;
    payout_type: string | null;
    payout_value: number | null;
    affects_commission?: boolean | null;
}

export interface Comanda {
    id: string;
    tenant_id?: string | null;
    client_id: string;
    staff_id?: string | null;
    appointment_id?: string | null;
    status: ComandaStatus;
    is_fiado?: boolean;
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
    payment_date_real?: string | null;
    settled_at?: string | null;
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

export interface ClientLookup {
    id: string;
    name: string;
    avatar: string | null;
    phone?: string | null;
}

export interface StaffLookup {
    id: string;
    name: string;
}

export interface AppointmentLookup {
    id: string;
    start_time: string;
}

export interface ComandaTransactionRow {
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

export interface FinancialReversalRow {
    original_transaction_id: string | null;
    reversal_transaction_id?: string | null;
    reversal_type?: string | null;
    amount: number | string | null;
    reason_type?: string | null;
    created_at?: string | null;
}

export interface ComandaItemRow {
    id: string;
    comanda_id: string;
    staff_id?: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    product_id?: string | null;
    service_id?: string | null;
}

export interface ComandasPreferences {
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

export const CANCEL_REASON_OTHER = '__other__';
export const CANCEL_TYPE_OPTIONS = [
    { value: 'operational_error', label: 'Erro operacional' },
    { value: 'test', label: 'Teste' },
    { value: 'duplicate', label: 'Duplicidade' },
    { value: 'client_gave_up', label: 'Cliente desistiu' },
    { value: 'appointment_cancelled', label: 'Agendamento cancelado' },
    { value: 'other', label: 'Outro' },
] as const;

export const COMANDAS_PREFERENCES_KEY = 'soumanager:comandas:preferences:v2';
export const CLIENT_NAME_FALLBACK = 'Cliente não informado';
export const NOT_INFORMED_FALLBACK = 'Não informado';
export const BATCH_SIZE = 80;

export const formatDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const parseDateInputValue = (value: string, endOfDay = false) => {
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

export const chunkIds = (ids: string[], size = BATCH_SIZE): string[][] => {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += size) {
        chunks.push(ids.slice(i, i + size));
    }
    return chunks;
};

export const formatDateLabel = (value: string) => new Date(value).toLocaleDateString('pt-BR');

export const getDisplayId = (id: string) => {
    const hexStr = id.replace(/-/g, '').slice(0, 8);
    const num = parseInt(hexStr, 16);
    return Number.isNaN(num) ? 1000 : (num % 89999) + 1000;
};

export const getShortComandaRef = (id: string) => `#${getDisplayId(id)}`;
export const formatMonthInputValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
export const getDefaultLegacyReferenceMonth = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return formatMonthInputValue(date);
};

export const getStatusSortValue = (status: ComandaStatus) => {
    return comandaStatusSortOrder[status] ?? 99;
};

export const getStatusContextLabel = (status: ComandaStatus, isEsteticaApp = false) => {
    if (status === 'open') return isEsteticaApp ? 'Aberto para procedimento, produto ou finalização.' : 'Aberta para consumo ou baixa no checkout.';
    if (status === 'blocked') return 'Bloqueada para baixa financeira segura.';
    if (status === 'paid') return 'Baixada/fechada no financeiro.';
    return 'Anulada/cancelada com motivo operacional.';
};

export const getConsumptionSummary = (comanda: Pick<Comanda, 'comanda_items'>) => {
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

export const getConsumptionTypeForFilter = (comanda: Pick<Comanda, 'comanda_items'>): ConsumptionType => {
    const hasServices = comanda.comanda_items.some((item) => Boolean(item.service_id));
    const hasProducts = comanda.comanda_items.some((item) => Boolean(item.product_id));
    if (hasServices && hasProducts) return 'mixed';
    if (hasServices) return 'service';
    if (hasProducts) return 'product';
    return 'all';
};

export const QUICK_RANGE_OPTIONS: Array<{ value: QuickRange; label: string }> = [
    { value: 'today', label: 'Hoje' },
    { value: 'yesterday', label: 'Ontem' },
    { value: 'this_week', label: 'Esta semana' },
    { value: 'this_month', label: 'Este mês' },
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: 'custom', label: 'Personalizado' },
    { value: 'all', label: 'Todo o período' },
];

export const QUICK_RANGE_LABELS: Record<QuickRange, string> = QUICK_RANGE_OPTIONS.reduce(
    (acc, option) => { acc[option.value] = option.label; return acc; },
    {} as Record<QuickRange, string>,
);

export const deriveDateRangeForQuickRange = (range: QuickRange): { dateFrom: string; dateTo: string } => {
    const derived = deriveComandaDateRange(range);
    return { dateFrom: derived.startDate, dateTo: derived.endDate };
};

export const buildPeriodLabel = (range: QuickRange, dateFrom: string, dateTo: string) => {
    const presetLabel = QUICK_RANGE_LABELS[range];
    const formatShortDate = (value: string) => (value ? formatDateLabel(`${value}T00:00:00`) : '');

    if (!dateFrom && !dateTo) return presetLabel;
    if (dateFrom && dateTo) {
        const from = formatShortDate(dateFrom);
        const to = formatShortDate(dateTo);
        return from === to ? `${presetLabel} · ${from}` : `${presetLabel} · ${from} – ${to}`;
    }
    if (dateFrom) return `${presetLabel} · a partir de ${formatShortDate(dateFrom)}`;
    return `${presetLabel} · até ${formatShortDate(dateTo)}`;
};

export const loadComandasPreferences = (): ComandasPreferences => {
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
        const parsedRange = Object.prototype.hasOwnProperty.call(QUICK_RANGE_LABELS, parsed.quickRange || '')
            ? (parsed.quickRange as QuickRange)
            : defaultPreferences.quickRange;

        let resolvedDates: { dateFrom: string; dateTo: string };
        if (isRelativeComandaRange(parsedRange)) {
            const derived = deriveComandaDateRange(parsedRange);
            resolvedDates = { dateFrom: derived.startDate, dateTo: derived.endDate };
        } else if (parsedRange === 'all') {
            resolvedDates = { dateFrom: '', dateTo: '' };
        } else {
            resolvedDates = {
                dateFrom: typeof parsed.dateFrom === 'string' && parsed.dateFrom ? parsed.dateFrom : defaultPreferences.dateFrom,
                dateTo: typeof parsed.dateTo === 'string' && parsed.dateTo ? parsed.dateTo : defaultPreferences.dateTo,
            };
        }

        return {
            filterStatus: ['all', 'blocked', 'open', 'paid', 'cancelled'].includes(parsed.filterStatus || '')
                ? (parsed.filterStatus as 'all' | ComandaStatus)
                : defaultPreferences.filterStatus,
            searchTerm: typeof parsed.searchTerm === 'string' ? parsed.searchTerm : defaultPreferences.searchTerm,
            dateFrom: resolvedDates.dateFrom,
            dateTo: resolvedDates.dateTo,
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
