/**
 * [SMG][DOMAIN][BILLING] planCatalogDb tests
 *
 * Implementa��ǜo DB-backed do contrato `PlanCatalog` (6.0.5.2) + valida��ǜo do
 * `CATALOG_FINGERPRINT` contra o seed persistido (migration 20260806090000).
 *
 * Conven����es: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createPlanCatalogDb,
  PlanCatalogDbError,
  PlanCatalogFingerprintMismatchError,
} from './planCatalogDb';
import { CATALOG_FINGERPRINT } from './planCatalog';
import { FEATURE_KEYS } from './featureKey';

// ─── Seed espelho da migration 20260806090000 ──────────────────────

const PLANS = [
  { slug: 'free', name: 'Free', price_cents: 0, limits: { max_staff: 1 } },
  { slug: 'pro', name: 'Pro', price_cents: 0, limits: { max_staff: 5 } },
  { slug: 'premium', name: 'Premium', price_cents: 0, limits: { max_staff: null } },
];

const FEATURES = FEATURE_KEYS.map((key) => ({ key }));

const PLAN_FEATURES = [
  'appointments', 'pos', 'clients', 'services', 'products', 'team', 'dashboard',
  'finance', 'cash_closing', 'commissions', 'receivables', 'expenses', 'vouchers', 'promotions',
];

const PRO_EXTRA = ['chef_club'];
const PREMIUM_EXTRA = ['bi', 'api', 'whatsapp', 'marketplace', 'multi_unit'];

const planFeaturesRows = [
  ...PLAN_FEATURES.map((feature_key) => ({ plan_slug: 'free', feature_key })),
  ...[...PLAN_FEATURES, ...PRO_EXTRA].map((feature_key) => ({ plan_slug: 'pro', feature_key })),
  ...[...PLAN_FEATURES, ...PRO_EXTRA, ...PREMIUM_EXTRA].map((feature_key) => ({
    plan_slug: 'premium',
    feature_key,
  })),
];

const fakeDb = (overrides?: {
  plans?: unknown[];
  features?: unknown[];
  planFeatures?: unknown[];
}): Pick<SupabaseClient, 'from'> => {
  const tables: Record<string, unknown[]> = {
    plans: overrides?.plans ?? PLANS,
    features: overrides?.features ?? FEATURES,
    plan_features: overrides?.planFeatures ?? planFeaturesRows,
  };
  return {
    from: (table: string) => ({
      select: async () => ({ data: tables[table] ?? null, error: null }),
    }),
  } as unknown as Pick<SupabaseClient, 'from'>;
};

// ─── Contrato preservado ───────────────────────────────────────────

describe('createPlanCatalogDb — contrato PlanCatalog preservado', () => {
  it('should_build_sync_catalog_from_seed_with_getPlan', async () => {
    const catalog = await createPlanCatalogDb({ db: fakeDb() });

    expect(catalog.getPlan('free')).toEqual({ slug: 'free', name: 'Free', priceCents: 0, maxStaff: 1 });
    expect(catalog.getPlan('pro')).toEqual({ slug: 'pro', name: 'Pro', priceCents: 0, maxStaff: 5 });
    expect(catalog.getPlan('premium')).toEqual({ slug: 'premium', name: 'Premium', priceCents: 0, maxStaff: null });
  });

  it('should_resolve_feature_sets_free_14_pro_15_premium_20', async () => {
    const catalog = await createPlanCatalogDb({ db: fakeDb() });

    expect(catalog.getFeatures('free')).toHaveLength(14);
    expect(catalog.getFeatures('pro')).toHaveLength(15);
    expect(catalog.getFeatures('premium')).toHaveLength(20);
    expect(catalog.getFeatures('free')).not.toContain('chef_club');
    expect(catalog.getFeatures('pro')).toContain('chef_club');
    expect(catalog.getFeatures('premium')).toContain('bi');
  });

  it('should_support_hasFeature_and_getLimits', async () => {
    const catalog = await createPlanCatalogDb({ db: fakeDb() });

    expect(catalog.hasFeature('free', 'finance')).toBe(true);
    expect(catalog.hasFeature('free', 'chef_club')).toBe(false);
    expect(catalog.getLimits('free').maxStaff).toBe(1);
    expect(catalog.getLimits('pro').maxStaff).toBe(5);
    expect(catalog.getLimits('premium').maxStaff).toBeNull();
  });
});

// ─── Fingerprint ───────────────────────────────────────────────────

describe('createPlanCatalogDb — CATALOG_FINGERPRINT', () => {
  it('should_accept_seed_identical_to_typed_catalog', async () => {
    const catalog = await createPlanCatalogDb({ db: fakeDb() });
    expect(catalog.getFeatures('premium')).toHaveLength(FEATURE_KEYS.length);
    expect(CATALOG_FINGERPRINT).toMatch(/^version=1\|/);
  });

  it('should_throw_on_limit_divergence (free max_staff=2)', async () => {
    const plans = PLANS.map((plan, index) =>
      index === 0 ? { ...plan, limits: { max_staff: 2 } } : plan,
    );
    await expect(createPlanCatalogDb({ db: fakeDb({ plans }) })).rejects.toBeInstanceOf(
      PlanCatalogFingerprintMismatchError,
    );
  });

  it('should_throw_on_plan_features_divergence (free sem receivables)', async () => {
    const planFeatures = planFeaturesRows.filter(
      (row) => !(row.plan_slug === 'free' && row.feature_key === 'receivables'),
    );
    await expect(createPlanCatalogDb({ db: fakeDb({ planFeatures }) })).rejects.toBeInstanceOf(
      PlanCatalogFingerprintMismatchError,
    );
  });

  it('should_throw_on_missing_plan', async () => {
    const plans = PLANS.filter((plan) => plan.slug !== 'premium');
    await expect(createPlanCatalogDb({ db: fakeDb({ plans }) })).rejects.toBeInstanceOf(
      PlanCatalogDbError,
    );
  });
});

// ─── Erros de infraestrutura ───────────────────────────────────────

describe('createPlanCatalogDb — erros de fetch', () => {
  it('should_throw_when_plans_select_fails', async () => {
    const db = {
      from: (table: string) =>
        table === 'plans'
          ? { select: async () => ({ data: null, error: new Error('boom') }) }
          : { select: async () => ({ data: [], error: null }) },
    } as unknown as Pick<SupabaseClient, 'from'>;

    await expect(createPlanCatalogDb({ db })).rejects.toBeInstanceOf(PlanCatalogDbError);
  });
});
