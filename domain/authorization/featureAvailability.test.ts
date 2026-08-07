/**
 * [SMG][DOMAIN][AUTHORIZATION] featureAvailability tests
 *
 * Testes por MATRIZ (ajuste PO #4): Plan × TenantStatus → FeatureSet.
 * Fonte congelada: FEATURE_FLAGS_MODEL §5 + ADR-013 §2.3/§5.3 + D-6.0.5-3.
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it } from 'vitest';
import { resolveFeatures, featureAvailabilityResolver } from './featureAvailability';
import type { FeatureKey } from './featureAvailability';
import type { TenantPlan } from '../billing/types';
import type { TenantStatus } from '../tenant/types';

const PLANS: readonly TenantPlan[] = ['free', 'pro', 'premium'];

const TENANT_STATUSES: readonly TenantStatus[] = [
  'draft',
  'trial',
  'active',
  'past_due',
  'suspended',
  'cancelled',
  'archived',
];

const contains = (features: readonly FeatureKey[], key: FeatureKey): boolean =>
  features.includes(key);

describe('resolveFeatures — matriz plano → features (FEATURE_FLAGS_MODEL §5)', () => {
  it('should_resolve_free_without_chef_club_and_premium_modules', () => {
    // D-6.0.5-3 Free congelado: sem Chef Club, sem módulos Premium.
    const features = resolveFeatures({ plan: 'free', tenantStatus: 'active' });
    expect(contains(features, 'chef_club')).toBe(false);
    for (const key of ['bi', 'api', 'whatsapp', 'marketplace', 'multi_unit'] as const) {
      expect(contains(features, key)).toBe(false);
    }
    for (const key of ['appointments', 'pos', 'clients', 'services', 'products', 'team', 'dashboard'] as const) {
      expect(contains(features, key)).toBe(true);
    }
  });

  it('should_resolve_pro_as_free_plus_chef_club', () => {
    const free = resolveFeatures({ plan: 'free', tenantStatus: 'active' });
    const pro = resolveFeatures({ plan: 'pro', tenantStatus: 'active' });
    for (const key of free) {
      expect(contains(pro, key)).toBe(true);
    }
    expect(contains(pro, 'chef_club')).toBe(true);
    expect(contains(pro, 'bi')).toBe(false);
  });

  it('should_resolve_premium_as_pro_plus_integrations_and_multi_unit', () => {
    const pro = resolveFeatures({ plan: 'pro', tenantStatus: 'active' });
    const premium = resolveFeatures({ plan: 'premium', tenantStatus: 'active' });
    for (const key of pro) {
      expect(contains(premium, key)).toBe(true);
    }
    for (const key of ['bi', 'api', 'whatsapp', 'marketplace', 'multi_unit'] as const) {
      expect(contains(premium, key)).toBe(true);
    }
  });

  it('should_keep_plan_features_stable_for_active_paid_statuses', () => {
    // trial/active/past_due/cancelled mantêm as features do plano (a restrição
    // de escrita é da AccessPolicy, não do resolver).
    for (const plan of PLANS) {
      const expected = resolveFeatures({ plan, tenantStatus: 'active' });
      for (const status of ['trial', 'past_due', 'cancelled'] as const) {
        expect(resolveFeatures({ plan, tenantStatus: status })).toEqual(expected);
      }
    }
  });
});

describe('resolveFeatures — override por status do tenant (ADR-013 §2.3/§5.3)', () => {
  it('should_resolve_empty_features_in_draft_suspended_and_archived', () => {
    for (const plan of PLANS) {
      for (const status of ['draft', 'suspended', 'archived'] as const) {
        expect(resolveFeatures({ plan, tenantStatus: status })).toEqual([]);
      }
    }
  });

  it('should_override_plan_features_when_suspended', () => {
    // "Suspensas" independentemente do plano (free/pro/premium).
    for (const plan of PLANS) {
      expect(resolveFeatures({ plan, tenantStatus: 'suspended' })).toEqual([]);
    }
  });

  it('should_ignore_null_tenant_status_and_use_plan_features', () => {
    expect(resolveFeatures({ plan: 'premium', tenantStatus: null })).toEqual(
      resolveFeatures({ plan: 'premium', tenantStatus: 'active' }),
    );
  });
});

describe('featureAvailabilityResolver — singleton', () => {
  it('should_resolve_same_as_function', () => {
    expect(featureAvailabilityResolver.resolve({ plan: 'free', tenantStatus: 'active' })).toEqual(
      resolveFeatures({ plan: 'free', tenantStatus: 'active' }),
    );
  });
});
