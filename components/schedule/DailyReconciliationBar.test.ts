/**
 * [SMG][SCHEDULE] DailyReconciliationBar unit tests
 *
 * Valida o cálculo puro de métricas e anomalias diárias da Barra de Conciliação.
 */

import { describe, expect, it } from 'vitest';
import {
  computeDailyReconciliation,
  type ReconciliationAppointmentItem,
} from './DailyReconciliationBar';
import type { AppointmentComandaSummary } from '../../domain/comanda/types';

const makeAppointment = (
  overrides: Partial<ReconciliationAppointmentItem> = {},
): ReconciliationAppointmentItem => ({
  id: 'apt-1',
  client: 'João Silva',
  clientPhone: '11999999999',
  service: 'Corte Masculino',
  staffId: 'staff-1',
  staffName: 'Carlos',
  start: 10,
  duration: 1,
  startTime: '2026-11-15T10:00:00-03:00',
  date: '2026-11-15T10:00:00-03:00',
  status: 'confirmed',
  price: 50,
  ...overrides,
});

describe('computeDailyReconciliation', () => {
  const selectedDate = new Date('2026-11-15T12:00:00-03:00');
  const now = new Date('2026-11-15T14:00:00-03:00');

  it('should_classify_overdue_checkin_pending_cash_and_completed_cycle_correctly', () => {
    // Arrange
    const appointments: ReconciliationAppointmentItem[] = [
      // (a) Atrasado s/ check-in (10h < 14h, confirmed)
      makeAppointment({
        id: 'apt-overdue-confirmed',
        status: 'confirmed',
        start: 10,
        startTime: '2026-11-15T10:00:00-03:00',
      }),
      // (a) Atrasado s/ check-in (11h < 14h, pending)
      makeAppointment({
        id: 'apt-overdue-pending',
        status: 'pending',
        start: 11,
        startTime: '2026-11-15T11:00:00-03:00',
      }),
      // Futuro confirmado (16h > 14h) -> não é anomalia
      makeAppointment({
        id: 'apt-future',
        status: 'confirmed',
        start: 16,
        startTime: '2026-11-15T16:00:00-03:00',
      }),
      // (b) Caixa Pendente: completed com comanda open
      makeAppointment({
        id: 'apt-completed-open',
        status: 'completed',
        start: 9,
        startTime: '2026-11-15T09:00:00-03:00',
        price: 50,
      }),
      // (b) Caixa Pendente: in_progress com comanda open
      makeAppointment({
        id: 'apt-inprogress-open',
        status: 'in_progress',
        start: 13.5,
        startTime: '2026-11-15T13:30:00-03:00',
        price: 70,
      }),
      // (c) Ciclo Concluído: completed com comanda paid
      makeAppointment({
        id: 'apt-completed-paid',
        status: 'completed',
        start: 8,
        startTime: '2026-11-15T08:00:00-03:00',
        price: 60,
      }),
      // (c) Ciclo Concluído: completed sem comanda vinculada (avulso gratuito)
      makeAppointment({
        id: 'apt-completed-free',
        status: 'completed',
        start: 8.5,
        startTime: '2026-11-15T08:30:00-03:00',
        price: 0,
      }),
      // (c) Ciclo Concluído: cancelled e no_show
      makeAppointment({
        id: 'apt-cancelled',
        status: 'cancelled',
        start: 12,
        startTime: '2026-11-15T12:00:00-03:00',
      }),
      makeAppointment({
        id: 'apt-noshow',
        status: 'no_show',
        start: 12.5,
        startTime: '2026-11-15T12:30:00-03:00',
      }),
    ];

    const comandasByAppointment: Record<string, AppointmentComandaSummary> = {
      'apt-completed-open': { id: 'c1', status: 'open', total: 65 },
      'apt-inprogress-open': { id: 'c2', status: 'open', total: 70 },
      'apt-completed-paid': { id: 'c3', status: 'paid', total: 60 },
      'apt-cancelled': { id: 'c4', status: 'cancelled', total: 50 },
    };

    // Act
    const result = computeDailyReconciliation(appointments, comandasByAppointment, selectedDate, now);

    // Assert
    expect(result.awaitingCheckIn.map((item) => item.appointment.id)).toEqual([
      'apt-overdue-confirmed',
      'apt-overdue-pending',
    ]);
    expect(result.pendingCash.map((item) => item.appointment.id)).toEqual([
      'apt-completed-open',
      'apt-inprogress-open',
    ]);
    expect(result.pendingCashTotal).toBe(135);
    expect(result.completedCycle.map((item) => item.id)).toEqual([
      'apt-completed-paid',
      'apt-completed-free',
      'apt-cancelled',
      'apt-noshow',
    ]);
    expect(result.totalAnomalies).toBe(4);
    expect(result.isFullyReconciled).toBe(false);
  });

  it('should_mark_day_as_fully_reconciled_when_there_are_no_anomalies', () => {
    // Arrange
    const appointments: ReconciliationAppointmentItem[] = [
      makeAppointment({
        id: 'apt-1',
        status: 'completed',
        start: 9,
        startTime: '2026-11-15T09:00:00-03:00',
      }),
      makeAppointment({
        id: 'apt-2',
        status: 'cancelled',
        start: 10,
        startTime: '2026-11-15T10:00:00-03:00',
      }),
      makeAppointment({
        id: 'apt-3',
        status: 'scheduled',
        start: 16,
        startTime: '2026-11-15T16:00:00-03:00',
      }),
    ];

    const comandasByAppointment: Record<string, AppointmentComandaSummary> = {
      'apt-1': { id: 'c1', status: 'paid', total: 80 },
      'apt-2': { id: 'c2', status: 'cancelled', total: 50 },
    };

    // Act
    const result = computeDailyReconciliation(appointments, comandasByAppointment, selectedDate, now);

    // Assert
    expect(result.awaitingCheckIn).toHaveLength(0);
    expect(result.pendingCash).toHaveLength(0);
    expect(result.completedCycle).toHaveLength(2);
    expect(result.totalAnomalies).toBe(0);
    expect(result.isFullyReconciled).toBe(true);
  });
});
