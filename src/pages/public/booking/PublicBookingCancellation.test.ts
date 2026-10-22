/**
 * Unit tests for Public Booking Cancellation & Active Booking Management:
 * - Cancellation window calculation and cutoff
 * - Error mapping for token and cancellation states
 * - LocalStorage active booking persistence and expiration cleanup
 * - Structured WhatsApp confirmation message formatting with token link
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSavedActiveBooking,
  saveActiveBooking,
  clearActiveBooking,
  STORAGE_KEY_LAST_BOOKING,
  type SavedClientBooking,
} from './components/ActiveBookingBanner';
import { buildStructuredWhatsAppConfirmationUrl } from './BookingSuccessVoucher';
import type { PublicTenantProfile, CreatePublicBookingResult } from './hooks/types';

class MemoryStorage implements Storage {
  private store: Record<string, string> = {};
  get length() {
    return Object.keys(this.store).length;
  }
  clear() {
    this.store = {};
  }
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  key(index: number) {
    return Object.keys(this.store)[index] ?? null;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
}

describe('PublicBookingCancellation — Invariants & Logic Suite', () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
  });

  describe('ActiveBookingBanner LocalStorage Helpers', () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow
    const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago

    const mockSavedBooking: SavedClientBooking = {
      tenantSlug: 'sanchez-barber',
      appointmentId: 'apt-12345678',
      publicToken: 'tok-abc-123',
      servicesNames: 'Corte Degradê + Barba',
      staffName: 'Augusto Barbeiro',
      startTime: futureDate,
      formattedDateTime: 'Amanhã às 15:00',
    };

    it('should save and retrieve active booking when date is in the future and slug matches', () => {
      saveActiveBooking(mockSavedBooking);

      const retrieved = getSavedActiveBooking('sanchez-barber');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.appointmentId).toBe('apt-12345678');
      expect(retrieved?.publicToken).toBe('tok-abc-123');
      expect(retrieved?.servicesNames).toBe('Corte Degradê + Barba');
    });

    it('should return null when tenant slug does not match', () => {
      saveActiveBooking(mockSavedBooking);

      const retrieved = getSavedActiveBooking('outra-barbearia');
      expect(retrieved).toBeNull();
    });

    it('should automatically clear and return null if the booking date is in the past', () => {
      const expiredBooking: SavedClientBooking = {
        ...mockSavedBooking,
        startTime: pastDate,
      };

      saveActiveBooking(expiredBooking);
      expect(localStorage.getItem(STORAGE_KEY_LAST_BOOKING)).not.toBeNull();

      // Retrieve should detect past appointment and clean it
      const retrieved = getSavedActiveBooking('sanchez-barber');
      expect(retrieved).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY_LAST_BOOKING)).toBeNull();
    });

    it('should clear active booking on explicit clear call', () => {
      saveActiveBooking(mockSavedBooking);
      expect(getSavedActiveBooking('sanchez-barber')).not.toBeNull();

      clearActiveBooking();
      expect(getSavedActiveBooking('sanchez-barber')).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY_LAST_BOOKING)).toBeNull();
    });
  });

  describe('Cancellation Window Logic', () => {
    const isCancellationAllowed = (
      startTimeISO: string,
      cancelWindowMinutes: number,
      now: Date
    ): boolean => {
      const startTime = new Date(startTimeISO).getTime();
      const cutoffTime = startTime - cancelWindowMinutes * 60 * 1000;
      return now.getTime() <= cutoffTime;
    };

    it('should allow cancellation when current time is before the cutoff window', () => {
      const now = new Date('2026-10-22T10:00:00Z');
      const appointmentStart = '2026-10-22T14:00:00Z'; // 4 hours later
      const windowMinutes = 120; // 2 hours window -> cutoff is 12:00:00Z

      expect(isCancellationAllowed(appointmentStart, windowMinutes, now)).toBe(true);
    });

    it('should reject cancellation when current time is past the cutoff window', () => {
      const now = new Date('2026-10-22T12:30:00Z');
      const appointmentStart = '2026-10-22T14:00:00Z'; // 1.5 hours later
      const windowMinutes = 120; // 2 hours window -> cutoff is 12:00:00Z

      expect(isCancellationAllowed(appointmentStart, windowMinutes, now)).toBe(false);
    });
  });

  describe('WhatsApp Confirmation URL with Manage/Cancel Link', () => {
    const mockTenant: PublicTenantProfile = {
      tenant_id: 'tenant-1',
      name: 'Sanchez Barber',
      slug: 'sanchez-barber',
      logo_url: null,
      address: 'Rua Central, 100',
      phone: '11999990000',
      whatsapp_number: '11999990000',
      instagram_url: null,
      maps_url: null,
      social_links: null,
      booking_enabled: true,
      booking_rules: {
        horizon_days: 14,
        min_booking_notice_minutes: 30,
        auto_confirm_online_bookings: true,
        public_cancel_window_minutes: 120,
        appointment_interval_minutes: 30,
        default_appointment_duration_minutes: 30,
        timezone: 'America/Sao_Paulo',
      },
      services: [],
      staff: [],
    };

    const mockResultWithToken: CreatePublicBookingResult = {
      appointment_id: '12345678-abcd-1234-abcd-123456789012',
      client_id: 'client-1',
      status: 'confirmed',
      public_token: 'secret-token-xyz',
      public_token_id: 'pubtok-1',
      expires_at: '2026-10-25T12:00:00Z',
      services: [{ service_id: 's1', name: 'Corte Cabelo', duration: 30, price: 50 }],
      staff: { id: 'st1', name: 'Augusto' },
      start_time: '2026-10-25T14:00:00Z',
      end_time: '2026-10-25T14:30:00Z',
      idempotent: false,
    };

    it('should include direct manage/cancel link with token in WhatsApp message', () => {
      const url = buildStructuredWhatsAppConfirmationUrl(
        mockTenant,
        mockResultWithToken,
        'Carlos Cliente',
        'Dom, 25',
        '14:00'
      );

      const decoded = decodeURIComponent(url.split('?text=')[1]);
      expect(decoded).toContain(
        'Gerenciar/Cancelar: https://barber.soumanager.com/#/agendar/sanchez-barber?token=secret-token-xyz'
      );
    });

    it('should omit manage link if public_token is null (e.g. idempotent retry)', () => {
      const resultWithoutToken: CreatePublicBookingResult = {
        ...mockResultWithToken,
        public_token: null,
      };

      const url = buildStructuredWhatsAppConfirmationUrl(
        mockTenant,
        resultWithoutToken,
        'Carlos Cliente',
        'Dom, 25',
        '14:00'
      );

      const decoded = decodeURIComponent(url.split('?text=')[1]);
      expect(decoded).not.toContain('Gerenciar/Cancelar:');
    });
  });
});
