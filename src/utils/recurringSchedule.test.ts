import { describe, expect, it } from 'vitest';
import {
  getIntervalDays,
  parseLocalDate,
  formatLocalDate,
  calculateProjectedDates,
  sanitizePhoneForWhatsApp,
  generateCativaConfirmationMessage,
  buildCativaWhatsAppUrl,
} from './recurringSchedule';

describe('recurringSchedule', () => {
  describe('getIntervalDays', () => {
    it('should return 7 for weekly', () => {
      expect(getIntervalDays('weekly')).toBe(7);
    });

    it('should return 14 for biweekly', () => {
      expect(getIntervalDays('biweekly')).toBe(14);
    });

    it('should return 28 for monthly', () => {
      expect(getIntervalDays('monthly')).toBe(28);
    });

    it('should return custom days or default to 7', () => {
      expect(getIntervalDays('custom', 10)).toBe(10);
      expect(getIntervalDays('custom', 0)).toBe(7);
      expect(getIntervalDays('custom', -5)).toBe(7);
    });
  });

  describe('parseLocalDate and formatLocalDate', () => {
    it('should parse and format round-trip without shifting day', () => {
      const dateStr = '2026-11-12';
      const parsed = parseLocalDate(dateStr);
      expect(formatLocalDate(parsed)).toBe(dateStr);
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(10); // 0-indexed November
      expect(parsed.getDate()).toBe(12);
    });
  });

  describe('calculateProjectedDates', () => {
    it('should return empty array for invalid startDateStr', () => {
      expect(calculateProjectedDates({ startDateStr: '', frequency: 'weekly' })).toEqual([]);
      expect(calculateProjectedDates({ startDateStr: 'invalid', frequency: 'weekly' })).toEqual([]);
    });

    it('should project 4 weekly dates with index 0 scheduled and rest pending', () => {
      // 2026-11-05 is a Thursday
      const dates = calculateProjectedDates({
        startDateStr: '2026-11-05',
        frequency: 'weekly',
        occurrences: 4,
      });

      expect(dates).toHaveLength(4);

      expect(dates[0].date).toBe('2026-11-05');
      expect(dates[0].status).toBe('scheduled');
      expect(dates[0].isFirst).toBe(true);
      expect(dates[0].dayOfWeek).toBe('Quinta-feira');

      expect(dates[1].date).toBe('2026-11-12');
      expect(dates[1].status).toBe('pending');
      expect(dates[1].isFirst).toBe(false);

      expect(dates[2].date).toBe('2026-11-19');
      expect(dates[2].status).toBe('pending');

      expect(dates[3].date).toBe('2026-11-26');
      expect(dates[3].status).toBe('pending');
    });

    it('should project biweekly (14 days) across month transition', () => {
      const dates = calculateProjectedDates({
        startDateStr: '2026-11-20',
        frequency: 'biweekly',
        occurrences: 3,
      });

      expect(dates).toHaveLength(3);
      expect(dates[0].date).toBe('2026-11-20');
      expect(dates[1].date).toBe('2026-12-04');
      expect(dates[2].date).toBe('2026-12-18');
    });

    it('should stop projecting if endDateStr is reached', () => {
      const dates = calculateProjectedDates({
        startDateStr: '2026-11-01',
        frequency: 'weekly',
        occurrences: 10,
        endDateStr: '2026-11-16',
      });

      // 2026-11-01, 2026-11-08, 2026-11-15 -> next would be 2026-11-22 (> Nov 16)
      expect(dates).toHaveLength(3);
      expect(dates.map((d) => d.date)).toEqual(['2026-11-01', '2026-11-08', '2026-11-15']);
    });

    it('should support custom frequency intervals', () => {
      const dates = calculateProjectedDates({
        startDateStr: '2026-11-01',
        frequency: 'custom',
        customDays: 10,
        occurrences: 3,
      });

      expect(dates).toHaveLength(3);
      expect(dates[0].date).toBe('2026-11-01');
      expect(dates[1].date).toBe('2026-11-11');
      expect(dates[2].date).toBe('2026-11-21');
    });
  });

  describe('sanitizePhoneForWhatsApp', () => {
    it('should sanitize phone number and add DDI 55 for Brazil', () => {
      expect(sanitizePhoneForWhatsApp('(11) 98765-4321')).toBe('5511987654321');
      expect(sanitizePhoneForWhatsApp('+55 (11) 98765-4321')).toBe('5511987654321');
      expect(sanitizePhoneForWhatsApp('+1 202 555 0192')).toBe('12025550192');
    });
  });

  describe('generateCativaConfirmationMessage', () => {
    it('should generate personalized confirmation message with date, time, and barber', () => {
      const msg = generateCativaConfirmationMessage({
        clientName: 'Lucas Oliveira',
        shopName: 'Barbearia Don Corleone',
        dateStr: '2026-11-12',
        timeStr: '18:00',
        barberName: 'Gabriel',
      });

      expect(msg).toContain('Olá, Lucas!');
      expect(msg).toContain('da Barbearia Don Corleone');
      expect(msg).toContain('Cadeira Cativa nesta semana');
      expect(msg).toContain('18:00');
      expect(msg).toContain('barbeiro Gabriel');
    });
  });

  describe('buildCativaWhatsAppUrl', () => {
    it('should generate proper wa.me link with encoded text', () => {
      const url = buildCativaWhatsAppUrl('(11) 98888-7777', 'Confirmando seu horário');
      expect(url).toContain('https://wa.me/5511988887777?text=Confirmando%20seu%20hor%C3%A1rio');
    });
  });
});
