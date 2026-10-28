/**
 * [SMG][APPLICATION][CHEF_CLUB] recurringSchedule
 *
 * Casos de uso de aplicação para Horários Fixos Recorrentes (ADR-038).
 */

import {
  chefClubRecurringScheduleRepository,
  validateRecurringSlotInput,
  type SubscriptionRecurringSlot,
  type CreateRecurringSlotInput,
  type RecurringScheduleGenerationResult,
  type RecurringScheduleEvictionResult,
} from '../../domain/chefClub';
import { ChefClubError } from './types';

export const loadSubscriptionRecurringSlots = async (
  tenantId: string,
  subscriptionId: string
): Promise<SubscriptionRecurringSlot[]> => {
  if (!tenantId || !subscriptionId) return [];
  return chefClubRecurringScheduleRepository.listBySubscription(tenantId, subscriptionId);
};

export const addSubscriptionRecurringSlot = async (
  input: CreateRecurringSlotInput
): Promise<SubscriptionRecurringSlot> => {
  const validation = validateRecurringSlotInput(input);
  if (!validation.valid) {
    throw new ChefClubError(validation.errors.join('; '));
  }

  return chefClubRecurringScheduleRepository.create(input);
};

export const toggleSubscriptionRecurringSlot = async (
  tenantId: string,
  slotId: string,
  isActive: boolean
): Promise<SubscriptionRecurringSlot> => {
  if (!tenantId || !slotId) {
    throw new ChefClubError('tenantId e slotId são obrigatórios');
  }

  return chefClubRecurringScheduleRepository.toggleActive(tenantId, slotId, isActive);
};

export const removeSubscriptionRecurringSlot = async (
  tenantId: string,
  slotId: string
): Promise<void> => {
  if (!tenantId || !slotId) {
    throw new ChefClubError('tenantId e slotId são obrigatórios');
  }

  return chefClubRecurringScheduleRepository.delete(tenantId, slotId);
};

export const triggerRecurringScheduleGeneration = async (
  tenantId: string,
  daysAhead = 30
): Promise<RecurringScheduleGenerationResult> => {
  if (!tenantId) {
    throw new ChefClubError('tenantId é obrigatório');
  }

  return chefClubRecurringScheduleRepository.generateRecurringAppointments(tenantId, daysAhead);
};

export const triggerOverdueScheduleEviction = async (
  tenantId: string,
  gracePeriodDays = 5
): Promise<RecurringScheduleEvictionResult> => {
  if (!tenantId) {
    throw new ChefClubError('tenantId é obrigatório');
  }

  return chefClubRecurringScheduleRepository.evictOverdueAppointments(tenantId, gracePeriodDays);
};
