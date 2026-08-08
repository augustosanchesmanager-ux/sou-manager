/**
 * [SMG][DOMAIN][BILLING] planCatalog — contrato único de catálogo de planos
 *
 * RESPONSABILIDADE: expor o catálogo de planos (definição, features e limites)
 * via um CONTRATO único (`PlanCatalog`), de modo que Billing Engine,
 * EffectiveAccessService e FeatureAvailability NUNCA conheçam SQL nem a
 * tabela `plans`. A 6.0.5.3 troca apenas a implementação (static → DB-backed)
 * sem tocar nos consumidores.
 *
 * Fonte congelada (6.0.5.1 certificada, commit 622a891):
 *   - Matriz por plano: PLAN_FEATURES (free 14 / pro 15 / premium 20)
 *   - Limites: plans.limits (free=1 / pro=5 / premium=∞); `limits.ts`
 *     eliminado do runtime na 6.0.5.3 (D-6.0.5.3)
 *
 * A persistência (tabelas plans/features/plan_features, seed idempotente)
 * vive na migration 20260806090000_phase_6_0_5_2_plans_catalog.sql.
 * Writer único do agregado `plans` = BillingService (ADR-013 §3.1).
 *
 * Domínio puro — zero dependência de Supabase/React.
 */

import type { TenantPlan } from './types';
import { FEATURE_KEYS, type FeatureKey, type FeatureSet } from './featureKey';

// ─── Modelos do catálogo ─────────────────────────────────────────

export interface PlanDefinition {
  slug: TenantPlan;
  name: string;
  /** Placeholder 0 — preços comerciais são decisão do PO (gateway futuro). */
  priceCents: number;
  /** Limite de profissionais (∞ = null). */
  maxStaff: number | null;
}

export interface PlanLimits {
  maxStaff: number | null;
}

// ─── Contrato (nunca SQL) ─────────────────────────────────────────

export interface PlanCatalog {
  getPlan(slug: TenantPlan): PlanDefinition;
  getFeatures(plan: TenantPlan): FeatureSet;
  hasFeature(plan: TenantPlan, feature: FeatureKey): boolean;
  getLimits(plan: TenantPlan): PlanLimits;
}

// ─── Dados congelados (PLAN_FEATURES + PLAN_LIMITS) ───────────────

const PLAN_DEFINITIONS: Readonly<Record<TenantPlan, PlanDefinition>> = {
  free: { slug: 'free', name: 'Free', priceCents: 0, maxStaff: 1 },
  pro: { slug: 'pro', name: 'Pro', priceCents: 0, maxStaff: 5 },
  premium: { slug: 'premium', name: 'Premium', priceCents: 0, maxStaff: null },
};

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

/**
 * Matriz por plano (FEATURE_FLAGS_MODEL §5) — fonte tipada do seed.
 *
 * @deprecated 6.0.5.5 (D-6.0.5.5-2 / D-6.0.5.3-6) — matriz estática FORA do
 * runtime: o consumo de flags em produção é EXCLUSIVO via RPC `tenant_has_feature`
 * (FeatureFlagService) e do catálogo DB-backed (`plans`/`plan_features`,
 * migration 20260806090000). Mantida SOMENTE como fonte tipada do seed e para
 * testes de compatibilidade (matriz tipada vira n para testes — entry audit
 * 6.0.5.3). Não criar novos consumidores de runtime a partir dela.
 */
export const PLAN_FEATURES: Readonly<Record<TenantPlan, FeatureSet>> = {
  free: FREE_FEATURES,
  pro: PRO_FEATURES,
  premium: PREMIUM_FEATURES,
};

// ─── Versionamento / checksum do catálogo ─────────────────────────

/**
 * Versão do catálogo de planos. INCREMENTAR a cada mudança intencional de
 * planos/features/limites — o teste de sincronismo BD ↔ TS falha se a BD
 * divergir do catálogo tipado, mas a versão documenta a intenção da mudança.
 */
export const PLAN_CATALOG_VERSION = 1;

/** Insumo canônico para o fingerprint (features + matriz + limites). */
export interface CatalogFingerprintInput {
  features: readonly FeatureKey[];
  planFeatures: Readonly<Record<TenantPlan, readonly FeatureKey[]>>;
  limits: Readonly<Record<TenantPlan, number | null>>;
}

/** Fingerprint determinístico do catálogo (checksum legível, sem hash criptográfico). */
export function computeCatalogFingerprint(input: CatalogFingerprintInput): string {
  const plans: readonly TenantPlan[] = ['free', 'pro', 'premium'];
  const lines: string[] = [];
  lines.push(`version=${PLAN_CATALOG_VERSION}`);
  lines.push(`features=${[...input.features].sort().join(',')}`);
  for (const plan of plans) {
    lines.push(`${plan}=${[...input.planFeatures[plan]].sort().join(',')}`);
  }
  lines.push(
    `limits=${plans
      .map((plan) => `${plan}:${input.limits[plan] ?? 'unlimited'}`)
      .join(';')}`,
  );
  return lines.join('|');
}

/**
 * Fingerprint do catálogo congelado (fonte TS). O teste
 * `planCatalogMigrationSync` compara este valor com o fingerprint derivado do
 * seed da migration — qualquer divergência BD ↔ TS quebra a regressão.
 */
export const CATALOG_FINGERPRINT = computeCatalogFingerprint({
  features: FEATURE_KEYS,
  planFeatures: PLAN_FEATURES,
  limits: {
    free: PLAN_DEFINITIONS.free.maxStaff,
    pro: PLAN_DEFINITIONS.pro.maxStaff,
    premium: PLAN_DEFINITIONS.premium.maxStaff,
  },
});

// ─── Implementação estática ───────────────────────────────────────

export class StaticPlanCatalog implements PlanCatalog {
  getPlan(slug: TenantPlan): PlanDefinition {
    return PLAN_DEFINITIONS[slug];
  }

  getFeatures(plan: TenantPlan): FeatureSet {
    return PLAN_FEATURES[plan];
  }

  hasFeature(plan: TenantPlan, feature: FeatureKey): boolean {
    return PLAN_FEATURES[plan].includes(feature);
  }

  getLimits(plan: TenantPlan): PlanLimits {
    return { maxStaff: PLAN_DEFINITIONS[plan].maxStaff };
  }
}

export const createStaticPlanCatalog = (): PlanCatalog => new StaticPlanCatalog();

/** Singleton do catálogo de planos (6.0.5.2 = implementação estática). */
export const planCatalog: PlanCatalog = createStaticPlanCatalog();
