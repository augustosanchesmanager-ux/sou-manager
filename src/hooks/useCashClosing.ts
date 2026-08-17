import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cashClosingApplicationService } from '@/application/cashClosing';
import { normalizePercentage } from '@/shared/numbers/normalize';
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
    buildPaymentMethodRows,
    buildBarberSummaries,
    buildAttendancesByBarber,
    buildOpenComandasSummary,
    filterEntries,
    generateId,
} from '@/components/financial/cashCloseUtils';

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

interface StaffRecord {
    id: string;
    name: string;
    role: string | null;
    commission_rate: number | null;
}

interface UseCashClosingReturn {
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

    const fetchRequestIdRef = useRef(0);

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

        const requestId = ++fetchRequestIdRef.current;
        setLoading(true);
        setLoadError(null);

        try {
            const snapshot = await cashClosingApplicationService.loadDailySnapshot(tenantId, filterDate);

            if (requestId !== fetchRequestIdRef.current) return;

            setStaffList(snapshot.staff as unknown as StaffRecord[]);

            const comandaDetailsMap = new Map(snapshot.comandaDetails.map(d => [d.comandaId, d]));
            setComandaDetails(snapshot.comandaDetails);

            const reversalMap = new Map<string, CashClosingEntryExtended['reversalSource']>();
            snapshot.reversals.forEach((rev) => {
                if (!rev.reversal_transaction_id) return;
                reversalMap.set(rev.reversal_transaction_id, {
                    originalTransactionId: rev.original_transaction_id || null,
                    reversalType: rev.reversal_type || 'reversal',
                    reasonType: rev.reason_type || 'Sem motivo informado',
                    amount: Math.abs(Number(rev.amount || 0)),
                    createdAt: rev.created_at || null,
                });
            });

            const openComandaIds = new Set(
                snapshot.comandas.filter(c => c.status === 'open').map(c => c.id)
            );

            const mappedEntries: CashClosingEntryExtended[] = snapshot.transactions.map(transaction => {
                const reversalSource = reversalMap.get(transaction.id) || null;
                const comandaDetail = transaction.source_type === 'comanda' && transaction.source_id
                    ? comandaDetailsMap.get(transaction.source_id)
                    : undefined;

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
                    barberStaffId: comandaDetail?.staffId || null,
                    barberName: comandaDetail?.staffName || null,
                    comandaStatus: transaction.source_id
                        ? (openComandaIds.has(transaction.source_id) ? 'Aberta' : 'Fechada')
                        : null,
                    isClubMember: false,
                    clientName: comandaDetail?.clientName || '',
                    comandaItems: comandaDetail?.items.map(i => i.serviceName).join(', ') || '',
                };
            });
            setEntries(mappedEntries);

            if (snapshot.cashClosing) {
                setCashClosingRecord(snapshot.cashClosing as unknown as CashClosingRecord);
                setObservations((snapshot.cashClosing as any).notes || '');
            } else {
                setCashClosingRecord(null);
                setObservations('');
            }
            setBarberClosingRecords(snapshot.barberClosings as unknown as BarberClosingRecord[]);
            setClosingEvents(snapshot.events);

            setAppointments(snapshot.appointments as unknown as AppointmentRecord[]);
            setComandas(snapshot.comandas as unknown as ComandaRecord[]);
            setOpenComandasCount(snapshot.openComandasCount);
            setOpenComandasTotal(snapshot.openComandasTotal);
            setClubOverdueCount(snapshot.clubOverdueCount);
            setClubOverdueTotal(snapshot.clubOverdueTotal);
            setPendingReceiptsCount(0);
            setPendingReceiptsTotal(0);

        } catch (error: any) {
            if (requestId !== fetchRequestIdRef.current) return;
            console.error('Erro ao carregar dados:', error);
            setLoadError(error?.message || 'Nao foi possivel carregar os dados.');
            setEntries([]);
            setComandaDetails([]);
            setAppointments([]);
            setComandas([]);
            setStaffList([]);
        } finally {
            if (requestId === fetchRequestIdRef.current) {
                setLoading(false);
            }
        }
    }, [tenantId, filterDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const staffMap = useMemo(() => {
        const map: Record<string, { name: string; role: string; commissionRate: number }> = {};
        staffList.forEach(s => { map[s.id] = { name: s.name, role: s.role || '', commissionRate: normalizePercentage(s.commission_rate ?? 40) }; });
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

    const reversalEntries = useMemo(
        () => filteredEntries.filter(e => e.isReversalTransaction),
        [filteredEntries]
    );

    const daySummary = useMemo(() => {
        return cashClosingApplicationService.computeDaySummary({
            filteredEntries,
            extras,
            comandas,
            appointments,
            filteredComandaDetails,
            barberSummaries,
            reversalEntries,
        });
    }, [filteredEntries, extras, comandas, appointments, filteredComandaDetails, barberSummaries, reversalEntries]);

    const {
        totals,
        validation,
        paymentMethodBreakdown,
        agendaSummary,
        timeline,
        dailyAudit,
        indicators,
        barberClosingDetails,
    } = daySummary;

    const totalEntradas = totals.totalEntradas;
    const totalSaidas = totals.totalSaidas;
    const saldoAtual = totals.saldoAtual;
    const totalExtrasSuprimento = totals.totalExtrasSuprimento;
    const totalExtrasSangria = totals.totalExtrasSangria;
    const totalExpected = totals.totalExpected;
    const totalReceived = totals.totalReceived;
    const entradasCount = totals.entradasCount;
    const saidasCount = totals.saidasCount;
    const totalReversals = totals.totalReversals;
    const reversalCount = totals.reversalCount;

    const paymentRows = useMemo(() => buildPaymentMethodRows(filteredEntries, extras), [filteredEntries, extras]);

    const hasPendingAlerts = openComandasCount > 0 || clubOverdueCount > 0 || pendingReceiptsCount > 0;
    const hasDailyFinancialData = entries.length > 0;

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

        try {
            await cashClosingApplicationService.saveDraftConference({
                tenantId,
                date: filterDate,
                userId: user?.id,
                notes: observations || null,
                totals: {
                    totalEntradas,
                    totalSaidas,
                    saldoAtual,
                    totalExtrasSuprimento,
                    totalExtrasSangria,
                    totalExpected,
                    totalReceived,
                },
                totalReceived,
                difference: validation.difference,
                agendaSummary,
                paymentMethodBreakdown: paymentMethodBreakdown.map(([method, data]) => ({
                    method,
                    entradas: data.entradas,
                    saidas: data.saidas,
                    count: data.count,
                })),
                extras,
                filters,
                barberSummaries,
            });
            setLastSavedAt(new Date().toISOString());
        } catch (error: any) {
            throw error;
        } finally {
            setSaving(false);
        }
    }, [tenantId, filterDate, user?.id, totalEntradas, totalSaidas, saldoAtual, totalReceived, validation.difference, agendaSummary, entradasCount, saidasCount, paymentMethodBreakdown, extras, observations, totalExpected, filters, barberSummaries, totalExtrasSangria, totalExtrasSuprimento]);

    // TODO [FASE]: Adicionar campo `needs_reconciliation BOOLEAN DEFAULT false`
    // na tabela cash_closings para permitir retry/identificação de fechamentos
    // com transações órfãs. Atualmente, apenas logs documentam a inconsistência.
    const handleCloseCash = useCallback(async () => {
        if (!tenantId) return;
        setClosing(true);

        try {
            await cashClosingApplicationService.closeCashRegister({
                tenantId,
                date: filterDate,
                userId: user?.id || '',
                extras,
                totals: {
                    totalEntradas,
                    totalSaidas,
                    saldoAtual,
                    totalExtrasSuprimento,
                    totalExtrasSangria,
                    totalExpected,
                    totalReceived,
                },
                agendaSummary,
                barberSummaries,
                indicators,
                timeline,
                audit: dailyAudit,
            });
            setLastSavedAt(new Date().toISOString());
        } catch (error: any) {
            throw error;
        } finally {
            setClosing(false);
        }
    }, [tenantId, filterDate, user?.id, extras, totalEntradas, totalSaidas, saldoAtual, totalReceived, validation.difference, agendaSummary, paymentMethodBreakdown, observations, totalExpected, filters, barberSummaries, totalExtrasSangria, totalExtrasSuprimento, indicators, timeline, dailyAudit]);

    const closeBarberCash = useCallback(async (barberStaffId: string, conference: { countedCash: number; justification: string }) => {
        if (!tenantId || !cashClosingRecord) return;

        const barberDetail = barberClosingDetails.find(b => b.staffId === barberStaffId);
        if (!barberDetail) return;

        const expectedCash = barberDetail.paymentMethods['Dinheiro'] || 0;

        await cashClosingApplicationService.closeBarberCash({
            tenantId,
            barberId: barberStaffId,
            barberName: barberDetail.staffName,
            businessDate: filterDate,
            countedCash: conference.countedCash,
            expectedCash,
            totalProduced: barberDetail.totalProduced,
            totalReceived: barberDetail.totalReceived,
            totalCommission: barberDetail.commission,
            repasse: barberDetail.repasse,
            discounts: barberDetail.discounts,
            advances: barberDetail.advances,
            balance: barberDetail.balance,
            comandasCount: barberDetail.clientsServed.length,
            clientsServedCount: barberDetail.clientsServed.length,
            productsSoldCount: barberDetail.productsSold.length,
            paymentMethods: barberDetail.paymentMethods,
            productsSold: barberDetail.productsSold,
            timeline,
            cashClosingId: cashClosingRecord.id,
            userId: user?.id || '',
            justification: conference.justification,
        });

        await fetchData();
    }, [tenantId, cashClosingRecord, barberClosingDetails, filterDate, user?.id, timeline, fetchData]);

    const recordEvent = useCallback(async (
        eventType: CashClosingEventRecord['event_type'],
        label: string,
        detail?: string,
        metadata?: Record<string, any>,
    ) => {
        if (!tenantId) return;

        await cashClosingApplicationService.recordEvent(
            tenantId,
            eventType,
            label,
            detail,
            metadata,
            user?.id,
            cashClosingRecord?.id || null,
        );
    }, [tenantId, cashClosingRecord?.id, user?.id]);

    const openCashRegister = useCallback(async () => {
        if (!tenantId) return;
        const { start, end } = getDayRange(filterDate);

        try {
            await cashClosingApplicationService.openCashRegister({
                tenantId,
                date: filterDate,
                userId: user?.id || '',
                periodStart: start,
                periodEnd: end,
            });
            await fetchData();
        } catch (error: any) {
            console.error('Erro ao abrir caixa:', error);
            throw error;
        }
    }, [tenantId, filterDate, getDayRange, user?.id, fetchData]);

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
