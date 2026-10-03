import { describe, it, expect } from 'vitest';
import { computeDaySummary } from './summary';

const emptyParams = {
  filteredEntries: [],
  extras: [],
  comandas: [],
  appointments: [],
  filteredComandaDetails: [],
  barberSummaries: [],
  reversalEntries: [],
};

const makeBarber = (overrides: Record<string, unknown> = {}) =>
  ({
    staffId: 'staff-heron',
    staffName: 'Heron',
    role: 'barber',
    commissionRate: 0.5,
    totalReceived: 100,
    pendingTotal: 0,
    openTotal: 0,
    comandaCount: 1,
    openComandaCount: 0,
    comandas: [],
    openComandas: [],
    ...overrides,
  }) as any;

describe('Fase C: apuração de settlement', () => {
  it('should_exclude_openTotal_from_totalProduced_when_tem_comandas_abertas', () => {
    const result = computeDaySummary({
      ...emptyParams,
      barberSummaries: [makeBarber({ totalReceived: 100, pendingTotal: 0, openTotal: 250 })],
    });

    const heron = result.barberClosingDetails.find(b => b.staffId === 'staff-heron');
    expect(heron!.totalProduced).toBe(100);
  });

  it('should_report_zero_pending_when_no_fiado', () => {
    const result = computeDaySummary({
      ...emptyParams,
      barberSummaries: [makeBarber({ totalReceived: 100, pendingTotal: 0 })],
    });

    const heron = result.barberClosingDetails.find(b => b.staffId === 'staff-heron');
    expect(heron!.pendingReceived).toBe(0);
    expect(heron!.pendingCommission).toBe(0);
    expect(heron!.totalProduced).toBe(heron!.totalReceived);
  });

  it('should_split_commission_when_fiado_parcial_50_50', () => {
    const result = computeDaySummary({
      ...emptyParams,
      barberSummaries: [makeBarber({ totalReceived: 50, pendingTotal: 50 })],
    });

    const heron = result.barberClosingDetails.find(b => b.staffId === 'staff-heron');
    expect(heron!.totalProduced).toBe(100);
    expect(heron!.totalReceived).toBe(50);
    expect(heron!.pendingReceived).toBe(50);
    expect(heron!.commission).toBe(25);
    expect(heron!.pendingCommission).toBe(25);
    expect(heron!.repasse).toBe(25);
  });

  it('should_sum_fiadoTotal_in_dailyAudit_across_barbers', () => {
    const result = computeDaySummary({
      ...emptyParams,
      barberSummaries: [
        makeBarber({ staffId: 'a', totalReceived: 50, pendingTotal: 50 }),
        makeBarber({ staffId: 'b', totalReceived: 30, pendingTotal: 20 }),
      ],
    });

    expect(result.dailyAudit.fiadoTotal).toBe(70);
  });

  it('should_round_pendingCommission_to_cents', () => {
    const result = computeDaySummary({
      ...emptyParams,
      barberSummaries: [
        makeBarber({ commissionRate: 0.3333, totalReceived: 0, pendingTotal: 100 }),
      ],
    });

    const heron = result.barberClosingDetails.find(b => b.staffId === 'staff-heron');
    expect(heron!.pendingCommission).toBe(33.33);
  });
});