import { describe, it, expect } from 'vitest';
import {
  findActiveOpenComanda,
  getTopFrequentItems,
  resolveItemCommission,
  type QuickComandaSummary,
  type CatalogItem,
  type HistoricalItemUsage,
} from './comandaQuickActions';

describe('comandaQuickActions', () => {
  describe('findActiveOpenComanda', () => {
    const today = new Date('2026-10-25T14:00:00Z');

    const mockComandas: QuickComandaSummary[] = [
      {
        id: 'cmd-1',
        client_id: 'client-123',
        status: 'open',
        created_at: '2026-10-25T10:30:00Z',
      },
      {
        id: 'cmd-2',
        client_id: 'client-456',
        status: 'paid',
        created_at: '2026-10-25T11:00:00Z',
      },
      {
        id: 'cmd-3',
        client_id: 'client-123',
        status: 'open',
        created_at: '2026-10-24T09:00:00Z', // Ontem
      },
      {
        id: 'cmd-4',
        client_id: null,
        status: 'open',
        created_at: '2026-10-25T12:00:00Z', // Consumidor final
      },
    ];

    it('should find active open comanda for client today', () => {
      const result = findActiveOpenComanda(mockComandas, 'client-123', today);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('cmd-1');
    });

    it('should return null if client only has closed/paid comanda today', () => {
      const result = findActiveOpenComanda(mockComandas, 'client-456', today);
      expect(result).toBeNull();
    });

    it('should return null if customerId is null or empty (Consumidor Final / Balcão)', () => {
      expect(findActiveOpenComanda(mockComandas, null, today)).toBeNull();
      expect(findActiveOpenComanda(mockComandas, '', today)).toBeNull();
      expect(findActiveOpenComanda(mockComandas, '   ', today)).toBeNull();
    });

    it('should return null if client has no comandas at all', () => {
      const result = findActiveOpenComanda(mockComandas, 'client-999', today);
      expect(result).toBeNull();
    });
  });

  describe('getTopFrequentItems', () => {
    const catalog: CatalogItem[] = [
      { id: 'srv-1', name: 'Corte Tradicional', price: 40, type: 'service' },
      { id: 'srv-2', name: 'Barba Terapia', price: 35, type: 'service' },
      { id: 'prd-1', name: 'Cerveja Artesanal', price: 15, type: 'product' },
      { id: 'prd-2', name: 'Pomada Matte', price: 45, type: 'product' },
      { id: 'prd-3', name: 'Água Mineral', price: 5, type: 'product' },
      { id: 'srv-3', name: 'Pézinho / Acabamento', price: 20, type: 'service' },
    ];

    it('should return top 4 items sorted by frequency from history', () => {
      const history: HistoricalItemUsage[] = [
        { service_id: 'srv-1', quantity: 1 },
        { service_id: 'srv-1', quantity: 2 }, // Total srv-1 = 3
        { product_id: 'prd-1', quantity: 5 }, // Total prd-1 = 5 (Top 1)
        { service_id: 'srv-2', quantity: 4 }, // Total srv-2 = 4 (Top 2)
        { product_id: 'prd-2', quantity: 2 }, // Total prd-2 = 2
      ];

      const top = getTopFrequentItems(history, catalog, 4);
      expect(top).toHaveLength(4);
      expect(top[0].id).toBe('prd-1'); // 5
      expect(top[1].id).toBe('srv-2'); // 4
      expect(top[2].id).toBe('srv-1'); // 3
      expect(top[3].id).toBe('prd-2'); // 2
    });

    it('should return first N catalog items when history is empty', () => {
      const top = getTopFrequentItems([], catalog, 3);
      expect(top).toHaveLength(3);
      expect(top.map((i) => i.id)).toEqual(['srv-1', 'srv-2', 'prd-1']);
    });

    it('should resolve item by product_name when id is missing in history', () => {
      const history: HistoricalItemUsage[] = [
        { product_name: 'Água Mineral', quantity: 10 },
      ];

      const top = getTopFrequentItems(history, catalog, 2);
      expect(top[0].id).toBe('prd-3'); // 10
    });
  });

  describe('resolveItemCommission', () => {
    const item: CatalogItem = {
      id: 'srv-1',
      name: 'Corte Tradicional',
      price: 40,
      type: 'service',
    };

    it('should resolve to house direct when professional is null or "house"', () => {
      const resNull = resolveItemCommission(item, null);
      expect(resNull.isHouseDirect).toBe(true);
      expect(resNull.staffId).toBeNull();
      expect(resNull.role).toBe('house');
      expect(resNull.label).toBe('Venda Direta / Balcão');

      const resHouse = resolveItemCommission(item, 'house');
      expect(resHouse.isHouseDirect).toBe(true);
      expect(resHouse.staffId).toBeNull();
    });

    it('should assign to specific professional when id is provided', () => {
      const res = resolveItemCommission(item, 'staff-123', 'Carlos Barbeiro');
      expect(res.isHouseDirect).toBe(false);
      expect(res.staffId).toBe('staff-123');
      expect(res.role).toBe('primary');
      expect(res.label).toBe('Carlos Barbeiro');
    });
  });
});
