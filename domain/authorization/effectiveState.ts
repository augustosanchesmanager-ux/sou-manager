/**
 * [SMG][DOMAIN][AUTHORIZATION] effectiveState — Value Object
 *
 * Estado Efetivo (ADR-013 §2.4) = Subscription State + Tenant State +
 * Feature Availability. É um VALUE OBJECT: carrega os três contextos
 * juntos com o resultado derivado (accessLevel, warnings, enabledFeatures),
 * para que a UI mostre sinais (trial terminando, plano cancelado, grace,
 * somente leitura) sem recomputar regras.
 *
 * NÃO é um enum: é um VO rico de propósito — o enum cresceria e a UI
 * perderia o contexto. Domínio puro — zero dependência de Supabase/React.
 */

import type { TenantStatus } from '../tenant/types';
import type { SubscriptionStatus, TenantPlan } from '../billing/types';
import type { FeatureSet } from './featureAvailability';

/** Nível de acesso derivado (fonte: LIFECYCLE_MODEL ACCESS_BY_STATUS + D-6.0.5-1/2). */
export type AccessLevel = 'onboarding' | 'full' | 'restricted' | 'readonly' | 'none';

/** Avisos derivados para a UI. Cresce conforme novos sinais forem necessários. */
export type AccessWarning = 'past_due' | 'cancelled' | 'readonly';

/**
 * Value Object imutável do Estado Efetivo.
 * Carrega os inputs (statuses) + outputs derivados (nível, avisos, features).
 */
export interface EffectiveState {
  tenantStatus: TenantStatus | null;
  subscriptionStatus: SubscriptionStatus | null;
  plan: TenantPlan | null;
  accessLevel: AccessLevel;
  warnings: AccessWarning[];
  enabledFeatures: FeatureSet;
}
