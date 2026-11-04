import { describe, expect, it } from 'vitest';
import {
  calculateComboTotals,
  formatComboSummary,
  type ServiceItemForCombo,
} from './comboCalculation';

describe('comboCalculation', () => {
  describe('calculateComboTotals', () => {
    it('should return all zeros when services array is empty', () => {
      const result = calculateComboTotals({ services: [] });
      expect(result).toEqual({
        sumPrice: 0,
        sumDuration: 0,
        discountValue: 0,
        finalPrice: 0,
        savings: 0,
      });
    });

    it('should sum price and duration without discount', () => {
      const services: ServiceItemForCombo[] = [
        { id: '1', name: 'Corte Tradicional', price: 50, duration: 30 },
        { id: '2', name: 'Barba Completa', price: 40, duration: 25 },
      ];

      const result = calculateComboTotals({ services });
      expect(result).toEqual({
        sumPrice: 90,
        sumDuration: 55,
        discountValue: 0,
        finalPrice: 90,
        savings: 0,
      });
    });

    it('should apply fixed discount correctly', () => {
      const services: ServiceItemForCombo[] = [
        { id: '1', name: 'Corte Tradicional', price: 50, duration: 30 },
        { id: '2', name: 'Barba Completa', price: 40, duration: 25 },
      ];

      const result = calculateComboTotals({
        services,
        discountAmount: 15,
        discountType: 'fixed',
      });

      expect(result).toEqual({
        sumPrice: 90,
        sumDuration: 55,
        discountValue: 15,
        finalPrice: 75,
        savings: 15,
      });
    });

    it('should clamp fixed discount to sumPrice if discount exceeds sumPrice', () => {
      const services: ServiceItemForCombo[] = [
        { id: '1', name: 'Pézinho', price: 20, duration: 15 },
      ];

      const result = calculateComboTotals({
        services,
        discountAmount: 50,
        discountType: 'fixed',
      });

      expect(result).toEqual({
        sumPrice: 20,
        sumDuration: 15,
        discountValue: 20,
        finalPrice: 0,
        savings: 20,
      });
    });

    it('should apply percentage discount correctly', () => {
      const services: ServiceItemForCombo[] = [
        { id: '1', name: 'Corte Tradicional', price: 60, duration: 30 },
        { id: '2', name: 'Hidratação', price: 40, duration: 30 },
      ];

      const result = calculateComboTotals({
        services,
        discountAmount: 10, // 10% of 100 = 10
        discountType: 'percentage',
      });

      expect(result).toEqual({
        sumPrice: 100,
        sumDuration: 60,
        discountValue: 10,
        finalPrice: 90,
        savings: 10,
      });
    });

    it('should clamp percentage discount to 100%', () => {
      const services: ServiceItemForCombo[] = [
        { id: '1', name: 'Corte', price: 50, duration: 30 },
      ];

      const result = calculateComboTotals({
        services,
        discountAmount: 150, // 150% clamped to 100%
        discountType: 'percentage',
      });

      expect(result).toEqual({
        sumPrice: 50,
        sumDuration: 30,
        discountValue: 50,
        finalPrice: 0,
        savings: 50,
      });
    });

    it('should handle zero or negative discount gracefully', () => {
      const services: ServiceItemForCombo[] = [
        { id: '1', name: 'Corte', price: 50, duration: 30 },
      ];

      const result = calculateComboTotals({
        services,
        discountAmount: -20,
        discountType: 'fixed',
      });

      expect(result).toEqual({
        sumPrice: 50,
        sumDuration: 30,
        discountValue: 0,
        finalPrice: 50,
        savings: 0,
      });
    });

    it('should handle decimal prices and round to 2 decimals', () => {
      const services: ServiceItemForCombo[] = [
        { id: '1', name: 'Corte', price: 49.9, duration: 35 },
        { id: '2', name: 'Sobrancelha', price: 19.9, duration: 15 },
      ];

      const result = calculateComboTotals({
        services,
        discountAmount: 10, // 10%
        discountType: 'percentage',
      });

      // sumPrice = 69.8
      // discountValue = 6.98
      // finalPrice = 62.82
      expect(result.sumPrice).toBe(69.8);
      expect(result.sumDuration).toBe(50);
      expect(result.discountValue).toBe(6.98);
      expect(result.finalPrice).toBe(62.82);
      expect(result.savings).toBe(6.98);
    });
  });

  describe('formatComboSummary', () => {
    it('should return fallback when no services provided', () => {
      expect(formatComboSummary({ includedServiceNames: [] })).toBe('Nenhum serviço vinculado');
    });

    it('should format services list without savings if savings is 0', () => {
      const summary = formatComboSummary({
        includedServiceNames: ['Corte Tradicional', 'Barba Terapia'],
        savings: 0,
      });
      expect(summary).toBe('Corte Tradicional + Barba Terapia');
    });

    it('should include savings formatted in BRL when savings > 0', () => {
      const summary = formatComboSummary({
        includedServiceNames: ['Corte', 'Barba', 'Sobrancelha'],
        savings: 15,
      });
      expect(summary).toContain('Corte + Barba + Sobrancelha');
      expect(summary).toContain('15,00');
      expect(summary).toContain('economia');
    });
  });
});
