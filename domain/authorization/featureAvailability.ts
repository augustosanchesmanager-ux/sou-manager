/**
 * [SMG][DOMAIN][AUTHORIZATION] featureAvailability — resolver (não catálogo)
 *
 * RESPONSABILIDADE: resolver a disponibilidade de features (FeatureSet) a partir
 * de plano × estado do tenant/subscription. Responde "Está habilitada?".
 *
 * NÃO É CATÁLOGO: o catálogo (definição de planos, features e limites) vive em
 * `domain/billing/planCatalog.ts` (contrato único `PlanCatalog`, 6.0.5.2) e é
 * persistido em `plans`/`features`/`plan_features` (migration
 * 20260806090000_phase_6_0_5_2_plans_catalog.sql). Aqui o código apenas RESOLVE,
 * consultando o catálogo — nunca SQL. A 6.0.5.3 troca a implementação do
 * catálogo (static → DB-backed) sem alterar este resolver nem seus consumidores.
 *
 * FONTE CONGELADA (PO 2026-08-06):
 *   - Matriz por plano: `PLAN_FEATURES` (free/pro/premium) — §5
 *   - Override por status do tenant: ADR-013 §2.3/§5.3
 *       draft      → Nenhuma (pré-F10, onboarding)
 *       suspended  → "Suspensas" (vazio)
 *       archived   → "Nenhuma" (vazio)
 *       cancelled  → mantém features do plano (leitura; escrita é barrada pela AccessPolicy)
 *   - D-6.0.5-3 Free congelado: sem Chef Club, sem módulos Premium
 *
 * Domínio puro — zero dependência de Supabase/React.
 */

import type { TenantPlan, SubscriptionStatus } from '../billing/types';
import type { TenantStatus } from '../tenant/types';
import { planCatalog } from '../billing/planCatalog';
import { type FeatureKey, type FeatureSet } from '../billing/featureKey';

// ─── Re-exports (estabilidade de API p/ consumidores da 6.0.5.1) ──

export type { FeatureKey, FeatureSet } from '../billing/featureKey';
export { PLAN_FEATURES } from '../billing/planCatalog';

// ─── Input do resolver ────────────────────────────────────────────

export interface FeatureAvailabilityInput {
  plan: TenantPlan;
  tenantStatus: TenantStatus | null;
  /** Reservado para extensões futuras (ex.: trialing). Não usado hoje. */
  subscriptionStatus?: SubscriptionStatus | null;
}

export interface FeatureAvailabilityResolver {
  resolve(input: FeatureAvailabilityInput): FeatureSet;
}

// ─── Override por status do tenant (ADR-013 §2.3/§5.3) ────────────

const NO_FEATURES: FeatureSet = [];

/** Status que removem todas as features, independente do plano. */
const STATUS_OVERRIDES: Partial<Record<TenantStatus, FeatureSet>> = {
  draft: NO_FEATURES,
  suspended: NO_FEATURES,
  archived: NO_FEATURES,
};

// ─── Resolver ─────────────────────────────────────────────────────

/**
 * Resolve o FeatureSet de um tenant.
 * - Se o status do tenant tiver override (draft/suspended/archived) → vazio.
 * - Caso contrário → features do plano (via PlanCatalog).
 * - cancelled/past_due/trial mantêm as features do plano: a RESTRIÇÃO de
 *   escrita é responsabilidade da AccessPolicy (níveis), não do resolver.
 */
export function resolveFeatures(input: FeatureAvailabilityInput): FeatureSet {
  const override = input.tenantStatus ? STATUS_OVERRIDES[input.tenantStatus] : undefined;
  if (override) return override;
  return planCatalog.getFeatures(input.plan);
}

export const featureAvailabilityResolver: FeatureAvailabilityResolver = {
  resolve: resolveFeatures,
};
