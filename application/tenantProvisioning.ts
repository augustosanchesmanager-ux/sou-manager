/**
 * [SMG][APPLICATION][TENANT_PROVISIONING] TenantProvisioningService
 *
 * RESPONSABILIDADE: Orquestra o provisioning completo de um novo tenant.
 *   - O Application Service É o responsável pelas decisões de negócio
 *   - A RPC faz apenas trabalho transacional
 *     (tenant + profile + user_tenants + tenant_settings skeleton + staff via trigger)
 *   - Quem decide criar tenant, publicar evento, iniciar onboarding, criar defaults
 *     é o Application Service
 *
 * NÃO FAZ:
 *   - Renderização de UI
 *   - Onboarding (CompleteOnboardingService)
 *   - Preenchimento dos valores de settings (CompleteOnboardingService)
 *     — a RPC cria apenas o skeleton de tenant_settings no provisionamento
 *
 * FLUXO:
 *   1. Valida dados de entrada (regra de negócio)
 *   2. Chama RPC provision_new_tenant (trabalho transacional apenas)
 *   3. Após sucesso, publica domínio TenantCreated via EventBus → Outbox
 *   4. Retorna resultado para o caller decidir o próximo passo (redirect)
 *
 * SEPARAÇÃO:
 *   - TenantProvisioningService = ORQUESTRADOR (decide o quê fazer)
 *   - provision_new_tenant RPC = EXECUTOR TRANSACIONAL (faz o inserir)
 *   - EventBus = DIFUSOR (publica eventos para subscribers)
 *
 * GARANTIAS:
 *   - RPC provision_new_tenant é idempotente (verifica profile existente)
 *   - Tenant inicia como draft (não ativo até onboarding completo)
 *   - Slug gerado com sufixo incremental (-2, -3) para unicidade
 *   - Owner vira manager em profiles + user_tenants (is_primary=true)
 *   - Staff inicial do manager criado via trigger handle_new_manager_profile
 *   - Evento TenantCreated é publicado apenas para tenants novos
 */

import { createSupabaseClient } from '../domain/shared/supabase-client-factory';
import { appEventBus } from '../domain/events/app-bus';
import { createEvent } from '../domain/events/types';
import type { TenantCreatedEvent } from '../domain/events/types';

// ─── RPC Client ──────────────────────────────────────────────────

function getRpcClient() {
  return createSupabaseClient('tenants', 'barber');
}

// ─── Types ───────────────────────────────────────────────────────

export interface ProvisionTenantRequest {
  userId: string;
  tenantName: string;
  firstName: string;
  lastName: string;
  appSlug?: string;
}

export interface ProvisionTenantResult {
  tenantId: string;
  slug: string;
  alreadyExists: boolean;
}

// ─── Validation (Regra de Negócio) ──────────────────────────────

function validateProvisioning(req: ProvisionTenantRequest): void {
  if (!req.userId) {
    throw new Error('userId é obrigatório');
  }
  if (!req.tenantName || req.tenantName.trim() === '') {
    throw new Error('Nome do tenant é obrigatório');
  }
  if (!req.firstName || req.firstName.trim() === '') {
    throw new Error('Nome do responsável é obrigatório');
  }
}

// ─── Service (Orquestrador) ─────────────────────────────────────

class TenantProvisioningServiceImpl {
  /**
   * Orquestra o provisioning completo de um novo tenant.
   *
   * O Application Service decide:
   *   - Validar entrada
   *   - Chamar RPC para criar tenant + profile
   *   - Publicar evento de domínio
   *   - Retornar resultado
   *
   * A RPC decide:
   *   - Inserir tenant (status=draft)
   *   - Inserir profile (role=manager)
   *   - Gerar slug único
   *   - Retornar IDs
   */
  async provision(req: ProvisionTenantRequest): Promise<ProvisionTenantResult> {
    // 1. Validar entrada (regra de negócio)
    validateProvisioning(req);

    // 2. Chamar RPC (trabalho transacional apenas)
    const rpc = getRpcClient();
    const { data, error } = await rpc.rpc('provision_new_tenant', {
      p_user_id: req.userId,
      p_tenant_name: req.tenantName,
      p_first_name: req.firstName,
      p_last_name: req.lastName,
      p_app_slug: req.appSlug ?? 'barber',
    }).single();

    if (error) {
      throw new Error(`Erro ao criar tenant: ${error.message}`);
    }

    const result = data as {
      tenant_id: string;
      slug: string;
      already_exists: boolean;
    };

    if (!result?.tenant_id) {
      throw new Error('RPC provision_new_tenant retornou resultado inválido');
    }

    // 3. Decisão de negócio: publicar evento apenas para tenants novos
    if (!result.already_exists) {
      await this.publishTenantCreated(result.tenant_id, result.slug, req);
    }

    return {
      tenantId: result.tenant_id,
      slug: result.slug,
      alreadyExists: result.already_exists,
    };
  }

  /**
   * Publica evento de domínio TenantCreated.
   * Extraído para método isolado — facilita testes e subscribers.
   */
  private async publishTenantCreated(
    tenantId: string,
    slug: string,
    req: ProvisionTenantRequest,
  ): Promise<void> {
    await appEventBus.publish(createEvent<TenantCreatedEvent>({
      eventType: 'TenantCreated',
      aggregateId: tenantId,
      aggregateType: 'tenant',
      payload: {
        tenantId,
        slug,
        name: req.tenantName,
        appSlug: req.appSlug ?? 'barber',
      },
      metadata: {
        tenantId,
        userId: req.userId,
        source: 'TenantProvisioningService',
      },
    }));
  }
}

export const tenantProvisioningService = new TenantProvisioningServiceImpl();
