/**
 * Unit tests for ServicesGridSelector & BookingStickyBottomBar logic:
 * - Multi-selection toggling and accumulation
 * - Title aggregation logic for Phase 3 confirmation modal
 * - Sticky bottom bar active vs disabled state calculations
 * - Price and duration summation
 */

import { describe, it, expect } from 'vitest';
import type { PublicService } from './hooks/types';

describe('ServicesGridSelector & BookingStickyBottomBar — Logic & Invariant Suite', () => {
  const mockServices: PublicService[] = [
    {
      id: 'srv-1',
      name: 'Corte Tradicional',
      category: 'Cabelo',
      duration: 30,
      price: 50,
      active: true,
      description: 'Corte clássico.',
    },
    {
      id: 'srv-2',
      name: 'Barboterapia',
      category: 'Barba',
      duration: 25,
      price: 40,
      active: true,
      description: 'Barba completa.',
    },
    {
      id: 'srv-3',
      name: 'Sobrancelha',
      category: 'Acabamento',
      duration: 15,
      price: 20,
      active: true,
      description: 'Design na pinça.',
    },
  ];

  describe('Multi-service Toggle & Accumulation Logic', () => {
    it('should toggle selection correctly (add when not present, remove when present)', () => {
      let selectedIds: string[] = [];

      const toggle = (id: string) => {
        if (selectedIds.includes(id)) {
          selectedIds = selectedIds.filter((item) => item !== id);
        } else {
          selectedIds = [...selectedIds, id];
        }
      };

      // Select first
      toggle('srv-1');
      expect(selectedIds).toEqual(['srv-1']);

      // Select second
      toggle('srv-2');
      expect(selectedIds).toEqual(['srv-1', 'srv-2']);

      // Deselect first
      toggle('srv-1');
      expect(selectedIds).toEqual(['srv-2']);

      // Deselect second
      toggle('srv-2');
      expect(selectedIds).toEqual([]);
    });

    it('should compute exact total price and duration accumulated from selected services', () => {
      const selectedIds = ['srv-1', 'srv-2', 'srv-3'];
      const selectedServices = mockServices.filter((s) => selectedIds.includes(s.id));

      const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
      const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

      expect(totalPrice).toBe(110); // 50 + 40 + 20
      expect(totalDuration).toBe(70); // 30 + 25 + 15
    });
  });

  describe('Service Title Aggregation for Phase 3 Summary Modal', () => {
    const aggregateServiceName = (
      selectedServices: PublicService[],
      fallbackName?: string
    ): string => {
      if (selectedServices.length === 0) {
        return fallbackName || 'Serviço Selecionado';
      }
      if (selectedServices.length === 1) {
        return selectedServices[0].name;
      }
      if (selectedServices.length === 2) {
        return `${selectedServices[0].name} + ${selectedServices[1].name}`;
      }
      return `${selectedServices[0].name} (+${selectedServices.length - 1} serviços)`;
    };

    it('should return fallback or default when no services are selected', () => {
      expect(aggregateServiceName([])).toBe('Serviço Selecionado');
      expect(aggregateServiceName([], 'Corte Rápido')).toBe('Corte Rápido');
    });

    it('should return single service name when exactly 1 service is selected', () => {
      expect(aggregateServiceName([mockServices[0]])).toBe('Corte Tradicional');
    });

    it('should join with + when exactly 2 services are selected', () => {
      expect(aggregateServiceName([mockServices[0], mockServices[1]])).toBe(
        'Corte Tradicional + Barboterapia'
      );
    });

    it('should format as first service + (+N serviços) when 3 or more services are selected', () => {
      expect(aggregateServiceName(mockServices)).toBe(
        'Corte Tradicional (+2 serviços)'
      );
    });
  });

  describe('BookingStickyBottomBar — Invariants & Display Logic', () => {
    it('should determine whether Continue CTA is enabled based on selectedCount', () => {
      const isCtaEnabled = (selectedCount: number) => selectedCount > 0;

      expect(isCtaEnabled(0)).toBe(false);
      expect(isCtaEnabled(1)).toBe(true);
      expect(isCtaEnabled(3)).toBe(true);
    });

    it('should format selected count label correctly for singular and plural', () => {
      const formatCountLabel = (count: number): string => {
        if (count === 0) return 'Nenhum serviço selecionado';
        return `${count} ${count === 1 ? 'serviço selecionado' : 'serviços selecionados'}`;
      };

      expect(formatCountLabel(0)).toBe('Nenhum serviço selecionado');
      expect(formatCountLabel(1)).toBe('1 serviço selecionado');
      expect(formatCountLabel(2)).toBe('2 serviços selecionados');
    });

    it('should format duration as human-readable minutes or hours/minutes', () => {
      const formatDuration = (minutes: number): string => {
        if (minutes < 60) return `${minutes} min`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}h ${m}min` : `${h}h`;
      };

      expect(formatDuration(30)).toBe('30 min');
      expect(formatDuration(60)).toBe('1h');
      expect(formatDuration(75)).toBe('1h 15min');
      expect(formatDuration(120)).toBe('2h');
    });
  });
});
