/**
 * [SMG][APPLICATION][CASH_CLOSING] operations
 *
 * Operações de mutação: abrir, fechar, fechar barbeiro, draft, eventos.
 */

import {
    cashClosingRepository,
    barberClosingRepository,
    cashClosingEventRepository,
} from '../../domain/cashClosing/repository';
import type { CashClosingEventRecord } from '../../domain/cashClosing/types';
import { transactionRepository } from '../../domain/transaction/repository';
import { appEventBus } from '../../domain/events/app-bus';
import { createEvent } from '../../domain/events/types';
import type { CashClosingCompletedEvent } from '../../domain/events/types';
import type {
    OpenCashParams,
    CloseCashParams,
    CloseBarberCashParams,
    SaveConferenceParams,
} from './types';

// ─── openCashRegister ────────────────────────────────────────────

export async function openCashRegister(params: OpenCashParams): Promise<void> {
    const { tenantId, date, userId, periodStart, periodEnd } = params;

    const existing = await cashClosingRepository.getByBusinessDate(tenantId, date);

    if (existing) {
        await cashClosingRepository.upsert({
            ...existing,
            opening_time: new Date().toISOString(),
            ...(periodStart ? { period_start: periodStart } : {}),
            ...(periodEnd ? { period_end: periodEnd } : {}),
        });
    } else {
        await cashClosingRepository.upsert({
            tenant_id: tenantId,
            business_date: date,
            status: 'draft',
            opening_time: new Date().toISOString(),
            created_by_user_id: userId,
            ...(periodStart ? { period_start: periodStart } : {}),
            ...(periodEnd ? { period_end: periodEnd } : {}),
        });
    }

    await cashClosingEventRepository.insert({
        tenant_id: tenantId,
        cash_closing_id: null,
        barber_closing_id: null,
        business_date: date,
        event_type: 'opening',
        event_time: new Date().toISOString(),
        label: 'Caixa aberto',
        detail: `Caixa aberto por ${userId}`,
        metadata: {},
        created_by_user_id: userId,
    });
}

// ─── closeCashRegister ───────────────────────────────────────────

export async function closeCashRegister(params: CloseCashParams): Promise<void> {
    const { tenantId, date, userId, countedCash, extras, totals, agendaSummary, indicators } = params;

    if (extras.length > 0) {
        const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR');
        const extraTransactions = extras.map(extra => ({
            type: (extra.type === 'sangria' ? 'expense' : 'income') as 'expense' | 'income',
            category: extra.type === 'sangria' ? 'Sangria - Fechamento' : 'Suprimento - Fechamento',
            amount: Number(extra.value),
            description: extra.description || `${extra.type === 'sangria' ? 'Sangria' : 'Suprimento'} - ${formattedDate}`,
            payment_method: 'Dinheiro',
            date: new Date().toISOString(),
            status: 'completed' as const,
            source_type: 'cash_closing' as const,
            user_id: userId,
        }));

        try {
            await transactionRepository.createBulk(extraTransactions, tenantId);
        } catch (txErr) {
            console.error('[SMG][CASH_CLOSING] Erro ao persistir extras como transações:', txErr);
            throw txErr;
        }
    }

    const existing = await cashClosingRepository.getByBusinessDate(tenantId, date);

    if (existing) {
        await cashClosingRepository.upsert({
            ...existing,
            status: 'confirmed',
            confirmed_by_user_id: userId,
            confirmed_at: new Date().toISOString(),
            closing_time: new Date().toISOString(),
            expected_income: totals.totalEntradas,
            expected_expense: totals.totalSaidas,
            expected_balance: totals.totalExpected,
            total_counted: countedCash,
            total_sangrias: totals.totalExtrasSangria,
            total_suprimentos: totals.totalExtrasSuprimento,
            total_difference: countedCash - totals.totalExpected,
            financial_summary: indicators as any,
            appointments_summary: agendaSummary as any,
        } as any);
    }

    await cashClosingEventRepository.insert({
        tenant_id: tenantId,
        cash_closing_id: existing?.id ?? null,
        barber_closing_id: null,
        business_date: date,
        event_type: 'closing',
        event_time: new Date().toISOString(),
        label: 'Caixa fechado',
        detail: `Caixa fechado por ${userId}. Total: R$ ${countedCash.toFixed(2)}`,
        metadata: {},
        created_by_user_id: userId,
    });

    // Publish domain event
    await appEventBus.publish(createEvent<CashClosingCompletedEvent>({
        eventType: 'CashClosingCompleted',
        aggregateId: existing?.id || '',
        aggregateType: 'cash_closing',
        payload: {
            closingId: existing?.id || '',
            businessDate: date,
            closedBy: userId,
            expectedBalance: totals.totalExpected,
            countedBalance: countedCash,
            difference: countedCash - totals.totalExpected,
            extrasCount: extras.length,
            hasDiscrepancy: Math.abs(countedCash - totals.totalExpected) > 0.01,
        },
        metadata: {
            tenantId,
            source: 'CashClosingApplicationService',
        },
    }));
}

// ─── closeBarberCash ─────────────────────────────────────────────

export async function closeBarberCash(params: CloseBarberCashParams): Promise<void> {
    const {
        tenantId, barberId, barberName, businessDate, countedCash, expectedCash,
        totalProduced, totalReceived, totalCommission, repasse, discounts, advances, balance,
        comandasCount, clientsServedCount, productsSoldCount, paymentMethods,
        cashClosingId, userId, justification,
    } = params;

    const cashDifference = countedCash - expectedCash;
    const hasDiscrepancy = Math.abs(cashDifference) > 0.01;
    const status = hasDiscrepancy ? 'discrepancy' : 'closed';

    const checklist = {
        allCommandsClosed: true,
        conferenceDone: true,
        cashCounted: true,
        productsVerified: true,
    };

    const allClosings = await barberClosingRepository.getByCashClosingId(cashClosingId, tenantId);
    const existing = allClosings.find(bc => bc.staff_id === barberId) ?? null;

    const barberClosingData = {
        ...(existing ? { id: existing.id } : {}),
        tenant_id: tenantId,
        cash_closing_id: cashClosingId,
        business_date: businessDate,
        staff_id: barberId,
        status,
        total_produced: totalProduced,
        total_received: totalReceived,
        commission_total: totalCommission,
        repasse_total: repasse,
        discounts_total: discounts,
        advances_total: advances,
        balance,
        payment_methods: paymentMethods,
        counted_cash: countedCash,
        expected_cash: expectedCash,
        cash_difference: cashDifference,
        conference_justification: justification || null,
        checklist,
        comandas_count: comandasCount,
        clients_served_count: clientsServedCount,
        products_sold_count: productsSoldCount,
        closed_by_user_id: userId,
        closed_at: new Date().toISOString(),
    };

    await barberClosingRepository.upsert(barberClosingData as any);

    const allBarberClosings = await barberClosingRepository.getByCashClosingId(cashClosingId, tenantId);
    const completeCount = allBarberClosings.filter(
        (bc: any) => bc.status === 'closed' || bc.status === 'discrepancy'
    ).length;

    await cashClosingRepository.updateBarberClosingsCount(cashClosingId, tenantId, {
        barber_closings_count: completeCount,
        barber_closings_complete: allBarberClosings.length > 0 && completeCount === allBarberClosings.length,
    });

    await cashClosingEventRepository.insert({
        tenant_id: tenantId,
        cash_closing_id: cashClosingId,
        barber_closing_id: null,
        business_date: businessDate,
        event_type: 'barber_closing',
        event_time: new Date().toISOString(),
        label: `Fechamento - ${barberName}`,
        detail: `Produção: R$ ${totalReceived.toFixed(2)} | Comissão: R$ ${totalCommission.toFixed(2)} | Status: ${status}`,
        metadata: {
            barberId,
            countedCash,
            expectedCash,
            cashDifference,
        },
        created_by_user_id: userId,
    });
}

// ─── saveDraftConference ─────────────────────────────────────────

export async function saveDraftConference(params: SaveConferenceParams): Promise<void> {
    const {
        tenantId, date, userId, notes, totals, totalReceived, difference,
        agendaSummary, paymentMethodBreakdown, extras, filters, barberSummaries,
    } = params;

    const existing = await cashClosingRepository.getByBusinessDate(tenantId, date);
    const { start, end } = existing?.period_start
        ? { start: existing.period_start, end: existing.period_end }
        : { start: new Date().toISOString(), end: new Date().toISOString() };

    await cashClosingRepository.upsert({
        tenant_id: tenantId,
        business_date: date,
        period_start: start,
        period_end: end,
        status: 'draft',
        created_by_user_id: userId,
        notes: notes || null,
        expected_income: totals.totalEntradas,
        expected_expense: totals.totalSaidas,
        expected_balance: totals.totalExpected,
        total_counted: totalReceived,
        total_difference: difference,
        appointments_scheduled_count: agendaSummary.scheduled.count,
        appointments_completed_count: agendaSummary.completed.count,
        appointments_received_count: agendaSummary.received.count,
        appointments_cancelled_count: agendaSummary.cancelled.count,
        appointments_pending_count: agendaSummary.pending.count,
        appointments_no_show_count: agendaSummary.no_show.count,
        appointments_summary: JSON.stringify(agendaSummary),
        financial_summary: JSON.stringify({
            entradas: totals.totalEntradas,
            saidas: totals.totalSaidas,
            saldo: totals.saldoAtual,
            payment_methods: paymentMethodBreakdown,
            extras,
            notes,
            total_expected: totals.totalExpected,
            total_received: totalReceived,
            difference,
            filters,
            barber_summaries: barberSummaries.map(b => ({
                name: b.staffName, role: b.role, total: b.totalReceived, count: b.comandaCount,
            })),
        }),
    } as any);
}

// ─── recordEvent ─────────────────────────────────────────────────

export async function recordEvent(
    tenantId: string,
    eventType: CashClosingEventRecord['event_type'],
    label: string,
    detail?: string,
    metadata?: Record<string, unknown>,
    userId?: string,
    cashClosingId?: string | null,
): Promise<void> {
    try {
        await cashClosingEventRepository.insert({
            tenant_id: tenantId,
            cash_closing_id: cashClosingId ?? null,
            barber_closing_id: null,
            business_date: new Date().toISOString().split('T')[0],
            event_type: eventType,
            event_time: new Date().toISOString(),
            label,
            detail: detail || null,
            metadata: metadata || {},
            created_by_user_id: userId ?? null,
        });
    } catch (eventErr) {
        console.warn('[SMG][CASH_CLOSING][EVENT] Audit trail incompleto:', { eventType, eventErr });
    }
}
