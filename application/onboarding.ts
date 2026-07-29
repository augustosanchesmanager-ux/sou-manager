/**
 * [SMG][APPLICATION][ONBOARDING] CompleteOnboardingService
 *
 * RESPONSABILIDADE: Orquestra a conclusão do onboarding de um novo tenant.
 *   - Valida dados obrigatórios antes de ativar
 *   - Chama RPC complete_onboarding (atomic: settings + tenant.status + profile.onboarding_completed)
 *   - Publica domínio TenantOnboardingCompleted via EventBus → Outbox
 *
 * NÃO FAZ:
 *   - Renderização de UI
 *   - Criação do tenant (TenantProvisioningService)
 *   - Seleção de plano (hardcoded free até Billing)
 *
 * FLUXO:
 *   1. Usuário preenche ShopSetup (dados empresa + operacionais)
 *   2. CompleteOnboardingService.validate() → verifica campos obrigatórios
 *   3. RPC complete_onboarding → settings criados + tenant.status='active' + profile.onboarding_completed=true
 *   4. Event TenantOnboardingCompleted published → EventBus → Outbox
 *
 * GARANTIAS:
 *   - Validação obrigatória: name, phone (campos mínimos)
 *   - RPC idempotente (upsert em tenant_settings)
 *   - Após onboarding, tenant fica ativo
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { createSupabaseClient } from '../domain/shared/supabase-client-factory';
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

// ─── Service ─────────────────────────────────────────────────────

class CompleteOnboardingServiceImpl {
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
