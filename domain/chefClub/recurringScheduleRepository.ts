/**
 * [SMG][DOMAIN][CHEF_CLUB] recurringScheduleRepository
 *
 * Responsabilidade: Acesso a dados de horários fixos de assinantes (tabela subscription_recurring_slots)
 * e execução das RPCs atômicas de geração e despejo do ADR-038.
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { AppSlug } from '../shared/app';
import type {
  SubscriptionRecurringSlot,
  CreateRecurringSlotInput,
  RecurringScheduleGenerationResult,
  RecurringScheduleEvictionResult,
} from './recurringScheduleTypes';

const RECURRING_SLOT_COLUMNS =
  'id, tenant_id, subscription_id, client_id, professional_id, service_id, day_of_week, start_time, duration_minutes, is_active, created_at, updated_at';

export class ChefClubRecurringScheduleRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('subscription_recurring_slots', db ?? createSupabaseClient('subscription_recurring_slots', appSlug));
  }

  async listBySubscription(tenantId: string, subscriptionId: string): Promise<SubscriptionRecurringSlot[]> {
    try {
      const result = await this.from()
        .select(RECURRING_SLOT_COLUMNS)
        .eq('tenant_id', tenantId)
        .eq('subscription_id', subscriptionId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      return this.extractData<SubscriptionRecurringSlot[]>(result, 'list recurring slots by subscription');
    } catch (error) {
      this.throwOnError(error, 'list recurring slots by subscription');
    }
  }

  async create(input: CreateRecurringSlotInput): Promise<SubscriptionRecurringSlot> {
    try {
      const result = await this.from()
        .insert({
          tenant_id: input.tenant_id,
          subscription_id: input.subscription_id,
          client_id: input.client_id,
          professional_id: input.professional_id,
          service_id: input.service_id,
          day_of_week: input.day_of_week,
          start_time: input.start_time,
          duration_minutes: input.duration_minutes ?? 30,
          is_active: true,
        })
        .select(RECURRING_SLOT_COLUMNS)
        .single();

      return this.extractData<SubscriptionRecurringSlot>(result, 'create recurring slot');
    } catch (error) {
      this.throwOnError(error, 'create recurring slot');
    }
  }

  async toggleActive(tenantId: string, slotId: string, isActive: boolean): Promise<SubscriptionRecurringSlot> {
    try {
      const result = await this.from()
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', slotId)
        .select(RECURRING_SLOT_COLUMNS)
        .single();

      return this.extractData<SubscriptionRecurringSlot>(result, 'toggle recurring slot active');
    } catch (error) {
      this.throwOnError(error, 'toggle recurring slot active');
    }
  }

  async delete(tenantId: string, slotId: string): Promise<void> {
    try {
      const result = await this.from()
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', slotId);

      if (result.error) {
        throw result.error;
      }
    } catch (error) {
      this.throwOnError(error, 'delete recurring slot');
    }
  }

  async generateRecurringAppointments(
    tenantId: string,
    daysAhead = 30
  ): Promise<RecurringScheduleGenerationResult> {
    try {
      const { data, error } = await this.db.rpc('generate_subscription_recurring_appointments', {
        p_tenant_id: tenantId,
        p_days_ahead: daysAhead,
      });

      if (error) {
        throw error;
      }

      return data as RecurringScheduleGenerationResult;
    } catch (error) {
      this.throwOnError(error, 'generate recurring appointments RPC');
    }
  }

  async evictOverdueAppointments(
    tenantId: string,
    gracePeriodDays = 5
  ): Promise<RecurringScheduleEvictionResult> {
    try {
      const { data, error } = await this.db.rpc('evict_overdue_subscription_appointments', {
        p_tenant_id: tenantId,
        p_grace_period_days: gracePeriodDays,
      });

      if (error) {
        throw error;
      }

      return data as RecurringScheduleEvictionResult;
    } catch (error) {
      this.throwOnError(error, 'evict overdue appointments RPC');
    }
  }
}

export const chefClubRecurringScheduleRepository = new ChefClubRecurringScheduleRepositoryImpl();
