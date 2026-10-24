import { describe, it, expect } from 'vitest';
import {
  getSaoPauloDateParts,
  getQuickPeriodDateRange,
  parseDateInputToUtcBoundary,
  filterComandas,
  calculateComandaKpiSummary,
  ComandaFilterTarget,
} from './comandaFilters';

describe('comandaFilters utility suite', () => {
  describe('Timezone & Date range calculation', () => {
    it('should extract correct Sao Paulo date parts', () => {
      // 2026-10-25 01:00:00 UTC = 2026-10-24 22:00:00 in SP (UTC-3)
      const dateUtc = new Date(Date.UTC(2026, 9, 25, 1, 0, 0));
      const parts = getSaoPauloDateParts(dateUtc);
      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(10);
      expect(parts.day).toBe(24);
    });

    it('should calculate today date range correctly', () => {
      const dateRef = new Date(Date.UTC(2026, 9, 24, 15, 0, 0));
      const range = getQuickPeriodDateRange('today', dateRef);
      expect(range.startDate).toBe('2026-10-24');
      expect(range.endDate).toBe('2026-10-24');
    });

    it('should calculate yesterday date range correctly', () => {
      const dateRef = new Date(Date.UTC(2026, 9, 24, 15, 0, 0));
      const range = getQuickPeriodDateRange('yesterday', dateRef);
      expect(range.startDate).toBe('2026-10-23');
      expect(range.endDate).toBe('2026-10-23');
    });

    it('should calculate this_week date range starting Monday and ending Sunday', () => {
      // 2026-10-24 is Saturday (day 6) -> Monday is 2026-10-19, Sunday is 2026-10-25
      const dateRef = new Date(Date.UTC(2026, 9, 24, 15, 0, 0));
      const range = getQuickPeriodDateRange('this_week', dateRef);
      expect(range.startDate).toBe('2026-10-19');
      expect(range.endDate).toBe('2026-10-25');
    });

    it('should calculate this_month date range from day 1 to last day', () => {
      const dateRef = new Date(Date.UTC(2026, 9, 24, 15, 0, 0)); // October 2026 has 31 days
      const range = getQuickPeriodDateRange('this_month', dateRef);
      expect(range.startDate).toBe('2026-10-01');
      expect(range.endDate).toBe('2026-10-31');
    });

    it('should return empty range for all and custom presets', () => {
      expect(getQuickPeriodDateRange('all')).toEqual({ startDate: '', endDate: '' });
      expect(getQuickPeriodDateRange('custom')).toEqual({ startDate: '', endDate: '' });
    });

    it('should parse date string boundaries for UTC filtering', () => {
      const start = parseDateInputToUtcBoundary('2026-10-24', false);
      expect(start?.toISOString()).toBe('2026-10-24T00:00:00.000Z');

      const end = parseDateInputToUtcBoundary('2026-10-24', true);
      expect(end?.toISOString()).toBe('2026-10-24T23:59:59.999Z');
    });
  });

  describe('filterComandas', () => {
    const mockComandas: ComandaFilterTarget[] = [
      {
        id: 'cmd-001',
        status: 'open',
        total: 120.0,
        created_at: '2026-10-24T10:00:00.000Z',
        clients: { name: 'João Santos', phone: '11988887777' },
        staff_id: 'staff-1',
        staff_ids: ['staff-1'],
        staff_names: ['Lucas Barbeiro'],
        comanda_items: [
          { id: 'item-1', product_name: 'Corte', quantity: 1, unit_price: 70, staff_id: 'staff-1' },
          { id: 'item-2', product_name: 'Pomada', quantity: 1, unit_price: 50, staff_id: 'staff-1' },
        ],
      },
      {
        id: 'cmd-002',
        status: 'paid',
        total: 80.0,
        created_at: '2026-10-24T14:30:00.000Z',
        closed_at: '2026-10-24T15:15:00.000Z',
        clients: { name: 'Marcos Silva', phone: '11977776666' },
        staff_id: 'staff-2',
        staff_ids: ['staff-2'],
        staff_names: ['Pedro Barbeiro'],
        comanda_items: [
          { id: 'item-3', product_name: 'Barba', quantity: 1, unit_price: 80, staff_id: 'staff-2' },
        ],
      },
      {
        id: 'cmd-003',
        status: 'cancelled',
        total: 50.0,
        created_at: '2026-10-23T11:00:00.000Z',
        clients: { name: 'Carlos Teste', phone: '11966665555' },
        staff_id: 'staff-1',
        staff_ids: ['staff-1'],
        staff_names: ['Lucas Barbeiro'],
        comanda_items: [],
      },
      {
        id: 'cmd-004',
        status: 'open',
        total: 200.0,
        created_at: '2026-10-22T18:00:00.000Z',
        clients: { name: 'Roberto Pereira', phone: '11955554444' },
        staff_id: 'staff-3',
        staff_ids: ['staff-3'],
        staff_names: ['Ana Esteticista'],
        comanda_items: [],
      },
    ];

    it('should filter by status open', () => {
      const result = filterComandas(mockComandas, { status: 'open' });
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.id)).toEqual(['cmd-001', 'cmd-004']);
    });

    it('should filter by status paid', () => {
      const result = filterComandas(mockComandas, { status: 'paid' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cmd-002');
    });

    it('should filter by professional staffId', () => {
      const result = filterComandas(mockComandas, { status: 'all', staffId: 'staff-2' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cmd-002');
    });

    it('should filter by date range', () => {
      const result = filterComandas(mockComandas, {
        status: 'all',
        dateFrom: '2026-10-24',
        dateTo: '2026-10-24',
      });
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.id)).toEqual(['cmd-001', 'cmd-002']);
    });

    it('should filter by search term matching client name', () => {
      const result = filterComandas(mockComandas, { status: 'all', searchTerm: 'santos' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cmd-001');
    });

    it('should filter by search term matching phone number', () => {
      const result = filterComandas(mockComandas, { status: 'all', searchTerm: '977776666' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cmd-002');
    });

    it('should filter by search term matching comanda ID', () => {
      const result = filterComandas(mockComandas, { status: 'all', searchTerm: 'cmd-004' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cmd-004');
    });

    it('should apply combined filters (status open + staff-1 + date 2026-10-24)', () => {
      const result = filterComandas(mockComandas, {
        status: 'open',
        staffId: 'staff-1',
        dateFrom: '2026-10-24',
        dateTo: '2026-10-24',
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cmd-001');
    });
  });

  describe('calculateComandaKpiSummary', () => {
    it('should return zeros for empty list', () => {
      const summary = calculateComandaKpiSummary([]);
      expect(summary).toEqual({
        openCount: 0,
        openTotal: 0,
        paidCount: 0,
        paidTotal: 0,
        cancelledCount: 0,
        cancelledTotal: 0,
        totalCount: 0,
        averageTicket: 0,
      });
    });

    it('should calculate correct summary totals and ticket average', () => {
      const list: ComandaFilterTarget[] = [
        { id: '1', status: 'open', total: 100, created_at: '' },
        { id: '2', status: 'open', total: 150, created_at: '' },
        { id: '3', status: 'paid', total: 200, created_at: '' },
        { id: '4', status: 'cancelled', total: 50, created_at: '' },
      ];

      const summary = calculateComandaKpiSummary(list);
      expect(summary.openCount).toBe(2);
      expect(summary.openTotal).toBe(250);
      expect(summary.paidCount).toBe(1);
      expect(summary.paidTotal).toBe(200);
      expect(summary.cancelledCount).toBe(1);
      expect(summary.cancelledTotal).toBe(50);
      expect(summary.totalCount).toBe(4);
      // Average ticket: (100 + 150 + 200) / 3 non-cancelled = 450 / 3 = 150
      expect(summary.averageTicket).toBe(150);
    });
  });
});
