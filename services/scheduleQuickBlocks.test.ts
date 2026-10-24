import { describe, it, expect } from 'vitest';
import {
  decimalHourToTimeString,
  timeStringToDecimalHour,
  addMinutesToTimeString,
  roundTimeToNextSlot,
  calculatePresetTimes,
  detectPresetAppointmentConflicts,
  QUICK_BLOCK_PRESETS,
  QuickBlockAppointmentTarget,
} from './scheduleQuickBlocks';

describe('scheduleQuickBlocks utility tests', () => {
  describe('Time conversion and rounding functions', () => {
    it('should convert decimal hour to HH:mm string', () => {
      expect(decimalHourToTimeString(14.5)).toBe('14:30');
      expect(decimalHourToTimeString(9.0)).toBe('09:00');
      expect(decimalHourToTimeString(18.75)).toBe('18:45');
      expect(decimalHourToTimeString(8.25)).toBe('08:15');
    });

    it('should convert HH:mm string to decimal hour', () => {
      expect(timeStringToDecimalHour('14:30')).toBe(14.5);
      expect(timeStringToDecimalHour('09:00')).toBe(9);
      expect(timeStringToDecimalHour('18:45')).toBe(18.75);
      expect(timeStringToDecimalHour('08:15')).toBe(8.25);
    });

    it('should add minutes to HH:mm string correctly', () => {
      expect(addMinutesToTimeString('14:00', 15)).toBe('14:15');
      expect(addMinutesToTimeString('14:30', 30)).toBe('15:00');
      expect(addMinutesToTimeString('12:00', 60)).toBe('13:00');
      expect(addMinutesToTimeString('23:45', 30)).toBe('23:59'); // Clamped to day end
    });

    it('should round time to next slot correctly', () => {
      expect(roundTimeToNextSlot('14:00', 15)).toBe('14:00');
      expect(roundTimeToNextSlot('14:03', 15)).toBe('14:15');
      expect(roundTimeToNextSlot('14:15', 15)).toBe('14:15');
      expect(roundTimeToNextSlot('14:46', 15)).toBe('15:00');
    });
  });

  describe('calculatePresetTimes', () => {
    it('should calculate Pausa 15m preset', () => {
      const result = calculatePresetTimes('pausa_15', '10:00');
      expect(result.startTime).toBe('10:00');
      expect(result.endTime).toBe('10:15');
      expect(result.blockType).toBe('interval');
      expect(result.reason).toContain('15m');
    });

    it('should calculate Pausa 30m preset', () => {
      const result = calculatePresetTimes('pausa_30', '11:15');
      expect(result.startTime).toBe('11:15');
      expect(result.endTime).toBe('11:45');
      expect(result.blockType).toBe('interval');
    });

    it('should calculate Almoço 1h preset', () => {
      const result = calculatePresetTimes('almoco_1h', '12:00');
      expect(result.startTime).toBe('12:00');
      expect(result.endTime).toBe('13:00');
      expect(result.blockType).toBe('interval');
      expect(result.reason).toBe('Almoço');
    });

    it('should calculate Folga Hoje preset with business hours', () => {
      const result = calculatePresetTimes('folga_hoje', '14:00', 8 * 60, 20 * 60);
      expect(result.startTime).toBe('08:00');
      expect(result.endTime).toBe('20:00');
      expect(result.blockType).toBe('full_day');
      expect(result.reason).toContain('Folga');
    });

    it('should throw error for invalid preset id', () => {
      // @ts-expect-error test invalid preset id
      expect(() => calculatePresetTimes('invalid_preset')).toThrowError();
    });
  });

  describe('detectPresetAppointmentConflicts', () => {
    const mockAppointments: QuickBlockAppointmentTarget[] = [
      {
        id: 'apt-1',
        client: 'Carlos Silva',
        phone: '11999999999',
        service: 'Corte Tradicional',
        staffId: 'staff-barber-1',
        date: '2026-10-25',
        start: 10.0, // 10:00
        duration: 0.75, // 45 min -> 10:45
        status: 'confirmed',
        price: 50,
      },
      {
        id: 'apt-2',
        client: 'Marcos Souza',
        phone: '11988888888',
        service: 'Barba Terapia',
        staffId: 'staff-barber-1',
        date: '2026-10-25',
        start: 14.0, // 14:00
        duration: 0.5, // 30 min -> 14:30
        status: 'scheduled',
        price: 40,
      },
      {
        id: 'apt-3-cancelled',
        client: 'João Cancelado',
        phone: '11977777777',
        service: 'Corte + Barba',
        staffId: 'staff-barber-1',
        date: '2026-10-25',
        start: 11.0, // 11:00
        duration: 1.0, // 60 min -> 12:00
        status: 'cancelled',
        price: 80,
      },
      {
        id: 'apt-4-other-staff',
        client: 'Lucas Outro Barbeiro',
        phone: '11966666666',
        service: 'Corte',
        staffId: 'staff-barber-2',
        date: '2026-10-25',
        start: 10.0,
        duration: 0.75,
        status: 'confirmed',
        price: 50,
      },
    ];

    it('should report NO conflict when block does not overlap appointments', () => {
      // Slot 08:00 - 08:30 (before any appointment)
      const result = detectPresetAppointmentConflicts(
        mockAppointments,
        'staff-barber-1',
        '2026-10-25',
        'interval',
        '08:00',
        '08:30'
      );
      expect(result.hasConflict).toBe(false);
      expect(result.conflictingAppointments).toHaveLength(0);
      expect(result.summaryMessage).toBeNull();
    });

    it('should report conflict when block overlaps an appointment', () => {
      // Slot 10:15 - 10:45 (overlaps Carlos Silva 10:00 - 10:45)
      const result = detectPresetAppointmentConflicts(
        mockAppointments,
        'staff-barber-1',
        '2026-10-25',
        'interval',
        '10:15',
        '10:45'
      );
      expect(result.hasConflict).toBe(true);
      expect(result.conflictingAppointments).toHaveLength(1);
      expect(result.conflictingAppointments[0].clientName).toBe('Carlos Silva');
      expect(result.conflictingAppointments[0].startTimeFormatted).toBe('10:00');
      expect(result.conflictingAppointments[0].endTimeFormatted).toBe('10:45');
      expect(result.summaryMessage).toContain('Carlos Silva');
    });

    it('should ignore cancelled appointments during conflict check', () => {
      // Slot 11:00 - 12:00 (overlaps Joao Cancelado who is cancelled)
      const result = detectPresetAppointmentConflicts(
        mockAppointments,
        'staff-barber-1',
        '2026-10-25',
        'interval',
        '11:00',
        '12:00'
      );
      expect(result.hasConflict).toBe(false);
      expect(result.conflictingAppointments).toHaveLength(0);
    });

    it('should ignore appointments belonging to other staff members', () => {
      // Slot 10:00 - 10:45 for staff-barber-2 should not conflict with staff-barber-1
      const result = detectPresetAppointmentConflicts(
        mockAppointments,
        'staff-barber-99', // Non-existing or different staff
        '2026-10-25',
        'interval',
        '10:00',
        '10:45'
      );
      expect(result.hasConflict).toBe(false);
    });

    it('should detect all active appointments when checking full_day block', () => {
      // Folga Hoje for staff-barber-1 on 2026-10-25 should conflict with apt-1 and apt-2
      const result = detectPresetAppointmentConflicts(
        mockAppointments,
        'staff-barber-1',
        '2026-10-25',
        'full_day',
        '08:00',
        '20:00'
      );
      expect(result.hasConflict).toBe(true);
      expect(result.conflictingAppointments).toHaveLength(2); // Carlos Silva & Marcos Souza
      expect(result.summaryMessage).toContain('2 agendamentos ativos');
    });
  });
});
