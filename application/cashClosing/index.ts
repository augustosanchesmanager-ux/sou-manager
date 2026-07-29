/**
 * [SMG][APPLICATION][CASH_CLOSING] index
 *
 * Classe compositora + re-exports.
 * Mantém a API pública idêntica para o hook.
 */

import type { CashClosingEntryExtended, SangriaSuprimento } from '../../components/financial/cashCloseUtils';
import type { CashClosingEventRecord } from '../../domain/cashClosing/types';
import type {
    CashClosingSnapshot,
    CloseCashParams,
    CloseBarberCashParams,
    OpenCashParams,
    SaveConferenceParams,
    DaySummaryResult,
    TotalsData,
} from './types';
import {
    loadDailySnapshot as _loadDailySnapshot,
    loadTransactions as _loadTransactions,
    loadAppointments as _loadAppointments,
    loadReceivables as _loadReceivables,
    loadReferenceData as _loadReferenceData,
    loadClosings as _loadClosings,
    loadReversals as _loadReversals,
    loadComandasWithDetails as _loadComandasWithDetails,
} from './loaders';
import { calculateTotals as _calculateTotals, validate as _validate, computeDaySummary as _computeDaySummary } from './summary';
import {
    openCashRegister as _openCashRegister,
    closeCashRegister as _closeCashRegister,
    closeBarberCash as _closeBarberCash,
    saveDraftConference as _saveDraftConference,
    recordEvent as _recordEvent,
} from './operations';

class CashClosingApplicationServiceImpl {
    // ── Summary ──
    calculateTotals(entries: CashClosingEntryExtended[], extras: SangriaSuprimento[]): TotalsData {
        return _calculateTotals(entries, extras);
    }

    validate(totalExpected: number, countedCash: number) {
        return _validate(totalExpected, countedCash);
    }

    computeDaySummary(params: {
        filteredEntries: CashClosingEntryExtended[];
        extras: SangriaSuprimento[];
        comandas: any[];
        appointments: any[];
        filteredComandaDetails: import('../../components/financial/cashCloseUtils').ComandaDetail[];
        barberSummaries: import('../../components/financial/cashCloseUtils').BarberSummary[];
        reversalEntries: CashClosingEntryExtended[];
    }): DaySummaryResult {
        return _computeDaySummary(params);
    }

    // ── Operations ──
    async openCashRegister(params: OpenCashParams): Promise<void> {
        return _openCashRegister(params);
    }

    async closeCashRegister(params: CloseCashParams): Promise<void> {
        return _closeCashRegister(params);
    }

    async closeBarberCash(params: CloseBarberCashParams): Promise<void> {
        return _closeBarberCash(params);
    }

    async saveDraftConference(params: SaveConferenceParams): Promise<void> {
        return _saveDraftConference(params);
    }

    async recordEvent(
        tenantId: string,
        eventType: CashClosingEventRecord['event_type'],
        label: string,
        detail?: string,
        metadata?: Record<string, unknown>,
        userId?: string,
        cashClosingId?: string | null,
    ): Promise<void> {
        return _recordEvent(tenantId, eventType, label, detail, metadata, userId, cashClosingId);
    }

    // ── Loaders ──
    async loadDailySnapshot(tenantId: string, date: string): Promise<CashClosingSnapshot> {
        return _loadDailySnapshot(tenantId, date);
    }
}

export const cashClosingApplicationService = new CashClosingApplicationServiceImpl();

export { CashClosingError } from './types';
export type {
    DailySnapshotParams,
    CashClosingSnapshot,
    TotalsData,
    CloseCashParams,
    CloseBarberCashParams,
    OpenCashParams,
    SaveConferenceParams,
    DaySummaryTotals,
    DaySummaryResult,
} from './types';
