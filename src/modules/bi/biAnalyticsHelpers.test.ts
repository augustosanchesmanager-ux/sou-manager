import { describe, it, expect } from 'vitest';
import { buildRevenueEvolutionSeries, buildServiceMatrix2x2 } from './biAnalyticsHelpers';

describe('src/modules/bi/biAnalyticsHelpers (ADR-057 Lote 1)', () => {
  it('should_aggregate_last_6_months_without_merging_previous_year_or_shifting_utc_dates', () => {
    const ref = new Date('2026-11-26T15:00:00-03:00');
    const result = buildRevenueEvolutionSeries(
      [
        // Previous year same month name (Nov/25) must NOT be merged into Nov/26
        { date: '2025-11-15', amount: 9999, type: 'income' },
        // Pure YYYY-MM-DD on the 1st must stay in Nov/26 (not shift to Oct)
        { date: '2026-11-01', amount: 250, type: 'income' },
        { date: '2026-11-20T22:30:00-03:00', amount: 150, type: 'income' },
        { date: '2026-11-10', amount: 80, type: 'expense' },
        // Unknown type should not inflate expense
        { date: '2026-11-12', amount: 500, type: 'adjustment' },
        { date: '2026-10-05', amount: 300, type: 'income' },
      ],
      ref
    );

    expect(result).toHaveLength(6);
    expect(result[0].month).toBe('Jun/26');
    expect(result[4]).toEqual({ month: 'Out/26', income: 300, expense: 0 });
    expect(result[5]).toEqual({ month: 'Nov/26', income: 400, expense: 80 });
  });

  it('should_classify_services_into_2x2_quadrants_by_volume_and_ticket', () => {
    const matrix = buildServiceMatrix2x2([
      { name: 'Combo Corte + Barba', count: 40, revenue: 4000 }, // ticket 100 -> star
      { name: 'Platinado Premium', count: 5, revenue: 900 },     // ticket 180 -> opportunity
      { name: 'Corte Simples', count: 50, revenue: 2000 },       // ticket 40  -> traffic
      { name: 'Sobrancelha', count: 8, revenue: 160 },           // ticket 20  -> review
    ]);

    const byName = Object.fromEntries(matrix.points.map((p) => [p.name, p.quadrant]));
    expect(byName['Combo Corte + Barba']).toBe('star');
    expect(byName['Platinado Premium']).toBe('opportunity');
    expect(byName['Corte Simples']).toBe('traffic');
    expect(byName['Sobrancelha']).toBe('review');
    expect(matrix.countsByQuadrant).toEqual({ star: 1, opportunity: 1, traffic: 1, review: 1 });
  });
});
