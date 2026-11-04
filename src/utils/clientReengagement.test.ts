import { describe, expect, it } from 'vitest';
import {
  calculateDaysSinceDate,
  getClientInactivityStatus,
  sanitizePhoneNumberForWhatsApp,
  generateReengagementMessage,
  buildWhatsAppUrl,
} from './clientReengagement';

describe('clientReengagement', () => {
  const refDate = new Date('2026-11-04T12:00:00Z');

  describe('calculateDaysSinceDate', () => {
    it('should return null for empty or invalid dates', () => {
      expect(calculateDaysSinceDate(null, refDate)).toBeNull();
      expect(calculateDaysSinceDate(undefined, refDate)).toBeNull();
      expect(calculateDaysSinceDate('', refDate)).toBeNull();
      expect(calculateDaysSinceDate('not-a-date', refDate)).toBeNull();
    });

    it('should calculate 0 days for same day', () => {
      expect(calculateDaysSinceDate('2026-11-04T08:00:00Z', refDate)).toBe(0);
    });

    it('should calculate past days correctly', () => {
      expect(calculateDaysSinceDate('2026-11-03T12:00:00Z', refDate)).toBe(1);
      expect(calculateDaysSinceDate('2026-10-05T12:00:00Z', refDate)).toBe(30);
      expect(calculateDaysSinceDate('2026-09-05T12:00:00Z', refDate)).toBe(60);
    });

    it('should return 0 if date is in the future', () => {
      expect(calculateDaysSinceDate('2026-11-10T12:00:00Z', refDate)).toBe(0);
    });
  });

  describe('getClientInactivityStatus', () => {
    it('should classify as "never" when lastVisit is missing', () => {
      const status = getClientInactivityStatus(null, refDate);
      expect(status.tier).toBe('never');
      expect(status.days).toBeNull();
      expect(status.label).toBe('Sem visitas');
    });

    it('should classify as "active" when lastVisit is < 30 days ago', () => {
      const statusToday = getClientInactivityStatus('2026-11-04T10:00:00Z', refDate);
      expect(statusToday.tier).toBe('active');
      expect(statusToday.label).toBe('Hoje');

      const statusYesterday = getClientInactivityStatus('2026-11-03T10:00:00Z', refDate);
      expect(statusYesterday.tier).toBe('active');
      expect(statusYesterday.label).toBe('Ontem');

      const status10Days = getClientInactivityStatus('2026-10-25T12:00:00Z', refDate);
      expect(status10Days.tier).toBe('active');
      expect(status10Days.days).toBe(10);
      expect(status10Days.label).toBe('Há 10 dias');
    });

    it('should classify as "absent" when lastVisit is between 30 and 60 days', () => {
      const status35Days = getClientInactivityStatus('2026-09-30T12:00:00Z', refDate);
      expect(status35Days.tier).toBe('absent');
      expect(status35Days.days).toBe(35);
      expect(status35Days.label).toBe('Há 35 dias');

      const status60Days = getClientInactivityStatus('2026-09-05T12:00:00Z', refDate);
      expect(status60Days.tier).toBe('absent');
      expect(status60Days.days).toBe(60);
    });

    it('should classify as "critical" when lastVisit is > 60 days', () => {
      const status75Days = getClientInactivityStatus('2026-08-21T12:00:00Z', refDate);
      expect(status75Days.tier).toBe('critical');
      expect(status75Days.days).toBe(75);
      expect(status75Days.label).toBe('Há 75 dias');
    });
  });

  describe('sanitizePhoneNumberForWhatsApp', () => {
    it('should return empty string for empty input', () => {
      expect(sanitizePhoneNumberForWhatsApp('')).toBe('');
      expect(sanitizePhoneNumberForWhatsApp('   ')).toBe('');
    });

    it('should add 55 country code for 11-digit Brazilian cellphone', () => {
      expect(sanitizePhoneNumberForWhatsApp('(11) 98765-4321')).toBe('5511987654321');
    });

    it('should add 55 country code for 10-digit Brazilian landline', () => {
      expect(sanitizePhoneNumberForWhatsApp('1133334444')).toBe('551133334444');
    });

    it('should preserve already present country code', () => {
      expect(sanitizePhoneNumberForWhatsApp('+55 (11) 98765-4321')).toBe('5511987654321');
      expect(sanitizePhoneNumberForWhatsApp('+1 415 555 2671')).toBe('14155552671');
    });
  });

  describe('generateReengagementMessage', () => {
    it('should generate personalized message with first name and shop name', () => {
      const msg = generateReengagementMessage({
        clientName: 'Carlos Silva',
        shopName: 'Barbearia Vintage',
        daysSinceVisit: 45,
      });

      expect(msg).toContain('Olá, Carlos!');
      expect(msg).toContain('da Barbearia Vintage');
      expect(msg).toContain('faz cerca de 45 dias');
      expect(msg).toContain('renovar aquele corte');
    });

    it('should append booking URL when provided', () => {
      const msg = generateReengagementMessage({
        clientName: 'Roberto',
        shopName: 'Barber Club',
        daysSinceVisit: 30,
        bookingUrl: 'https://barber.soumanager.com/#/agendamento',
      });

      expect(msg).toContain('https://barber.soumanager.com/#/agendamento');
    });

    it('should handle missing daysSinceVisit gracefully', () => {
      const msg = generateReengagementMessage({
        clientName: 'Marcos',
        daysSinceVisit: null,
      });

      expect(msg).toContain('já faz algum tempo que não nos vemos');
    });
  });

  describe('buildWhatsAppUrl', () => {
    it('should return empty string if phone is empty', () => {
      expect(buildWhatsAppUrl('', 'Olá')).toBe('');
    });

    it('should build proper wa.me link with encoded message', () => {
      const url = buildWhatsAppUrl('(11) 99999-8888', 'Olá Carlos! Tudo bem?');
      expect(url).toBe('https://wa.me/5511999998888?text=Ol%C3%A1%20Carlos!%20Tudo%20bem%3F');
    });
  });
});
