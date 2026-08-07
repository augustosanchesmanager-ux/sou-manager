/**
 * [SMG][DOMAIN][BILLING] planCatalogDb — implementação DB-backed do PlanCatalog
 *
 * Resolução de planos a partir das tabelas persistidas pela 6.0.5.2
 * (`plans`/`features`/`plan_features`, migration 20260806090000). Implementa o
 * CONTRATO ÚNICO `PlanCatalog` de domain/billing/planCatalog.ts — consumidores
 * (featureAvailability, BillingService, FeatureFlagService) ficam inalterados.
 *
 * Garantias:
 *   - Fetches via `getSharedClient()` (D-6.0.5.3-6: leitura de catálogo é
 *     permitida; a DECISÃO de capacidade passa pelo FeatureFlagService).
 *   - Valida `CATALOG_FINGERPRINT` vs BD: divergência BD ↔ TS lança
 *     `PlanCatalogFingerprintMismatchError` (regressão da 6.0.5.2 em runtime).
 *   - Instância resultante é SÍNCRONA (dados carregados na criação) — o
 *     contrato 6.0.5.2 é preservado; o async fica só na fábrica.
 *   - Singleton lazy via `getPlanCatalogDb()` (uma carga por sessão).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeCatalogFingerprint,
  CATALOG_FINGERPRINT,
  type PlanCatalog,
  type PlanDefinition,
  type PlanLimits,
} from './planCatalog';
import { type FeatureKey, type FeatureSet } from './featureKey';
import type { TenantPlan } from './types';
import { getSharedClient } from '../../src/lib/supabase/client';

// ─── Erros ─────────────────────────────────────────────────────────

export class PlanCatalogDbError extends Error {}

export class PlanCatalogFingerprintMismatchError extends PlanCatalogDbError {}

// ─── Linhas esperadas do BD ────────────────────────────────────────

interface PlanRow {
  slug: string;
  name: string;
  price_cents: number;
  limits: { max_staff: number | null } | null;
}

interface FeatureRow {
  key: string;
}

interface PlanFeatureRow {
  plan_slug: string;
  feature_key: string;
}

// ─── Implementação síncrona ────────────────────────────────────────

class PlanCatalogDb implements PlanCatalog {
  private readonly definitions: Readonly<Record<TenantPlan, PlanDefinition>>;
  private readonly features: Readonly<Record<TenantPlan, FeatureSet>>;

  constructor(
    plans: ReadonlyMap<string, PlanRow>,
    features: ReadonlySet<string>,
    planFeatures: ReadonlyMap<string, readonly string[]>,
  ) {
    const plansRecord = {} as Record<TenantPlan, PlanDefinition>;
    const featuresRecord = {} as Record<TenantPlan, FeatureSet>;
    const planSlugs: TenantPlan[] = ['free', 'pro', 'premium'];

    for (const slug of planSlugs) {
      const row = plans.get(slug);
      if (!row) {
        throw new PlanCatalogDbError(`Plano "${slug}" ausente no catálogo persistido.`);
      }
      plansRecord[slug] = {
        slug,
        name: row.name,
        priceCents: row.price_cents,
        maxStaff: row.limits?.max_staff ?? null,
      };
      featuresRecord[slug] = (planFeatures.get(slug) ?? []).filter(
        (key): key is FeatureKey => features.has(key),
      );
    }

    this.definitions = plansRecord;
    this.features = featuresRecord;
  }

  getPlan(slug: TenantPlan): PlanDefinition {
    return this.definitions[slug];
  }

  getFeatures(plan: TenantPlan): FeatureSet {
    return this.features[plan];
  }

  hasFeature(plan: TenantPlan, feature: FeatureKey): boolean {
    return this.features[plan].includes(feature);
  }

  getLimits(plan: TenantPlan): PlanLimits {
    return { maxStaff: this.definitions[plan].maxStaff };
  }
}

// ─── Fábrica (async; instância síncrona) ───────────────────────────

export interface PlanCatalogDbOptions {
  /** Injectable para testes; default = getSharedClient(). */
  db?: Pick<SupabaseClient, 'from'>;
}

export async function createPlanCatalogDb(
  options: PlanCatalogDbOptions = {},
): Promise<PlanCatalog> {
  const db = options.db ?? getSharedClient();

  const [plansResult, featuresResult, planFeaturesResult] = await Promise.all([
    db.from('plans').select('slug, name, price_cents, limits'),
    db.from('features').select('key'),
    db.from('plan_features').select('plan_slug, feature_key'),
  ]);

  if (plansResult.error) throw new PlanCatalogDbError(`Falha ao carregar plans: ${String(plansResult.error)}`);
  if (featuresResult.error) throw new PlanCatalogDbError(`Falha ao carregar features: ${String(featuresResult.error)}`);
  if (planFeaturesResult.error) throw new PlanCatalogDbError(`Falha ao carregar plan_features: ${String(planFeaturesResult.error)}`);

  const plans = new Map<string, PlanRow>();
  for (const row of (plansResult.data ?? []) as PlanRow[]) {
    plans.set(row.slug, row);
  }

  const features = new Set<string>();
  for (const row of (featuresResult.data ?? []) as FeatureRow[]) {
    features.add(row.key);
  }

  const planFeatures = new Map<string, string[]>();
  for (const row of (planFeaturesResult.data ?? []) as PlanFeatureRow[]) {
    const list = planFeatures.get(row.plan_slug) ?? [];
    list.push(row.feature_key);
    planFeatures.set(row.plan_slug, list);
  }

  validateFingerprint(plans, features, planFeatures);

  return new PlanCatalogDb(plans, features, planFeatures);
}

// ─── Validação BD ↔ TS (regressão 6.0.5.2) ─────────────────────────

function validateFingerprint(
  plans: ReadonlyMap<string, PlanRow>,
  features: ReadonlySet<string>,
  planFeatures: ReadonlyMap<string, readonly string[]>,
): void {
  const computed = computeCatalogFingerprint({
    features: [...features] as FeatureKey[],
    planFeatures: {
      free: (planFeatures.get('free') ?? []) as FeatureKey[],
      pro: (planFeatures.get('pro') ?? []) as FeatureKey[],
      premium: (planFeatures.get('premium') ?? []) as FeatureKey[],
    },
    limits: {
      free: plans.get('free')?.limits?.max_staff ?? null,
      pro: plans.get('pro')?.limits?.max_staff ?? null,
      premium: plans.get('premium')?.limits?.max_staff ?? null,
    },
  });

  if (computed !== CATALOG_FINGERPRINT) {
    throw new PlanCatalogFingerprintMismatchError(
      `Catálogo persistido diverge do catálogo tipado (6.0.5.3). ` +
        `BD: ${computed} | TS: ${CATALOG_FINGERPRINT}`,
    );
  }
}

// ─── Singleton lazy ────────────────────────────────────────────────

let catalogPromise: Promise<PlanCatalog> | null = null;

export function getPlanCatalogDb(): Promise<PlanCatalog> {
  if (!catalogPromise) {
    catalogPromise = createPlanCatalogDb();
  }
  return catalogPromise;
}

export function resetPlanCatalogDbForTests(): void {
  catalogPromise = null;
}
