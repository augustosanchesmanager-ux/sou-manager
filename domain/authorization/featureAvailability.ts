/**
 * [SMG][DOMAIN][AUTHORIZATION] featureAvailability — resolver (não catálogo)
 *
 * RESPONSABILIDADE: resolver a disponibilidade de features (FeatureSet) a partir
 * de plano × estado do tenant/subscription. Responde "Está habilitada?".
 *
 * NÃO É CATÁLOGO: o catálogo (nomes, descrições, dependências) vive em
 * `docs/FEATURE_FLAGS_MODEL.md` (§3/§5). Aqui o código apenas RESOLVE.
 * Essa separação permite futuros addons, promoções, planos enterprise,
 * feature overrides e beta flags sem reescrever a AccessPolicy.
 *
 * FONTE CONGELADA (PO 2026-08-06):
 *   - Matriz por plano: `FEATURE_FLAGS_MODEL.md` §5 (free/pro/premium)
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

// ─── FeatureKey (catálogo D4/P4 — FEATURE_FLAGS_MODEL §3) ─────────

export type FeatureKey =
  // Core
  | 'appointments'
  | 'pos'
  | 'clients'
  | 'services'
  | 'products'
  | 'team'
  | 'dashboard'
  // Financial
  | 'finance'
  | 'cash_closing'
  | 'commissions'
  | 'receivables'
  | 'expenses'
  // Engagement
  | 'chef_club'
  | 'vouchers'
  | 'promotions'
  // Integration
  | 'api'
  | 'whatsapp'
  | 'marketplace'
  // Admin
  | 'multi_unit'
  | 'bi';

export type FeatureSet = readonly FeatureKey[];

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

// ─── Matriz por plano (FEATURE_FLAGS_MODEL §5, congelada) ─────────

const FREE_FEATURES: FeatureSet = [
  'appointments',
  'pos',
  'clients',
  'services',
  'products',
  'team',
  'dashboard',
  'finance',
  'cash_closing',
  'commissions',
  'receivables',
  'expenses',
  'vouchers',
  'promotions',
];

const PRO_FEATURES: FeatureSet = [...FREE_FEATURES, 'chef_club'];

const PREMIUM_FEATURES: FeatureSet = [
  ...PRO_FEATURES,
  'bi',
  'api',
  'whatsapp',
  'marketplace',
  'multi_unit',
];

export const PLAN_FEATURES: Readonly<Record<TenantPlan, FeatureSet>> = {
  free: FREE_FEATURES,
  pro: PRO_FEATURES,
  premium: PREMIUM_FEATURES,
};

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
 * - Caso contrário → features do plano (matriz §5).
 * - cancelled/past_due/trial mantêm as features do plano: a RESTRIÇÃO de
 *   escrita é responsabilidade da AccessPolicy (níveis), não do resolver.
 */
export function resolveFeatures(input: FeatureAvailabilityInput): FeatureSet {
  const override = input.tenantStatus ? STATUS_OVERRIDES[input.tenantStatus] : undefined;
  if (override) return override;
  return PLAN_FEATURES[input.plan];
}

export const featureAvailabilityResolver: FeatureAvailabilityResolver = {
  resolve: resolveFeatures,
};
