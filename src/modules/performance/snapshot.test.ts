import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildSnapshot,
  clampToRecordLimit,
  computeDeltas,
  dateKeyInSaoPaulo,
  resolveGoalContext,
  resolvePreviousWindow,
  resolveWindow,
} from './snapshot';
import type { PerformanceTotals, TenantGoal } from './types';
import {
  makePerformanceAppointment,
  makePerformanceComanda,
  makePerformanceContext,
  makePerformanceItem,
  makePerformanceParticipant,
  makePerformanceStaff,
  resetPerformanceSeq,
} from '../../../tests/builders/performance';

const windowFor = (from: string, to: string) => {
  const window = resolveWindow(from, to);
  if (!window) throw new Error(`Janela inválida no teste: ${from}..${to}`);
  return window;
};

const totals = (overrides: Partial<PerformanceTotals> = {}): PerformanceTotals => ({
  totalRevenue: 0,
  cashRevenue: 0,
  clubCreditVolume: 0,
  totalAttendances: 0,
  averageTicket: 0,
  totalCommissions: 0,
  netMargin: 0,
  netMarginPercent: 0,
  ...overrides,
});

const monthlyGoal = (overrides: Partial<TenantGoal> = {}): TenantGoal => ({
  id: 'goal-1',
  period: 'monthly',
  revenue_goal: 10_000,
  appointments_goal: 100,
  clients_goal: 80,
  active: true,
  ...overrides,
});

describe('buildSnapshot', () => {
  beforeEach(() => {
    resetPerformanceSeq();
  });

  it('should_fill_missing_days_with_zero_when_range_has_gaps', () => {
    const context = makePerformanceContext({
      staffById: new Map([['staff-1', makePerformanceStaff()]]),
    });
    const comandas = [
      makePerformanceComanda({
        total: 120,
        created_at: '2026-11-03T11:00:00-03:00',
        closed_at: '2026-11-03T12:00:00-03:00',
      }),
    ];

    const snapshot = buildSnapshot(comandas, context, windowFor('2026-11-01', '2026-11-07'));

    expect(snapshot.timeline).toHaveLength(7);
    expect(snapshot.timeline.map((point) => point.total)).toEqual([0, 0, 120, 0, 0, 0, 0]);
    expect(snapshot.timeline.map((point) => point.count)).toEqual([0, 0, 1, 0, 0, 0, 0]);
    expect(snapshot.timeline[2].label).toBe('03/11');
    expect(snapshot.timeline[2].tooltipLabel).toBe('03/11/2026');
    expect(snapshot.totals.totalRevenue).toBe(120);
  });

  it('should_aggregate_by_week_when_range_exceeds_31_days', () => {
    const context = makePerformanceContext({
      staffById: new Map([['staff-1', makePerformanceStaff()]]),
    });
    const comandas = [
      makePerformanceComanda({
        total: 100,
        created_at: '2026-10-01T11:00:00-03:00',
        closed_at: '2026-10-01T12:00:00-03:00',
      }),
      makePerformanceComanda({
        total: 250,
        created_at: '2026-10-05T11:00:00-03:00',
        closed_at: '2026-10-05T12:00:00-03:00',
      }),
    ];

    const window = windowFor('2026-10-01', '2026-11-15');
    const snapshot = buildSnapshot(comandas, context, window);

    expect(window.granularity).toBe('week');
    expect(snapshot.timeline).toHaveLength(7);
    expect(snapshot.timeline[0].key).toBe('2026-10-01');
    expect(snapshot.timeline[0].tooltipLabel).toBe('01/10 a 04/10');
    expect(snapshot.timeline[1].key).toBe('2026-10-05');
    expect(snapshot.timeline[1].total).toBe(250);
    expect(snapshot.timeline[snapshot.timeline.length - 1].key).toBe('2026-11-09');
    expect(snapshot.timeline.reduce((sum, point) => sum + point.total, 0)).toBe(350);
    expect(snapshot.totals.totalRevenue).toBe(350);
  });

  it('should_keep_timeline_and_totals_in_sync_when_zero_filling', () => {
    const context = makePerformanceContext({
      staffById: new Map([['staff-1', makePerformanceStaff()]]),
    });
    const comandas = [
      makePerformanceComanda({
        total: 80,
        closed_at: '2026-11-02T10:00:00-03:00',
        created_at: '2026-11-02T09:00:00-03:00',
      }),
      makePerformanceComanda({
        total: 320,
        closed_at: '2026-11-09T10:00:00-03:00',
        created_at: '2026-11-09T09:00:00-03:00',
      }),
    ];

    const window = windowFor('2026-10-01', '2026-11-15');
    const snapshot = buildSnapshot(comandas, context, window);

    const timelineRevenue = snapshot.timeline.reduce((sum, point) => sum + point.total, 0);
    const timelineCount = snapshot.timeline.reduce((sum, point) => sum + point.count, 0);
    expect(timelineRevenue).toBeCloseTo(snapshot.totals.totalRevenue, 6);
    expect(timelineCount).toBe(snapshot.totals.totalAttendances);
  });

  it('should_attribute_revenue_to_staff_when_participant_row_uses_staff_id_without_professional_id', () => {
    const staff = makePerformanceStaff({ id: 'staff-canon-1', name: 'Barbeiro Canônico' });
    const comanda = makePerformanceComanda({
      id: 'cmd-canon-1',
      total: 100,
      payment_method: 'dinheiro',
      closed_at: '2026-11-05T15:00:00-03:00',
      staff_id: null,
    });
    const item = makePerformanceItem({
      id: 'item-canon-1',
      comanda_id: 'cmd-canon-1',
      unit_price: 100,
      quantity: 1,
      staff_id: null,
    });
    // Schema real de produção retorna staff_id e não professional_id
    const participant = makePerformanceParticipant({
      id: 'part-canon-1',
      comanda_item_id: 'item-canon-1',
      professional_id: undefined,
      staff_id: 'staff-canon-1',
    });

    const context = makePerformanceContext({
      staffById: new Map([['staff-canon-1', staff]]),
      itemsByComandaId: new Map([['cmd-canon-1', [item]]]),
      participantsByItemId: new Map([['item-canon-1', [participant]]]),
    });

    const snapshot = buildSnapshot([comanda], context, windowFor('2026-11-01', '2026-11-07'));

    const staffMetric = snapshot.rankedStaff.find((s) => s.id === 'staff-canon-1');
    expect(staffMetric).toBeDefined();
    expect(staffMetric?.total_revenue).toBe(100);
    expect(staffMetric?.appointments_count).toBe(1);
  });

  it('should_attribute_comanda_to_appointment_day_when_regime_is_attendance', () => {
    const appointment = makePerformanceAppointment({
      id: 'apt-1',
      start_time: '2026-11-03T10:00:00-03:00',
    });
    const context = makePerformanceContext({
      dateRegime: 'attendance',
      staffById: new Map([['staff-1', makePerformanceStaff()]]),
      appointmentById: new Map([['apt-1', appointment]]),
    });
    const comanda = makePerformanceComanda({
      appointment_id: 'apt-1',
      total: 90,
      created_at: '2026-12-02T10:00:00-03:00',
      closed_at: '2026-12-02T11:00:00-03:00',
    });

    const snapshot = buildSnapshot([comanda], context, windowFor('2026-11-01', '2026-11-07'));

    expect(snapshot.timeline[2].total).toBe(90);
    expect(snapshot.totals.totalRevenue).toBe(90);
    expect(snapshot.totals.totalAttendances).toBe(1);
  });

  it('should_not_count_comanda_when_target_date_falls_outside_window', () => {
    const context = makePerformanceContext({
      staffById: new Map([['staff-1', makePerformanceStaff()]]),
    });
    const comanda = makePerformanceComanda({
      total: 500,
      created_at: '2026-12-01T10:00:00-03:00',
      closed_at: '2026-12-01T11:00:00-03:00',
    });

    const snapshot = buildSnapshot([comanda], context, windowFor('2026-11-01', '2026-11-30'));

    expect(snapshot.totals.totalRevenue).toBe(0);
    expect(snapshot.timeline.every((point) => point.total === 0)).toBe(true);
  });
});

describe('resolveWindow', () => {
  it('should_use_daily_granularity_when_range_is_31_days_or_less', () => {
    expect(windowFor('2026-11-01', '2026-11-30').granularity).toBe('day');
    expect(windowFor('2026-11-01', '2026-11-30').days).toBe(30);
  });

  it('should_use_weekly_granularity_when_range_exceeds_31_days', () => {
    expect(windowFor('2026-11-01', '2026-12-02').granularity).toBe('week');
  });

  it('should_swap_dates_when_from_is_after_to', () => {
    const window = windowFor('2026-11-30', '2026-11-01');
    expect(window.dateFrom).toBe('2026-11-01');
    expect(window.dateTo).toBe('2026-11-30');
    expect(window.days).toBe(30);
  });

  it('should_return_null_when_dates_are_invalid', () => {
    expect(resolveWindow('', '2026-11-30')).toBeNull();
    expect(resolveWindow('2026-02-30', '2026-03-05')).toBeNull();
  });
});

describe('resolvePreviousWindow', () => {
  it('should_end_on_the_day_before_when_window_starts_mid_month', () => {
    const previous = resolvePreviousWindow(windowFor('2026-11-01', '2026-11-15'));
    expect(previous?.dateFrom).toBe('2026-10-17');
    expect(previous?.dateTo).toBe('2026-10-31');
    expect(previous?.days).toBe(15);
  });

  it('should_use_full_previous_month_when_window_is_a_full_month', () => {
    const previous = resolvePreviousWindow(windowFor('2026-11-01', '2026-11-30'));
    expect(previous?.dateFrom).toBe('2026-10-01');
    expect(previous?.dateTo).toBe('2026-10-31');
    expect(previous?.days).toBe(31);
  });

  it('should_compare_short_month_with_full_previous_month', () => {
    const previous = resolvePreviousWindow(windowFor('2026-02-01', '2026-02-28'));
    expect(previous?.dateFrom).toBe('2026-01-01');
    expect(previous?.dateTo).toBe('2026-01-31');
    expect(previous?.days).toBe(31);
  });

  it('should_cross_year_boundary_when_window_starts_in_january', () => {
    const previous = resolvePreviousWindow(windowFor('2026-01-01', '2026-01-31'));
    expect(previous?.dateFrom).toBe('2025-12-01');
    expect(previous?.dateTo).toBe('2025-12-31');
    expect(previous?.days).toBe(31);
  });

  it('should_handle_leap_year_when_previous_month_is_february', () => {
    const previous = resolvePreviousWindow(windowFor('2028-03-01', '2028-03-31'));
    expect(previous?.dateFrom).toBe('2028-02-01');
    expect(previous?.dateTo).toBe('2028-02-29');
    expect(previous?.days).toBe(29);
  });
});

describe('computeDeltas', () => {
  it('should_return_null_when_previous_period_has_no_revenue_base', () => {
    const deltas = computeDeltas(
      totals({
        totalRevenue: 1000,
        totalAttendances: 10,
        averageTicket: 100,
        totalCommissions: 400,
        netMargin: 600,
        netMarginPercent: 60,
      }),
      totals(),
    );

    expect(deltas.revenuePct).toBeNull();
    expect(deltas.appointmentsPct).toBeNull();
    expect(deltas.averageTicketPct).toBeNull();
    expect(deltas.commissionPct).toBeNull();
    expect(deltas.netMarginPctPoints).toBe(60);
  });

  it('should_return_all_nulls_when_previous_totals_are_missing', () => {
    const deltas = computeDeltas(totals({ totalRevenue: 1000 }), null);
    expect(deltas).toEqual({
      revenuePct: null,
      appointmentsPct: null,
      averageTicketPct: null,
      commissionPct: null,
      netMarginPctPoints: null,
    });
  });

  it('should_compute_percentage_change_when_previous_has_base', () => {
    const deltas = computeDeltas(
      totals({ totalRevenue: 1500, totalAttendances: 12, averageTicket: 125 }),
      totals({ totalRevenue: 1000, totalAttendances: 10, averageTicket: 100 }),
    );

    expect(deltas.revenuePct).toBeCloseTo(50, 6);
    expect(deltas.appointmentsPct).toBeCloseTo(20, 6);
    expect(deltas.averageTicketPct).toBeCloseTo(25, 6);
  });
});

describe('resolveGoalContext', () => {
  it('should_apply_goal_when_window_covers_a_full_past_month', () => {
    const context = resolveGoalContext(
      windowFor('2026-10-01', '2026-10-31'),
      monthlyGoal(),
      '2026-11-15',
    );

    expect(context).toEqual({ applies: true, reason: null, pacePercent: null });
  });

  it('should_apply_goal_with_pace_when_window_is_current_month_until_today', () => {
    const context = resolveGoalContext(
      windowFor('2026-11-01', '2026-11-15'),
      monthlyGoal(),
      '2026-11-15',
    );

    expect(context.applies).toBe(true);
    expect(context.reason).toBeNull();
    expect(context.pacePercent).toBeCloseTo(50, 6);
  });

  it('should_not_apply_goal_when_window_is_a_partial_slice', () => {
    const context = resolveGoalContext(
      windowFor('2026-11-01', '2026-11-15'),
      monthlyGoal(),
      '2026-11-20',
    );

    expect(context).toEqual({
      applies: false,
      reason: 'partial_range',
      pacePercent: null,
    });
  });

  it('should_not_apply_goal_when_window_spans_more_than_one_month', () => {
    const context = resolveGoalContext(
      windowFor('2026-10-15', '2026-11-15'),
      monthlyGoal(),
      '2026-11-15',
    );

    expect(context.reason).toBe('multi_month');
    expect(context.applies).toBe(false);
  });

  it('should_not_apply_goal_when_tenant_has_no_active_goal', () => {
    expect(
      resolveGoalContext(windowFor('2026-11-01', '2026-11-30'), null, '2026-11-15').reason,
    ).toBe('no_goal');
    expect(
      resolveGoalContext(
        windowFor('2026-11-01', '2026-11-30'),
        monthlyGoal({ revenue_goal: 0, appointments_goal: 0 }),
        '2026-11-15',
      ).reason,
    ).toBe('no_goal');
  });
});

describe('clampToRecordLimit', () => {
  it('should_flag_truncated_when_row_cap_is_reached', () => {
    const rows = Array.from({ length: 501 }, (_, index) => index);
    const result = clampToRecordLimit(rows, 500);
    expect(result.rows).toHaveLength(500);
    expect(result.truncated).toBe(true);
  });

  it('should_keep_rows_when_below_cap', () => {
    expect(clampToRecordLimit([1, 2, 3], 500)).toEqual({
      rows: [1, 2, 3],
      truncated: false,
    });
  });
});

describe('dateKeyInSaoPaulo', () => {
  it('should_keep_late_night_payment_in_the_business_day', () => {
    expect(dateKeyInSaoPaulo('2026-11-05T02:00:00Z')).toBe('2026-11-04');
    expect(dateKeyInSaoPaulo('2026-11-05T03:00:00Z')).toBe('2026-11-05');
  });

  it('should_return_null_when_timestamp_is_invalid', () => {
    expect(dateKeyInSaoPaulo(null)).toBeNull();
    expect(dateKeyInSaoPaulo('not-a-date')).toBeNull();
  });
});
