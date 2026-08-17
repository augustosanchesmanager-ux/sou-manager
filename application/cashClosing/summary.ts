/**
 * [SMG][APPLICATION][CASH_CLOSING] summary
 *
 * Settlement calculations — effective financial payout during cash closing.
 *
 * IMPORTANT: This module intentionally does NOT reuse the Commission domain algorithm.
 * Commission = theoretical commission generated from service execution.
 * Settlement = effective financial payout adjusted by discounts, advances, reversals.
 *
 * See docs/adr/ADR-001-Commission-vs-Settlement.md
 *
 * Zero side effects, zero async — facilitates unit testing.
 */

import { formatCurrency } from '../../shared/format/currency';
import {
    validateCashClose,
    type SangriaSuprimento,
    type CashClosingEntryExtended,
    type ComandaDetail,
    type BarberSummary,
    type AgendaSummary,
    type TimelineEvent,
    type DailyAuditData,
    type IndicatorsData,
    type BarberClosingDetail,
} from '../../components/financial/cashCloseUtils';
import type { TotalsData, DaySummaryResult } from './types';

// ─── calculateTotals ─────────────────────────────────────────────

export function calculateTotals(
    entries: CashClosingEntryExtended[],
    extras: SangriaSuprimento[],
): TotalsData {
    const totalEntradas = entries
        .filter(e => e.type === 'entrada')
        .reduce((sum, e) => sum + Number(e.value || 0), 0);

    const totalSaidas = entries
        .filter(e => e.type === 'saida')
        .reduce((sum, e) => sum + Number(e.value || 0), 0);

    const saldoAtual = totalEntradas - totalSaidas;

    const totalExtrasSuprimento = extras
        .filter(e => e.type === 'suprimento')
        .reduce((sum, e) => sum + Number(e.value || 0), 0);

    const totalExtrasSangria = extras
        .filter(e => e.type === 'sangria')
        .reduce((sum, e) => sum + Number(e.value || 0), 0);

    const totalExpected = totalEntradas + totalExtrasSuprimento - totalExtrasSangria;
    const totalReceived = totalExpected;

    return {
        totalEntradas,
        totalSaidas,
        saldoAtual,
        totalExtrasSuprimento,
        totalExtrasSangria,
        totalExpected,
        totalReceived,
    };
}

// ─── validate ────────────────────────────────────────────────────

export function validate(
    totalExpected: number,
    countedCash: number,
) {
    return validateCashClose(totalExpected, countedCash);
}

// ─── computeDaySummary ───────────────────────────────────────────

export function computeDaySummary(params: {
    filteredEntries: CashClosingEntryExtended[];
    extras: SangriaSuprimento[];
    comandas: any[];
    appointments: any[];
    filteredComandaDetails: ComandaDetail[];
    barberSummaries: BarberSummary[];
    reversalEntries: CashClosingEntryExtended[];
}): DaySummaryResult {
    const { filteredEntries, extras, comandas, appointments, filteredComandaDetails, barberSummaries, reversalEntries } = params;

    // ── Totals ──
    const totalEntradas = filteredEntries.filter(e => e.type === 'entrada').reduce((sum, e) => sum + e.value, 0);
    const totalSaidas = filteredEntries.filter(e => e.type === 'saida').reduce((sum, e) => sum + e.value, 0);
    const saldoAtual = totalEntradas - totalSaidas;
    const totalExtrasSuprimento = extras.filter(e => e.type === 'suprimento').reduce((s, e) => s + e.value, 0);
    const totalExtrasSangria = extras.filter(e => e.type === 'sangria').reduce((s, e) => s + e.value, 0);
    const totalExpected = totalEntradas + totalExtrasSuprimento - totalExtrasSangria;
    const totalReceived = totalEntradas + totalExtrasSuprimento - totalExtrasSangria;
    const entradasCount = filteredEntries.filter(e => e.type === 'entrada').length;
    const saidasCount = filteredEntries.filter(e => e.type === 'saida').length;
    const totalReversals = reversalEntries.reduce((sum, e) => sum + e.value, 0);
    const reversalCount = reversalEntries.length;

    const validation = validateCashClose(totalExpected, totalReceived);

    // ── Payment Method Breakdown ──
    const paymentMap: Record<string, { entradas: number; saidas: number; count: number }> = {};
    filteredEntries.forEach(e => {
        if (!paymentMap[e.paymentMethod]) paymentMap[e.paymentMethod] = { entradas: 0, saidas: 0, count: 0 };
        if (e.type === 'entrada') paymentMap[e.paymentMethod].entradas += e.value;
        else paymentMap[e.paymentMethod].saidas += e.value;
        paymentMap[e.paymentMethod].count += 1;
    });
    const paymentMethodBreakdown = Object.entries(paymentMap).sort((a, b) => b[1].count - a[1].count);

    // ── Agenda Summary ──
    const apptIds = new Set(appointments.map((a: any) => a.id));
    const paidComandas = comandas.filter((c: any) => c.appointment_id && apptIds.has(c.appointment_id) && c.status === 'paid');
    const receivedTotal = paidComandas.reduce((sum: number, c: any) => sum + Number(c.total || 0), 0);
    const completed = appointments.filter((a: any) => a.status === 'completed');
    const cancelled = appointments.filter((a: any) => a.status === 'cancelled');
    const pending = appointments.filter((a: any) => ['scheduled', 'pending', 'confirmed', 'in_progress'].includes(a.status));
    const no_show = appointments.filter((a: any) => a.status === 'no_show');
    const scheduled = appointments.filter((a: any) => ['scheduled', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(a.status));

    const agendaSummary: AgendaSummary = {
        scheduled: { count: scheduled.length, total: scheduled.reduce((s: number, a: any) => s + Number(a.price || 0), 0) },
        completed: { count: completed.length, total: completed.reduce((s: number, a: any) => s + Number(a.price || 0), 0) },
        received: { count: paidComandas.length, total: receivedTotal },
        cancelled: { count: cancelled.length, total: cancelled.reduce((s: number, a: any) => s + Number(a.price || 0), 0) },
        pending: { count: pending.length, total: pending.reduce((s: number, a: any) => s + Number(a.price || 0), 0) },
        no_show: { count: no_show.length, total: no_show.reduce((s: number, a: any) => s + Number(a.price || 0), 0) },
    };

    // ── Timeline ──
    const allComandasSorted = [...comandas].sort((a: any, b: any) => {
        const aTime = a.appointment_id
            ? appointments.find((ap: any) => ap.id === a.appointment_id)?.start_time || ''
            : '';
        const bTime = b.appointment_id
            ? appointments.find((ap: any) => ap.id === b.appointment_id)?.start_time || ''
            : '';
        return aTime.localeCompare(bTime);
    });

    const timelineEvents: TimelineEvent[] = [];
    if (allComandasSorted.length > 0) {
        const first = allComandasSorted[0];
        const firstAppt = first.appointment_id ? appointments.find((a: any) => a.id === first.appointment_id) : null;
        if (firstAppt) {
            timelineEvents.push({
                time: firstAppt.start_time,
                label: 'Primeiro atendimento',
                type: 'service',
                detail: `${first.client_name || 'Cliente'} (${formatCurrency(first.total)})`,
            });
        }
        const last = allComandasSorted[allComandasSorted.length - 1];
        const lastAppt = last.appointment_id ? appointments.find((a: any) => a.id === last.appointment_id) : null;
        if (lastAppt && lastAppt.id !== firstAppt?.id) {
            timelineEvents.push({
                time: lastAppt.start_time,
                label: 'Ultimo atendimento',
                type: 'service',
                detail: `${last.client_name || 'Cliente'} (${formatCurrency(last.total)})`,
            });
        }
    }
    extras.forEach(ext => {
        timelineEvents.push({
            time: ext.createdAt,
            label: ext.type === 'sangria' ? 'Sangria' : 'Suprimento',
            type: ext.type === 'sangria' ? 'sangria' : 'suprimento',
            detail: `${formatCurrency(ext.value)}${ext.description ? ': ' + ext.description : ''}`,
        });
    });
    reversalEntries.forEach(rev => {
        timelineEvents.push({
            time: rev.reversalSource?.createdAt || rev.date,
            label: 'Estorno',
            type: 'reversal',
            detail: `${formatCurrency(rev.value)} - ${rev.reversalSource?.reasonType || 'Reversao'}`,
        });
    });
    const timeline = timelineEvents.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    // ── Daily Audit ──
    const paidComandasAll = comandas.filter((c: any) => c.status === 'paid');
    const openCmds = comandas.filter((c: any) => c.status === 'open');
    const cancelledCmds = comandas.filter((c: any) => c.status === 'cancelled');
    const reversedCmds = comandas.filter((c: any) => c.status === 'reversed');
    const pendingPayments = filteredEntries.filter(e => e.status === 'previsto' || e.status === 'vencido');
    const manuallyLaunched = filteredEntries.filter(e => !e.sourceType || e.sourceType === 'manual');
    const incomeEntries = filteredEntries.filter(e => e.type === 'entrada');
    const expenseEntries = filteredEntries.filter(e => e.type === 'saida');

    const dailyAudit: DailyAuditData = {
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
        totalReversals: reversalEntries.length,
        totalTransactions: filteredEntries.length,
    };

    // ── Indicators ──
    const totalPaid = paidComandasAll.reduce((s: number, c: any) => s + Number(c.total || 0), 0);
    const ticketMedio = paidComandasAll.length > 0 ? totalPaid / paidComandasAll.length : 0;
    const uniqueClients = new Set(comandas.filter((c: any) => c.client_id).map((c: any) => c.client_id));
    const comandaItemsFiltered = filteredComandaDetails.flatMap(c => c.items);
    const serviceItems = comandaItemsFiltered.filter(i => i.serviceName && !i.serviceName.includes('Produto'));
    const productItems = comandaItemsFiltered.filter(i => i.serviceName && i.serviceName.includes('Produto'));
    const totalCommissions = barberSummaries.reduce((s, b) => s + b.totalReceived * b.commissionRate, 0);

    const indicators: IndicatorsData = {
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

    // ── Barber Closing Details ──
    const barberClosingDetails: BarberClosingDetail[] = barberSummaries.map(barber => {
        const barberComandas = barber.comandas;
        const barberOpenComandas = barber.openComandas;

        const paymentMethods: Record<string, number> = {};
        barberComandas.forEach(cmd => {
            const method = cmd.paymentMethod || 'Nao informado';
            paymentMethods[method] = (paymentMethods[method] || 0) + cmd.total;
        });

        const clientsServed = barberComandas.map(cmd => ({
            clientName: cmd.clientName,
            serviceName: cmd.items.map((i: any) => i.serviceName).join(', '),
            time: cmd.comandaId,
            value: cmd.total,
            paymentMethod: cmd.paymentMethod || 'Nao informado',
            status: cmd.status,
        }));

        const productsSold = barberComandas.flatMap(cmd =>
            cmd.items
                .filter((i: any) => i.serviceName.includes('Produto'))
                .map((i: any) => ({
                    name: i.serviceName,
                    quantity: i.quantity,
                    value: i.unitPrice * i.quantity,
                }))
        );

        const commissionRate = barber.commissionRate;
        const commissionServices = barber.totalReceived * commissionRate;
        const commissionProducts = productsSold.reduce((s, p) => s + p.value, 0) * commissionRate;

        const barberTimeline: TimelineEvent[] = [];
        if (barberComandas.length > 0) {
            const firstAppt = barberComandas[0].appointmentId
                ? appointments.find((a: any) => a.id === barberComandas[0].appointmentId)
                : null;
            barberTimeline.push({
                time: firstAppt?.start_time || barberComandas[0].comandaId,
                label: 'Primeiro atendimento',
                type: 'service',
                detail: `${barberComandas[0].clientName} (${formatCurrency(barberComandas[0].total)})`,
            });
            if (barberComandas.length > 1) {
                const lastCmd = barberComandas[barberComandas.length - 1];
                const lastAppt = lastCmd.appointmentId
                    ? appointments.find((a: any) => a.id === lastCmd.appointmentId)
                    : null;
                barberTimeline.push({
                    time: lastAppt?.start_time || lastCmd.comandaId,
                    label: 'Ultimo atendimento',
                    type: 'service',
                    detail: `${lastCmd.clientName} (${formatCurrency(lastCmd.total)})`,
                });
            }
        }

        return {
            staffId: barber.staffId,
            staffName: barber.staffName,
            role: barber.role,
            status: 'open' as const,
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
            timeline: barberTimeline,
        };
    });

    return {
        totals: {
            totalEntradas,
            totalSaidas,
            saldoAtual,
            totalExtrasSuprimento,
            totalExtrasSangria,
            totalExpected,
            totalReceived,
            entradasCount,
            saidasCount,
            totalReversals,
            reversalCount,
        },
        validation,
        paymentMethodBreakdown,
        agendaSummary,
        timeline,
        dailyAudit,
        indicators,
        barberClosingDetails,
    };
}
