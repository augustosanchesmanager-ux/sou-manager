import { describe, expect, it } from 'vitest';
import {
  calculateAverageTicket,
  calculateNextPreferredDate,
  calculatePreferredBarber,
  formatPreferredScheduleSummary,
  FREQUENCY_LABELS,
  WEEKDAY_LABELS,
} from './clientProfile';

describe('clientProfile utils', () => {
  describe('calculatePreferredBarber', () => {
    it('should return null when history is empty or null', () => {
      expect(calculatePreferredBarber([])).toBeNull();
      expect(calculatePreferredBarber(null as unknown as [])).toBeNull();
    });

    it('should return null when no entries have valid staffId', () => {
      const history = [
        { staffId: null, staffName: 'Sem profissional' },
        { staffId: '', staffName: '' },
      ];
      expect(calculatePreferredBarber(history)).toBeNull();
    });

    it('should identify the barber with highest visit count', () => {
      const history = [
        { staffId: 'staff-1', staffName: 'Carlos Barbeiro', staffAvatar: 'https://avatar/1' },
        { staffId: 'staff-2', staffName: 'João Silva', staffAvatar: 'https://avatar/2' },
        { staffId: 'staff-1', staffName: 'Carlos Barbeiro', staffAvatar: 'https://avatar/1' },
      ];

      const preferred = calculatePreferredBarber(history);
      expect(preferred).toEqual({
        staffId: 'staff-1',
        name: 'Carlos Barbeiro',
        avatar: 'https://avatar/1',
        serviceCount: 2,
      });
    });

    it('should fallback to default name when staffName is absent', () => {
      const history = [{ staffId: 'staff-x' }];
      const preferred = calculatePreferredBarber(history);
      expect(preferred?.name).toBe('Barbeiro');
      expect(preferred?.serviceCount).toBe(1);
    });
  });

  describe('calculateAverageTicket', () => {
    it('should return totalSpent when visits count is zero or negative', () => {
      expect(calculateAverageTicket(150, 0)).toBe(150);
      expect(calculateAverageTicket(150, -1)).toBe(150);
    });

    it('should return 0 when totalSpent is 0, negative or NaN', () => {
      expect(calculateAverageTicket(0, 5)).toBe(0);
      expect(calculateAverageTicket(-50, 2)).toBe(0);
      expect(calculateAverageTicket(Number.NaN, 3)).toBe(0);
    });

    it('should accurately calculate average ticket rounded to 2 decimal places', () => {
      expect(calculateAverageTicket(100, 3)).toBe(33.33);
      expect(calculateAverageTicket(250, 5)).toBe(50);
      expect(calculateAverageTicket(75.5, 2)).toBe(37.75);
    });
  });

  describe('calculateNextPreferredDate', () => {
    it('should calculate future date in the same week when target day is later than reference', () => {
      // 2026-11-02 is Monday (ISO 1)
      const mondayRef = new Date('2026-11-02T10:00:00Z');
      // Target: Friday (ISO 5) -> should be 2026-11-06
      const nextFriday = calculateNextPreferredDate(5, mondayRef);
      expect(nextFriday).toBe('2026-11-06');
    });

    it('should advance to next week when target day is today (guaranteeing future booking)', () => {
      // 2026-11-02 is Monday (ISO 1)
      const mondayRef = new Date('2026-11-02T10:00:00Z');
      // Target: Monday (ISO 1) -> should be +7 days -> 2026-11-09
      const nextMonday = calculateNextPreferredDate(1, mondayRef);
      expect(nextMonday).toBe('2026-11-09');
    });

    it('should advance to next week when target day was earlier in current week', () => {
      // 2026-11-06 is Friday (ISO 5)
      const fridayRef = new Date('2026-11-06T10:00:00Z');
      // Target: Tuesday (ISO 2) -> should be 2026-11-10
      const nextTuesday = calculateNextPreferredDate(2, fridayRef);
      expect(nextTuesday).toBe('2026-11-10');
    });

    it('should fallback to reference date ISO string if weekday is invalid', () => {
      const ref = new Date('2026-11-02T12:00:00Z');
      expect(calculateNextPreferredDate(0, ref)).toBe('2026-11-02');
      expect(calculateNextPreferredDate(8, ref)).toBe('2026-11-02');
    });
  });

  describe('formatPreferredScheduleSummary', () => {
    it('should return fallback message if frequency or weekday is not set', () => {
      expect(formatPreferredScheduleSummary({})).toBe('Sem horário fixo definido');
      expect(formatPreferredScheduleSummary({ frequency: 'weekly' })).toBe('Sem horário fixo definido');
      expect(formatPreferredScheduleSummary({ weekday: 5 })).toBe('Sem horário fixo definido');
    });

    it('should format complete summary with frequency, weekday, time and staff', () => {
      const result = formatPreferredScheduleSummary({
        frequency: 'weekly',
        weekday: 5,
        time: '18:00',
        staffName: 'Carlos',
      });
      expect(result).toBe('Semanal • Sexta-feira às 18:00 com Carlos');
    });

    it('should format partial summary without time or staff', () => {
      const result = formatPreferredScheduleSummary({
        frequency: 'biweekly',
        weekday: 6,
      });
      expect(result).toBe('Quinzenal • Sábado');
    });
  });

  describe('WEEKDAY_LABELS & FREQUENCY_LABELS', () => {
    it('should have all 7 ISO weekdays mapped', () => {
      expect(Object.keys(WEEKDAY_LABELS)).toHaveLength(7);
      expect(WEEKDAY_LABELS[1].short).toBe('Seg');
      expect(WEEKDAY_LABELS[7].full).toBe('Domingo');
    });

    it('should have weekly, biweekly and monthly frequency labels', () => {
      expect(FREQUENCY_LABELS.weekly).toBe('Semanal');
      expect(FREQUENCY_LABELS.biweekly).toBe('Quinzenal');
      expect(FREQUENCY_LABELS.monthly).toBe('Mensal');
    });
  });
});
