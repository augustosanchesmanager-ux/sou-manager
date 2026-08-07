/**
 * [SMG][DOMAIN][BILLING] planCatalog tests
 *
 * Contrato único `PlanCatalog` (6.0.5.2 — D-6.0.5-5):
 * getPlan / getFeatures / hasFeature / getLimits — zero SQL.
 * Matriz congelada (6.0.5.1, commit 622a891). `limits.ts` eliminado do
 * runtime na 6.0.5.3 (D-6.0.5.3 — fonte única: plans.limits).
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it } from 'vitest';
import {
  planCatalog,
  createStaticPlanCatalog,
  PLAN_FEATURES,
  PLAN_CATALOG_VERSION,
  CATALOG_FINGERPRINT,
  computeCatalogFingerprint,
  type PlanCatalog,
} from './planCatalog';
import { FEATURE_KEYS, type FeatureKey } from './featureKey';
import type { TenantPlan } from './types';

const PLANS: readonly TenantPlan[] = ['free', 'pro', 'premium'];

describe('planCatalog.getPlan — definição de plano', () => {
  it('should_return_plan_definition_for_free', () => {
    expect(planCatalog.getPlan('free')).toEqual({
      slug: 'free',
      name: 'Free',
      priceCents: 0,
      maxStaff: 1,
    });
  });

  it('should_return_plan_definition_for_pro', () => {
    expect(planCatalog.getPlan('pro')).toEqual({
      slug: 'pro',
      name: 'Pro',
      priceCents: 0,
      maxStaff: 5,
    });
  });

  it('should_return_unlimited_max_staff_for_premium', () => {
    expect(planCatalog.getPlan('premium')).toEqual({
      slug: 'premium',
      name: 'Premium',
      priceCents: 0,
      maxStaff: null,
    });
  });
});

describe('planCatalog.getFeatures — matriz congelada', () => {
  it('should_resolve_free_with_14_features_without_chef_club_or_premium_modules', () => {
    const free = planCatalog.getFeatures('free');
    expect(free).toHaveLength(14);
    expect(free).not.toContain('chef_club');
    for (const key of ['bi', 'api', 'whatsapp', 'marketplace', 'multi_unit'] as const) {
      expect(free).not.toContain(key);
    }
    for (const key of ['appointments', 'pos', 'clients', 'services', 'products', 'team', 'dashboard', 'finance', 'cash_closing', 'commissions', 'receivables', 'expenses', 'vouchers', 'promotions'] as const) {
      expect(free).toContain(key);
    }
  });

  it('should_resolve_pro_as_free_plus_chef_club_15', () => {
    const free = planCatalog.getFeatures('free');
    const pro = planCatalog.getFeatures('pro');
    expect(pro).toHaveLength(15);
    for (const key of free) {
      expect(pro).toContain(key);
    }
    expect(pro).toContain('chef_club');
    expect(pro).not.toContain('bi');
  });

  it('should_resolve_premium_as_pro_plus_integrations_and_multi_unit_20', () => {
    const pro = planCatalog.getFeatures('pro');
    const premium = planCatalog.getFeatures('premium');
    expect(premium).toHaveLength(20);
    for (const key of pro) {
      expect(premium).toContain(key);
    }
    for (const key of ['bi', 'api', 'whatsapp', 'marketplace', 'multi_unit'] as const) {
      expect(premium).toContain(key);
    }
  });
});

describe('planCatalog.hasFeature — gate por plano', () => {
  it('should_reject_chef_club_and_premium_modules_on_free', () => {
    expect(planCatalog.hasFeature('free', 'chef_club')).toBe(false);
    expect(planCatalog.hasFeature('free', 'bi')).toBe(false);
  });

  it('should_allow_chef_club_on_pro_but_not_bi', () => {
    expect(planCatalog.hasFeature('pro', 'chef_club')).toBe(true);
    expect(planCatalog.hasFeature('pro', 'bi')).toBe(false);
  });

  it('should_allow_all_features_on_premium', () => {
    for (const key of FEATURE_KEYS) {
      expect(planCatalog.hasFeature('premium', key)).toBe(true);
    }
  });
});

describe('planCatalog.getLimits — limites do plano', () => {
  it('should_match_plans_limits_seed (free=1, pro=5, premium=∞)', () => {
    // 6.0.5.3: limits.ts eliminado do runtime (D-6.0.5.3) — fonte = plans.limits
    const expected: Record<TenantPlan, number | null> = {
      free: 1,
      pro: 5,
      premium: null,
    };
    for (const plan of PLANS) {
      expect(planCatalog.getLimits(plan).maxStaff).toBe(expected[plan]);
    }
  });
});

describe('planCatalog — invariantes da matriz tipada', () => {
  it('should_have_20_unique_feature_keys', () => {
    expect(FEATURE_KEYS).toHaveLength(20);
    expect(new Set(FEATURE_KEYS).size).toBe(20);
  });

  it('should_cover_every_feature_key_across_all_plans (1:1)', () => {
    const union = new Set<FeatureKey>();
    for (const plan of PLANS) {
      for (const key of PLAN_FEATURES[plan]) union.add(key);
    }
    expect(Array.from(union).sort()).toEqual([...FEATURE_KEYS].sort());
  });
});

describe('planCatalog — contrato e fábrica', () => {
  it('should_expose_singleton_as_plan_catalog_contract', () => {
    const catalog: PlanCatalog = planCatalog;
    expect(catalog.getFeatures('free')).toBeDefined();
    expect(catalog.getPlan('pro')).toBeDefined();
  });

  it('should_create_independent_static_instance', () => {
    const instance = createStaticPlanCatalog();
    expect(instance.getFeatures('premium')).toEqual(planCatalog.getFeatures('premium'));
  });
});

describe('planCatalog — versionamento e fingerprint', () => {
  it('should_start_catalog_at_version_1', () => {
    expect(PLAN_CATALOG_VERSION).toBe(1);
  });

  it('should_be_deterministic (fingerprint identico entre chamadas)', () => {
    const recomputed = computeCatalogFingerprint({
      features: FEATURE_KEYS,
      planFeatures: PLAN_FEATURES,
      limits: {
        free: planCatalog.getPlan('free').maxStaff,
        pro: planCatalog.getPlan('pro').maxStaff,
        premium: planCatalog.getPlan('premium').maxStaff,
      },
    });
    expect(recomputed).toBe(CATALOG_FINGERPRINT);
  });

  it('should_change_fingerprint_when_matrix_or_limits_change', () => {
    const base = computeCatalogFingerprint({
      features: FEATURE_KEYS,
      planFeatures: PLAN_FEATURES,
      limits: { free: 1, pro: 5, premium: null },
    });
    const changedLimits = computeCatalogFingerprint({
      features: FEATURE_KEYS,
      planFeatures: PLAN_FEATURES,
      limits: { free: 2, pro: 5, premium: null },
    });
    expect(changedLimits).not.toBe(base);
  });
});
