import { describe, it, expect } from 'vitest';
import {
  generateCashSuggestions,
  calculateCashChange,
  formatBrlCurrency,
} from './checkoutQuickPay';

describe('checkoutQuickPay utility suite', () => {
  describe('generateCashSuggestions', () => {
    it('should generate correct BRL banknotes sequence for R$ 35,00 (PO specification)', () => {
      const suggestions = generateCashSuggestions(35);
      // PO expected: [35, 40 (two 20s), 50, 100]
      expect(suggestions).toEqual([35, 40, 50, 100]);
    });

    it('should return empty list for 0 or negative totals', () => {
      expect(generateCashSuggestions(0)).toEqual([]);
      expect(generateCashSuggestions(-10)).toEqual([]);
    });

    it('should generate correct sequence for small total (R$ 8,00)', () => {
      const suggestions = generateCashSuggestions(8);
      // Expected: 8 (exact), 10 (note 10), 20 (note 20), 50 (note 50)
      expect(suggestions).toEqual([8, 10, 20, 50]);
    });

    it('should generate correct sequence for total R$ 20,00', () => {
      const suggestions = generateCashSuggestions(20);
      // Expected: 20 (exact), 30, 40, 50
      expect(suggestions[0]).toBe(20);
      expect(suggestions.length).toBeLessThanOrEqual(4);
      expect(suggestions.every((val, idx, arr) => idx === 0 || val > arr[idx - 1])).toBe(true);
      expect(suggestions).toContain(50);
    });

    it('should handle fractional cent totals correctly (R$ 42,50)', () => {
      const suggestions = generateCashSuggestions(42.5);
      expect(suggestions[0]).toBe(42.5);
      expect(suggestions).toContain(50);
      expect(suggestions).toContain(60);
      expect(suggestions).toContain(100);
      expect(suggestions.length).toBe(4);
    });

    it('should generate correct sequence for higher amount (R$ 75,00)', () => {
      const suggestions = generateCashSuggestions(75);
      // 75 exact, 80 (four 20s), 100, 200
      expect(suggestions).toEqual([75, 80, 100, 200]);
    });

    it('should generate correct sequence for amounts above 100 (R$ 130,00)', () => {
      const suggestions = generateCashSuggestions(130);
      expect(suggestions[0]).toBe(130);
      expect(suggestions).toContain(140);
      expect(suggestions).toContain(150);
      expect(suggestions).toContain(200);
    });
  });

  describe('calculateCashChange', () => {
    it('should identify exact payment with 0 change', () => {
      const result = calculateCashChange(35, 35);
      expect(result.status).toBe('exact');
      expect(result.isSufficient).toBe(true);
      expect(result.change).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it('should calculate correct change when customer pays with R$ 50 on a R$ 35 bill', () => {
      const result = calculateCashChange(35, 50);
      expect(result.status).toBe('over');
      expect(result.isSufficient).toBe(true);
      expect(result.change).toBe(15);
      expect(result.remaining).toBe(0);
    });

    it('should calculate correct change when customer pays with R$ 100 on a R$ 42,50 bill', () => {
      const result = calculateCashChange(42.5, 100);
      expect(result.status).toBe('over');
      expect(result.isSufficient).toBe(true);
      expect(result.change).toBe(57.5);
      expect(result.remaining).toBe(0);
    });

    it('should identify insufficient amount and calculate missing balance', () => {
      const result = calculateCashChange(35, 20);
      expect(result.status).toBe('under');
      expect(result.isSufficient).toBe(false);
      expect(result.change).toBe(0);
      expect(result.remaining).toBe(15);
    });

    it('should safely handle floating point precision', () => {
      const result = calculateCashChange(19.99, 20.0);
      expect(result.status).toBe('over');
      expect(result.isSufficient).toBe(true);
      expect(result.change).toBe(0.01);
      expect(result.remaining).toBe(0);
    });
  });

  describe('formatBrlCurrency', () => {
    it('should format numbers into BRL currency string', () => {
      const formatted = formatBrlCurrency(35);
      expect(formatted).toContain('35,00');
    });

    it('should format cents properly', () => {
      const formatted = formatBrlCurrency(15.5);
      expect(formatted).toContain('15,50');
    });
  });
});
