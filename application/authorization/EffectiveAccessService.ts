/**
 * [SMG][APPLICATION][AUTHORIZATION] EffectiveAccessService
 *
 * RESPONSABILIDADE: Orquestrar a camada de autorização (Estado Efetivo,
 * ADR-013 §2.4 — Fase 6.0.5.1). Compõe os três contextos:
 *
 *   Subscription State (subscriptionStatus)     │  AccessPolicy (Pode?)
 *      +                                        │      ↓
 *   Tenant State (tenantStatus)       ───────►  EffectiveAccessService ──► EffectiveState (VO)
 *      +                                        │      ↑
 *   Feature Availability (plan,status)          │  FeatureAvailabilityResolver (Está habilitada?)
 *
 * O serviço É responsável por compor Policy + Resolver. Nenhuma regra de
 * acesso/feature vive aqui — apenas a orquestração (ajuste PO #1/#3).
 *
 * NÃO FAZ:
 *   - Decide funcionalidade por plan/feature (pertence ao resolver)
 *   - Decide níveis de acesso (pertence à AccessPolicy)
 *   - Escreve em subscriptions/tenants (Single Writer, ADR-013 §3.1)
 *   - Conhece React/UI/navigate (pertence ao AuthorizationService + App.tsx)
 *
 * GARANTIAS:
 *   - Sempre retorna um EffectiveState válido (VO imutável)
 *   - tenantStatus null → nível 'onboarding' (fase pré-tenant/provision)
 *   - Fail-fast herdado da Policy (status desconhecido lança)
 *   - DI: policy e featureResolver injetáveis (padrão dos services existentes)
 */

import {
  accessPolicy,
  type AccessPolicy,
} from '../../domain/authorization/accessPolicy';
import {
  featureAvailabilityResolver,
  type FeatureAvailabilityInput,
  type FeatureAvailabilityResolver,
} from '../../domain/authorization/featureAvailability';
import type { EffectiveState, AccessLevel } from '../../domain/authorization/effectiveState';
import type { TenantStatus } from '../../domain/tenant/types';
import type { SubscriptionStatus, TenantPlan } from '../../domain/billing/types';

// ─── Input ───────────────────────────────────────────────────────

export interface EffectiveAccessInput {
  /** Estado do acesso (fonte de verdade, ADR-013 §3). Null = fase pré-tenant. */
  tenantStatus: TenantStatus | null;
  /** Contexto do contrato (informativo na 6.0.5.1 — Policy usa tenants.status). */
  subscriptionStatus?: SubscriptionStatus | null;
  /** Plano comercial (alimenta o resolver de features). */
  plan: TenantPlan | null;
}

// ─── Service ─────────────────────────────────────────────────────

export interface EffectiveAccessService {
  resolve(input: EffectiveAccessInput): EffectiveState;
}

export class EffectiveAccessServiceImpl implements EffectiveAccessService {
  constructor(
    private readonly policy: AccessPolicy = accessPolicy,
    private readonly features: FeatureAvailabilityResolver = featureAvailabilityResolver,
  ) {}

  resolve(input: EffectiveAccessInput): EffectiveState {
    const tenantStatus = input.tenantStatus;
    const subscriptionStatus = input.subscriptionStatus ?? null;

    // Fase pré-tenant (login sem tenant provisionado): nenhum contexto de
    // acesso para avaliar — nível de onboarding; o fluxo de provision roda
    // antes dos guards de tenant (ProtectedRoute pendingRegistration).
    if (tenantStatus === null) {
      return {
        tenantStatus: null,
        subscriptionStatus,
        plan: input.plan,
        accessLevel: 'onboarding' satisfies AccessLevel,
        warnings: [],
        enabledFeatures: [],
      };
    }

    const accessLevel = this.policy.evaluateAccess({
      tenantStatus,
      subscriptionStatus,
    });
    const warnings = this.policy.getWarnings(accessLevel);

    const featureInput: FeatureAvailabilityInput = {
      plan: input.plan ?? 'free',
      tenantStatus,
      subscriptionStatus,
    };
    const enabledFeatures = this.features.resolve(featureInput);

    return {
      tenantStatus,
      subscriptionStatus,
      plan: input.plan,
      accessLevel,
      warnings,
      enabledFeatures,
    };
  }
}

export const effectiveAccessService = new EffectiveAccessServiceImpl();
