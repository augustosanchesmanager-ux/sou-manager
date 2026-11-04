import { describe, expect, it } from 'vitest';
import {
  calculateBarberStatementSummary,
  getDateRangeForStatementPeriod,
  type BarberStatementItem,
} from './barberStatement';

describe('barberStatement utils', () => {
  describe('calculateBarberStatementSummary', () => {
    it('should return zeroes for empty or null array', () => {
      const summary = calculateBarberStatementSummary([]);
      expect(summary).toEqual({
        confirmedCommission: 0,
        pendingCommission: 0,
        totalCommission: 0,
        grossProduction: 0,
        totalItems: 0,
        totalComandas: 0,
        averageTicket: 0,
      });

      // Resilience against null cast
      expect(calculateBarberStatementSummary(null as unknown as [])).toEqual(summary);
    });

    it('should correctly separate confirmed (paid comanda) from pending (open comanda)', () => {
      const items: BarberStatementItem[] = [
        {
          id: 'item-1',
          comandaId: 'com-1',
          createdAt: '2026-11-03T10:00:00Z',
          clientName: 'João Silva',
          itemName: 'Corte Degradê',
          itemType: 'service',
          grossValue: 60,
          commissionRate: 50,
          commissionValue: 30,
          comandaStatus: 'paid',
          isPaid: true,
        },
        {
          id: 'item-2',
          comandaId: 'com-2',
          createdAt: '2026-11-03T11:00:00Z',
          clientName: 'Pedro Santos',
          itemName: 'Barba Terapia',
          itemType: 'service',
          grossValue: 40,
          commissionRate: 50,
          commissionValue: 20,
          comandaStatus: 'open',
          isPaid: false,
        },
      ];

      const result = calculateBarberStatementSummary(items);

      expect(result.confirmedCommission).toBe(30);
      expect(result.pendingCommission).toBe(20);
      expect(result.totalCommission).toBe(50);
      expect(result.grossProduction).toBe(100);
      expect(result.totalItems).toBe(2);
      expect(result.totalComandas).toBe(2);
      expect(result.averageTicket).toBe(50); // 100 / 2 comandas
    });

    it('should calculate commissionValue from rate if commissionValue is missing', () => {
      const items: BarberStatementItem[] = [
        {
          id: 'item-1',
          comandaId: 'com-1',
          createdAt: '2026-11-03T10:00:00Z',
          clientName: 'Carlos Lima',
          itemName: 'Pomada Modeladora',
          itemType: 'product',
          grossValue: 50,
          commissionRate: 10, // 10% de 50 = 5
          commissionValue: 0,
          comandaStatus: 'paid',
          isPaid: true,
        },
      ];

      const result = calculateBarberStatementSummary(items);
      expect(result.confirmedCommission).toBe(5);
      expect(result.pendingCommission).toBe(0);
      expect(result.grossProduction).toBe(50);
    });

    it('should ignore cancelled comandas completely', () => {
      const items: BarberStatementItem[] = [
        {
          id: 'item-1',
          comandaId: 'com-1',
          createdAt: '2026-11-03T10:00:00Z',
          clientName: 'Cliente Cancelado',
          itemName: 'Corte',
          itemType: 'service',
          grossValue: 100,
          commissionRate: 50,
          commissionValue: 50,
          comandaStatus: 'cancelled',
          isPaid: false,
        },
        {
          id: 'item-2',
          comandaId: 'com-2',
          createdAt: '2026-11-03T11:00:00Z',
          clientName: 'Cliente Ativo',
          itemName: 'Corte',
          itemType: 'service',
          grossValue: 60,
          commissionRate: 50,
          commissionValue: 30,
          comandaStatus: 'paid',
          isPaid: true,
        },
      ];

      const result = calculateBarberStatementSummary(items);
      expect(result.totalItems).toBe(1);
      expect(result.grossProduction).toBe(60);
      expect(result.confirmedCommission).toBe(30);
      expect(result.pendingCommission).toBe(0);
    });

    it('should group items of the same comanda for average ticket calculation', () => {
      const items: BarberStatementItem[] = [
        {
          id: 'item-1',
          comandaId: 'com-1',
          createdAt: '2026-11-03T10:00:00Z',
          clientName: 'Marcos',
          itemName: 'Cabelo',
          itemType: 'service',
          grossValue: 60,
          commissionRate: 50,
          commissionValue: 30,
          comandaStatus: 'paid',
          isPaid: true,
        },
        {
          id: 'item-2',
          comandaId: 'com-1', // Mesma comanda
          createdAt: '2026-11-03T10:00:00Z',
          clientName: 'Marcos',
          itemName: 'Barba',
          itemType: 'service',
          grossValue: 40,
          commissionRate: 50,
          commissionValue: 20,
          comandaStatus: 'paid',
          isPaid: true,
        },
      ];

      const result = calculateBarberStatementSummary(items);
      expect(result.totalItems).toBe(2);
      expect(result.totalComandas).toBe(1); // 1 comanda única
      expect(result.grossProduction).toBe(100);
      expect(result.averageTicket).toBe(100); // 100 / 1 comanda = 100
      expect(result.confirmedCommission).toBe(50);
    });
  });

  describe('getDateRangeForStatementPeriod', () => {
    it('should return identical start and end for today', () => {
      const ref = new Date('2026-11-04T12:00:00Z');
      const range = getDateRangeForStatementPeriod('today', ref);
      expect(range.startDate).toBe('2026-11-04');
      expect(range.endDate).toBe('2026-11-04');
    });

    it('should return previous day for yesterday', () => {
      const ref = new Date('2026-11-04T12:00:00Z');
      const range = getDateRangeForStatementPeriod('yesterday', ref);
      expect(range.startDate).toBe('2026-11-03');
      expect(range.endDate).toBe('2026-11-03');
    });

    it('should calculate monday to sunday for week', () => {
      // 2026-11-04 is Wednesday
      const ref = new Date('2026-11-04T12:00:00Z');
      const range = getDateRangeForStatementPeriod('week', ref);
      expect(range.startDate).toBe('2026-11-02'); // Monday
      expect(range.endDate).toBe('2026-11-08'); // Sunday
    });

    it('should calculate first to last day of month', () => {
      // November 2026 has 30 days
      const ref = new Date('2026-11-15T12:00:00Z');
      const range = getDateRangeForStatementPeriod('month', ref);
      expect(range.startDate).toBe('2026-11-01');
      expect(range.endDate).toBe('2026-11-30');
    });
  });
});
