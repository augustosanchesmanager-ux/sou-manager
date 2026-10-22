/**
 * Unit tests for Public Booking Redesign utilities and helpers:
 * - Phone number masking and validation
 * - WhatsApp URL and Instagram URL sanitization
 * - Structured WhatsApp confirmation message formatting
 */

import { describe, it, expect } from 'vitest';
import { applyPhoneMask } from './LeadCaptureModal';
import { buildSafeWhatsAppUrl, buildSafeInstagramUrl } from './BookingHeader';
import { buildStructuredWhatsAppConfirmationUrl } from './BookingSuccessVoucher';
import type { PublicTenantProfile, CreatePublicBookingResult } from './hooks/types';

describe('PublicBookingRedesign — Helpers & Formatter Suite', () => {
  describe('applyPhoneMask', () => {
    it('should format 11-digit Brazilian mobile number with DDD and 9 digits', () => {
      expect(applyPhoneMask('11999998888')).toBe('(11) 99999-8888');
    });

    it('should format partial digits as user types', () => {
      expect(applyPhoneMask('1')).toBe('(1');
      expect(applyPhoneMask('11')).toBe('(11');
      expect(applyPhoneMask('119')).toBe('(11) 9');
      expect(applyPhoneMask('1199999')).toBe('(11) 99999');
      expect(applyPhoneMask('11999998')).toBe('(11) 99999-8');
    });

    it('should strip non-numeric characters and limit to 11 digits', () => {
      expect(applyPhoneMask('(11) 9.9999-88889999')).toBe('(11) 99999-8888');
    });
  });

  describe('buildSafeWhatsAppUrl', () => {
    it('should prepend 55 to 11-digit Brazilian numbers', () => {
      const url = buildSafeWhatsAppUrl('11999998888');
      expect(url).toBe('https://wa.me/5511999998888');
    });

    it('should preserve already formatted country code', () => {
      const url = buildSafeWhatsAppUrl('+55 11 99999-8888');
      expect(url).toBe('https://wa.me/5511999998888');
    });

    it('should return null for empty or null phone', () => {
      expect(buildSafeWhatsAppUrl(null)).toBeNull();
      expect(buildSafeWhatsAppUrl('')).toBeNull();
    });

    it('should append custom message query when provided', () => {
      const url = buildSafeWhatsAppUrl('11999998888', 'Olá barbearia!');
      expect(url).toContain('https://wa.me/5511999998888?text=');
      expect(url).toContain(encodeURIComponent('Olá barbearia!'));
    });
  });

  describe('buildSafeInstagramUrl', () => {
    it('should build proper url from plain username or @handle', () => {
      expect(buildSafeInstagramUrl('@barbeariadompedro')).toBe('https://instagram.com/barbeariadompedro');
      expect(buildSafeInstagramUrl('barbeariadompedro')).toBe('https://instagram.com/barbeariadompedro');
    });

    it('should sanitize full url if provided', () => {
      expect(buildSafeInstagramUrl('https://instagram.com/barbeariadompedro')).toBe('https://instagram.com/barbeariadompedro');
    });

    it('should return null for empty input', () => {
      expect(buildSafeInstagramUrl('')).toBeNull();
      expect(buildSafeInstagramUrl(null)).toBeNull();
    });
  });

  describe('buildStructuredWhatsAppConfirmationUrl', () => {
    const mockTenant: PublicTenantProfile = {
      tenant_id: 'tenant-1',
      name: 'Barbearia Dom Pedro',
      slug: 'dompedro',
      logo_url: null,
      address: 'Rua Augusta, 1500',
      phone: '11999990000',
      whatsapp_number: '11999990000',
      instagram_url: 'dompedro',
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

    const mockResult: CreatePublicBookingResult = {
      appointment_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      client_id: 'client-1',
      status: 'confirmed',
      public_token: 'token123',
      public_token_id: 'pubtok-1',
      expires_at: '2026-10-25T12:00:00Z',
      services: [
        { service_id: 's1', name: 'Corte Degradê', duration: 30, price: 50 },
        { service_id: 's2', name: 'Barboterapia', duration: 30, price: 40 },
      ],
      staff: { id: 'staff-1', name: 'Carlos Barbeiro' },
      start_time: '2026-10-25T14:00:00Z',
      end_time: '2026-10-25T15:00:00Z',
      idempotent: false,
    };

    it('should generate structured WhatsApp confirmation URL matching specification', () => {
      const url = buildStructuredWhatsAppConfirmationUrl(
        mockTenant,
        mockResult,
        'João da Silva',
        'Seg, 25',
        '14:00'
      );

      expect(url).toContain('https://wa.me/5511999990000?text=');

      // Decode URL message to verify structured content
      const decoded = decodeURIComponent(url.split('?text=')[1]);

      expect(decoded).toContain('Olá, acabei de agendar pelo SMG!');
      expect(decoded).toContain('Cliente: João da Silva');
      expect(decoded).toContain('Serviço(s): Corte Degradê, Barboterapia');
      expect(decoded).toContain('Profissional: Carlos Barbeiro');
      expect(decoded).toContain('Data: Seg, 25 às 14:00');
      expect(decoded).toContain('Código: A1B2C3D4');
      expect(decoded).toContain('Gerenciar/Cancelar: https://barber.soumanager.com/#/agendar/dompedro?token=token123');
    });
  });
});
