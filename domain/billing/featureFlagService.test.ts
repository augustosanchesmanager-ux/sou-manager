/**
 * [SMG][DOMAIN][BILLING] FeatureFlagService tests
 *
 * Cobertura da API congelada (PHASE_6_0_5_3_ENTRY_AUDIT §2.5) + critérios
 * T1/T2/T3/T4/T6 do §7:
 *   T1 resolução por plano (free 14 / pro 15 / premium 20)
 *   T2 não-membro → can = false
 *   T3 override enable/disable vence a matriz
 *   T4 suspensão/arquivamento → todas false (derivação, sem rows)
 *   T6 upgrade/downgrade de plano reflete a matriz nova
 * + fail-closed de feature desconhecida e getLimits.
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it } from 'vitest';
import {
  createFeatureFlagService,
  type FeatureFlagService,
  type FeatureFlagServiceDeps,
  type FeatureOverride,
  type FeatureOverrideStore,
} from './featureFlagService';
import { planCatalog } from './planCatalog';
import { PLAN_FEATURES } from './planCatalog';
import { FEATURE_KEYS, type FeatureKey } from './featureKey';
import type { TenantPlan } from './types';

const PLANS: readonly TenantPlan[] = ['free', 'pro', 'premium'];

// ─── Fakes ─────────────────────────────────────────────────────────

class FakeOverrideStore implements FeatureOverrideStore {
  private rows: FeatureOverride[] = [];

  constructor(rows: FeatureOverride[] = []) {
    this.rows = rows;
  }

  getOverrides(tenantId: string): Promise<FeatureOverride[]> {
    return Promise.resolve(this.rows.filter((row) => row.tenantId === tenantId));
  }
}

const buildService = (
  overrides: FeatureOverride[] = [],
  plan: TenantPlan = 'free',
  status = 'active',
): { service: FeatureFlagService; setPlan: (next: TenantPlan) => void; setStatus: (next: string) => void } => {
  const state: { plan: TenantPlan; status: string } = { plan, status };
  const service = createFeatureFlagService({
    catalog: planCatalog,
    overrides: new FakeOverrideStore(overrides),
    tenantState: async () => ({ plan: state.plan, status: state.status }),
  });
  return {
    service,
    setPlan: (next) => {
      state.plan = next;
    },
    setStatus: (next) => {
      state.status = next;
    },
  };
};

// ─── T1 — Resolução por plano ──────────────────────────────────────

describe('FeatureFlagService.resolve — resolução por plano (T1)', () => {
  it.each(PLANS)('should_resolve_%s_with_the_catalog_matrix', async (plan) => {
    const { service } = buildService([], plan);
    const resolution = await service.resolve('tenant-1');

    expect(resolution.tenantId).toBe('tenant-1');
    expect(resolution.planSlug).toBe(plan);
    expect(resolution.derivedFrom).toBe('active');
    expect(resolution.overridden).toEqual([]);
    expect(resolution.enabledFeatures).toHaveLength(PLAN_FEATURES[plan].length);
    for (const key of PLAN_FEATURES[plan]) {
      expect(resolution.enabledFeatures).toContain(key);
    }
  });

  it('should_have_14_features_on_free', async () => {
    const { service } = buildService([], 'free');
    const resolution = await service.resolve('tenant-1');
    expect(resolution.enabledFeatures).toHaveLength(14);
    expect(resolution.enabledFeatures).not.toContain('chef_club');
    expect(resolution.enabledFeatures).not.toContain('bi');
  });

  it('should_have_15_features_on_pro_including_chef_club', async () => {
    const { service } = buildService([], 'pro');
    const resolution = await service.resolve('tenant-1');
    expect(resolution.enabledFeatures).toHaveLength(15);
    expect(resolution.enabledFeatures).toContain('chef_club');
    expect(resolution.enabledFeatures).not.toContain('bi');
  });

  it('should_have_20_features_on_premium', async () => {
    const { service } = buildService([], 'premium');
    const resolution = await service.resolve('tenant-1');
    expect(resolution.enabledFeatures).toHaveLength(20);
    expect(resolution.enabledFeatures).toEqual(FEATURE_KEYS);
  });
});

// ─── T2 — Não-membro ───────────────────────────────────────────────

describe('FeatureFlagService.can — não-membro (T2)', () => {
  it('should_reject_bi_and_chef_club_on_free', async () => {
    const { service } = buildService([], 'free');
    expect(await service.can('tenant-1', 'bi')).toBe(false);
    expect(await service.can('tenant-1', 'chef_club')).toBe(false);
  });

  it('should_allow_core_financial_flags_on_free', async () => {
    const { service } = buildService([], 'free');
    expect(await service.can('tenant-1', 'finance')).toBe(true);
    expect(await service.can('tenant-1', 'receivables')).toBe(true);
    expect(await service.can('tenant-1', 'expenses')).toBe(true);
    expect(await service.can('tenant-1', 'commissions')).toBe(true);
    expect(await service.can('tenant-1', 'cash_closing')).toBe(true);
  });

  it('should_reject_api_on_pro', async () => {
    const { service } = buildService([], 'pro');
    expect(await service.can('tenant-1', 'api')).toBe(false);
    expect(await service.can('tenant-1', 'bi')).toBe(false);
  });

  it('should_allow_every_feature_on_premium', async () => {
    const { service } = buildService([], 'premium');
    for (const key of FEATURE_KEYS) {
      expect(await service.can('tenant-1', key)).toBe(true);
    }
  });
});

// ─── T3 — Override enable/disable ──────────────────────────────────

describe('FeatureFlagService.resolve — override (T3)', () => {
  it('should_enable_flag_outside_matrix_when_override_grants_it', async () => {
    const { service } = buildService(
      [{ tenantId: 'tenant-1', featureKey: 'bi', override: true, reason: 'degustacao' }],
      'free',
    );
    const resolution = await service.resolve('tenant-1');

    expect(resolution.enabledFeatures).toContain('bi');
    expect(await service.can('tenant-1', 'bi')).toBe(true);
    expect(resolution.overridden).toContain('bi');
  });

  it('should_disable_flag_from_matrix_when_override_blocks_it', async () => {
    const { service } = buildService(
      [{ tenantId: 'tenant-1', featureKey: 'finance', override: false, reason: 'bloqueio temporario' }],
      'premium',
    );
    const resolution = await service.resolve('tenant-1');

    expect(resolution.enabledFeatures).not.toContain('finance');
    expect(await service.can('tenant-1', 'finance')).toBe(false);
    expect(resolution.overridden).toContain('finance');
  });

  it('should_ignore_overrides_of_other_tenants', async () => {
    const { service } = buildService(
      [{ tenantId: 'tenant-9', featureKey: 'bi', override: true }],
      'free',
    );
    expect(await service.can('tenant-1', 'bi')).toBe(false);
    expect((await service.resolve('tenant-1')).overridden).toEqual([]);
  });
});

// ─── T4 — Suspensão (derivação sem rows) ───────────────────────────

describe('FeatureFlagService.resolve — suspensão (T4)', () => {
  it.each(['suspended', 'archived'] as const)(
    'should_disable_all_flags_when_status_is_%s',
    async (status) => {
      const { service } = buildService([], 'premium', status);
      const resolution = await service.resolve('tenant-1');

      expect(resolution.enabledFeatures).toEqual([]);
      expect(resolution.overridden).toEqual([]);
      expect(resolution.derivedFrom).toBe('suspended');

      for (const key of FEATURE_KEYS) {
        expect(await service.can('tenant-1', key)).toBe(false);
      }
    },
  );

  it('should_keep_flags_when_status_is_cancelled_or_past_due', async () => {
    for (const status of ['cancelled', 'past_due']) {
      const { service } = buildService([], 'pro', status);
      expect(await service.can('tenant-1', 'chef_club')).toBe(true);
    }
  });
});

// ─── T6 — Upgrade/downgrade ────────────────────────────────────────

describe('FeatureFlagService.resolve — upgrade/downgrade (T6)', () => {
  it('should_reflect_matrix_after_plan_change_free_pro_premium_free', async () => {
    const { service, setPlan } = buildService([], 'free');

    expect(await service.can('tenant-1', 'chef_club')).toBe(false);

    setPlan('pro');
    expect(await service.can('tenant-1', 'chef_club')).toBe(true);
    expect(await service.can('tenant-1', 'bi')).toBe(false);

    setPlan('premium');
    expect(await service.can('tenant-1', 'bi')).toBe(true);

    setPlan('free');
    expect(await service.can('tenant-1', 'chef_club')).toBe(false);
    expect(await service.can('tenant-1', 'bi')).toBe(false);
  });
});

// ─── Fail-closed + getLimits ───────────────────────────────────────

describe('FeatureFlagService.can — fail-closed', () => {
  it('should_return_false_for_unknown_feature_key_without_throwing', async () => {
    const { service } = buildService([], 'premium');
    expect(await service.can('tenant-1', 'unknown_flag' as FeatureKey)).toBe(false);
  });
});

describe('FeatureFlagService.getLimits', () => {
  it('should_delegate_limits_to_catalog (free=1, pro=5, premium=∞)', async () => {
    const { service } = buildService([], 'free');
    expect((await service.getLimits('free')).maxStaff).toBe(1);
    expect((await service.getLimits('pro')).maxStaff).toBe(5);
    expect((await service.getLimits('premium')).maxStaff).toBeNull();
  });
});

// ─── Deps de um FeatureFlagServiceDeps completo (type-check) ───────

describe('FeatureFlagServiceDeps', () => {
  it('should_accept_di_shape_with_all_dependencies', async () => {
    const deps: FeatureFlagServiceDeps = {
      catalog: planCatalog,
      overrides: new FakeOverrideStore(),
      tenantState: async () => ({ plan: 'free', status: 'active' }),
    };
    const service = createFeatureFlagService(deps);
    expect(await service.can('tenant-1', 'pos')).toBe(true);
  });
});
