import { describe, it, expect } from 'vitest';
import {
  classifyChairQueue,
  getRecommendedPrimaryAction,
  formatElapsedTime,
  validateWalkInForm,
  type QueueAppointment,
} from './barberQueue';

describe('barberQueue util', () => {
  const makeApt = (overrides: Partial<QueueAppointment>): QueueAppointment => ({
    id: 'apt-1',
    staffId: 'staff-1',
    staffName: 'Barbeiro Lucas',
    service: 'Corte Degradê',
    client: 'Carlos Silva',
    start: 14,
    duration: 0.5,
    startTime: '2026-10-25T14:00:00.000Z',
    status: 'confirmed',
    ...overrides,
  });

  describe('classifyChairQueue', () => {
    it('should return empty lists and zero metrics for empty appointments', () => {
      const result = classifyChairQueue([]);
      expect(result.inProgress).toBeNull();
      expect(result.next).toBeNull();
      expect(result.upcoming).toHaveLength(0);
      expect(result.completed).toHaveLength(0);
      expect(result.cancelled).toHaveLength(0);
      expect(result.metrics).toEqual({
        total: 0,
        completedCount: 0,
        inProgressCount: 0,
        waitingCount: 0,
        cancelledCount: 0,
      });
    });

    it('should correctly separate in_progress, next and upcoming appointments for specific staff', () => {
      const appointments: QueueAppointment[] = [
        makeApt({ id: '1', status: 'in_progress', startTime: '2026-10-25T13:30:00.000Z', staffId: 'staff-1' }),
        makeApt({ id: '2', status: 'confirmed', startTime: '2026-10-25T14:00:00.000Z', staffId: 'staff-1' }),
        makeApt({ id: '3', status: 'pending', startTime: '2026-10-25T14:30:00.000Z', staffId: 'staff-1' }),
        makeApt({ id: '4', status: 'completed', startTime: '2026-10-25T13:00:00.000Z', staffId: 'staff-1' }),
        makeApt({ id: '5', status: 'cancelled', startTime: '2026-10-25T15:00:00.000Z', staffId: 'staff-1' }),
        makeApt({ id: '6', status: 'confirmed', startTime: '2026-10-25T14:00:00.000Z', staffId: 'staff-2' }), // Outro barbeiro
      ];

      const result = classifyChairQueue(appointments, 'staff-1');

      expect(result.inProgress?.id).toBe('1');
      expect(result.next?.id).toBe('2');
      expect(result.upcoming).toHaveLength(1);
      expect(result.upcoming[0].id).toBe('3');
      expect(result.completed).toHaveLength(1);
      expect(result.completed[0].id).toBe('4');
      expect(result.cancelled).toHaveLength(1);
      expect(result.cancelled[0].id).toBe('5');
      expect(result.metrics).toEqual({
        total: 5,
        completedCount: 1,
        inProgressCount: 1,
        waitingCount: 2,
        cancelledCount: 1,
      });
    });

    it('should include all staff when professionalId is "all" or undefined', () => {
      const appointments: QueueAppointment[] = [
        makeApt({ id: '1', staffId: 'staff-1', status: 'confirmed', startTime: '2026-10-25T14:00:00.000Z' }),
        makeApt({ id: '2', staffId: 'staff-2', status: 'confirmed', startTime: '2026-10-25T14:30:00.000Z' }),
      ];

      const result = classifyChairQueue(appointments, 'all');
      expect(result.metrics.total).toBe(2);
      expect(result.next?.id).toBe('1');
      expect(result.upcoming[0]?.id).toBe('2');
    });

    it('should sort waiting candidates chronologically', () => {
      const appointments: QueueAppointment[] = [
        makeApt({ id: 'later', status: 'pending', startTime: '2026-10-25T16:00:00.000Z' }),
        makeApt({ id: 'earlier', status: 'confirmed', startTime: '2026-10-25T14:00:00.000Z' }),
      ];

      const result = classifyChairQueue(appointments);
      expect(result.next?.id).toBe('earlier');
      expect(result.upcoming[0]?.id).toBe('later');
    });
  });

  describe('getRecommendedPrimaryAction', () => {
    it('should return finish action for in_progress', () => {
      const action = getRecommendedPrimaryAction('in_progress');
      expect(action).toEqual({
        actionKey: 'finish',
        label: 'Finalizar Atendimento',
        icon: 'task_alt',
        variant: 'success',
      });
    });

    it('should return start action for confirmed', () => {
      const action = getRecommendedPrimaryAction('confirmed');
      expect(action).toEqual({
        actionKey: 'start',
        label: 'Iniciar Atendimento',
        icon: 'play_arrow',
        variant: 'primary',
      });
    });

    it('should return start action for pending with amber variant', () => {
      const action = getRecommendedPrimaryAction('pending');
      expect(action).toEqual({
        actionKey: 'start',
        label: 'Iniciar Atendimento',
        icon: 'play_arrow',
        variant: 'amber',
      });
    });

    it('should return view_comanda for completed', () => {
      const action = getRecommendedPrimaryAction('completed');
      expect(action).toEqual({
        actionKey: 'view_comanda',
        label: 'Ver Comanda',
        icon: 'receipt_long',
        variant: 'neutral',
      });
    });

    it('should return none for cancelled and no_show', () => {
      expect(getRecommendedPrimaryAction('cancelled').actionKey).toBe('none');
      expect(getRecommendedPrimaryAction('no_show').actionKey).toBe('none');
    });
  });

  describe('formatElapsedTime', () => {
    const baseNow = new Date('2026-10-25T15:00:00.000Z');

    it('should return empty string for invalid dates', () => {
      expect(formatElapsedTime('invalid-date', baseNow)).toBe('');
    });

    it('should return "Horário agendado" if appointment is in the future', () => {
      const future = '2026-10-25T15:30:00.000Z';
      expect(formatElapsedTime(future, baseNow)).toBe('Horário agendado');
    });

    it('should return "Iniciado agora" for 0 min diff', () => {
      const nowIso = '2026-10-25T15:00:00.000Z';
      expect(formatElapsedTime(nowIso, baseNow)).toBe('Iniciado agora');
    });

    it('should return "Há 25 min" for under 1 hour', () => {
      const past25 = '2026-10-25T14:35:00.000Z';
      expect(formatElapsedTime(past25, baseNow)).toBe('Há 25 min');
    });

    it('should return "Há 1h" or "Há 1h 15m" for over 1 hour', () => {
      const pastExact1h = '2026-10-25T14:00:00.000Z';
      expect(formatElapsedTime(pastExact1h, baseNow)).toBe('Há 1h');

      const past1h15 = '2026-10-25T13:45:00.000Z';
      expect(formatElapsedTime(past1h15, baseNow)).toBe('Há 1h 15m');
    });
  });

  describe('validateWalkInForm', () => {
    it('should invalidate if clientName has less than 2 characters', () => {
      expect(validateWalkInForm({ clientName: '', serviceId: 's1', staffId: 'st1' })).toEqual({
        isValid: false,
        error: 'Nome do cliente deve conter pelo menos 2 caracteres.',
      });
      expect(validateWalkInForm({ clientName: 'A', serviceId: 's1', staffId: 'st1' })).toEqual({
        isValid: false,
        error: 'Nome do cliente deve conter pelo menos 2 caracteres.',
      });
    });

    it('should invalidate if serviceId is missing', () => {
      expect(validateWalkInForm({ clientName: 'Roberto', serviceId: '', staffId: 'st1' })).toEqual({
        isValid: false,
        error: 'Selecione um serviço para o atendimento.',
      });
    });

    it('should invalidate if staffId is missing', () => {
      expect(validateWalkInForm({ clientName: 'Roberto', serviceId: 's1', staffId: '' })).toEqual({
        isValid: false,
        error: 'Profissional da cadeira é obrigatório.',
      });
    });

    it('should validate successfully when all required fields are provided', () => {
      expect(validateWalkInForm({ clientName: 'Roberto Carlos', serviceId: 's1', staffId: 'st1' })).toEqual({
        isValid: true,
      });
    });
  });
});
