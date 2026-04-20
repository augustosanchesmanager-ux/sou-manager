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
import DatePickerInput from '../components/ui/DatePickerInput';
import Button from '../components/ui/Button';
import { DEFAULT_APP_SLUG } from '../src/lib/supabase/schemas';

type ComandaStatus = 'open' | 'paid' | 'cancelled';
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

interface Comanda {
    id: string;
    client_id: string;
    staff_id?: string | null;
    appointment_id?: string | null;
    status: ComandaStatus;
    cancellation_reason?: string | null;
    closure_mode?: 'standard' | 'legacy_membership' | null;
    closure_note?: string | null;
    financial_effect?: boolean | null;
    membership_credit_effect?: boolean | null;
    legacy_reference_month?: string | null;
    closed_at?: string | null;
    total: number;
    created_at: string;
    clients: {
        name: string;
        avatar: string;
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
}

interface ClientLookup {
    id: string;
    name: string;
    avatar: string | null;
}

interface StaffLookup {
    id: string;
    name: string;
}

interface AppointmentLookup {
    id: string;
    start_time: string;
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

type ComandasPreferences = {
    filterStatus: 'all' | ComandaStatus;
    searchTerm: string;
    dateFrom: string;
    dateTo: string;
    quickRange: QuickRange;
    sortField: SortField;
    sortDirection: SortDirection;
    staffFilter: string;
    minTotal: string;
    maxTotal: string;
    consumptionType: ConsumptionType;
    advancedFiltersOpen: boolean;
};

const CANCEL_REASON_OTHER = '__other__';
const CANCEL_REASON_OPTIONS = [
    'Cliente desistiu',
    'Cliente nao compareceu',
    'Erro no lancamento',
    'Pagamento recusado',
    'Solicitacao do profissional',
    'Falta de produto ou servico',
] as const;

const STATUS_LABELS: Record<'all' | ComandaStatus, string> = {
    all: 'Todas',
    open: 'Abertas',
    paid: 'Pagas',
    cancelled: 'Canceladas',
};

const COMANDAS_PREFERENCES_KEY = 'soumanager:comandas:preferences:v2';

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
const formatTimeLabel = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
        open: 0,
        paid: 1,
        cancelled: 2,
    };

    return orderMap[status] ?? 99;
};

const getStatusMeta = (status: ComandaStatus) => {
    if (status === 'open') {
        return {
            label: 'Aberta',
            icon: 'schedule',
            className: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
            dotClassName: 'bg-amber-400',
        };
    }

    if (status === 'paid') {
        return {
            label: 'Paga',
            icon: 'check_circle',
            className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
            dotClassName: 'bg-emerald-400',
        };
    }

    return {
        label: 'Cancelada',
        icon: 'do_not_disturb_on',
        className: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
        dotClassName: 'bg-slate-400',
    };
};

const getSettlementMeta = (comanda: Comanda) => {
    if (comanda.status !== 'paid' || comanda.financial_effect !== false) return null;

    return {
        label: comanda.closure_mode === 'legacy_membership' ? 'Baixa administrativa do Clube' : 'Baixa administrativa',
        helper: comanda.legacy_reference_month
            ? `Referencia: ${new Date(comanda.legacy_reference_month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
            : 'Sem impacto financeiro e sem abatimento de creditos atuais.',
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
    };
};

const getConsumptionType = (comanda: Comanda): ConsumptionType => {
    const hasServices = comanda.comanda_items.some((item) => Boolean(item.service_id));
    const hasProducts = comanda.comanda_items.some((item) => Boolean(item.product_id));

    if (hasServices && hasProducts) return 'mixed';
    if (hasServices) return 'service';
    if (hasProducts) return 'product';
    return 'all';
};

const getConsumptionSummary = (comanda: Comanda) => {
    if (comanda.comanda_items.length === 0) {
        return {
            title: 'Sem consumo lancado',
            detail: 'Adicione itens para concluir o fechamento.',
        };
    }

    const sortedItems = [...comanda.comanda_items].sort(
        (first, second) => (second.quantity * second.unit_price) - (first.quantity * first.unit_price),
    );
    const primaryItem = sortedItems[0];
    const remainingItems = comanda.comanda_items.length - 1;

    return {
        title: primaryItem.product_name,
        detail: remainingItems > 0
            ? `+ ${remainingItems} ${remainingItems === 1 ? 'item complementar' : 'itens complementares'}`
            : `${primaryItem.quantity} ${primaryItem.quantity === 1 ? 'item' : 'itens'}`,
    };
};

const getComandaAttention = (comanda: Comanda) => {
    if (comanda.status !== 'open') return null;

    const createdAt = new Date(comanda.created_at);
    const ageHours = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 3600000));
    const isFromPreviousDay = createdAt.toDateString() !== new Date().toDateString();

    if (isFromPreviousDay) {
        return {
            level: 'critical',
            label: 'Virou o dia',
            description: 'Comanda aberta desde outro dia.',
            className: 'border-red-500/30 bg-red-500/8 text-red-200',
            icon: 'priority_high',
        };
    }

    if (comanda.comanda_items.length === 0) {
        return {
            level: 'warning',
            label: 'Sem consumo',
            description: 'Aberta sem itens lancados.',
            className: 'border-amber-500/25 bg-amber-500/8 text-amber-200',
            icon: 'inventory_2',
        };
    }

    if (ageHours >= 4) {
        return {
            level: 'warning',
            label: `Aberta ha ${ageHours}h`,
            description: 'Vale revisar antes do fechamento.',
            className: 'border-amber-500/25 bg-amber-500/8 text-amber-200',
            icon: 'schedule',
        };
    }

    if (comanda.total >= 180) {
        return {
            level: 'info',
            label: 'Alto valor',
            description: 'Conferir itens e pagamento.',
            className: 'border-sky-500/25 bg-sky-500/8 text-sky-200',
            icon: 'payments',
        };
    }

    return null;
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
        minTotal: '',
        maxTotal: '',
        consumptionType: 'all',
        advancedFiltersOpen: false,
    };

    if (typeof window === 'undefined') {
        return defaultPreferences;
    }

    try {
        const rawValue = window.localStorage.getItem(COMANDAS_PREFERENCES_KEY);
        if (!rawValue) return defaultPreferences;

        const parsed = JSON.parse(rawValue) as Partial<ComandasPreferences>;

        return {
            filterStatus: ['all', 'open', 'paid', 'cancelled'].includes(parsed.filterStatus || '')
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
            minTotal: typeof parsed.minTotal === 'string' ? parsed.minTotal : defaultPreferences.minTotal,
            maxTotal: typeof parsed.maxTotal === 'string' ? parsed.maxTotal : defaultPreferences.maxTotal,
            consumptionType: ['all', 'service', 'product', 'mixed'].includes(parsed.consumptionType || '')
                ? (parsed.consumptionType as ConsumptionType)
                : defaultPreferences.consumptionType,
            advancedFiltersOpen: Boolean(parsed.advancedFiltersOpen),
        };
    } catch (error) {
        console.error('Erro ao carregar preferencias de comandas:', error);
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
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-sm shadow-slate-900/5 dark:border-white/8 dark:bg-[#121826]">
        <div className={`absolute inset-x-0 top-0 h-1 ${accentClassName}`} />
        <div className="mb-4 flex items-center justify-between">
            <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{title}</p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{helper}</p>
            </div>
            <span className="material-symbols-outlined text-[22px] text-slate-400 dark:text-slate-500">{icon}</span>
        </div>
        <p className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">{value}</p>
    </div>
);

const Comandas: React.FC = () => {
    const navigate = useNavigate();
    const { appSlug, schema, tenantId, canAccessSuperAdmin } = useAuth();
    const preferences = loadComandasPreferences();

    const [comandas, setComandas] = useState<Comanda[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | ComandaStatus>(preferences.filterStatus);
    const [searchTerm, setSearchTerm] = useState(preferences.searchTerm);
    const [dateFrom, setDateFrom] = useState(preferences.dateFrom);
    const [dateTo, setDateTo] = useState(preferences.dateTo);
    const [quickRange, setQuickRange] = useState<QuickRange>(preferences.quickRange);
    const [sortField, setSortField] = useState<SortField>(preferences.sortField);
    const [sortDirection, setSortDirection] = useState<SortDirection>(preferences.sortDirection);
    const [staffFilter, setStaffFilter] = useState(preferences.staffFilter);
    const [minTotal, setMinTotal] = useState(preferences.minTotal);
    const [maxTotal, setMaxTotal] = useState(preferences.maxTotal);
    const [consumptionType, setConsumptionType] = useState<ConsumptionType>(preferences.consumptionType);
    const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(preferences.advancedFiltersOpen);
    const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null);
    const [selectedOpenComandaIds, setSelectedOpenComandaIds] = useState<string[]>([]);
    const [bulkCloseModalOpen, setBulkCloseModalOpen] = useState(false);
    const [bulkClosing, setBulkClosing] = useState(false);
    const [bulkClosureNote, setBulkClosureNote] = useState('');
    const [bulkLegacyReferenceMonth, setBulkLegacyReferenceMonth] = useState(getDefaultLegacyReferenceMonth);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const [deleteComanda, setDeleteComanda] = useState<Comanda | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelReasonOther, setCancelReasonOther] = useState('');

    const fetchData = useCallback(async () => {
        if (!tenantId && !canAccessSuperAdmin) {
            setComandas([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug || DEFAULT_APP_SLUG, 'comandas', ['barber']);
            const client = getScopedClient(currentAppSlug);
            const resolvedTenantId = canAccessSuperAdmin
                ? null
                : requireTenantContext({
                    tenantId,
                    appSlug: currentAppSlug,
                    schema,
                    table: 'comandas',
                    operation: 'load comandas',
                }).tenantId;

            let query = client
                .from('comandas')
                .select('*')
                .order('created_at', { ascending: false });

            if (resolvedTenantId) {
                query = query.eq('tenant_id', resolvedTenantId);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                setComandas([]);
                return;
            }

            const comandasRows = data as Array<Comanda & { staff_id?: string | null }>;
            const comandaIds = comandasRows.map((comanda) => comanda.id);
            const appointmentIds = Array.from(new Set(
                comandasRows
                    .map((comanda) => comanda.appointment_id)
                    .filter((appointmentId): appointmentId is string => Boolean(appointmentId)),
            ));
            const clientIds = Array.from(new Set(
                comandasRows
                    .map((comanda) => comanda.client_id)
                    .filter((clientId): clientId is string => Boolean(clientId)),
            ));

            const { data: itemsData, error: itemsError } = await client
                .from('comanda_items')
                .select('id, comanda_id, staff_id, product_name, quantity, unit_price, product_id, service_id')
                .in('comanda_id', comandaIds);

            if (itemsError) throw itemsError;

            const itemRows = (itemsData || []) as ComandaItemRow[];

            const staffIds = Array.from(new Set(
                [
                    ...comandasRows.map((comanda) => comanda.staff_id ?? null),
                    ...itemRows.map((item) => item.staff_id ?? null),
                ].filter((staffId): staffId is string => Boolean(staffId)),
            ));

            const [clientsResult, staffResult, appointmentsResult] = await Promise.all([
                clientIds.length > 0
                    ? client.from('clients').select('id, name, avatar').in('id', clientIds)
                    : Promise.resolve({ data: [] as ClientLookup[], error: null }),
                staffIds.length > 0
                    ? client.from('staff').select('id, name').in('id', staffIds)
                    : Promise.resolve({ data: [] as StaffLookup[], error: null }),
                appointmentIds.length > 0
                    ? client.from('appointments').select('id, start_time').in('id', appointmentIds)
                    : Promise.resolve({ data: [] as AppointmentLookup[], error: null }),
            ]);

            if (clientsResult.error) throw clientsResult.error;
            if (staffResult.error) throw staffResult.error;
            if (appointmentsResult.error) {
                console.warn('Nao foi possivel enriquecer as comandas com agendamentos:', appointmentsResult.error);
            }

            const clientsById = ((clientsResult.data || []) as ClientLookup[]).reduce<Record<string, ClientLookup>>((acc, clientRow) => {
                acc[clientRow.id] = clientRow;
                return acc;
            }, {});

            const staffById = ((staffResult.data || []) as StaffLookup[]).reduce<Record<string, StaffLookup>>((acc, staffRow) => {
                acc[staffRow.id] = staffRow;
                return acc;
            }, {});

            const appointmentsById = (((appointmentsResult.error ? [] : appointmentsResult.data) || []) as AppointmentLookup[]).reduce<Record<string, AppointmentLookup>>((acc, appointmentRow) => {
                acc[appointmentRow.id] = appointmentRow;
                return acc;
            }, {});

            const itemsByComanda = itemRows.reduce<Record<string, ComandaItem[]>>((acc, item) => {
                if (!acc[item.comanda_id]) acc[item.comanda_id] = [];
                acc[item.comanda_id].push({
                    id: item.id,
                    staff_id: item.staff_id ?? null,
                    product_name: item.product_name,
                    quantity: Number(item.quantity) || 0,
                    unit_price: Number(item.unit_price) || 0,
                    product_id: item.product_id ?? null,
                    service_id: item.service_id ?? null,
                });
                return acc;
            }, {});

            const hydratedComandas = comandasRows.map((comanda) => {
                const mappedItems = itemsByComanda[comanda.id] || [];
                const mappedStaffIds = Array.from(new Set(
                    [comanda.staff_id, ...mappedItems.map((item) => item.staff_id)]
                        .filter((staffId): staffId is string => Boolean(staffId)),
                ));
                const mappedStaffNames = mappedStaffIds
                    .map((staffId) => staffById[staffId]?.name)
                    .filter((name): name is string => Boolean(name));

                return {
                    ...comanda,
                    clients: {
                        name: clientsById[comanda.client_id]?.name || 'Cliente sem nome',
                        avatar: clientsById[comanda.client_id]?.avatar || '',
                    },
                    staff: comanda.staff_id ? staffById[comanda.staff_id] || undefined : undefined,
                    appointment: comanda.appointment_id
                        ? { start_time: appointmentsById[comanda.appointment_id]?.start_time || null }
                        : undefined,
                    comanda_items: mappedItems,
                    staff_ids: mappedStaffIds,
                    staff_names: mappedStaffNames,
                };
            });

            setComandas(hydratedComandas);
        } catch (error) {
            console.error(error);
            setToast({ message: 'Erro ao carregar comandas.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [appSlug, canAccessSuperAdmin, schema, tenantId]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const nextPreferences: ComandasPreferences = {
            filterStatus,
            searchTerm,
            dateFrom,
            dateTo,
            quickRange,
            sortField,
            sortDirection,
            staffFilter,
            minTotal,
            maxTotal,
            consumptionType,
            advancedFiltersOpen,
        };

        window.localStorage.setItem(COMANDAS_PREFERENCES_KEY, JSON.stringify(nextPreferences));
    }, [
        advancedFiltersOpen,
        consumptionType,
        dateFrom,
        dateTo,
        filterStatus,
        maxTotal,
        minTotal,
        quickRange,
        searchTerm,
        sortDirection,
        sortField,
        staffFilter,
    ]);

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
            if (!dateFrom && !dateTo) {
                const customStartDate = new Date();
                customStartDate.setDate(customStartDate.getDate() - 6);
                setDateFrom(formatDateInputValue(customStartDate));
                setDateTo(formatDateInputValue(today));
            }
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const hasDateFilter = Boolean(dateFrom || dateTo);
    const hasAdvancedFilters = Boolean(staffFilter || minTotal || maxTotal || consumptionType !== 'all');
    const hasAnyFilter = Boolean(searchTerm.trim() || filterStatus !== 'all' || hasDateFilter || hasAdvancedFilters);

    const openCountAll = comandas.filter((comanda) => comanda.status === 'open').length;
    const paidCountAll = comandas.filter((comanda) => comanda.status === 'paid').length;
    const cancelledCountAll = comandas.filter((comanda) => comanda.status === 'cancelled').length;

    const dateFilteredComandas = comandas.filter((comanda) => {
        const createdAt = new Date(comanda.created_at);
        if (Number.isNaN(createdAt.getTime())) return false;

        const startDate = parseDateInputValue(dateFrom);
        const endDate = parseDateInputValue(dateTo, true);

        if (startDate && createdAt < startDate) return false;
        if (endDate && createdAt > endDate) return false;

        return true;
    });

    const filteredComandas = dateFilteredComandas.filter((comanda) => {
        const normalizedSearchTerm = searchTerm.trim().toLowerCase();
        const matchesSearch = !normalizedSearchTerm
            || comanda.clients.name.toLowerCase().includes(normalizedSearchTerm)
            || comanda.id.toLowerCase().includes(normalizedSearchTerm)
            || comanda.staff_names.some((name) => name.toLowerCase().includes(normalizedSearchTerm));

        const matchesStatus = filterStatus === 'all' || comanda.status === filterStatus;
        const matchesStaff = !staffFilter || comanda.staff_ids.includes(staffFilter);
        const matchesMin = !minTotal || comanda.total >= Number(minTotal);
        const matchesMax = !maxTotal || comanda.total <= Number(maxTotal);

        const comandaConsumptionType = getConsumptionType(comanda);
        const matchesConsumption = consumptionType === 'all'
            || comandaConsumptionType === consumptionType
            || (consumptionType === 'service' && comandaConsumptionType === 'mixed')
            || (consumptionType === 'product' && comandaConsumptionType === 'mixed');

        return matchesSearch && matchesStatus && matchesStaff && matchesMin && matchesMax && matchesConsumption;
    });

    const sortedComandas = [...filteredComandas].sort((first, second) => {
        let comparison = 0;

        if (sortField === 'date') comparison = new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
        if (sortField === 'client') comparison = first.clients.name.localeCompare(second.clients.name, 'pt-BR', { sensitivity: 'base' });
        if (sortField === 'status') comparison = getStatusSortValue(first.status) - getStatusSortValue(second.status);
        if (sortField === 'total') comparison = first.total - second.total;
        if (comparison === 0) comparison = new Date(first.created_at).getTime() - new Date(second.created_at).getTime();

        return sortDirection === 'asc' ? comparison : comparison * -1;
    });

    useEffect(() => {
        if (sortedComandas.length === 0) {
            setSelectedComandaId(null);
            return;
        }

        if (!selectedComandaId || !sortedComandas.some((comanda) => comanda.id === selectedComandaId)) {
            const nextDefault = sortedComandas.find((comanda) => comanda.status === 'open') || sortedComandas[0];
            setSelectedComandaId(nextDefault.id);
        }
    }, [selectedComandaId, sortedComandas]);

    useEffect(() => {
        setSelectedOpenComandaIds((current) =>
            current.filter((id) => comandas.some((comanda) => comanda.id === id && comanda.status === 'open')),
        );
    }, [comandas]);

    const selectedComanda = sortedComandas.find((comanda) => comanda.id === selectedComandaId) || null;
    const openComandasInView = sortedComandas.filter((comanda) => comanda.status === 'open');
    const allOpenInViewSelected = openComandasInView.length > 0
        && openComandasInView.every((comanda) => selectedOpenComandaIds.includes(comanda.id));

    const tabs = [
        { key: 'all' as const, label: STATUS_LABELS.all, count: comandas.length },
        { key: 'open' as const, label: STATUS_LABELS.open, count: openCountAll },
        { key: 'paid' as const, label: STATUS_LABELS.paid, count: paidCountAll },
        { key: 'cancelled' as const, label: STATUS_LABELS.cancelled, count: cancelledCountAll },
    ];

    const openCount = dateFilteredComandas.filter((comanda) => comanda.status === 'open').length;
    const finalizedToday = comandas.filter((comanda) => {
        if (comanda.status !== 'paid') return false;
        const createdAt = new Date(comanda.created_at);
        const today = new Date();
        return createdAt.getDate() === today.getDate()
            && createdAt.getMonth() === today.getMonth()
            && createdAt.getFullYear() === today.getFullYear();
    }).length;

    const toggleOpenComandaSelection = (comandaId: string) => {
        setSelectedOpenComandaIds((current) =>
            current.includes(comandaId)
                ? current.filter((id) => id !== comandaId)
                : [...current, comandaId],
        );
    };

    const toggleSelectAllOpenInView = () => {
        if (allOpenInViewSelected) {
            setSelectedOpenComandaIds((current) =>
                current.filter((id) => !openComandasInView.some((comanda) => comanda.id === id)),
            );
            return;
        }

        setSelectedOpenComandaIds((current) => Array.from(new Set([
            ...current,
            ...openComandasInView.map((comanda) => comanda.id),
        ])));
    };

    const handleBulkClose = async () => {
        if (selectedOpenComandaIds.length === 0) {
            setToast({ message: 'Selecione pelo menos uma comanda aberta.', type: 'info' });
            return;
        }

        if (!bulkLegacyReferenceMonth) {
            setToast({ message: 'Informe o mes de referencia para a baixa administrativa.', type: 'info' });
            return;
        }

        setBulkClosing(true);
        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug || DEFAULT_APP_SLUG, 'comandas', ['barber']);
            const resolvedTenantId = canAccessSuperAdmin
                ? null
                : requireTenantContext({
                    tenantId,
                    appSlug: currentAppSlug,
                    schema,
                    table: 'comandas',
                    operation: 'bulk close comandas',
                }).tenantId;

            const { data, error } = await supabase.rpc('bulk_close_comandas_admin', {
                p_comanda_ids: selectedOpenComandaIds,
                p_tenant_id: resolvedTenantId,
                p_closure_note: bulkClosureNote.trim() || null,
                p_legacy_reference_month: `${bulkLegacyReferenceMonth}-01`,
            });

            if (error) throw error;

            const updatedCount = Number((data as { updated_count?: number } | null)?.updated_count || selectedOpenComandaIds.length);

            setToast({
                message: `${updatedCount} comanda(s) baixada(s) em modo administrativo, sem impacto financeiro ou nos creditos atuais.`,
                type: 'success',
            });
            setSelectedOpenComandaIds([]);
            setBulkCloseModalOpen(false);
            setBulkClosureNote('');
            setBulkLegacyReferenceMonth(getDefaultLegacyReferenceMonth());
            await fetchData();
        } catch (error: any) {
            console.error(error);
            setToast({ message: `Erro ao baixar comandas em massa: ${error.message}`, type: 'error' });
        } finally {
            setBulkClosing(false);
        }
    };
    const totalOpen = comandas.filter((comanda) => comanda.status === 'open').reduce((sum, comanda) => sum + comanda.total, 0);
    const avgTicket = filteredComandas.length > 0
        ? filteredComandas.reduce((sum, comanda) => sum + comanda.total, 0) / filteredComandas.length
        : 0;
    const criticalComandas = filteredComandas.filter((comanda) => getComandaAttention(comanda)?.level === 'critical').length;
    const attentionComandas = filteredComandas.filter((comanda) => Boolean(getComandaAttention(comanda))).length;

    const staffOptions = Array.from(new Map<string, { id: string; name: string }>(
        comandas
            .flatMap((comanda) => comanda.staff_ids.map((staffId, index) => ({
                id: staffId,
                name: comanda.staff_names[index] || 'Profissional',
            })))
            .map((staff) => [staff.id, staff]),
    ).values()).sort((first, second) => first.name.localeCompare(second.name, 'pt-BR', { sensitivity: 'base' }));

    const dateFilterDescription = !hasDateFilter
        ? 'Periodo completo'
        : dateFrom && dateTo
            ? `${formatDateLabel(`${dateFrom}T00:00:00`)} ate ${formatDateLabel(`${dateTo}T00:00:00`)}`
            : dateFrom
                ? `A partir de ${formatDateLabel(`${dateFrom}T00:00:00`)}`
                : `Ate ${formatDateLabel(`${dateTo}T00:00:00`)}`;

    const clearAllFilters = () => {
        setFilterStatus('all');
        setSearchTerm('');
        setStaffFilter('');
        setMinTotal('');
        setMaxTotal('');
        setConsumptionType('all');
        setSortField('date');
        setSortDirection('desc');
        applyQuickRange('today');
    };

    const generateCSV = () => {
        const headers = ['Codigo', 'Cliente', 'Consumo principal', 'Total', 'Status', 'Profissionais', 'Abertura'];
        const rows = sortedComandas.map((comanda) => {
            const summary = getConsumptionSummary(comanda);
            return [
                getDisplayId(comanda.id).toString(),
                comanda.clients.name,
                summary.title,
                comanda.total.toFixed(2).replace('.', ','),
                STATUS_LABELS[comanda.status],
                comanda.staff_names.join(' / ') || 'Sem profissional',
                `${formatDateLabel(comanda.created_at)} ${formatTimeLabel(comanda.created_at)}`,
            ];
        });

        const csvContent = `data:text/csv;charset=utf-8,${[headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n')}`;
        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csvContent));
        link.setAttribute('download', `comandas_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const copyToClipboard = async () => {
        const headers = ['Codigo', 'Cliente', 'Consumo', 'Total', 'Status', 'Abertura'];
        const rows = sortedComandas.map((comanda) => {
            const summary = getConsumptionSummary(comanda);
            return [
                getDisplayId(comanda.id).toString(),
                comanda.clients.name,
                summary.title,
                comanda.total.toFixed(2).replace('.', ','),
                STATUS_LABELS[comanda.status],
                `${formatDateLabel(comanda.created_at)} ${formatTimeLabel(comanda.created_at)}`,
            ];
        });

        try {
            await navigator.clipboard.writeText([headers.join('\t'), ...rows.map((row) => row.join('\t'))].join('\n'));
            setToast({ message: 'Listagem copiada para colar no Excel ou Sheets.', type: 'success' });
        } catch (error) {
            console.error(error);
            setToast({ message: 'Nao foi possivel copiar os dados.', type: 'error' });
        }
    };

    const handlePrint = (comanda: Comanda) => {
        const printWindow = window.open('', '_blank', 'width=420,height=640');
        if (!printWindow) return;

        const itemsHtml = comanda.comanda_items
            .map((item) => `<li>${item.product_name} x${item.quantity} - ${formatCurrency(item.unit_price * item.quantity)}</li>`)
            .join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Comanda #${getDisplayId(comanda.id)}</title>
                    <style>
                        body { font-family: Segoe UI, sans-serif; padding: 24px; color: #111827; }
                        h1 { font-size: 20px; margin-bottom: 16px; }
                        .line { margin: 8px 0; font-size: 13px; }
                        ul { padding-left: 18px; margin: 16px 0; }
                        li { margin-bottom: 6px; font-size: 13px; }
                        .total { margin-top: 18px; font-size: 22px; font-weight: 700; }
                    </style>
                </head>
                <body>
                    <h1>Comanda #${getDisplayId(comanda.id)}</h1>
                    <div class="line"><strong>Cliente:</strong> ${comanda.clients.name}</div>
                    <div class="line"><strong>Status:</strong> ${STATUS_LABELS[comanda.status]}</div>
                    <div class="line"><strong>Abertura:</strong> ${formatDateLabel(comanda.created_at)} ${formatTimeLabel(comanda.created_at)}</div>
                    <div class="line"><strong>Profissionais:</strong> ${comanda.staff_names.join(' / ') || 'Sem profissional'}</div>
                    <ul>${itemsHtml}</ul>
                    <div class="total">Total: ${formatCurrency(comanda.total)}</div>
                </body>
            </html>
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

        setDeleting(true);
        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug || DEFAULT_APP_SLUG, 'comandas', ['barber']);
            const client = getScopedClient(currentAppSlug);
            const resolvedTenantId = canAccessSuperAdmin
                ? null
                : requireTenantContext({
                    tenantId,
                    appSlug: currentAppSlug,
                    schema,
                    table: 'comandas',
                    operation: 'cancel comanda',
                }).tenantId;

            let usedFallback = false;
            let cancelQuery = client.from('comandas').update({
                status: 'cancelled',
                cancellation_reason: reason,
            }).eq('id', comanda.id);

            if (resolvedTenantId) cancelQuery = cancelQuery.eq('tenant_id', resolvedTenantId);

            let { error } = await cancelQuery;

            if (error && `${error.message}`.toLowerCase().includes('cancellation_reason')) {
                let fallbackQuery = client.from('comandas').update({ status: 'cancelled' }).eq('id', comanda.id);
                if (resolvedTenantId) fallbackQuery = fallbackQuery.eq('tenant_id', resolvedTenantId);

                const fallbackResult = await fallbackQuery;
                error = fallbackResult.error;
                if (!error) {
                    usedFallback = true;
                    setToast({ message: 'Comanda cancelada, mas o motivo nao foi salvo no banco atual.', type: 'info' });
                }
            }

            if (error) throw error;

            if (!usedFallback) setToast({ message: 'Comanda cancelada com sucesso.', type: 'success' });

            setDeleteComanda(null);
            setCancelReason('');
            setCancelReasonOther('');
            await fetchData();
        } catch (error: any) {
            console.error(error);
            setToast({ message: `Erro ao cancelar comanda: ${error.message}`, type: 'error' });
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <section className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.14),_transparent_32%),linear-gradient(135deg,_rgba(15,23,42,0.04),_rgba(15,23,42,0.01))] p-6 shadow-sm shadow-slate-900/5 dark:border-white/8 dark:bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_32%),linear-gradient(135deg,_rgba(15,23,42,0.92),_rgba(15,23,42,0.78))]">
                <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-slate-600 dark:bg-white/5 dark:text-slate-300">
                            <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                            Operacao de comandas
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-4xl">Gestao de Comandas</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Centralize abertura, consulta e fechamento sem sair da tela. O foco agora esta em triagem rapida, leitura operacional e decisao de caixa.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
                        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/8 dark:bg-white/5">
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Acoes principais</p>
                            <div className="mt-4 flex flex-col gap-2">
                                <Button onClick={() => navigate('/checkout?mode=comanda')} leftIcon="add_circle" className="w-full justify-center">
                                    Abrir Comanda
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => navigate('/checkout?mode=pdv')}
                                    leftIcon="point_of_sale"
                                    className="w-full justify-center"
                                    title="Fluxo atual de checkout para fechamento ou venda imediata"
                                >
                                    Ir para Checkout / PDV
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/8 dark:bg-white/5">
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Apoio rapido</p>
                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <Button variant="secondary" size="sm" leftIcon="file_download" onClick={generateCSV} className="justify-center">CSV</Button>
                                <Button variant="secondary" size="sm" leftIcon="content_copy" onClick={copyToClipboard} className="justify-center">Sheets</Button>
                                <div className="col-span-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                                    {criticalComandas > 0
                                        ? `${criticalComandas} comanda(s) aberta(s) exigem atencao imediata.`
                                        : `${attentionComandas} comanda(s) com sinais de acompanhamento no periodo filtrado.`}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                <KpiCard title="Comandas abertas" helper="Fila operacional em aberto" value={loading ? '...' : String(openCount).padStart(2, '0')} icon="schedule" accentClassName="bg-amber-400" />
                <KpiCard title="Finalizadas hoje" helper="Fechamentos concluido no dia" value={loading ? '...' : String(finalizedToday).padStart(2, '0')} icon="task_alt" accentClassName="bg-emerald-400" />
                <KpiCard title="Total em aberto" helper="Valor pendente de cobranca" value={loading ? '...' : formatCurrency(totalOpen)} icon="payments" accentClassName="bg-sky-400" />
                <KpiCard title="Ticket medio" helper="Media da visao atual" value={loading ? '...' : formatCurrency(avgTicket)} icon="monitoring" accentClassName="bg-fuchsia-400" />
            </section>

            <section className="rounded-[26px] border border-slate-200/70 bg-white/90 shadow-sm shadow-slate-900/5 dark:border-white/8 dark:bg-[#111827]">
                <div className="border-b border-slate-200/70 px-5 py-5 dark:border-white/8">
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-wrap gap-2">
                                {tabs.map((tab) => {
                                    const isActive = filterStatus === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setFilterStatus(tab.key)}
                                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition-all ${isActive ? 'border-amber-400/60 bg-amber-500/15 text-amber-100 shadow-[0_10px_30px_rgba(245,158,11,0.12)]' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white'}`}
                                        >
                                            <span>{tab.label}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-[11px] ${isActive ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/8 dark:text-slate-300'}`}>
                                                {tab.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] xl:min-w-[520px]">
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        placeholder="Buscar cliente, codigo ou profissional"
                                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="secondary" onClick={() => setAdvancedFiltersOpen((current) => !current)} leftIcon={advancedFiltersOpen ? 'expand_less' : 'tune'} className="justify-center">
                                        Filtros
                                    </Button>
                                    <Button variant="ghost" onClick={clearAllFilters} disabled={!hasAnyFilter} leftIcon="ink_eraser" className="justify-center rounded-2xl border border-slate-200 dark:border-white/10">
                                        Limpar
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { key: 'today' as const, label: 'Hoje' },
                                    { key: '7d' as const, label: 'Ultimos 7 dias' },
                                    { key: '30d' as const, label: 'Ultimos 30 dias' },
                                    { key: 'custom' as const, label: 'Personalizado' },
                                    { key: 'all' as const, label: 'Sem periodo' },
                                ].map((range) => (
                                    <button
                                        key={range.key}
                                        type="button"
                                        onClick={() => applyQuickRange(range.key)}
                                        className={`rounded-full border px-3 py-2 text-xs font-bold transition ${quickRange === range.key ? 'border-sky-400/50 bg-sky-500/15 text-sky-100' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white'}`}
                                    >
                                        {range.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-semibold">Periodo:</span>
                                <span>{dateFilterDescription}</span>
                                {attentionComandas > 0 && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-200">{attentionComandas} em acompanhamento</span>}
                            </div>
                        </div>

                        {advancedFiltersOpen && (
                            <div className="grid gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/8 dark:bg-white/[0.03] md:grid-cols-2 xl:grid-cols-5">
                                <div className="space-y-1 xl:col-span-2">
                                    <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Periodo personalizado</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <DatePickerInput
                                            value={dateFrom}
                                            onChange={(event) => {
                                                setQuickRange('custom');
                                                setDateFrom(event.target.value);
                                            }}
                                            max={dateTo || undefined}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                                            containerClassName="w-full"
                                        />
                                        <DatePickerInput
                                            value={dateTo}
                                            onChange={(event) => {
                                                setQuickRange('custom');
                                                setDateTo(event.target.value);
                                            }}
                                            min={dateFrom || undefined}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                                            containerClassName="w-full"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Profissional</label>
                                    <select value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]">
                                        <option value="">Todos</option>
                                        {staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Faixa de valor</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="number" min="0" step="0.01" value={minTotal} onChange={(event) => setMinTotal(event.target.value)} placeholder="Min" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]" />
                                        <input type="number" min="0" step="0.01" value={maxTotal} onChange={(event) => setMaxTotal(event.target.value)} placeholder="Max" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]" />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Tipo de consumo</label>
                                    <select value={consumptionType} onChange={(event) => setConsumptionType(event.target.value as ConsumptionType)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]">
                                        <option value="all">Todos</option>
                                        <option value="service">Servico</option>
                                        <option value="product">Produto</option>
                                        <option value="mixed">Misto</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                                {filterStatus !== 'all' && <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 dark:border-white/10 dark:bg-white/5">Status: {STATUS_LABELS[filterStatus]}</span>}
                                {staffFilter && <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 dark:border-white/10 dark:bg-white/5">Profissional filtrado</span>}
                                {consumptionType !== 'all' && <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 dark:border-white/10 dark:bg-white/5">Consumo: {consumptionType === 'service' ? 'Servico' : consumptionType === 'product' ? 'Produto' : 'Misto'}</span>}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]">
                                    <option value="date">Ordenar por data</option>
                                    <option value="client">Ordenar por cliente</option>
                                    <option value="status">Ordenar por status</option>
                                    <option value="total">Ordenar por total</option>
                                </select>
                                <button type="button" onClick={() => setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:text-slate-950 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-300 dark:hover:text-white" title={sortDirection === 'asc' ? 'Ordenacao crescente' : 'Ordenacao decrescente'}>
                                    <span className="material-symbols-outlined text-[18px]">{sortDirection === 'asc' ? 'south' : 'north'}</span>
                                    {sortDirection === 'asc' ? 'Crescente' : 'Decrescente'}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">Baixa administrativa em massa</p>
                                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                        Ideal para regularizar comandas abertas de clientes do Clube sem duplicar receita e sem consumir creditos do ciclo atual.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-amber-500/20 bg-white/70 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-white/5 dark:text-slate-200">
                                        {selectedOpenComandaIds.length} selecionada(s)
                                    </span>
                                    <Button variant="secondary" size="sm" onClick={toggleSelectAllOpenInView} leftIcon={allOpenInViewSelected ? 'check_box' : 'check_box_outline_blank'}>
                                        {allOpenInViewSelected ? 'Desmarcar abertas visiveis' : 'Selecionar abertas visiveis'}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedOpenComandaIds([])} disabled={selectedOpenComandaIds.length === 0} leftIcon="ink_eraser">
                                        Limpar
                                    </Button>
                                    <Button variant="warning" size="sm" onClick={() => setBulkCloseModalOpen(true)} disabled={selectedOpenComandaIds.length === 0} leftIcon="rule_settings">
                                        Baixar em massa
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="min-w-0 border-b border-slate-200/70 dark:border-white/8 xl:border-b-0 xl:border-r">
                        <div className="hidden grid-cols-[1.7fr_1.45fr_0.9fr_0.95fr_1.15fr] gap-4 border-b border-slate-200/70 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:border-white/8 dark:text-slate-400 lg:grid">
                            <span>Cliente</span>
                            <span>Consumo principal</span>
                            <span>Total</span>
                            <span>Status</span>
                            <span>Acoes</span>
                        </div>

                        <div className="divide-y divide-slate-200/70 dark:divide-white/8">
                            {loading ? (
                                <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Carregando comandas...</div>
                            ) : sortedComandas.length === 0 ? (
                                <div className="px-5 py-12 text-center">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nenhuma comanda encontrada.</p>
                                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Ajuste os filtros ou abra uma nova comanda para iniciar a operacao.</p>
                                </div>
                            ) : (
                                sortedComandas.map((comanda) => {
                                    const statusMeta = getStatusMeta(comanda.status);
                                    const attention = getComandaAttention(comanda);
                                    const summary = getConsumptionSummary(comanda);
                                    const isSelected = selectedComandaId === comanda.id;
                                    const isBulkSelected = selectedOpenComandaIds.includes(comanda.id);
                                    const settlementMeta = getSettlementMeta(comanda);

                                    return (
                                        <div
                                            key={comanda.id}
                                            className={`cursor-pointer px-5 py-4 transition ${isSelected ? 'bg-amber-500/[0.07] dark:bg-amber-500/[0.08]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'} ${isBulkSelected ? 'ring-1 ring-amber-500/30 ring-inset' : ''}`}
                                            onClick={() => setSelectedComandaId(comanda.id)}
                                        >
                                            <div className="grid gap-4 lg:grid-cols-[1.7fr_1.45fr_0.9fr_0.95fr_1.15fr] lg:items-center">
                                                <div className="min-w-0">
                                                    <div className="flex items-start gap-3">
                                                        {comanda.status === 'open' && (
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    toggleOpenComandaSelection(comanda.id);
                                                                }}
                                                                className="mt-1 inline-flex size-8 items-center justify-center rounded-xl border border-amber-500/20 bg-white text-amber-600 transition hover:bg-amber-500/10 dark:bg-white/5"
                                                                title={isBulkSelected ? 'Desmarcar comanda' : 'Selecionar comanda'}
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">
                                                                    {isBulkSelected ? 'check_box' : 'check_box_outline_blank'}
                                                                </span>
                                                            </button>
                                                        )}

                                                        <div className="relative shrink-0">
                                                            {comanda.clients.avatar ? (
                                                                <img src={comanda.clients.avatar} alt={comanda.clients.name} className="size-11 rounded-2xl border border-slate-200 object-cover dark:border-white/10" />
                                                            ) : (
                                                                <div className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm font-black text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                                                                    {comanda.clients.name.slice(0, 1).toUpperCase()}
                                                                </div>
                                                            )}
                                                            {attention && <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-slate-950 text-[11px] text-white dark:bg-white dark:text-slate-950">!</span>}
                                                        </div>

                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="truncate text-sm font-black text-slate-950 dark:text-white">{comanda.clients.name}</p>
                                                                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                                                                    #{getDisplayId(comanda.id)}
                                                                </span>
                                                            </div>
                                                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                                <span className="inline-flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                                                                    {formatDateLabel(comanda.created_at)} as {formatTimeLabel(comanda.created_at)}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[14px]">badge</span>
                                                                    {comanda.staff_names.join(' / ') || 'Sem profissional'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{summary.title}</p>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{summary.detail}</p>
                                                    {attention && (
                                                        <div className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${attention.className}`}>
                                                            <span className="material-symbols-outlined text-[14px]">{attention.icon}</span>
                                                            {attention.label}
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <p className="text-lg font-black tracking-tight text-slate-950 dark:text-white">{formatCurrency(comanda.total)}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{comanda.comanda_items.length} {comanda.comanda_items.length === 1 ? 'item' : 'itens'}</p>
                                                </div>

                                                <div>
                                                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] ${statusMeta.className}`}>
                                                        <span className={`size-2 rounded-full ${statusMeta.dotClassName}`} />
                                                        {statusMeta.label}
                                                    </span>
                                                    {settlementMeta && (
                                                        <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${settlementMeta.className}`}>
                                                            {settlementMeta.label}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    {comanda.status === 'open' ? (
                                                        <Button
                                                            size="sm"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                navigate(`/checkout/${comanda.id}`);
                                                            }}
                                                            leftIcon="point_of_sale"
                                                            title="Ir para o fechamento desta comanda"
                                                        >
                                                            Fechar
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setSelectedComandaId(comanda.id);
                                                            }}
                                                            leftIcon="visibility"
                                                            title="Consultar detalhes"
                                                        >
                                                            Ver
                                                        </Button>
                                                    )}

                                                    <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedComandaId(comanda.id); }} className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:text-white" title="Abrir painel lateral">
                                                        <span className="material-symbols-outlined text-[18px]">dock_to_right</span>
                                                    </button>

                                                    <button type="button" onClick={(event) => { event.stopPropagation(); handlePrint(comanda); }} className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:text-white" title="Imprimir resumo da comanda">
                                                        <span className="material-symbols-outlined text-[18px]">print</span>
                                                    </button>

                                                    {comanda.status === 'open' && (
                                                        <button type="button" onClick={(event) => { event.stopPropagation(); setDeleteComanda(comanda); setCancelReason(''); setCancelReasonOther(''); }} className="inline-flex size-9 items-center justify-center rounded-xl border border-red-500/20 text-red-400 transition hover:bg-red-500/10 hover:text-red-300" title="Cancelar comanda">
                                                            <span className="material-symbols-outlined text-[18px]">block</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="flex flex-col gap-1 border-t border-slate-200/70 px-5 py-4 text-xs text-slate-500 dark:border-white/8 dark:text-slate-400 md:flex-row md:items-center md:justify-between">
                            <span>{sortedComandas.length} comandas na visao atual</span>
                            <span>{dateFilterDescription}</span>
                        </div>
                    </div>

                    <aside className="min-w-0">
                        {selectedComanda ? (
                            <div className="h-full p-5 xl:sticky xl:top-6">
                                <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/70 p-5 dark:border-white/8 dark:bg-white/[0.03]">
                                    {(() => {
                                        const settlementMeta = getSettlementMeta(selectedComanda);
                                        return settlementMeta ? (
                                            <div className={`mb-4 rounded-2xl border px-4 py-3 ${settlementMeta.className}`}>
                                                <p className="text-[11px] font-black uppercase tracking-[0.2em]">{settlementMeta.label}</p>
                                                <p className="mt-1 text-xs opacity-90">{settlementMeta.helper}</p>
                                                {selectedComanda.closure_note && (
                                                    <p className="mt-2 text-xs opacity-90">Obs.: {selectedComanda.closure_note}</p>
                                                )}
                                            </div>
                                        ) : null;
                                    })()}

                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Painel da comanda</p>
                                            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">#{getDisplayId(selectedComanda.id)}</h2>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedComanda.clients.name}</p>
                                        </div>
                                        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] ${getStatusMeta(selectedComanda.status).className}`}>
                                            <span className={`size-2 rounded-full ${getStatusMeta(selectedComanda.status).dotClassName}`} />
                                            {getStatusMeta(selectedComanda.status).label}
                                        </span>
                                    </div>

                                    {getComandaAttention(selectedComanda) && (
                                        <div className={`mt-4 rounded-2xl border px-4 py-3 ${getComandaAttention(selectedComanda)?.className}`}>
                                            <div className="flex items-start gap-3">
                                                <span className="material-symbols-outlined text-[18px]">{getComandaAttention(selectedComanda)?.icon}</span>
                                                <div>
                                                    <p className="text-sm font-black">{getComandaAttention(selectedComanda)?.label}</p>
                                                    <p className="mt-1 text-xs opacity-90">{getComandaAttention(selectedComanda)?.description}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-5 grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-slate-200/70 bg-white p-3 dark:border-white/8 dark:bg-[#0f172a]">
                                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Abertura da comanda</p>
                                            <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{formatDateLabel(selectedComanda.created_at)}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{formatTimeLabel(selectedComanda.created_at)}</p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200/70 bg-white p-3 dark:border-white/8 dark:bg-[#0f172a]">
                                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Data do agendamento</p>
                                            <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                                                {selectedComanda.appointment?.start_time ? formatDateLabel(selectedComanda.appointment.start_time) : 'Sem agendamento vinculado'}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {selectedComanda.appointment?.start_time ? formatTimeLabel(selectedComanda.appointment.start_time) : 'Atendimento sem origem na agenda'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 rounded-2xl border border-slate-200/70 bg-white p-3 dark:border-white/8 dark:bg-[#0f172a]">
                                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Profissional</p>
                                        <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{selectedComanda.staff_names.join(' / ') || 'Sem profissional'}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{selectedComanda.comanda_items.length} {selectedComanda.comanda_items.length === 1 ? 'item' : 'itens'}</p>
                                    </div>

                                    <div className="mt-5 rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-[#0f172a]">
                                        <div className="mb-3 flex items-center justify-between">
                                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Consumo</p>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {getConsumptionType(selectedComanda) === 'mixed' ? 'Misto' : getConsumptionType(selectedComanda) === 'service' ? 'Servicos' : getConsumptionType(selectedComanda) === 'product' ? 'Produtos' : 'Nao identificado'}
                                            </span>
                                        </div>

                                        <div className="space-y-3">
                                            {selectedComanda.comanda_items.length > 0 ? selectedComanda.comanda_items.map((item) => (
                                                <div key={item.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/70 p-3 dark:border-white/8">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{item.product_name}</p>
                                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.quantity} x {formatCurrency(item.unit_price)}</p>
                                                    </div>
                                                    <p className="text-sm font-black text-slate-950 dark:text-white">{formatCurrency(item.unit_price * item.quantity)}</p>
                                                </div>
                                            )) : (
                                                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">Esta comanda ainda nao possui itens lancados.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-5 rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-[#0f172a]">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total da comanda</p>
                                                <p className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{formatCurrency(selectedComanda.total)}</p>
                                            </div>
                                            <span className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-white/10 dark:text-slate-400">
                                                {selectedComanda.status === 'open' ? 'Aguardando fechamento' : 'Fluxo concluido'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                                        {selectedComanda.status === 'open' ? (
                                            <Button onClick={() => navigate(`/checkout/${selectedComanda.id}`)} leftIcon="point_of_sale" className="justify-center">Fechar comanda</Button>
                                        ) : (
                                            <Button variant="secondary" onClick={() => navigate(`/checkout/${selectedComanda.id}`)} leftIcon="edit" className="justify-center">Reabrir edicao</Button>
                                        )}
                                        <Button variant="secondary" onClick={() => handlePrint(selectedComanda)} leftIcon="print" className="justify-center">Imprimir</Button>
                                    </div>

                                    <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4 text-xs text-slate-500 dark:border-white/8 dark:bg-[#0f172a] dark:text-slate-400">
                                        <p className="font-semibold text-slate-700 dark:text-slate-200">Evolucao sugerida</p>
                                        <p className="mt-1 leading-5">Este painel lateral ja simula a futura experiencia de drawer: consulta sem navegar, contexto preservado e atalho direto para fechamento.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500 dark:text-slate-400">Selecione uma comanda para ver os detalhes laterais.</div>
                        )}
                    </aside>
                </div>
            </section>

            <Modal
                isOpen={bulkCloseModalOpen}
                onClose={() => {
                    if (bulkClosing) return;
                    setBulkCloseModalOpen(false);
                }}
                title="Baixa Administrativa em Massa"
                maxWidth="md"
            >
                <div className="space-y-4">
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                        <p className="font-black uppercase tracking-[0.18em] text-xs">Sem impacto financeiro</p>
                        <p className="mt-2 text-xs leading-5">
                            Esse fechamento em massa marca as comandas selecionadas como pagas em modo administrativo, sem gerar nova receita e sem consumir creditos atuais do Clube.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedOpenComandaIds.length} comanda(s) aberta(s) selecionada(s)</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use esse fluxo para regularizacao de legado ou fechamento operacional de assinantes ja recorrentes.</p>
                    </div>

                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Mes de referencia</label>
                        <input
                            type="month"
                            value={bulkLegacyReferenceMonth}
                            onChange={(event) => setBulkLegacyReferenceMonth(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Observacao interna</label>
                        <textarea
                            value={bulkClosureNote}
                            onChange={(event) => setBulkClosureNote(event.target.value)}
                            rows={4}
                            placeholder="Ex.: regularizacao das comandas abertas de assinantes recorrentes do mes anterior"
                            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                        />
                    </div>

                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setBulkCloseModalOpen(false)} disabled={bulkClosing} className="flex-1 justify-center">
                            Voltar
                        </Button>
                        <Button variant="warning" onClick={handleBulkClose} disabled={bulkClosing || selectedOpenComandaIds.length === 0} leftIcon={bulkClosing ? 'hourglass_empty' : 'rule_settings'} className="flex-1 justify-center">
                            {bulkClosing ? 'Baixando...' : 'Confirmar baixa'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={!!deleteComanda}
                onClose={() => {
                    setDeleteComanda(null);
                    setCancelReason('');
                    setCancelReasonOther('');
                }}
                title="Cancelar Comanda"
                maxWidth="sm"
            >
                {deleteComanda && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
                            <span className="material-symbols-outlined text-2xl">warning</span>
                            <div>
                                <p className="text-sm font-bold">Atencao operacional</p>
                                <p className="text-xs">A comanda sera marcada como cancelada e deixara de seguir para fechamento.</p>
                            </div>
                        </div>

                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Confirma o cancelamento da comanda <strong className="text-slate-900 dark:text-white">#{getDisplayId(deleteComanda.id)}</strong> de{' '}
                            <strong className="text-slate-900 dark:text-white">{deleteComanda.clients.name}</strong> no valor de{' '}
                            <strong className="text-slate-900 dark:text-white">{formatCurrency(deleteComanda.total)}</strong>?
                        </p>

                        <div>
                            <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Motivo do cancelamento</label>
                            <select value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]">
                                <option value="">Selecione um motivo</option>
                                {CANCEL_REASON_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                                <option value={CANCEL_REASON_OTHER}>Outro motivo</option>
                            </select>
                            {cancelReason === CANCEL_REASON_OTHER && (
                                <textarea value={cancelReasonOther} onChange={(event) => setCancelReasonOther(event.target.value)} rows={3} placeholder="Descreva o motivo" className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]" />
                            )}
                        </div>

                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => { setDeleteComanda(null); setCancelReason(''); setCancelReasonOther(''); }} disabled={deleting} className="flex-1 justify-center">
                                Voltar
                            </Button>
                            <Button variant="danger" onClick={() => handleDelete(deleteComanda)} disabled={deleting || !(cancelReason === CANCEL_REASON_OTHER ? cancelReasonOther.trim() : cancelReason.trim())} leftIcon={deleting ? 'hourglass_empty' : 'block'} className="flex-1 justify-center">
                                {deleting ? 'Cancelando...' : 'Confirmar cancelamento'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Comandas;
