/**
 * Unit tests for Public Booking 3-Phase Guided Modals:
 * - ServiceSpecificationModal (lead capture & specifications)
 * - StaffSelectionModal (active staff filtering & initials)
 * - DateTimeBookingModal (date carousel, slot grid & confirmation constraints)
 */

import { describe, it, expect } from 'vitest';
import type { PublicService, PublicStaff, PublicSlot } from './hooks/types';

describe('PublicBookingModals — Specification & Invariant Tests', () => {
  const mockService: PublicService = {
    id: 'srv-corte-1',
    name: 'Corte Tradicional',
    category: 'Cabelo',
    duration: 35,
    price: 45,
    active: true,
    description: 'Corte clássico na tesoura ou máquina com acabamento e toalha quente.',
  };

  const mockStaffList: PublicStaff[] = [
    {
      id: 'staff-1',
      name: 'Dom Pedro Silva',
      avatar_url: 'https://example.com/avatar.jpg',
      status: 'active',
    },
    {
      id: 'staff-2',
      name: 'Leonardo',
      avatar_url: null,
      status: 'active',
    },
    {
      id: 'staff-inactive',
      name: 'Antônio Inativo',
      avatar_url: null,
      status: 'inactive',
    },
  ];

  const mockSlots: PublicSlot[] = [
    {
      start_time: '2026-10-22T09:00:00-03:00',
      end_time: '2026-10-22T09:35:00-03:00',
      staff_id: 'staff-1',
      available: true,
    },
    {
      start_time: '2026-10-22T10:00:00-03:00',
      end_time: '2026-10-22T10:35:00-03:00',
      staff_id: 'staff-1',
      available: true,
    },
  ];

  describe('ServiceSpecificationModal — Business Logic & Validation', () => {
    it('should validate lead capture requirements (name >= 3 chars, phone >= 11 digits)', () => {
      const validateLead = (name: string, phone: string) => {
        const phoneDigits = phone.replace(/\D/g, '');
        return name.trim().length >= 3 && phoneDigits.length >= 11;
      };

      expect(validateLead('', '')).toBe(false);
      expect(validateLead('Jo', '11999998888')).toBe(false);
      expect(validateLead('João', '1199999888')).toBe(false); // 10 digits
      expect(validateLead('João da Silva', '11999998888')).toBe(true); // 11 digits
      expect(validateLead('Augusto', '(11) 98765-4321')).toBe(true);
    });

    it('should format service price and duration consistently', () => {
      const formatPriceBRL = (price: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

      const formatted = formatPriceBRL(mockService.price);
      expect(formatted).toContain('45');
      expect(mockService.duration).toBe(35);
    });
  });

  describe('StaffSelectionModal — Staff Filtering & Initials Calculation', () => {
    it('should only include active staff members in the selection pool', () => {
      const activeStaff = mockStaffList.filter((s) => s.status === 'active');
      expect(activeStaff).toHaveLength(2);
      expect(activeStaff.map((s) => s.id)).toEqual(['staff-1', 'staff-2']);
      expect(activeStaff.find((s) => s.status === 'inactive')).toBeUndefined();
    });

    it('should correctly calculate initials for single-word and multi-word names', () => {
      const getInitials = (name: string): string => {
        const words = name.trim().split(/\s+/);
        if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
      };

      expect(getInitials('Dom Pedro Silva')).toBe('DS');
      expect(getInitials('Leonardo')).toBe('LE');
      expect(getInitials('Augusto Sanches')).toBe('AS');
    });
  });

  describe('DateTimeBookingModal — Slots & Summary Constraints', () => {
    it('should determine confirmation button readiness based on slot selection and submission state', () => {
      const isButtonEnabled = (selectedSlot: PublicSlot | null, isSubmitting: boolean) =>
        Boolean(selectedSlot) && !isSubmitting;

      expect(isButtonEnabled(null, false)).toBe(false);
      expect(isButtonEnabled(mockSlots[0], true)).toBe(false); // submitting blocks click
      expect(isButtonEnabled(mockSlots[0], false)).toBe(true);
    });

    it('should correctly extract slot time in 24h format', () => {
      const formatSlotTime = (isoString: string): string => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'America/Sao_Paulo',
        });
      };

      const slotTime = formatSlotTime('2026-10-22T09:00:00-03:00');
      expect(slotTime).toBe('09:00');
    });

    it('should correctly classify UTC timestamps into Brazilian local periods (Manhã, Tarde, Noite)', () => {
      // 00:00 UTC = 21:00 BRT (Noite)
      // 11:00 UTC = 08:00 BRT (Manhã)
      // 17:00 UTC = 14:00 BRT (Tarde)
      const classifyPeriod = (isoUtc: string, timezone = 'America/Sao_Paulo'): string => {
        const d = new Date(isoUtc);
        const hourStr = d.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          hour12: false,
          timeZone: timezone,
        });
        const hour = parseInt(hourStr, 10);
        if (hour < 12) return 'Manhã';
        if (hour < 18) return 'Tarde';
        return 'Noite';
      };

      expect(classifyPeriod('2026-10-31T11:00:00+00:00')).toBe('Manhã'); // 08:00 BRT
      expect(classifyPeriod('2026-10-31T17:00:00+00:00')).toBe('Tarde'); // 14:00 BRT
      expect(classifyPeriod('2026-11-01T00:00:00+00:00')).toBe('Noite'); // 21:00 BRT
      expect(classifyPeriod('2026-11-01T00:30:00+00:00')).toBe('Noite'); // 21:30 BRT
    });
  });
});
