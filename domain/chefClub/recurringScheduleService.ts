/**
 * [SMG][DOMAIN][CHEF_CLUB] recurringScheduleService
 *
 * Regras puras de negócio para Horários Fixos Recorrentes e Yield Management (ADR-038).
 * 100% testável, zero side-effects.
 */

import type { CreateRecurringSlotInput } from './recurringScheduleTypes';

export interface DateWindowParams {
  dayOfWeek: number; // 0=Domingo, 1=Segunda, ..., 6=Sábado
  windowStartDate: string; // YYYY-MM-DD
  windowEndDate: string; // YYYY-MM-DD
  cycleStartDate: string; // YYYY-MM-DD
  cycleEndDate: string; // YYYY-MM-DD
}

export interface ScheduleBlockCheckParams {
  blockType: 'full_day' | 'time_range';
  blockStartDate: string; // YYYY-MM-DD
  blockEndDate: string; // YYYY-MM-DD
  blockStartTime?: string | null; // HH:mm
  blockEndTime?: string | null; // HH:mm
  targetDate: string; // YYYY-MM-DD
  slotStartTime: string; // HH:mm
  slotDurationMinutes?: number;
}

export interface CancellationYieldEvaluation {
  isLateCancellation: boolean;
  shouldRetainCredit: boolean;
  refundCredit: boolean;
  reason: string;
}

/**
 * Valida os dados de criação de um horário fixo recorrente.
 */
export const validateRecurringSlotInput = (input: CreateRecurringSlotInput): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!input.tenant_id?.trim()) errors.push('tenant_id é obrigatório');
  if (!input.subscription_id?.trim()) errors.push('subscription_id é obrigatório');
  if (!input.client_id?.trim()) errors.push('client_id é obrigatório');
  if (!input.professional_id?.trim()) errors.push('professional_id é obrigatório');
  if (!input.service_id?.trim()) errors.push('service_id é obrigatório');

  if (typeof input.day_of_week !== 'number' || input.day_of_week < 0 || input.day_of_week > 6) {
    errors.push('day_of_week deve ser um número entre 0 (Domingo) e 6 (Sábado)');
  }

  if (!input.start_time || !/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(input.start_time)) {
    errors.push('start_time deve estar no formato HH:mm ou HH:mm:ss');
  }

  if (input.duration_minutes !== undefined && (input.duration_minutes <= 0 || input.duration_minutes > 480)) {
    errors.push('duration_minutes deve ser maior que 0 e no máximo 480 minutos');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Calcula todas as datas do dia da semana escolhido que caem tanto
 * dentro da janela rolante quanto no ciclo de faturamento ativo.
 */
export const calculateSlotDatesInWindow = (params: DateWindowParams): string[] => {
  const { dayOfWeek, windowStartDate, windowEndDate, cycleStartDate, cycleEndDate } = params;

  const wStart = new Date(`${windowStartDate}T00:00:00Z`);
  const wEnd = new Date(`${windowEndDate}T00:00:00Z`);
  const cStart = new Date(`${cycleStartDate}T00:00:00Z`);
  const cEnd = new Date(`${cycleEndDate}T00:00:00Z`);

  if (isNaN(wStart.getTime()) || isNaN(wEnd.getTime()) || isNaN(cStart.getTime()) || isNaN(cEnd.getTime())) {
    return [];
  }

  // Interseção entre a janela rolante e o ciclo pago
  const effectiveStart = new Date(Math.max(wStart.getTime(), cStart.getTime()));
  const effectiveEnd = new Date(Math.min(wEnd.getTime(), cEnd.getTime()));

  if (effectiveStart > effectiveEnd) {
    return [];
  }

  const matchingDates: string[] = [];
  const current = new Date(effectiveStart);

  while (current <= effectiveEnd) {
    // getUTCDay() retorna 0 para domingo, 1 para segunda, etc.
    if (current.getUTCDay() === dayOfWeek) {
      matchingDates.push(current.toISOString().slice(0, 10));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return matchingDates;
};

/**
 * Converte string 'HH:mm' para total de minutos desde 00:00.
 */
const timeToMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Avalia se o horário fixo recorrente colide com um ScheduleBlock do barbeiro (ADR-038 D3).
 */
export const isSlotCollidingWithBlock = (params: ScheduleBlockCheckParams): boolean => {
  const {
    blockType,
    blockStartDate,
    blockEndDate,
    blockStartTime,
    blockEndTime,
    targetDate,
    slotStartTime,
    slotDurationMinutes = 30,
  } = params;

  // Se a data do agendamento estiver fora do intervalo do bloqueio, não há conflito
  if (targetDate < blockStartDate || targetDate > blockEndDate) {
    return false;
  }

  // Bloqueio de dia inteiro (férias, folga completa, feriado)
  if (blockType === 'full_day') {
    return true;
  }

  // Bloqueio com faixa de horário
  if (blockType === 'time_range' && blockStartTime && blockEndTime) {
    const blockStart = timeToMinutes(blockStartTime);
    const blockEnd = timeToMinutes(blockEndTime);
    const slotStart = timeToMinutes(slotStartTime);
    const slotEnd = slotStart + slotDurationMinutes;

    // Conflito ocorre se houver sobreposição nos intervalos: slotStart < blockEnd && slotEnd > blockStart
    return slotStart < blockEnd && slotEnd > blockStart;
  }

  return false;
};

/**
 * Avalia política de cancelamento / Yield Management (ADR-038 D4).
 * Cancelamento com >= 12h de antecedência: estorna crédito.
 * Cancelamento tardio (< 12h) ou No-Show: retém crédito como penalidade.
 */
export const evaluateCancellationYield = (
  appointmentDateTime: Date | string,
  cancellationDateTime: Date | string = new Date(),
  leadTimeHoursThreshold = 12
): CancellationYieldEvaluation => {
  const appDate = typeof appointmentDateTime === 'string' ? new Date(appointmentDateTime) : appointmentDateTime;
  const cancelDate = typeof cancellationDateTime === 'string' ? new Date(cancellationDateTime) : cancellationDateTime;

  const diffMs = appDate.getTime() - cancelDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours >= leadTimeHoursThreshold) {
    return {
      isLateCancellation: false,
      shouldRetainCredit: false,
      refundCredit: true,
      reason: `Cancelamento realizado com ${diffHours.toFixed(1)}h de antecedência (limite: ${leadTimeHoursThreshold}h). Crédito estornado.`,
    };
  }

  return {
    isLateCancellation: true,
    shouldRetainCredit: true,
    refundCredit: false,
    reason: `Cancelamento tardio (${diffHours.toFixed(1)}h de antecedência, inferior a ${leadTimeHoursThreshold}h). Crédito retido por yield management.`,
  };
};
