/**
 * [SMG][APPLICATION][CASH_CLOSING] loaders
 *
 * Carregamento de dados para o snapshot diário.
 * Cada loader é uma função standalone, testável isoladamente.
 *
 * 4.7.4: Refactored to use domain repositories instead of direct Supabase calls.
 */

import {
    cashClosingRepository,
    barberClosingRepository,
    cashClosingEventRepository,
} from '../../domain/cashClosing/repository';
import { transactionRepository } from '../../domain/transaction/repository';
import type { Transaction } from '../../domain/transaction/types';
import { comandaRepository } from '../../domain/comanda/repository';
import { comandaItemRepository } from '../../domain/comanda/item-repository';
import type { Comanda } from '../../domain/comanda/types';
import type { ComandaItemRow } from '../../domain/comanda/item-repository';
import { receivableRepository } from '../../domain/receivable/repository';
import { staffRepository } from '../../domain/staff/repository';
import type { StaffMember } from '../../domain/staff/types';
import { clientRepository } from '../../domain/client/repository';
import { serviceRepository } from '../../domain/service/repository';
import type { ServiceRecord } from '../../domain/service/repository';
import { appointmentRepository } from '../../domain/appointment/repository';
import { financialReversalRepository } from '../../domain/financial/reversal-repository';
import type { ComandaDetail, ComandaItemDetail } from '../../components/financial/cashCloseUtils';
import type {
    AppointmentSnapshot,
    ComandaSnapshot,
    ComandaItemSnapshot,
    ClientSnapshot,
    ReceivableSnapshot,
    CashClosingSnapshotRecord,
    BarberClosingSnapshotRecord,
    ReversalSnapshot,
    CashClosingSnapshot,
} from './types';
import { CashClosingError } from './types';

// ─── Helpers ─────────────────────────────────────────────────────

export function getDayRange(dateStr: string): { start: string; end: string } {
    const d = new Date(dateStr + 'T00:00:00');
    const start = d.toISOString();
    const end = new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
    return { start, end };
}

// ─── Loaders ─────────────────────────────────────────────────────

export async function loadTransactions(tenantId: string, start: string, end: string): Promise<Transaction[]> {
    return transactionRepository.list(tenantId, { dateFrom: start, dateTo: end });
}

export async function loadAppointments(tenantId: string, start: string, end: string): Promise<AppointmentSnapshot[]> {
    try {
        const rows = await appointmentRepository.listForSnapshot(tenantId, start, end);
        return rows as AppointmentSnapshot[];
    } catch (err) {
        throw new CashClosingError(`Erro ao carregar agendamentos: ${(err as Error).message}`, 'LOAD_APPOINTMENTS', err);
    }
}

export async function loadReceivables(tenantId: string): Promise<ReceivableSnapshot[]> {
    const receivables = await receivableRepository.generateAndListPending(tenantId);
    return receivables.map(r => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
    }));
}

export async function loadReferenceData(tenantId: string): Promise<{
    staff: StaffMember[];
    clients: ClientSnapshot[];
    services: ServiceRecord[];
}> {
    const [allStaff, allClients, allServices] = await Promise.all([
        staffRepository.list(tenantId),
        clientRepository.list(tenantId),
        serviceRepository.list(tenantId),
    ]);
    return {
        staff: allStaff,
        clients: allClients.map(c => ({ id: c.id, name: c.name })),
        services: allServices,
    };
}

export async function loadClosings(tenantId: string, date: string): Promise<{
    cashClosing: CashClosingSnapshotRecord | null;
    barberClosings: BarberClosingSnapshotRecord[];
    events: import('../../domain/cashClosing/types').CashClosingEventRecord[];
}> {
    const cashClosing = await cashClosingRepository.getByBusinessDate(tenantId, date);
    let barberClosings: BarberClosingSnapshotRecord[] = [];
    let events: import('../../domain/cashClosing/types').CashClosingEventRecord[] = [];

    if (cashClosing) {
        barberClosings = await barberClosingRepository.getByCashClosingId(cashClosing.id, tenantId);
        events = await cashClosingEventRepository.getByBusinessDate(tenantId, date);
    }

    return {
        cashClosing: cashClosing as CashClosingSnapshotRecord | null,
        barberClosings: barberClosings as unknown as BarberClosingSnapshotRecord[],
        events,
    };
}

export async function loadReversals(tenantId: string, transactionIds: string[]): Promise<ReversalSnapshot[]> {
    try {
        if (transactionIds.length === 0) return [];
        const rows = await financialReversalRepository.listByTransactionIds(transactionIds, tenantId);
        return rows as ReversalSnapshot[];
    } catch (err) {
        console.warn('[SMG][CASH_CLOSING][REVERSALS] Erro ao carregar estornos:', err);
        return [];
    }
}

// ─── Comanda Details Builder ─────────────────────────────────────

function buildComandaDetails(
    comandas: Comanda[],
    items: ComandaItemRow[],
    staffMap: Record<string, { name: string; role: string }>,
    clientMap: Record<string, string>,
    serviceMap: Record<string, string>,
): Map<string, ComandaDetail> {
    const itemsByComanda = new Map<string, ComandaItemRow[]>();
    items.forEach(item => {
        const list = itemsByComanda.get(item.comanda_id) || [];
        list.push(item);
        itemsByComanda.set(item.comanda_id, list);
    });

    const result = new Map<string, ComandaDetail>();
    comandas.forEach(cmd => {
        const cmdItems = itemsByComanda.get(cmd.id) || [];
        const detailItems: ComandaItemDetail[] = cmdItems.map(item => {
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

        const resolvedStaffId = cmd.staff_id || cmdItems.find(i => i.staff_id)?.staff_id || null;
        const clientName = cmd.client_name || clientMap[cmd.client_id || ''] || 'Cliente nao identificado';

        result.set(cmd.id, {
            comandaId: cmd.id,
            clientId: cmd.client_id,
            clientName,
            staffId: resolvedStaffId,
            staffName: staffMap[resolvedStaffId || '']?.name || 'Sem profissional',
            paymentMethod: cmd.payment_method,
            total: Number(cmd.total || 0),
            status: cmd.status,
            appointmentId: cmd.appointment_id || null,
            createdAt: null,
            items: detailItems,
        });
    });

    return result;
}

export async function loadComandasWithDetails(
    tenantId: string,
    start: string,
    end: string,
    staffMap: Record<string, { name: string; role: string }>,
    clientMap: Record<string, string>,
    serviceMap: Record<string, string>,
): Promise<{
    comandas: ComandaSnapshot[];
    comandaItems: ComandaItemSnapshot[];
    comandaDetails: ComandaDetail[];
}> {
    const allComandas = await comandaRepository.list(tenantId, { dateFrom: start, dateTo: end });
    const comandaIds = allComandas.map(c => c.id);
    const allItems = await comandaItemRepository.listByComandaIds(comandaIds, tenantId);

    const comandaDetails = buildComandaDetails(allComandas, allItems, staffMap, clientMap, serviceMap);

    return {
        comandas: allComandas as unknown as ComandaSnapshot[],
        comandaItems: allItems as unknown as ComandaItemSnapshot[],
        comandaDetails: Array.from(comandaDetails.values()),
    };
}

// ─── Orchestrator ────────────────────────────────────────────────

export async function loadDailySnapshot(tenantId: string, date: string): Promise<CashClosingSnapshot> {
    const { start, end } = getDayRange(date);

    const [
        transactions,
        appointments,
        receivables,
        referenceData,
        closings,
    ] = await Promise.all([
        loadTransactions(tenantId, start, end),
        loadAppointments(tenantId, start, end),
        loadReceivables(tenantId),
        loadReferenceData(tenantId),
        loadClosings(tenantId, date),
    ]);

    const staffMap: Record<string, { name: string; role: string }> = {};
    referenceData.staff.forEach(s => { staffMap[s.id] = { name: s.name, role: s.role || '' }; });
    const clientMap: Record<string, string> = {};
    referenceData.clients.forEach(c => { clientMap[c.id] = c.name; });
    const serviceMap: Record<string, string> = {};
    referenceData.services.forEach(s => { serviceMap[s.id] = s.name; });

    const [comandaResult, reversals] = await Promise.all([
        loadComandasWithDetails(tenantId, start, end, staffMap, clientMap, serviceMap),
        loadReversals(tenantId, transactions.map(t => t.id).filter(Boolean)),
    ]);

    const openComandas = comandaResult.comandas.filter(c => c.status === 'open');
    const clubOverdue = receivables.filter(r => r.status === 'overdue');

    return {
        transactions,
        appointments,
        comandas: comandaResult.comandas,
        comandaItems: comandaResult.comandaItems,
        comandaDetails: comandaResult.comandaDetails,
        staff: referenceData.staff,
        clients: referenceData.clients,
        services: referenceData.services,
        receivables,
        reversals,
        cashClosing: closings.cashClosing,
        barberClosings: closings.barberClosings,
        events: closings.events,
        openComandasCount: openComandas.length,
        openComandasTotal: openComandas.reduce((sum, c) => sum + Number((c as any).total || 0), 0),
        clubOverdueCount: clubOverdue.length,
        clubOverdueTotal: clubOverdue.reduce((sum, r) => sum + Number(r.amount || 0), 0),
    };
}
