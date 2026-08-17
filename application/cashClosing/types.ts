/**
 * [SMG][APPLICATION][CASH_CLOSING] types
 *
 * Todos os tipos DTO, interfaces de params e erros do Cash Closing.
 */

import type { Transaction } from '../../domain/transaction/types';
import type { StaffMember } from '../../domain/staff/types';
import type { ServiceRecord } from '../../domain/service/repository';
import type { CashClosingEventRecord } from '../../domain/cashClosing/types';
import type {
    SangriaSuprimento,
    ComandaDetail,
    BarberSummary,
    CashCloseValidation,
    AgendaSummary,
    TimelineEvent,
    DailyAuditData,
    IndicatorsData,
    BarberClosingDetail,
} from '../../components/financial/cashCloseUtils';

// ─── Snapshot DTO ────────────────────────────────────────────────

export interface DailySnapshotParams {
    tenantId: string;
    date: string;
    appSlug?: string;
}

export interface CashClosingSnapshot {
    transactions: Transaction[];
    appointments: AppointmentSnapshot[];
    comandas: ComandaSnapshot[];
    comandaItems: ComandaItemSnapshot[];
    comandaDetails: ComandaDetail[];
    staff: StaffMember[];
    clients: ClientSnapshot[];
    services: ServiceRecord[];
    receivables: ReceivableSnapshot[];
    reversals: ReversalSnapshot[];
    cashClosing: CashClosingSnapshotRecord | null;
    barberClosings: BarberClosingSnapshotRecord[];
    events: CashClosingEventRecord[];
    openComandasCount: number;
    openComandasTotal: number;
    clubOverdueCount: number;
    clubOverdueTotal: number;
}

export interface AppointmentSnapshot {
    id: string;
    status: string;
    price: number;
    start_time: string;
    staff_id?: string | null;
}

export interface ComandaSnapshot {
    id: string;
    appointment_id: string | null;
    client_id: string | null;
    client_name: string | null;
    staff_id: string | null;
    status: string;
    total: number;
    payment_method: string | null;
}

export interface ComandaItemSnapshot {
    id: string;
    comanda_id: string;
    service_id: string | null;
    product_name: string | null;
    quantity: number;
    unit_price: number;
    staff_id: string | null;
}

export interface ClientSnapshot {
    id: string;
    name: string;
}

export interface ReceivableSnapshot {
    id: string;
    amount: number;
    status: string;
}

export interface CashClosingSnapshotRecord {
    id: string;
    business_date: string;
    status: string;
    notes?: string | null;
}

export interface BarberClosingSnapshotRecord {
    id: string;
    cash_closing_id: string;
    staff_id: string;
    status?: 'open' | 'closed' | 'discrepancy';
}

export interface ReversalSnapshot {
    original_transaction_id: string | null;
    reversal_transaction_id: string | null;
    reversal_type: string | null;
    amount: number | string | null;
    reason_type: string | null;
    created_at: string | null;
}

// ─── Params ──────────────────────────────────────────────────────

export interface TotalsData {
    totalEntradas: number;
    totalSaidas: number;
    saldoAtual: number;
    totalExtrasSuprimento: number;
    totalExtrasSangria: number;
    totalExpected: number;
}

export interface CloseCashParams {
    tenantId: string;
    date: string;
    userId: string;
    countedCash: number;
    extras: SangriaSuprimento[];
    totals: TotalsData;
    agendaSummary: AgendaSummary;
    barberSummaries: BarberSummary[];
    indicators: IndicatorsData;
    timeline: TimelineEvent[];
    audit: DailyAuditData;
}

export interface CloseBarberCashParams {
    tenantId: string;
    barberId: string;
    barberName: string;
    businessDate: string;
    countedCash: number;
    expectedCash: number;
    totalProduced: number;
    totalReceived: number;
    totalCommission: number;
    repasse: number;
    discounts: number;
    advances: number;
    balance: number;
    comandasCount: number;
    clientsServedCount: number;
    productsSoldCount: number;
    paymentMethods: Record<string, number>;
    productsSold: Array<{ name: string; quantity: number; value: number }>;
    timeline: TimelineEvent[];
    cashClosingId: string;
    userId: string;
    justification?: string;
}

export interface OpenCashParams {
    tenantId: string;
    date: string;
    userId: string;
    periodStart?: string;
    periodEnd?: string;
}

export interface SaveConferenceParams {
    tenantId: string;
    date: string;
    userId?: string;
    notes?: string | null;
    totals: TotalsData;
    totalReceived: number;
    difference: number;
    agendaSummary: AgendaSummary;
    paymentMethodBreakdown: Array<{ method: string; entradas: number; saidas: number; count: number }>;
    extras: SangriaSuprimento[];
    filters?: Record<string, unknown>;
    barberSummaries: BarberSummary[];
}

// ─── Summary Types ───────────────────────────────────────────────

export interface DaySummaryTotals {
    totalEntradas: number;
    totalSaidas: number;
    saldoAtual: number;
    totalExtrasSuprimento: number;
    totalExtrasSangria: number;
    totalExpected: number;
    entradasCount: number;
    saidasCount: number;
    totalReversals: number;
    reversalCount: number;
}

export interface DaySummaryResult {
    totals: DaySummaryTotals;
    validation: CashCloseValidation;
    paymentMethodBreakdown: Array<[string, { entradas: number; saidas: number; count: number }]>;
    agendaSummary: AgendaSummary;
    timeline: TimelineEvent[];
    dailyAudit: DailyAuditData;
    indicators: IndicatorsData;
    barberClosingDetails: BarberClosingDetail[];
}

// ─── Errors ──────────────────────────────────────────────────────

export class CashClosingError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'CashClosingError';
    }
}
