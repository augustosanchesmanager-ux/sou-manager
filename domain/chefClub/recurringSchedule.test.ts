import { describe, it, expect } from 'vitest';
import {
  validateRecurringSlotInput,
  calculateSlotDatesInWindow,
  isSlotCollidingWithBlock,
  evaluateCancellationYield,
} from './recurringScheduleService';
import type { CreateRecurringSlotInput } from './recurringScheduleTypes';

describe('recurringScheduleService (ADR-038)', () => {
  describe('validateRecurringSlotInput', () => {
    const validSlot: CreateRecurringSlotInput = {
      tenant_id: 'ten-123',
      subscription_id: 'sub-456',
      client_id: 'cli-789',
      professional_id: 'pro-101',
      service_id: 'srv-202',
      day_of_week: 4, // Quinta-feira
      start_time: '18:00',
      duration_minutes: 45,
    };

    it('should pass with fully valid input', () => {
      const result = validateRecurringSlotInput(validSlot);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when required IDs are empty', () => {
      const result = validateRecurringSlotInput({
        ...validSlot,
        tenant_id: '',
        client_id: '   ',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('tenant_id é obrigatório');
      expect(result.errors).toContain('client_id é obrigatório');
    });

    it('should fail when day_of_week is invalid', () => {
      expect(validateRecurringSlotInput({ ...validSlot, day_of_week: -1 }).valid).toBe(false);
      expect(validateRecurringSlotInput({ ...validSlot, day_of_week: 7 }).valid).toBe(false);
      expect(validateRecurringSlotInput({ ...validSlot, day_of_week: 0 }).valid).toBe(true); // Domingo
      expect(validateRecurringSlotInput({ ...validSlot, day_of_week: 6 }).valid).toBe(true); // Sábado
    });

    it('should validate start_time format', () => {
      expect(validateRecurringSlotInput({ ...validSlot, start_time: '25:00' }).valid).toBe(false);
      expect(validateRecurringSlotInput({ ...validSlot, start_time: '18:65' }).valid).toBe(false);
      expect(validateRecurringSlotInput({ ...validSlot, start_time: 'abc' }).valid).toBe(false);
      expect(validateRecurringSlotInput({ ...validSlot, start_time: '09:30' }).valid).toBe(true);
      expect(validateRecurringSlotInput({ ...validSlot, start_time: '14:00:00' }).valid).toBe(true);
    });

    it('should validate duration_minutes bounds', () => {
      expect(validateRecurringSlotInput({ ...validSlot, duration_minutes: 0 }).valid).toBe(false);
      expect(validateRecurringSlotInput({ ...validSlot, duration_minutes: -15 }).valid).toBe(false);
      expect(validateRecurringSlotInput({ ...validSlot, duration_minutes: 500 }).valid).toBe(false);
      expect(validateRecurringSlotInput({ ...validSlot, duration_minutes: 60 }).valid).toBe(true);
    });
  });

  describe('calculateSlotDatesInWindow', () => {
    it('should generate all matching Thursdays in a 30-day window within billing cycle', () => {
      // Novembro de 2026: 05, 12, 19, 26 são quintas-feiras (dayOfWeek = 4)
      const dates = calculateSlotDatesInWindow({
        dayOfWeek: 4,
        windowStartDate: '2026-11-01',
        windowEndDate: '2026-11-30',
        cycleStartDate: '2026-11-01',
        cycleEndDate: '2026-11-30',
      });

      expect(dates).toEqual(['2026-11-05', '2026-11-12', '2026-11-19', '2026-11-26']);
    });

    it('should truncate dates when billing cycle ends earlier than rolling window', () => {
      // Ciclo encerra em 2026-11-15: apenas dias 05 e 12 devem ser agendados
      const dates = calculateSlotDatesInWindow({
        dayOfWeek: 4,
        windowStartDate: '2026-11-01',
        windowEndDate: '2026-11-30',
        cycleStartDate: '2026-11-01',
        cycleEndDate: '2026-11-15',
      });

      expect(dates).toEqual(['2026-11-05', '2026-11-12']);
    });

    it('should truncate dates when cycle starts after window start', () => {
      // Ciclo inicia em 2026-11-10: exclui dia 05
      const dates = calculateSlotDatesInWindow({
        dayOfWeek: 4,
        windowStartDate: '2026-11-01',
        windowEndDate: '2026-11-30',
        cycleStartDate: '2026-11-10',
        cycleEndDate: '2026-11-30',
      });

      expect(dates).toEqual(['2026-11-12', '2026-11-19', '2026-11-26']);
    });

    it('should return empty array when window and billing cycle do not overlap', () => {
      const dates = calculateSlotDatesInWindow({
        dayOfWeek: 4,
        windowStartDate: '2026-12-01',
        windowEndDate: '2026-12-31',
        cycleStartDate: '2026-10-01',
        cycleEndDate: '2026-10-31',
      });

      expect(dates).toHaveLength(0);
    });
  });

  describe('isSlotCollidingWithBlock (ADR-038 D3)', () => {
    it('should return false when target date is outside block date range', () => {
      const collides = isSlotCollidingWithBlock({
        blockType: 'full_day',
        blockStartDate: '2026-11-10',
        blockEndDate: '2026-11-15',
        targetDate: '2026-11-05',
        slotStartTime: '18:00',
      });
      expect(collides).toBe(false);
    });

    it('should return true for full_day block on matching date', () => {
      const collides = isSlotCollidingWithBlock({
        blockType: 'full_day',
        blockStartDate: '2026-11-10',
        blockEndDate: '2026-11-15',
        targetDate: '2026-11-12',
        slotStartTime: '18:00',
      });
      expect(collides).toBe(true);
    });

    it('should detect collision when slot overlaps with time_range block', () => {
      // Bloqueio das 17:30 às 18:30. Slot às 18:00 com duração de 30m.
      const collides = isSlotCollidingWithBlock({
        blockType: 'time_range',
        blockStartDate: '2026-11-12',
        blockEndDate: '2026-11-12',
        blockStartTime: '17:30',
        blockEndTime: '18:30',
        targetDate: '2026-11-12',
        slotStartTime: '18:00',
        slotDurationMinutes: 30,
      });
      expect(collides).toBe(true);
    });

    it('should return false when slot is completely before or after time_range block', () => {
      // Bloqueio das 14:00 às 15:00
      const collidesBefore = isSlotCollidingWithBlock({
        blockType: 'time_range',
        blockStartDate: '2026-11-12',
        blockEndDate: '2026-11-12',
        blockStartTime: '14:00',
        blockEndTime: '15:00',
        targetDate: '2026-11-12',
        slotStartTime: '10:00',
        slotDurationMinutes: 30,
      });
      expect(collidesBefore).toBe(false);

      const collidesAfter = isSlotCollidingWithBlock({
        blockType: 'time_range',
        blockStartDate: '2026-11-12',
        blockEndDate: '2026-11-12',
        blockStartTime: '14:00',
        blockEndTime: '15:00',
        targetDate: '2026-11-12',
        slotStartTime: '15:00', // Slot inicia exatamente quando o bloqueio termina
        slotDurationMinutes: 30,
      });
      expect(collidesAfter).toBe(false);
    });
  });

  describe('evaluateCancellationYield (ADR-038 D4)', () => {
    it('should refund credit when cancelled >= 12h in advance', () => {
      const appTime = new Date('2026-11-12T18:00:00Z');
      const cancelTime = new Date('2026-11-12T05:00:00Z'); // 13h antes

      const evaluation = evaluateCancellationYield(appTime, cancelTime, 12);
      expect(evaluation.isLateCancellation).toBe(false);
      expect(evaluation.refundCredit).toBe(true);
      expect(evaluation.shouldRetainCredit).toBe(false);
      expect(evaluation.reason).toContain('Crédito estornado');
    });

    it('should retain credit when cancelled < 12h in advance (late cancellation)', () => {
      const appTime = new Date('2026-11-12T18:00:00Z');
      const cancelTime = new Date('2026-11-12T14:00:00Z'); // 4h antes

      const evaluation = evaluateCancellationYield(appTime, cancelTime, 12);
      expect(evaluation.isLateCancellation).toBe(true);
      expect(evaluation.refundCredit).toBe(false);
      expect(evaluation.shouldRetainCredit).toBe(true);
      expect(evaluation.reason).toContain('Crédito retido por yield management');
    });

    it('should retain credit for no-show (cancellation after appointment time)', () => {
      const appTime = new Date('2026-11-12T18:00:00Z');
      const cancelTime = new Date('2026-11-12T19:00:00Z'); // 1h depois

      const evaluation = evaluateCancellationYield(appTime, cancelTime, 12);
      expect(evaluation.isLateCancellation).toBe(true);
      expect(evaluation.refundCredit).toBe(false);
      expect(evaluation.shouldRetainCredit).toBe(true);
    });
  });
});
