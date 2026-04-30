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
import { DEFAULT_APP_SLUG } from '../src/lib/supabase/schemas';
import { fetchChefClubCreditsByClients, type ChefClubClientCredits } from '../src/lib/supabase/chefClub';
import ComandaListItem from '../components/ComandaListItem';
import ComandaSidebar from '../components/ComandaSidebar';

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
    chefClubInfo?: ChefClubClientCredits | null;
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

interface ComandasPreferences {
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

            let query = client.from('comandas').select('*').order('created_at', { ascending: false });
            if (resolvedTenantId) query = query.eq('tenant_id', resolvedTenantId);

            const { data, error } = await query;
            if (error) throw error;

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

            const { data: itemsData, error: itemsError } = await client
                .from('comanda_items')
                .select('id, comanda_id, staff_id, product_name, quantity, unit_price, product_id, service_id')
                .in('comanda_id', comandaIds);

            if (itemsError) throw itemsError;
            const itemRows = (itemsData || []) as ComandaItemRow[];

            const staffIds = Array.from(new Set([
                ...comandasRows.map((c) => c.staff_id ?? null),
                ...itemRows.map((i) => i.staff_id ?? null),
            ].filter((id): id is string => Boolean(id))));

            const [clientsResult, staffResult, appointmentsResult] = await Promise.all([
                clientIds.length > 0 ? client.from('clients').select('id, name, avatar').in('id', clientIds) : Promise.resolve({ data: [] as ClientLookup[], error: null }),
                staffIds.length > 0 ? client.from('staff').select('id, name').in('id', staffIds) : Promise.resolve({ data: [] as StaffLookup[], error: null }),
                appointmentIds.length > 0 ? client.from('appointments').select('id, start_time').in('id', appointmentIds) : Promise.resolve({ data: [] as AppointmentLookup[], error: null }),
            ]);

            const clientsById = ((clientsResult.data || []) as ClientLookup[]).reduce((acc, c) => { acc[c.id] = c; return acc; }, {} as Record<string, ClientLookup>);
            const staffById = ((staffResult.data || []) as StaffLookup[]).reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<string, StaffLookup>);
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
                const mappedStaffNames = mappedStaffIds.map((id) => staffById[id]?.name).filter((name): name is string => Boolean(name));

                return {
                    ...comanda,
                    clients: {
                        name: clientsById[comanda.client_id]?.name || 'Cliente sem nome',
                        avatar: clientsById[comanda.client_id]?.avatar || '',
                    },
                    staff: comanda.staff_id ? staffById[comanda.staff_id] : undefined,
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
                } catch {
                    console.warn('Erro ao carregar info do Clube');
                }
            }

            setComandas(hydratedComandas);
        } catch (error) {
            console.error(error);
            setToast({ message: 'Erro ao carregar comandas.', type: 'error' });
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

        const currentAppSlug = ensureAppSupportsModule(appSlug || DEFAULT_APP_SLUG, 'comandas', ['barber']);

        const unblockComandas = async () => {
            try {
                const unblockClient = getScopedClient(currentAppSlug);
                const { error } = await unblockClient
                    .from('comandas')
                    .update({ status: 'open' })
                    .in('id', commandsToUnblock)
                    .eq('tenant_id', tenantId);

                if (error) {
                    console.warn('Erro ao desbloquear comandas:', error);
                    return;
                }

                setComandas((prev) =>
                    prev.map((c) =>
                        commandsToUnblock.includes(c.id) ? { ...c, status: 'open' as const } : c
                    )
                );
            } catch (err) {
                console.warn('Erro ao desbloquear comandas:', err);
            }
        };

        unblockComandas();
    }, [comandas, tenantId, appSlug]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const nextPrefs = { filterStatus, searchTerm, dateFrom, dateTo, quickRange, sortField, sortDirection, staffFilter, minTotal, maxTotal, consumptionType };
        window.localStorage.setItem(COMANDAS_PREFERENCES_KEY, JSON.stringify(nextPrefs));
    }, [filterStatus, searchTerm, dateFrom, dateTo, quickRange, sortField, sortDirection, staffFilter, minTotal, maxTotal, consumptionType]);

    const applyQuickRange = (range: QuickRange) => {
        const today = new Date();
        if (range === 'all') {
            setQuickRange('all');
            setDateFrom('');
            setDateTo('');
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

    const hasAdvancedFilters = Boolean(staffFilter || minTotal || maxTotal || consumptionType !== 'all');
    const hasAnyFilter = Boolean(searchTerm.trim() || filterStatus !== 'all' || hasAdvancedFilters);

    const openCountAll = comandas.filter((c) => c.status === 'open').length;
    const paidCountAll = comandas.filter((c) => c.status === 'paid').length;
    const cancelledCountAll = comandas.filter((c) => c.status === 'cancelled').length;
    const blockedCountAll = comandas.filter((c) => c.status === 'blocked').length;

    const dateFilteredComandas = comandas.filter((c) => {
        const createdAt = new Date(c.created_at);
        if (Number.isNaN(createdAt.getTime())) return false;
        const startDate = parseDateInputValue(dateFrom);
        const endDate = parseDateInputValue(dateTo, true);
        if (startDate && createdAt < startDate) return false;
        if (endDate && createdAt > endDate) return false;
        return true;
    });

    const filteredComandas = dateFilteredComandas.filter((c) => {
        const normalizedSearchTerm = searchTerm.trim().toLowerCase();
        const matchesSearch = !normalizedSearchTerm
            || c.clients.name.toLowerCase().includes(normalizedSearchTerm)
            || c.id.toLowerCase().includes(normalizedSearchTerm)
            || c.staff_names.some((name) => name.toLowerCase().includes(normalizedSearchTerm));
        const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
        const matchesStaff = !staffFilter || c.staff_ids.includes(staffFilter);
        const matchesMin = !minTotal || c.total >= Number(minTotal);
        const matchesMax = !maxTotal || c.total <= Number(maxTotal);
        const hasService = c.comanda_items.some((item) => item.service_id);
        const hasProduct = c.comanda_items.some((item) => item.product_id);
        const matchesConsumptionType =
            consumptionType === 'all' ||
            (consumptionType === 'service' && hasService && !hasProduct) ||
            (consumptionType === 'product' && hasProduct && !hasService) ||
            (consumptionType === 'mixed' && hasService && hasProduct);
        return matchesSearch && matchesStatus && matchesStaff && matchesMin && matchesMax && matchesConsumptionType;
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
        if (sortedComandas.length === 0) {
            setSelectedComandaId(null);
            return;
        }
        if (!selectedComandaId || !sortedComandas.some((c) => c.id === selectedComandaId)) {
            const nextDefault = sortedComandas.find((c) => c.status === 'open') || sortedComandas[0];
            setSelectedComandaId(nextDefault.id);
        }
    }, [selectedComandaId, sortedComandas]);

    useEffect(() => {
        setSelectedOpenComandaIds((current) => current.filter((id) => comandas.some((c) => c.id === id && c.status === 'open')));
    }, [comandas]);

    const selectedComanda = sortedComandas.find((c) => c.id === selectedComandaId) || null;
    const openComandasInView = sortedComandas.filter((c) => c.status === 'open');
    const allOpenInViewSelected = openComandasInView.length > 0 && openComandasInView.every((c) => selectedOpenComandaIds.includes(c.id));

    const tabs = [
        { key: 'all' as const, label: STATUS_LABELS.all, count: dateFilteredComandas.length },
        { key: 'blocked' as const, label: STATUS_LABELS.blocked, count: dateFilteredComandas.filter((c) => c.status === 'blocked').length },
        { key: 'open' as const, label: STATUS_LABELS.open, count: dateFilteredComandas.filter((c) => c.status === 'open').length },
        { key: 'paid' as const, label: STATUS_LABELS.paid, count: dateFilteredComandas.filter((c) => c.status === 'paid').length },
        { key: 'cancelled' as const, label: STATUS_LABELS.cancelled, count: dateFilteredComandas.filter((c) => c.status === 'cancelled').length },
    ];

    const openCount = dateFilteredComandas.filter((c) => c.status === 'open').length;
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

    const totalOpen = comandas.filter((c) => c.status === 'open').reduce((sum, c) => sum + c.total, 0);
    const avgTicket = filteredComandas.length > 0 ? filteredComandas.reduce((sum, c) => sum + c.total, 0) / filteredComandas.length : 0;

    const staffOptions = Array.from(new Map<string, { id: string; name: string }>(
        comandas.flatMap((c) => c.staff_ids.map((staffId, index) => ({ id: staffId, name: c.staff_names[index] || 'Profissional' })))
            .map((s) => [s.id, s] as [string, { id: string; name: string }])
            .values(),
    ).values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));

    const dateFilterDescription = !dateFrom && !dateTo
        ? 'Periodo completo'
        : dateFrom && dateTo
        ? `${formatDateLabel(`${dateFrom}T00:00:00`)} ate ${formatDateLabel(`${dateTo}T00:00:00`)}`
        : dateFrom ? `A partir de ${formatDateLabel(`${dateFrom}T00:00:00`)}` : `Ate ${formatDateLabel(`${dateTo}T00:00:00`)}`;

    const clearAllFilters = () => {
        setFilterStatus('all');
        setSearchTerm('');
        setStaffFilter('');
        setMinTotal('');
        setMaxTotal('');
        setConsumptionType('all');
        setSortField('date');
        setSortDirection('desc');
        setQuickRange('today');
        setDateFrom(formatDateInputValue(new Date()));
        setDateTo('');
    };

    const generateCSV = () => {
        const headers = ['Codigo', 'Cliente', 'Consumo', 'Total', 'Status', 'Abertura'];
        const rows = sortedComandas.map((c) => [getDisplayId(c.id), c.clients.name, getConsumptionSummary(c).title, c.total.toFixed(2).replace('.', ','), STATUS_LABELS[c.status], new Date(c.created_at).toLocaleString('pt-BR')]);
        const csvContent = `data:text/csv;charset=utf-8,${[headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')}`;
        const link = window.document.createElement('a');
        link.setAttribute('href', encodeURI(csvContent));
        link.setAttribute('download', `comandas_${new Date().toISOString().slice(0, 10)}.csv`);
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
    };

    const copyToClipboard = async () => {
        const headers = ['Codigo', 'Cliente', 'Consumo', 'Total', 'Status', 'Abertura'];
        const rows = sortedComandas.map((c) => [getDisplayId(c.id), c.clients.name, getConsumptionSummary(c).title, c.total.toFixed(2).replace('.', ','), STATUS_LABELS[c.status], new Date(c.created_at).toLocaleString('pt-BR')]);
        try {
            await navigator.clipboard.writeText([headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n'));
            setToast({ message: 'Copiado para Excel/Sheets', type: 'success' });
        } catch {
            setToast({ message: 'Erro ao copiar', type: 'error' });
        }
    };

    const handlePrint = (comanda: Comanda) => {
        const printWindow = window.open('', '_blank', 'width=420,height=640');
        if (!printWindow) return;
        const itemsHtml = comanda.comanda_items.map((item) => `<li>${item.product_name} x${item.quantity} - ${formatCurrency(item.unit_price * item.quantity)}</li>`).join('');
        printWindow.document.write(`
            <html><head><title>Comanda #${getDisplayId(comanda.id)}</title><style>body{font-family:Segoe UI,sans-serif;padding:24px;color:#111827}h1{font-size:20px;margin-bottom:16px}.line{margin:8px 0;font-size:13px}ul{padding-left:18px;margin:16px 0}li{margin-bottom:6px;font-size:13px}.total{margin-top:18px;font-size:22px;font-weight:700}</style></head>
            <body><h1>Comanda #${getDisplayId(comanda.id)}</h1><div class="line"><strong>Cliente:</strong> ${comanda.clients.name}</div><div class="line"><strong>Status:</strong> ${STATUS_LABELS[comanda.status]}</div><div class="line"><strong>Abertura:</strong> ${new Date(comanda.created_at).toLocaleString('pt-BR')}</div><div class="line"><strong>Profissionais:</strong> ${comanda.staff_names.join(' / ') || 'Sem profissional'}</div><ul>${itemsHtml}</ul><div class="total">Total: ${formatCurrency(comanda.total)}</div></body></html>
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
                'Esta comanda foi fechada (status: paga). Anulá-la pode afetar o financeiro e comissões.\n\nTem certeza que deseja anular?'
            );
            if (!confirmed) return;
        }

        const isHiddenFinancial = ['operational_error', 'test', 'duplicate'].includes(cancelReason);

        setDeleting(true);
        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug || DEFAULT_APP_SLUG, 'comandas', ['barber']);
            const client = getScopedClient(currentAppSlug);
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
                    if (!error) setToast({ message: 'Cancelada, mas campos de auditoria nao foram salvos.', type: 'info' });
                }
                if (error) throw error;
            }

            setToast({ message: 'Comanda anulada com sucesso.', type: 'success' });
            setDeleteComanda(null);
            setCancelReason('');
            setCancelReasonOther('');
            await fetchData();
        } catch (error: any) {
            console.error(error);
            setToast({ message: `Erro ao anular: ${error.message}`, type: 'error' });
        } finally {
            setDeleting(false);
        }
    };

    const handleBulkClose = async () => {
        if (selectedOpenComandaIds.length === 0) {
            setToast({ message: 'Selecione pelo menos uma comanda aberta.', type: 'info' });
            return;
        }
        if (bulkCloseType === 'admin' && !bulkLegacyReferenceMonth) {
            setToast({ message: 'Informe o mes de referencia.', type: 'info' });
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
                    ? `${updatedCount} comanda(s) baixada(s) com impacto financeiro`
                    : `${updatedCount} comanda(s) baixada(s) em modo administrativo`,
                type: 'success',
            });
            setSelectedOpenComandaIds([]);
            setBulkCloseModalOpen(false);
            setBulkClosureNote('');
            setBulkLegacyReferenceMonth(getDefaultLegacyReferenceMonth());
            await fetchData();
        } catch (error: any) {
            console.error(error);
            setToast({ message: `Erro ao baixar: ${error.message}`, type: 'error' });
        } finally {
            setBulkClosing(false);
        }
    };

    return (
        <div className="space-y-4 pb-20 animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <section className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-[#121826]">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white">Gestao de Comandas</h1>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sortedComandas.length} comanda(s) • {dateFilterDescription}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => navigate('/checkout?mode=comanda')} leftIcon="add">Abrir</Button>
                        <Button size="sm" variant="secondary" onClick={() => navigate('/checkout?mode=pdv')} leftIcon="point_of_sale">PDV</Button>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <KpiCard title="Abertas" value={loading ? '...' : String(openCount).padStart(2, '0')} helper="Em aberto" icon="schedule" accentClassName="bg-amber-400" />
                <KpiCard title="Hoje" value={loading ? '...' : String(finalizedToday).padStart(2, '0')} helper="Finalizadas" icon="task_alt" accentClassName="bg-emerald-400" />
                <KpiCard title="Total" value={loading ? '...' : formatCurrency(totalOpen)} helper="Pendente" icon="payments" accentClassName="bg-sky-400" />
                <KpiCard title="Ticket" value={loading ? '...' : formatCurrency(avgTicket)} helper="Media" icon="monitoring" accentClassName="bg-fuchsia-400" />
            </section>

            <section className="rounded-2xl border border-slate-200/70 bg-white dark:border-white/8 dark:bg-[#111827]">
                <div className="flex flex-col gap-3 p-3">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setFilterStatus(tab.key)}
                                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                                    filterStatus === tab.key
                                        ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
                                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-400'
                                }`}
                            >
                                {tab.label}
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filterStatus === tab.key ? 'bg-white/10 text-white' : 'bg-slate-100 dark:bg-white/5'}`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar cliente..."
                                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                            />
                        </div>
                        <button onClick={() => setFiltersModalOpen(true)} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-slate-300 dark:border-white/10 dark:text-slate-400">
                            <span className="material-symbols-outlined text-sm">tune</span>
                            Filtros
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
                            value={sortField}
                            onChange={(e) => setSortField(e.target.value as SortField)}
                            className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs dark:border-white/10 dark:bg-[#0f172a]"
                        >
                            <option value="date">Data</option>
                            <option value="client">Cliente</option>
                            <option value="total">Valor</option>
                        </select>
                        <button onClick={() => setSortDirection((d) => d === 'asc' ? 'desc' : 'asc')} className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-2 py-2 dark:border-white/10">
                            <span className="material-symbols-outlined text-sm">{sortDirection === 'asc' ? 'south' : 'north'}</span>
                        </button>
                    </div>

                    {selectedOpenComandaIds.length > 0 && (
                        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2">
                            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{selectedOpenComandaIds.length} selecionada(s)</span>
                            <button onClick={toggleSelectAllOpenInView} className="ml-auto text-xs text-amber-700 hover:underline dark:text-amber-300">
                                {allOpenInViewSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                            </button>
                            <Button size="sm" variant="warning" onClick={() => setBulkCloseModalOpen(true)}>Baixar em massa</Button>
                        </div>
                    )}
                </div>

                <div className="divide-y divide-slate-200/70 dark:divide-white/8">
                    {loading ? (
                        <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
                    ) : sortedComandas.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-sm text-slate-600 dark:text-slate-400">Nenhuma comanda encontrada.</p>
                            <Button className="mt-3" onClick={() => navigate('/checkout?mode=comanda')}>Abrir comanda</Button>
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

            <aside className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#121826] xl:sticky xl:top-6 xl:left-auto xl:right-auto xl:bottom-auto xl:z-auto xl:block xl:w-80 xl:shrink-0 xl:rounded-2xl xl:border xl:border-slate-200 xl:dark:border-white/8">
                <ComandaSidebar
                    comanda={selectedComanda}
                    onClose={() => setSelectedComandaId(null)}
                    onCancel={() => selectedComanda && (setDeleteComanda(selectedComanda), setCancelReason(''), setCancelReasonOther(''))}
                    onPrint={() => selectedComanda && handlePrint(selectedComanda)}
                    onCheckout={() => selectedComanda && navigate(`/checkout/${selectedComanda.id}`)}
                />
            </aside>

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
                            Venda Normal
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
                        {selectedOpenComandaIds.length} comanda(s) selecionada(s)
                    </p>
                    {bulkCloseType === 'admin' && (
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-slate-500">Mes de referencia</label>
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
                        placeholder="Observacao"
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
                title="Anular Comanda"
                maxWidth="sm"
            >
                {deleteComanda && (
                    <div className="space-y-4">
                        {deleteComanda.status === 'paid' && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs font-medium text-amber-800">
                                    ⚠️ Esta comanda está <strong>PAGA</strong>. Anulá-la pode afetar o financeiro e comissões.
                                </p>
                            </div>
                        )}
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Anular comanda <strong>#{getDisplayId(deleteComanda.id)}</strong> de <strong>{deleteComanda.clients.name}</strong>?
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
                                    ⚠️ Esta comanda <strong>não será considerada no financeiro</strong>.
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