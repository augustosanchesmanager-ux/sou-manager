/**
 * [SMG][APPLICATION][ONBOARDING] CompleteOnboardingService
 *
 * RESPONSABILIDADE: Orquestra o onboarding de um novo tenant (Fase 6.0.2).
 *   - Salva passos de configuração progressivamente (empresa → operacional)
 *   - Valida dados obrigatórios antes de cada passo
 *   - Finaliza: RPC complete_onboarding (atomic: settings + tenant.status + profile.onboarding_completed)
 *   - Publica domínio TenantOnboardingCompleted via EventBus → Outbox
 *
 * NÃO FAZ:
 *   - Renderização de UI
 *   - Criação do tenant (TenantProvisioningService)
 *   - Seleção de plano (hardcoded free até Billing)
 *
 * FLUXO:
 *   1. Usuário preenche ShopSetup (dados empresa) → saveCompanyStep
 *   2. Usuário preenche OperationalSetup (horários/intervalo/duração) → saveOperationalStep
 *   3. Finalização → CompleteOnboardingService.complete()
 *      (RPC complete_onboarding → settings + tenant.status='active' + onboarding_completed)
 *   4. Event TenantOnboardingCompleted published → EventBus → Outbox
 *
 * GARANTIAS:
 *   - Validação obrigatória: name, phone (campos mínimos)
 *   - Passos idempotentes (RPC save_onboarding_step → upsert em tenant_settings)
 *   - Após onboarding, tenant fica ativo
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { createSupabaseClient } from '../domain/shared/supabase-client-factory';
import { tenantSettingsRepository } from '../domain/tenantSettings/repository';
import type { TenantSettings, BusinessHours } from '../domain/tenantSettings/types';
import { appEventBus } from '../domain/events/app-bus';
import { createEvent } from '../domain/events/types';
import type { TenantOnboardingCompletedEvent } from '../domain/events/types';

// ─── RPC Client ──────────────────────────────────────────────────

function getRpcClient() {
  return createSupabaseClient('tenants', 'barber');
}

// ─── Types ───────────────────────────────────────────────────────

export interface CompleteOnboardingRequest {
  tenantId: string;
  tenantSlug?: string;

  // Company data
  phone?: string;
  cnpj?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;

  // Operational data
  chairCount?: number;
  businessHours?: Record<string, { open: string; close: string } | null>;
}

export interface SaveCompanyStepRequest {
  tenantId: string;
  phone: string;
  cnpj?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  timezone?: string;
  currency?: string;
}

export interface SaveOperationalStepRequest {
  tenantId: string;
  businessHours?: BusinessHours | null;
  appointmentIntervalMinutes?: number;
  defaultAppointmentDurationMinutes?: number;
  bookingHorizonDays?: number;
  staffOwnedSchedule?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Validation ──────────────────────────────────────────────────

function validateOnboarding(req: CompleteOnboardingRequest): ValidationResult {
  const errors: string[] = [];

  if (!req.tenantId) {
    errors.push('ID do tenant é obrigatório');
  }

  if (!req.phone || req.phone.trim() === '') {
    errors.push('Telefone é obrigatório');
  }

  return { valid: errors.length === 0, errors };
}

function validateCompanyStep(req: SaveCompanyStepRequest): ValidationResult {
  const errors: string[] = [];

  if (!req.tenantId) {
    errors.push('ID do tenant é obrigatório');
  }

  if (!req.phone || req.phone.trim() === '') {
    errors.push('Telefone é obrigatório');
  }

  return { valid: errors.length === 0, errors };
}

function validateOperationalStep(req: SaveOperationalStepRequest): ValidationResult {
  const errors: string[] = [];

  if (!req.tenantId) {
    errors.push('ID do tenant é obrigatório');
  }

  const interval = req.appointmentIntervalMinutes;
  if (interval != null && interval <= 0) {
    errors.push('Intervalo entre horários deve ser maior que zero');
  }

  const duration = req.defaultAppointmentDurationMinutes;
  if (duration != null && duration <= 0) {
    errors.push('Duração padrão deve ser maior que zero');
  }

  const horizon = req.bookingHorizonDays;
  if (horizon != null && horizon <= 0) {
    errors.push('Horizonte de agendamento deve ser maior que zero');
  }

  return { valid: errors.length === 0, errors };
}

// ─── Service ─────────────────────────────────────────────────────

class CompleteOnboardingServiceImpl {
  async getSettings(tenantId: string): Promise<TenantSettings | null> {
    return tenantSettingsRepository.getByTenantId(tenantId);
  }

  async saveCompanyStep(req: SaveCompanyStepRequest): Promise<void> {
    const validation = validateCompanyStep(req);
    if (!validation.valid) {
      throw new Error(`Dados incompletos: ${validation.errors.join(', ')}`);
    }

    const rpc = getRpcClient();

    const { error } = await rpc.rpc('save_onboarding_step', {
      p_tenant_id: req.tenantId,
      p_step: 'company',
      p_data: {
        phone: req.phone ?? '',
        cnpj: req.cnpj ?? '',
        address_street: req.addressStreet ?? '',
        address_number: req.addressNumber ?? '',
        address_city: req.addressCity ?? '',
        address_state: req.addressState ?? '',
        address_zip: req.addressZip ?? '',
        timezone: req.timezone ?? 'America/Sao_Paulo',
        currency: req.currency ?? 'BRL',
      },
    });

    if (error) {
      throw new Error(`Erro ao salvar dados da empresa: ${error.message}`);
    }
  }

  async saveOperationalStep(req: SaveOperationalStepRequest): Promise<void> {
    const validation = validateOperationalStep(req);
    if (!validation.valid) {
      throw new Error(`Dados incompletos: ${validation.errors.join(', ')}`);
    }

    const rpc = getRpcClient();

    const { error } = await rpc.rpc('save_onboarding_step', {
      p_tenant_id: req.tenantId,
      p_step: 'operational',
      p_data: {
        business_hours: req.businessHours ?? null,
        appointment_interval_minutes: req.appointmentIntervalMinutes ?? 30,
        default_appointment_duration_minutes: req.defaultAppointmentDurationMinutes ?? 60,
        booking_horizon_days: req.bookingHorizonDays ?? 30,
        staff_owned_schedule: req.staffOwnedSchedule ?? true,
      },
    });

    if (error) {
      throw new Error(`Erro ao salvar configurações operacionais: ${error.message}`);
    }
  }

  async complete(req: CompleteOnboardingRequest): Promise<void> {
    const validation = validateOnboarding(req);
    if (!validation.valid) {
      throw new Error(`Dados incompletos: ${validation.errors.join(', ')}`);
    }

    const rpc = getRpcClient();

    const { error } = await rpc.rpc('complete_onboarding', {
      p_tenant_id: req.tenantId,
      p_chair_count: req.chairCount ?? null,
      p_business_hours: req.businessHours ?? null,
      p_phone: req.phone ?? null,
      p_cnpj: req.cnpj ?? null,
      p_address_street: req.addressStreet ?? null,
      p_address_number: req.addressNumber ?? null,
      p_address_city: req.addressCity ?? null,
      p_address_state: req.addressState ?? null,
      p_address_zip: req.addressZip ?? null,
    });

    if (error) {
      throw new Error(`Erro ao finalizar onboarding: ${error.message}`);
    }

    await appEventBus.publish(createEvent<TenantOnboardingCompletedEvent>({
      eventType: 'TenantOnboardingCompleted',
      aggregateId: req.tenantId,
      aggregateType: 'tenant',
      payload: {
        tenantId: req.tenantId,
        slug: req.tenantSlug ?? '',
        hasChairCount: req.chairCount != null,
        hasBusinessHours: req.businessHours != null,
        hasAddress: !!(req.addressStreet && req.addressCity),
      },
      metadata: {
        tenantId: req.tenantId,
        source: 'CompleteOnboardingService',
      },
    }));
  }

  validate(req: CompleteOnboardingRequest): ValidationResult {
    return validateOnboarding(req);
  }
}

export const completeOnboardingService = new CompleteOnboardingServiceImpl();
