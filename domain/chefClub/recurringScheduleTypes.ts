/**
 * [SMG][DOMAIN][CHEF_CLUB] recurringScheduleTypes
 *
 * Tipos e contratos de domínio para Horários Fixos Recorrentes e Yield Management (ADR-038).
 */

export interface SubscriptionRecurringSlot {
  id: string;
  tenant_id: string;
  subscription_id: string;
  client_id: string;
  professional_id: string;
  service_id: string;
  day_of_week: number; // 0=Domingo, 1=Segunda, ..., 6=Sábado
  start_time: string; // HH:mm ou HH:mm:ss
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRecurringSlotInput {
  tenant_id: string;
  subscription_id: string;
  client_id: string;
  professional_id: string;
  service_id: string;
  day_of_week: number;
  start_time: string;
  duration_minutes?: number;
}

export interface RecurringScheduleGenerationResult {
  success: boolean;
  generated_count: number;
  skipped_conflict_count: number;
  skipped_quota_count: number;
  details: Array<{
    slot_id: string;
    client_name: string;
    date: string;
    start_time?: string;
    status: 'generated' | 'skipped_conflict' | 'skipped_quota_exhausted';
  }>;
}

export interface RecurringScheduleEvictionResult {
  success: boolean;
  evicted_count: number;
  grace_period_days: number;
  details: Array<{
    appointment_id: string;
    client_name: string;
    start_time: string;
    subscription_id: string;
  }>;
}
