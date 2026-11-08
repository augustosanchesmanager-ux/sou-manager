import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBiDateRange, fetchBiCockpitData } from './biCockpitService';

vi.mock('../../../services/supabaseClient', () => {
  const dummyChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        revenue_goal: 30000,
        appointments_goal: 400,
        clients_goal: 70,
        period: 'monthly',
      },
      error: null,
    }),
  };

  return {
    supabase: {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'staff') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: (resolve: any) =>
              resolve({
                data: [
                  { id: 'staff-1', name: 'Rubens Sanchez', status: 'active', role: 'manager' },
                  { id: 'staff-2', name: 'Heron Ferreira', status: 'active', role: 'barber' },
                ],
                error: null,
              }),
          };
        }
        return dummyChain;
      }),
    },
    getClientForTable: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            { id: '1', amount: 1500, type: 'income', date: '2026-11-01' },
            { id: '2', amount: 300, type: 'expense', date: '2026-11-02' },
          ],
          error: null,
        }),
      }),
    }),
  };
});

describe('biCockpitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBiDateRange', () => {
    it('should_calculate_today_range_correctly', () => {
      const fixedDate = new Date('2026-11-08T12:00:00Z');
      const { from, to } = getBiDateRange('today', fixedDate);

      expect(from.getDate()).toBe(fixedDate.getDate());
      expect(to.getDate()).toBe(fixedDate.getDate());
      expect(from.getHours()).toBe(0);
      expect(to.getHours()).toBe(23);
    });

    it('should_calculate_7d_range_correctly', () => {
      const fixedDate = new Date('2026-11-08T12:00:00Z');
      const { from, to } = getBiDateRange('7d', fixedDate);

      const diffDays = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(7);
    });

    it('should_calculate_30d_range_correctly', () => {
      const fixedDate = new Date('2026-11-08T12:00:00Z');
      const { from, to } = getBiDateRange('30d', fixedDate);

      const diffDays = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(30);
    });
  });

  describe('fetchBiCockpitData', () => {
    it('should_return_complete_cockpit_structure', async () => {
      const data = await fetchBiCockpitData('tenant-123', '30d');

      // Metrics
      expect(data.metrics).toBeDefined();
      expect(typeof data.metrics.grossRevenue).toBe('number');
      expect(typeof data.metrics.netRevenue).toBe('number');
      expect(typeof data.metrics.averageTicket).toBe('number');

      // Timeline
      expect(Array.isArray(data.timeline)).toBe(true);
      expect(data.timeline.length).toBeGreaterThan(0);
      expect(data.timeline[0]).toHaveProperty('grossRevenue');
      expect(data.timeline[0]).toHaveProperty('netRevenue');

      // Composition Donut
      expect(Array.isArray(data.composition)).toBe(true);
      expect(data.composition.some((c) => c.name.includes('Serviços'))).toBe(true);
      expect(data.composition.some((c) => c.name.includes('Produtos'))).toBe(true);

      // Goals
      expect(Array.isArray(data.goals)).toBe(true);
      expect(data.goals.length).toBe(3);
      expect(data.goals[0].target).toBe(30000); // from mock tenant_goals

      // Staff Radar
      expect(data.radar).toBeDefined();
      expect(Array.isArray(data.radar.points)).toBe(true);
      expect(Array.isArray(data.radar.staffProfiles)).toBe(true);
      expect(data.radar.staffProfiles.length).toBeGreaterThan(0);
    });
  });
});
