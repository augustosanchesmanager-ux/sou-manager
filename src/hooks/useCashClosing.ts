import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import {
    CashCloseFilters,
    SangriaSuprimento,
    CashClosingEntryExtended,
    ComandaDetail,
    ComandaItemDetail,
    BarberSummary,
    BarberAttendanceSummary,
    OpenComandaSummary,
    PaymentMethodRow,
    CashCloseValidation,
    AgendaSummary,
    TimelineEvent,
    DailyAuditData,
    IndicatorsData,
    BarberClosingDetail,
    CashClosingRecord,
    BarberClosingRecord,
    CashClosingEventRecord,
    isFrontlineRole,
    validateCashClose,
    buildPaymentMethodRows,
    buildBarberSummaries,
    buildAttendancesByBarber,
    buildOpenComandasSummary,
    filterEntries,
    generateId,
} from '@/components/financial/cashCloseUtils';

interface TransactionRecord {
    id: string;
    type: string;
    category: string | null;
    amount: number | string | null;
    description: string | null;
    payment_method: string | null;
    date: string | null;
    created_at?: string | null;
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

interface AppointmentRecord {
    id: string;
    status: string;
    price: number;
    start_time: string;
    staff_id?: string | null;
}

interface ComandaRecord {
    id: string;
    appointment_id: string | null;
    client_id: string | null;
    client_name?: string | null;
    staff_id: string | null;
    status: string;
    total: number;
    payment_method?: string | null;
}

interface ComandaItemRecord {
    id: string;
    comanda_id: string;
    service_id?: string | null;
    product_name?: string | null;
    quantity: number;
    unit_price: number;
    staff_id?: string | null;
}

interface StaffRecord {
    id: string;
    name: string;
    role: string | null;
}

interface ClientRecord {
    id: string;
    name: string;
}

interface ServiceRecord {
    id: string;
    name: string;
    price?: number;
}

export interface UseCashClosingReturn {
    filterDate: string;
    setFilterDate: (date: string) => void;
    loading: boolean;
    saving: boolean;
    closing: boolean;
    loadError: string | null;
    lastSavedAt: string | null;
    entries: CashClosingEntryExtended[];
    comandaDetails: ComandaDetail[];
    appointments: AppointmentRecord[];
    comandas: ComandaRecord[];
    staffList: StaffRecord[];
    staffMap: Record<string, { name: string; role: string }>;
    frontlineStaff: StaffRecord[];
    filters: CashCloseFilters;
    setFilters: (filters: CashCloseFilters | ((prev: CashCloseFilters) => CashCloseFilters)) => void;
    extras: SangriaSuprimento[];
    setExtras: React.Dispatch<React.SetStateAction<SangriaSuprimento[]>>;
    observations: string;
    setObservations: (obs: string) => void;
    filteredEntries: CashClosingEntryExtended[];
    filteredComandaDetails: ComandaDetail[];
    barberSummaries: BarberSummary[];
    attendancesByBarber: BarberAttendanceSummary[];
    openComandasSummary: OpenComandaSummary[];
    openComandasCount: number;
    openComandasTotal: number;
    clubOverdueCount: number;
    clubOverdueTotal: number;
    pendingReceiptsCount: number;
    pendingReceiptsTotal: number;
    totalEntradas: number;
    totalSaidas: number;
    totalReversals: number;
    reversalCount: number;
    saldoAtual: number;
    entradasCount: number;
    saidasCount: number;
    totalExpected: number;
    totalReceived: number;
    validation: CashCloseValidation;
    paymentRows: PaymentMethodRow[];
    paymentMethodBreakdown: [string, { entradas: number; saidas: number; count: number }][];
    agendaSummary: AgendaSummary;
    hasPendingAlerts: boolean;
    hasDailyFinancialData: boolean;
    fetchData: () => Promise<void>;
    handleSaveConference: () => Promise<void>;
    handleCloseCash: () => Promise<void>;
    addExtra: (type: 'sangria' | 'suprimento', value: number, description: string) => void;
    removeExtra: (id: string) => void;
    timeline: TimelineEvent[];
    dailyAudit: DailyAuditData;
    indicators: IndicatorsData;
    barberClosingDetails: BarberClosingDetail[];
    cashClosingRecord: CashClosingRecord | null;
    barberClosingRecords: BarberClosingRecord[];
    closingEvents: CashClosingEventRecord[];
    openingTime: string | null;
    closingTime: string | null;
    isOpen: boolean;
    isConfirmed: boolean;
    openCashRegister: () => Promise<void>;
    closeBarberCash: (barberStaffId: string, conference: { countedCash: number; justification: string }) => Promise<void>;
    recordEvent: (eventType: CashClosingEventRecord['event_type'], label: string, detail?: string, metadata?: Record<string, any>) => Promise<void>;
}

export function useCashClosing(
    tenantId: string | undefined | null,
    user: { id: string; email?: string } | undefined | null,
): UseCashClosingReturn {
    const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [closing, setClosing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

    const [entries, setEntries] = useState<CashClosingEntryExtended[]>([]);
    const [comandaDetails, setComandaDetails] = useState<ComandaDetail[]>([]);
    const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
    const [comandas, setComandas] = useState<ComandaRecord[]>([]);
    const [staffList, setStaffList] = useState<StaffRecord[]>([]);
    const [openComandasCount, setOpenComandasCount] = useState(0);
    const [openComandasTotal, setOpenComandasTotal] = useState(0);
    const [clubOverdueCount, setClubOverdueCount] = useState(0);
    const [clubOverdueTotal, setClubOverdueTotal] = useState(0);
    const [pendingReceiptsCount, setPendingReceiptsCount] = useState(0);
    const [pendingReceiptsTotal, setPendingReceiptsTotal] = useState(0);

    const [filters, setFilters] = useState<CashCloseFilters>({
        operatorId: null,
        showOnlyOpenComandas: false,
        onlyClubMembers: false,
    });

    const [extras, setExtras] = useState<SangriaSuprimento[]>([]);
    const [observations, setObservations] = useState('');

    const [cashClosingRecord, setCashClosingRecord] = useState<CashClosingRecord | null>(null);
    const [barberClosingRecords, setBarberClosingRecords] = useState<BarberClosingRecord[]>([]);
    const [closingEvents, setClosingEvents] = useState<CashClosingEventRecord[]>([]);

    const getDayRange = useCallback((dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        const start = d.toISOString();
        const end = new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
        return { start, end };
    }, []);

    const fetchData = useCallback(async () => {
        if (!tenantId || !filterDate) {
            setEntries([]);
            setComandaDetails([]);
            setAppointments([]);
            setComandas([]);
            setStaffList([]);
            setOpenComandasCount(0);
            setOpenComandasTotal(0);
            setClubOverdueCount(0);
            setClubOverdueTotal(0);
            setPendingReceiptsCount(0);
            setPendingReceiptsTotal(0);
            setLoadError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setLoadError(null);
        const { start, end } = getDayRange(filterDate);

        try {
            const [
                transactionsResult,
                appointmentsResult,
                comandasResult,
                comandaItemsResult,
                clubResult,
                receiptsResult,
                staffResult,
                clientsResult,
                servicesResult,
            ] = await Promise.all([
                supabase
                    .from('transactions')
                    .select('id, type, category, amount, description, payment_method, date, created_at, source_type, source_id')
                    .eq('tenant_id', tenantId)
                    .gte('date', start)
                    .lte('date', end)
                    .order('date', { ascending: true }),
                supabase
                    .from('appointments')
                    .select('id, status, price, start_time, staff_id')
                    .eq('tenant_id', tenantId)
                    .gte('start_time', start)
                    .lte('start_time', end),
                supabase
                    .from('comandas')
                    .select('id, appointment_id, client_id, client_name, staff_id, status, total, payment_method')
                    .eq('tenant_id', tenantId)
                    .gte('created_at', start)
                    .lte('created_at', end),
                supabase
                    .from('comanda_items')
                    .select('id, comanda_id, service_id, product_name, quantity, unit_price, staff_id')
                    .eq('tenant_id', tenantId),
                supabase.rpc('generate_club_receivables', { p_tenant_id: tenantId }).then(() =>
                    supabase
                        .from('customer_subscription_receivables')
                        .select('id, amount, status')
                        .eq('tenant_id', tenantId)
                        .in('status', ['pending', 'overdue'])
                ),
                supabase
                    .from('transactions')
                    .select('id, status, amount')
                    .eq('tenant_id', tenantId)
                    .gte('date', start)
                    .lte('date', end),
                supabase
                    .from('staff')
                    .select('id, name, role')
                    .eq('tenant_id', tenantId)
                    .eq('status', 'active'),
                supabase
                    .from('clients')
                    .select('id, name')
                    .eq('tenant_id', tenantId),
                supabase
                    .from('services')
                    .select('id, name')
                    .eq('tenant_id', tenantId),
            ]);

            if (transactionsResult.error) throw transactionsResult.error;

            const txData = (transactionsResult.data || []) as TransactionRecord[];
            const allComandas = (comandasResult.data || []) as ComandaRecord[];
            const allComandaItems = (comandaItemsResult.data || []) as ComandaItemRecord[];
            const allStaff = (staffResult.data || []) as StaffRecord[];
            const allClients = (clientsResult.data || []) as ClientRecord[];
            const allServices = (servicesResult.data || []) as ServiceRecord[];

            setStaffList(allStaff);

            const staffMap: Record<string, { name: string; role: string }> = {};
            allStaff.forEach(s => { staffMap[s.id] = { name: s.name, role: s.role || '' }; });

            const clientMap: Record<string, string> = {};
            allClients.forEach(c => { clientMap[c.id] = c.name; });

            const serviceMap: Record<string, string> = {};
            allServices.forEach(s => { serviceMap[s.id] = s.name; });

            const comandaMap = new Map<string, ComandaRecord>();
            allComandas.forEach(c => { comandaMap.set(c.id, c); });

            const itemsByComanda = new Map<string, ComandaItemRecord[]>();
            allComandaItems.forEach(item => {
                const list = itemsByComanda.get(item.comanda_id) || [];
                list.push(item);
                itemsByComanda.set(item.comanda_id, list);
            });

            const comandaIdToDetail = new Map<string, ComandaDetail>();
            allComandas.forEach(cmd => {
                const items = itemsByComanda.get(cmd.id) || [];
                const detailItems: ComandaItemDetail[] = items.map(item => {
                    const itemStaffId = item.staff_id || cmd.staff_id;
                    return {
                        id: item.id,
                        serviceName: serviceMap[item.service_id || ''] || item.product_name || 'Item',
                        quantity: item.quantity,
                        unitPrice: Number(item.unit_price || 0),
                        staffId: itemStaffId,
                        staffName: staffMap[itemStaffId || '']?.name || '-',
                    };
                });

                const resolvedStaffId = cmd.staff_id
                    || items.find(i => i.staff_id)?.staff_id
                    || null;

                const clientName = cmd.client_name
                    || clientMap[cmd.client_id || '']
                    || 'Cliente nao identificado';

                comandaIdToDetail.set(cmd.id, {
                    comandaId: cmd.id,
                    clientId: cmd.client_id,
                    clientName,
                    staffId: resolvedStaffId,
                    staffName: staffMap[resolvedStaffId || '']?.name || 'Sem profissional',
                    paymentMethod: cmd.payment_method,
                    total: Number(cmd.total || 0),
                    status: cmd.status,
                    items: detailItems,
                });
            });

            setComandaDetails(Array.from(comandaIdToDetail.values()));

            const missingComandaIds = txData
                .filter(t => t.source_type === 'comanda' && t.source_id && !comandaIdToDetail.has(t.source_id))
                .map(t => t.source_id!);

            if (missingComandaIds.length > 0) {
                const { data: missingComandas } = await supabase
                    .from('comandas')
                    .select('id, appointment_id, client_id, client_name, staff_id, status, total, payment_method')
                    .in('id', missingComandaIds);

                if (missingComandas && missingComandas.length > 0) {
                    const missingIds = missingComandas.map((c: ComandaRecord) => c.id);
                    const { data: missingItems } = await supabase
                        .from('comanda_items')
                        .select('id, comanda_id, service_id, product_name, quantity, unit_price, staff_id')
                        .in('comanda_id', missingIds);

                    const missingItemsByComanda = new Map<string, ComandaItemRecord[]>();
                    (missingItems || []).forEach((item: ComandaItemRecord) => {
                        const list = missingItemsByComanda.get(item.comanda_id) || [];
                        list.push(item);
                        missingItemsByComanda.set(item.comanda_id, list);
                    });

                    missingComandas.forEach((cmd: ComandaRecord) => {
                        if (comandaIdToDetail.has(cmd.id)) return;
                        const items = missingItemsByComanda.get(cmd.id) || [];
                        const detailItems: ComandaItemDetail[] = items.map(item => {
                            const itemStaffId = item.staff_id || cmd.staff_id;
                            return {
                                id: item.id,
                                serviceName: serviceMap[item.service_id || ''] || item.product_name || 'Item',
                                quantity: item.quantity,
                                unitPrice: Number(item.unit_price || 0),
                                staffId: itemStaffId,
                                staffName: staffMap[itemStaffId || '']?.name || '-',
                            };
                        });
                        const resolvedStaffId = cmd.staff_id || items.find(i => i.staff_id)?.staff_id || null;
                        const clientName = cmd.client_name || clientMap[cmd.client_id || ''] || 'Cliente nao identificado';
                        comandaIdToDetail.set(cmd.id, {
                            comandaId: cmd.id,
                            clientId: cmd.client_id,
                            clientName,
                            staffId: resolvedStaffId,
                            staffName: staffMap[resolvedStaffId || '']?.name || 'Sem profissional',
                            paymentMethod: cmd.payment_method,
                            total: Number(cmd.total || 0),
                            status: cmd.status,
                            items: detailItems,
                        });
                    });

                    setComandaDetails(Array.from(comandaIdToDetail.values()));
                }
            }

            const transactionIds = txData.map((t) => t.id).filter(Boolean);
            const reversalSourceByTransactionId = new Map<string, CashClosingEntryExtended['reversalSource']>();

            if (transactionIds.length > 0) {
                const { data: reversalSources, error: reversalSourcesError } = await supabase
                    .from('financial_reversals')
                    .select('original_transaction_id, reversal_transaction_id, reversal_type, amount, reason_type, created_at')
                    .eq('tenant_id', tenantId)
                    .in('reversal_transaction_id', transactionIds);

                if (!reversalSourcesError) {
                    ((reversalSources || []) as FinancialReversalRecord[]).forEach((rev) => {
                        if (!rev.reversal_transaction_id) return;
                        reversalSourceByTransactionId.set(rev.reversal_transaction_id, {
                            originalTransactionId: rev.original_transaction_id || null,
                            reversalType: rev.reversal_type || 'reversal',
                            reasonType: rev.reason_type || 'Sem motivo informado',
                            amount: Math.abs(Number(rev.amount || 0)),
                            createdAt: rev.created_at || null,
                        });
                    });
                }
            }

            const openComandaIdSet = new Set(allComandas.filter(c => c.status === 'open').map(c => c.id));

            const clubSourceIds = new Set(
                (clubResult.data || [])
                    .filter((r: any) => !r.transaction_id && r.status === 'overdue')
                    .map((r: any) => r.id)
            );

            const mappedEntries: CashClosingEntryExtended[] = txData.map(transaction => {
                const reversalSource = reversalSourceByTransactionId.get(transaction.id) || null;
                const comandaDetail = transaction.source_type === 'comanda' && transaction.source_id
                    ? comandaIdToDetail.get(transaction.source_id)
                    : undefined;

                const barberStaffId = comandaDetail?.staffId || null;
                const barberName = comandaDetail?.staffName || null;
                const clientName = comandaDetail?.clientName || '';
                const comandaItemsStr = comandaDetail?.items.map(i => i.serviceName).join(', ') || '';

                return {
                    id: transaction.id,
                    date: transaction.date || transaction.created_at || new Date().toISOString(),
                    description: transaction.description || transaction.category || 'Lancamento sem descricao',
                    category: transaction.category || 'Sem categoria',
                    accountId: transaction.payment_method || 'nao-informado',
                    accountName: transaction.payment_method || 'Nao informado',
                    costCenter: transaction.category || 'Sem centro',
                    type: transaction.type === 'income' ? 'entrada' : 'saida',
                    paymentMethod: transaction.payment_method || 'Nao informado',
                    status: 'realizado',
                    value: Number(transaction.amount || 0),
                    runningBalance: 0,
                    sourceType: transaction.source_type || null,
                    sourceId: transaction.source_id || null,
                    isReversalTransaction: Boolean(reversalSource),
                    reversalSource,
                    barberStaffId,
                    barberName,
                    comandaStatus: transaction.source_id
                        ? (openComandaIdSet.has(transaction.source_id) ? 'Aberta' : 'Fechada')
                        : null,
                    isClubMember: clubSourceIds.has(transaction.source_id || ''),
                    clientName,
                    comandaItems: comandaItemsStr,
                };
            });
            setEntries(mappedEntries);

            // Fetch cash_closings record for the day
            const { data: cashClosingData } = await supabase
                .from('cash_closings')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('business_date', filterDate)
                .single();

            if (cashClosingData) {
                setCashClosingRecord(cashClosingData as CashClosingRecord);
                setObservations((cashClosingData as CashClosingRecord).notes || '');

                // Fetch barber_closings for this cash_closing
                const { data: barberClosingData } = await supabase
                    .from('barber_closings')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .eq('cash_closing_id', cashClosingData.id)
                    .order('created_at', { ascending: true });

                setBarberClosingRecords((barberClosingData || []) as BarberClosingRecord[]);

                // Fetch events for this cash_closing
                const { data: eventsData } = await supabase
                    .from('cash_closing_events')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .eq('business_date', filterDate)
                    .order('event_time', { ascending: true });

                setClosingEvents((eventsData || []) as CashClosingEventRecord[]);
            } else {
                setCashClosingRecord(null);
                setBarberClosingRecords([]);
                setClosingEvents([]);
            }

            if (appointmentsResult.data) setAppointments(appointmentsResult.data as AppointmentRecord[]);

            if (comandasResult.data) {
                const cmds = comandasResult.data as ComandaRecord[];
                const openCmds = cmds.filter(c => c.status === 'open');
                setOpenComandasCount(openCmds.length);
                setOpenComandasTotal(openCmds.reduce((sum, c) => sum + Number(c.total || 0), 0));
                setComandas(cmds);
            }

            if (clubResult.data) {
                const clubData = (clubResult.data as any[]).filter((r: any) => !r.transaction_id);
                const overdue = clubData.filter((r: any) => r.status === 'overdue');
                setClubOverdueCount(overdue.length);
                setClubOverdueTotal(overdue.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0));
            }

            if (receiptsResult.data) {
                const txAll = receiptsResult.data as any[];
                const pendentes = txAll.filter((tx: any) => {
                    let status = tx.status || 'Pago';
                    if (status !== 'Pago' && status !== 'Pendente' && status !== 'Cancelado') {
                        status = status === 'paid' ? 'Pago' : (status === 'pending' ? 'Pendente' : 'Pago');
                    }
                    return status === 'Pendente';
                });
                setPendingReceiptsCount(pendentes.length);
                setPendingReceiptsTotal(pendentes.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0));
            }

        } catch (error: any) {
            console.error('Erro ao carregar dados:', error);
            setLoadError(error?.message || 'Nao foi possivel carregar os dados.');
            setEntries([]);
            setComandaDetails([]);
            setAppointments([]);
            setComandas([]);
            setStaffList([]);
        } finally {
            setLoading(false);
        }
    }, [tenantId, filterDate, getDayRange]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const staffMap = useMemo(() => {
        const map: Record<string, { name: string; role: string }> = {};
        staffList.forEach(s => { map[s.id] = { name: s.name, role: s.role || '' }; });
        return map;
    }, [staffList]);

    const frontlineStaff = useMemo(
        () => staffList.filter(s => isFrontlineRole(s.role)),
        [staffList]
    );

    const openComandaIds = useMemo(
        () => new Set(comandas.filter(c => c.status === 'open').map(c => c.id)),
        [comandas]
    );

    const filteredEntries = useMemo(
        () => filterEntries(entries, filters, openComandaIds),
        [entries, filters, openComandaIds]
    );

    const filteredComandaDetails = useMemo(() => {
        let filtered = comandaDetails;
        if (filters.operatorId) {
            filtered = filtered.filter(c => c.staffId === filters.operatorId);
        }
        if (filters.onlyClubMembers) {
            filtered = filtered.filter(c => {
                const txEntry = entries.find(e => e.sourceId === c.comandaId);
                return txEntry?.isClubMember;
            });
        }
        return filtered;
    }, [comandaDetails, filters, entries]);

    const barberSummaries = useMemo(
        () => buildBarberSummaries(filteredComandaDetails, staffMap),
        [filteredComandaDetails, staffMap]
    );

    const attendancesByBarber = useMemo(() => {
        const base = buildAttendancesByBarber(filteredComandaDetails);
        return base.map(b => ({
            ...b,
            staffName: staffMap[b.staffId]?.name || (b.staffId === 'sem-profissional' ? 'Sem profissional' : 'Desconhecido'),
            role: staffMap[b.staffId]?.role || '',
        }));
    }, [filteredComandaDetails, staffMap]);

    const openComandasSummary = useMemo(
        () => buildOpenComandasSummary(filteredComandaDetails),
        [filteredComandaDetails]
    );

    const totalEntradas = filteredEntries.filter(e => e.type === 'entrada').reduce((sum, e) => sum + e.value, 0);
    const totalSaidas = filteredEntries.filter(e => e.type === 'saida').reduce((sum, e) => sum + e.value, 0);
    const reversalEntries = filteredEntries.filter(e => e.isReversalTransaction);
    const totalReversals = reversalEntries.reduce((sum, e) => sum + e.value, 0);
    const reversalCount = reversalEntries.length;
    const saldoAtual = totalEntradas - totalSaidas;
    const entradasCount = filteredEntries.filter(e => e.type === 'entrada').length;
    const saidasCount = filteredEntries.filter(e => e.type === 'saida').length;

    const totalExtrasSuprimento = extras.filter(e => e.type === 'suprimento').reduce((s, e) => s + e.value, 0);
    const totalExtrasSangria = extras.filter(e => e.type === 'sangria').reduce((s, e) => s + e.value, 0);

    const totalExpected = saldoAtual;
    const totalReceived = totalEntradas + totalExtrasSuprimento - totalExtrasSangria;
    const validation = useMemo(() => validateCashClose(totalExpected, totalReceived), [totalExpected, totalReceived]);

    const paymentRows = useMemo(() => buildPaymentMethodRows(filteredEntries, extras), [filteredEntries, extras]);

    const paymentMethodBreakdown = useMemo(() => {
        const map: Record<string, { entradas: number; saidas: number; count: number }> = {};
        filteredEntries.forEach(e => {
            if (!map[e.paymentMethod]) map[e.paymentMethod] = { entradas: 0, saidas: 0, count: 0 };
            if (e.type === 'entrada') map[e.paymentMethod].entradas += e.value;
            else map[e.paymentMethod].saidas += e.value;
            map[e.paymentMethod].count += 1;
        });
        return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
    }, [filteredEntries]);

    const agendaSummary = useMemo((): AgendaSummary => {
        const apptIds = new Set(appointments.map(a => a.id));
        const paidComandas = comandas.filter(c => c.appointment_id && apptIds.has(c.appointment_id) && c.status === 'paid');
        const receivedTotal = paidComandas.reduce((sum, c) => sum + Number(c.total || 0), 0);
        const completed = appointments.filter(a => a.status === 'completed');
        const cancelled = appointments.filter(a => a.status === 'cancelled');
        const pending = appointments.filter(a => ['scheduled', 'pending', 'confirmed', 'in_progress'].includes(a.status));
        const no_show = appointments.filter(a => a.status === 'no_show');
        const scheduled = appointments.filter(a => ['scheduled', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(a.status));

        return {
            scheduled: { count: scheduled.length, total: scheduled.reduce((s, a) => s + Number(a.price || 0), 0) },
            completed: { count: completed.length, total: completed.reduce((s, a) => s + Number(a.price || 0), 0) },
            received: { count: paidComandas.length, total: receivedTotal },
            cancelled: { count: cancelled.length, total: cancelled.reduce((s, a) => s + Number(a.price || 0), 0) },
            pending: { count: pending.length, total: pending.reduce((s, a) => s + Number(a.price || 0), 0) },
            no_show: { count: no_show.length, total: no_show.reduce((s, a) => s + Number(a.price || 0), 0) },
        };
    }, [appointments, comandas]);

    const hasPendingAlerts = openComandasCount > 0 || clubOverdueCount > 0 || pendingReceiptsCount > 0;
    const hasDailyFinancialData = entries.length > 0;

    const timeline = useMemo((): TimelineEvent[] => {
        const events: TimelineEvent[] = [];

        const allComandasSorted = [...comandas].sort((a, b) => {
            const aTime = a.appointment_id
                ? appointments.find(ap => ap.id === a.appointment_id)?.start_time || ''
                : '';
            const bTime = b.appointment_id
                ? appointments.find(ap => ap.id === b.appointment_id)?.start_time || ''
                : '';
            return aTime.localeCompare(bTime);
        });

        if (allComandasSorted.length > 0) {
            const first = allComandasSorted[0];
            const firstAppt = first.appointment_id ? appointments.find(a => a.id === first.appointment_id) : null;
            if (firstAppt) {
                events.push({
                    time: firstAppt.start_time,
                    label: 'Primeiro atendimento',
                    type: 'service',
                    detail: `${first.client_name || 'Cliente'} (${formatCurrencyBR(first.total)})`,
                });
            }

            const last = allComandasSorted[allComandasSorted.length - 1];
            const lastAppt = last.appointment_id ? appointments.find(a => a.id === last.appointment_id) : null;
            if (lastAppt && lastAppt.id !== firstAppt?.id) {
                events.push({
                    time: lastAppt.start_time,
                    label: 'Ultimo atendimento',
                    type: 'service',
                    detail: `${last.client_name || 'Cliente'} (${formatCurrencyBR(last.total)})`,
                });
            }
        }

        extras.forEach(ext => {
            events.push({
                time: ext.createdAt,
                label: ext.type === 'sangria' ? 'Sangria' : 'Suprimento',
                type: ext.type === 'sangria' ? 'sangria' : 'suprimento',
                detail: `${formatCurrencyBR(ext.value)}${ext.description ? ': ' + ext.description : ''}`,
            });
        });

        reversalEntries.forEach(rev => {
            events.push({
                time: rev.reversalSource?.createdAt || rev.date,
                label: 'Estorno',
                type: 'reversal',
                detail: `${formatCurrencyBR(rev.value)} - ${rev.reversalSource?.reasonType || 'Reversao'}`,
            });
        });

        return events.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    }, [comandas, appointments, extras, reversalEntries]);

    const dailyAudit = useMemo((): DailyAuditData => {
        const paidComandas = comandas.filter(c => c.status === 'paid');
        const openCmds = comandas.filter(c => c.status === 'open');
        const cancelledCmds = comandas.filter(c => c.status === 'cancelled');
        const reversedCmds = comandas.filter(c => c.status === 'reversed');
        const pendingPayments = entries.filter(e => e.status === 'previsto' || e.status === 'vencido');
        const manuallyLaunched = entries.filter(e => !e.sourceType || e.sourceType === 'manual');
        const incomeEntries = entries.filter(e => e.type === 'entrada');
        const expenseEntries = entries.filter(e => e.type === 'saida');
        const reversals = reversalEntries;

        return {
            totalComandas: comandas.length,
            openComandas: openCmds.length,
            cancelledComandas: cancelledCmds.length,
            reversedComandas: reversedCmds.length,
            pendingPayments: pendingPayments.length,
            pendingPaymentsTotal: pendingPayments.reduce((s, e) => s + e.value, 0),
            reaberturas: 0,
            manualReceivables: manuallyLaunched.filter(e => e.type === 'entrada').length,
            manualExpenses: manuallyLaunched.filter(e => e.type === 'saida').length,
            totalIncome: incomeEntries.length,
            totalExpenses: expenseEntries.length,
            totalReversals: reversals.length,
            totalTransactions: entries.length,
        };
    }, [comandas, entries, reversalEntries]);

    const indicators = useMemo((): IndicatorsData => {
        const paidComandas = comandas.filter(c => c.status === 'paid');
        const totalPaid = paidComandas.reduce((s, c) => s + Number(c.total || 0), 0);
        const ticketMedio = paidComandas.length > 0 ? totalPaid / paidComandas.length : 0;

        const uniqueClients = new Set(
            comandas.filter(c => c.client_id).map(c => c.client_id)
        );

        const comandaItemsFiltered = filteredComandaDetails.flatMap(c => c.items);
        const serviceItems = comandaItemsFiltered.filter(i => i.serviceName && !i.serviceName.includes('Produto'));
        const productItems = comandaItemsFiltered.filter(i => i.serviceName && i.serviceName.includes('Produto'));

        const totalCommissions = barberSummaries.reduce((s, b) => s + b.totalReceived * 0.35, 0);

        return {
            ticketMedio,
            clientesAtendidos: uniqueClients.size,
            novosClientes: 0,
            produtosVendidos: productItems.length,
            servicosVendidos: serviceItems.length,
            tempoMedioAtendimento: agendaSummary.completed.count > 0 ? 45 : 0,
            comissaoTotal: totalCommissions,
            metaDoDia: 0,
            percentualMeta: 0,
        };
    }, [comandas, filteredComandaDetails, barberSummaries, agendaSummary]);

    const barberClosingDetails = useMemo((): BarberClosingDetail[] => {
        return barberSummaries.map(barber => {
            const barberComandas = barber.comandas;
            const barberOpenComandas = barber.openComandas;

            const paymentMethods: Record<string, number> = {};
            barberComandas.forEach(cmd => {
                const method = cmd.paymentMethod || 'Nao informado';
                paymentMethods[method] = (paymentMethods[method] || 0) + cmd.total;
            });

            const clientsServed = barberComandas.map(cmd => ({
                clientName: cmd.clientName,
                serviceName: cmd.items.map(i => i.serviceName).join(', '),
                time: cmd.comandaId,
                value: cmd.total,
                paymentMethod: cmd.paymentMethod || 'Nao informado',
                status: cmd.status,
            }));

            const productsSold = barberComandas.flatMap(cmd =>
                cmd.items
                    .filter(i => i.serviceName.includes('Produto'))
                    .map(i => ({
                        name: i.serviceName,
                        quantity: i.quantity,
                        value: i.unitPrice * i.quantity,
                    }))
            );

            const commissionServices = barber.totalReceived * 0.35;
            const commissionProducts = productsSold.reduce((s, p) => s + p.value, 0) * 0.10;

            const allExtras = extras.filter(() => false);

            const timelineEvents: TimelineEvent[] = [];
            if (barberComandas.length > 0) {
                timelineEvents.push({
                    time: barberComandas[0].comandaId,
                    label: 'Primeiro atendimento',
                    type: 'service',
                });
                if (barberComandas.length > 1) {
                    timelineEvents.push({
                        time: barberComandas[barberComandas.length - 1].comandaId,
                        label: 'Ultimo atendimento',
                        type: 'service',
                    });
                }
            }

            return {
                staffId: barber.staffId,
                staffName: barber.staffName,
                role: barber.role,
                status: 'open',
                totalProduced: barber.totalReceived,
                totalReceived: barber.totalReceived,
                commission: commissionServices + commissionProducts,
                repasse: barber.totalReceived - (commissionServices + commissionProducts),
                discounts: 0,
                advances: 0,
                balance: barber.totalReceived - (commissionServices + commissionProducts),
                paymentMethods,
                clientsServed,
                productsSold,
                commissions: {
                    services: commissionServices,
                    products: commissionProducts,
                    bonus: 0,
                    discounts: 0,
                    finalValue: commissionServices + commissionProducts,
                },
                conference: {
                    countedCash: 0,
                    expectedCash: paymentMethods['Dinheiro'] || 0,
                    difference: 0,
                    justification: '',
                },
                checklist: {
                    allCommandsClosed: barberOpenComandas.length === 0,
                    allPaymentsCompleted: true,
                    noPendingReversals: true,
                    noOpenCommands: barberOpenComandas.length === 0,
                    noInconsistentCommissions: true,
                    conferenceDone: false,
                },
                timeline: timelineEvents,
            };
        });
    }, [barberSummaries, extras]);

    const addExtra = useCallback((type: 'sangria' | 'suprimento', value: number, description: string) => {
        const newExtra: SangriaSuprimento = {
            id: generateId(),
            type,
            value,
            description,
            createdAt: new Date().toISOString(),
        };
        setExtras(prev => [...prev, newExtra]);
    }, []);

    const removeExtra = useCallback((id: string) => {
        setExtras(prev => prev.filter(e => e.id !== id));
    }, []);

    const handleSaveConference = useCallback(async () => {
        if (!tenantId) return;
        setSaving(true);
        const { start, end } = getDayRange(filterDate);

        try {
            const { error } = await supabase
                .from('cash_closings')
                .upsert({
                    tenant_id: tenantId,
                    business_date: filterDate,
                    period_start: start,
                    period_end: end,
                    status: 'draft',
                    created_by_user_id: user?.id,
                    notes: observations || null,
                    expected_income: totalEntradas,
                    expected_expense: totalSaidas,
                    expected_balance: saldoAtual,
                    total_counted: totalReceived,
                    total_difference: validation.difference,
                    appointments_scheduled_count: agendaSummary.scheduled.count,
                    appointments_completed_count: agendaSummary.completed.count,
                    appointments_received_count: agendaSummary.received.count,
                    appointments_cancelled_count: agendaSummary.cancelled.count,
                    appointments_pending_count: agendaSummary.pending.count,
                    appointments_no_show_count: agendaSummary.no_show.count,
                    appointments_summary: JSON.stringify(agendaSummary),
                    financial_summary: JSON.stringify({
                        entradas: totalEntradas, entradas_count: entradasCount,
                        saidas: totalSaidas, saidas_count: saidasCount,
                        saldo: saldoAtual, payment_methods: paymentMethodBreakdown,
                        extras, observations, total_expected: totalExpected,
                        total_received: totalReceived, difference: validation.difference,
                        filters, barber_summaries: barberSummaries.map(b => ({
                            name: b.staffName, role: b.role, total: b.totalReceived, count: b.comandaCount,
                        })),
                    }),
                }, { onConflict: 'tenant_id,business_date' });

            if (error) throw error;
            setLastSavedAt(new Date().toISOString());
        } catch (error: any) {
            throw error;
        } finally {
            setSaving(false);
        }
    }, [tenantId, filterDate, getDayRange, user?.id, totalEntradas, totalSaidas, saldoAtual, totalReceived, validation.difference, agendaSummary, entradasCount, saidasCount, paymentMethodBreakdown, extras, observations, totalExpected, filters, barberSummaries]);

    const handleCloseCash = useCallback(async () => {
        if (!tenantId) return;
        setClosing(true);
        const { start, end } = getDayRange(filterDate);
        const formattedDate = new Date(`${filterDate}T00:00:00`).toLocaleDateString('pt-BR');

        try {
            for (const extra of extras) {
                await supabase.from('transactions').insert({
                    tenant_id: tenantId,
                    type: extra.type === 'sangria' ? 'expense' : 'income',
                    category: extra.type === 'sangria' ? 'Sangria - Fechamento' : 'Suprimento - Fechamento',
                    amount: extra.value,
                    description: extra.description || `${extra.type === 'sangria' ? 'Sangria' : 'Suprimento'} - ${formattedDate}`,
                    payment_method: 'Dinheiro',
                    date: new Date().toISOString(),
                    status: 'completed',
                    source_type: 'cash_closing',
                    user_id: user?.id,
                });
            }

            const { error } = await supabase
                .from('cash_closings')
                .upsert({
                    tenant_id: tenantId,
                    business_date: filterDate,
                    period_start: start,
                    period_end: end,
                    status: 'confirmed',
                    created_by_user_id: user?.id,
                    confirmed_by_user_id: user?.id,
                    confirmed_at: new Date().toISOString(),
                    closing_time: new Date().toISOString(),
                    notes: observations || null,
                    expected_income: totalEntradas,
                    expected_expense: totalSaidas,
                    expected_balance: saldoAtual,
                    total_counted: totalReceived,
                    total_difference: validation.difference,
                    total_sangrias: totalExtrasSangria,
                    total_suprimentos: totalExtrasSuprimento,
                    appointments_summary: JSON.stringify(agendaSummary),
                    financial_summary: JSON.stringify({
                        entradas: totalEntradas, saidas: totalSaidas, saldo: saldoAtual,
                        payment_methods: paymentMethodBreakdown, extras, observations,
                        total_expected: totalExpected, total_received: totalReceived,
                        difference: validation.difference, filters,
                        closed_at: new Date().toISOString(), closed_by: user?.id,
                        barber_summaries: barberSummaries.map(b => ({
                            name: b.staffName, role: b.role, total: b.totalReceived, count: b.comandaCount,
                        })),
                    }),
                }, { onConflict: 'tenant_id,business_date' });

            if (error) throw error;
            setLastSavedAt(new Date().toISOString());
        } catch (error: any) {
            throw error;
        } finally {
            setClosing(false);
        }
    }, [tenantId, filterDate, getDayRange, extras, user?.id, totalEntradas, totalSaidas, saldoAtual, totalReceived, validation.difference, agendaSummary, paymentMethodBreakdown, observations, totalExpected, filters, barberSummaries, totalExtrasSangria, totalExtrasSuprimento]);

    const openCashRegister = useCallback(async () => {
        if (!tenantId) return;
        const { start, end } = getDayRange(filterDate);

        // Upsert or update the cash_closings record with opening_time
        const { data: existing } = await supabase
            .from('cash_closings')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('business_date', filterDate)
            .single();

        if (existing) {
            await supabase
                .from('cash_closings')
                .update({ opening_time: new Date().toISOString() })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('cash_closings')
                .insert({
                    tenant_id: tenantId,
                    business_date: filterDate,
                    period_start: start,
                    period_end: end,
                    status: 'draft',
                    created_by_user_id: user?.id,
                    opening_time: new Date().toISOString(),
                });
        }

        // Record opening event
        await recordEvent('opening', 'Caixa Aberto', undefined, { opened_by: user?.id });

        // Refresh data
        await fetchData();
    }, [tenantId, filterDate, getDayRange, user?.id, fetchData]);

    const closeBarberCash = useCallback(async (barberStaffId: string, conference: { countedCash: number; justification: string }) => {
        if (!tenantId || !cashClosingRecord) return;

        const barberDetail = barberClosingDetails.find(b => b.staffId === barberStaffId);
        if (!barberDetail) return;

        const expectedCash = barberDetail.paymentMethods['Dinheiro'] || 0;
        const cashDifference = conference.countedCash - expectedCash;
        const hasDiscrepancy = Math.abs(cashDifference) > 0.01;

        const checklistState = {
            allCommandsClosed: barberDetail.checklist.allCommandsClosed,
            allPaymentsCompleted: barberDetail.checklist.allPaymentsCompleted,
            noPendingReversals: barberDetail.checklist.noPendingReversals,
            noOpenCommands: barberDetail.checklist.noOpenCommands,
            noInconsistentCommissions: barberDetail.checklist.noInconsistentCommissions,
            conferenceDone: true,
        };

        const { error } = await supabase
            .from('barber_closings')
            .upsert({
                tenant_id: tenantId,
                cash_closing_id: cashClosingRecord.id,
                business_date: filterDate,
                staff_id: barberStaffId,
                status: hasDiscrepancy ? 'discrepancy' : 'closed',
                total_produced: barberDetail.totalProduced,
                total_received: barberDetail.totalReceived,
                commission_total: barberDetail.commission,
                repasse_total: barberDetail.repasse,
                discounts_total: barberDetail.discounts,
                advances_total: barberDetail.advances,
                balance: barberDetail.balance,
                payment_methods: barberDetail.paymentMethods,
                counted_cash: conference.countedCash,
                expected_cash: expectedCash,
                cash_difference: cashDifference,
                conference_justification: conference.justification || null,
                checklist: checklistState,
                comandas_count: barberDetail.clientsServed.length,
                clients_served_count: barberDetail.clientsServed.length,
                products_sold_count: barberDetail.productsSold.length,
                closed_by_user_id: user?.id,
                closed_at: new Date().toISOString(),
            }, { onConflict: 'tenant_id,cash_closing_id,staff_id' });

        if (error) throw error;

        // Record barber closing event
        await recordEvent('barber_closing', `Caixa Fechado: ${barberDetail.staffName}`,
            `${formatCurrencyBR(barberDetail.totalReceived)} produzido`,
            { staff_id: barberStaffId, produced: barberDetail.totalReceived, commission: barberDetail.commission }
        );

        // Update cash_closings with barber closings count
        const { data: updatedBarberClosings } = await supabase
            .from('barber_closings')
            .select('id, status')
            .eq('cash_closing_id', cashClosingRecord.id);

        const completeCount = (updatedBarberClosings || []).filter((b: any) => b.status === 'closed' || b.status === 'discrepancy').length;
        const frontlineTotal = frontlineStaff.length;

        await supabase
            .from('cash_closings')
            .update({
                barber_closings_count: completeCount,
                barber_closings_complete: completeCount >= frontlineTotal,
            })
            .eq('id', cashClosingRecord.id);

        await fetchData();
    }, [tenantId, cashClosingRecord, barberClosingDetails, frontlineStaff, filterDate, user?.id, fetchData]);

    const recordEvent = useCallback(async (
        eventType: CashClosingEventRecord['event_type'],
        label: string,
        detail?: string,
        metadata?: Record<string, any>,
    ) => {
        if (!tenantId) return;

        await supabase
            .from('cash_closing_events')
            .insert({
                tenant_id: tenantId,
                cash_closing_id: cashClosingRecord?.id || null,
                business_date: filterDate,
                event_type: eventType,
                event_time: new Date().toISOString(),
                label,
                detail: detail || null,
                metadata: metadata || {},
                created_by_user_id: user?.id,
            });
    }, [tenantId, cashClosingRecord?.id, filterDate, user?.id]);

    const openingTime = cashClosingRecord?.opening_time || null;
    const closingTime = cashClosingRecord?.closing_time || null;
    const isOpen = Boolean(cashClosingRecord?.opening_time && !cashClosingRecord?.closing_time);
    const isConfirmed = cashClosingRecord?.status === 'confirmed';

    return {
        filterDate,
        setFilterDate,
        loading,
        saving,
        closing,
        loadError,
        lastSavedAt,
        entries,
        comandaDetails,
        appointments,
        comandas,
        staffList,
        staffMap,
        frontlineStaff,
        filters,
        setFilters,
        extras,
        setExtras,
        observations,
        setObservations,
        filteredEntries,
        filteredComandaDetails,
        barberSummaries,
        attendancesByBarber,
        openComandasSummary,
        openComandasCount,
        openComandasTotal,
        clubOverdueCount,
        clubOverdueTotal,
        pendingReceiptsCount,
        pendingReceiptsTotal,
        totalEntradas,
        totalSaidas,
        totalReversals,
        reversalCount,
        saldoAtual,
        entradasCount,
        saidasCount,
        totalExpected,
        totalReceived,
        validation,
        paymentRows,
        paymentMethodBreakdown,
        agendaSummary,
        hasPendingAlerts,
        hasDailyFinancialData,
        fetchData,
        handleSaveConference,
        handleCloseCash,
        addExtra,
        removeExtra,
        timeline,
        dailyAudit,
        indicators,
        barberClosingDetails,
        cashClosingRecord,
        barberClosingRecords,
        closingEvents,
        openingTime,
        closingTime,
        isOpen,
        isConfirmed,
        openCashRegister,
        closeBarberCash,
        recordEvent,
    };
}

function formatCurrencyBR(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
