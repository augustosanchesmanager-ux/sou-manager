/**
 * [SMG][APPLICATION][AUTHORIZATION] EffectiveAccessService tests
 *
 * Orquestração da camada de autorização: compõe AccessPolicy + Resolver no
 * EffectiveState VO. Testes por MATRIZ (ajuste PO #4): Tenant × Subscription
 * × Feature → Expected Access.
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it } from 'vitest';
import { EffectiveAccessServiceImpl } from './EffectiveAccessService';
import type { EffectiveAccessInput } from './EffectiveAccessService';
import type { TenantStatus } from '../../domain/tenant/types';
import type { SubscriptionStatus } from '../../domain/billing/types';

const svc = new EffectiveAccessServiceImpl();

const input = (
  tenantStatus: TenantStatus | null,
  plan: EffectiveAccessInput['plan'] = 'free',
  subscriptionStatus?: SubscriptionStatus | null,
): EffectiveAccessInput => ({ tenantStatus, plan, subscriptionStatus });

describe('EffectiveAccessService.resolve — níveis', () => {
  it('should_resolve_onboarding_when_tenant_status_is_null', () => {
    const state = svc.resolve(input(null));
    expect(state.accessLevel).toBe('onboarding');
    expect(state.warnings).toEqual([]);
    expect(state.enabledFeatures).toEqual([]);
  });

  it('should_resolve_onboarding_when_tenant_is_draft', () => {
    const state = svc.resolve(input('draft'));
    expect(state.accessLevel).toBe('onboarding');
    expect(state.enabledFeatures).toEqual([]);
  });

  it('should_resolve_full_with_plan_features_when_active', () => {
    const state = svc.resolve(input('active', 'pro'));
    expect(state.accessLevel).toBe('full');
    expect(state.enabledFeatures).toContain('chef_club');
    expect(state.warnings).toEqual([]);
  });

  it('should_resolve_full_when_trial', () => {
    const state = svc.resolve(input('trial', 'premium'));
    expect(state.accessLevel).toBe('full');
    expect(state.enabledFeatures).toContain('bi');
  });

  it('should_resolve_restricted_with_past_due_warnings_when_past_due', () => {
    const state = svc.resolve(input('past_due', 'pro'));
    expect(state.accessLevel).toBe('restricted');
    expect(state.warnings).toEqual(['readonly', 'past_due']);
    expect(state.enabledFeatures).toContain('chef_club');
  });

  it('should_resolve_readonly_with_cancelled_warnings_when_cancelled', () => {
    const state = svc.resolve(input('cancelled', 'pro'));
    expect(state.accessLevel).toBe('readonly');
    expect(state.warnings).toEqual(['readonly', 'cancelled']);
    expect(state.enabledFeatures).toContain('chef_club');
  });

  it('should_resolve_none_when_suspended', () => {
    const state = svc.resolve(input('suspended', 'premium'));
    expect(state.accessLevel).toBe('none');
    expect(state.enabledFeatures).toEqual([]);
  });

  it('should_resolve_none_when_archived', () => {
    const state = svc.resolve(input('archived', 'premium'));
    expect(state.accessLevel).toBe('none');
    expect(state.enabledFeatures).toEqual([]);
  });
});

describe('EffectiveAccessService.resolve — matriz Tenant × Subscription', () => {
  it('should_keep_level_and_features_stable_for_any_subscription_status', () => {
    // DIV-3/D-6.0.5.1: subscriptions.status é informativo; tenants.status
    // domina. Para cada par, nível e features derivados devem ser idênticos.
    const statuses: readonly TenantStatus[] = ['trial', 'active', 'past_due', 'cancelled'];
    for (const tenant of statuses) {
      const baseline = svc.resolve(input(tenant, 'free'));
      for (const sub of ['trialing', 'active', 'past_due', 'cancelled'] as const) {
        const withSub = svc.resolve(input(tenant, 'free', sub));
        expect(withSub.accessLevel).toBe(baseline.accessLevel);
        expect(withSub.enabledFeatures).toEqual(baseline.enabledFeatures);
        expect(withSub.warnings).toEqual(baseline.warnings);
      }
    }
  });
});

describe('EffectiveAccessService.resolve — plano', () => {
  it('should_default_to_free_features_when_plan_is_null', () => {
    const state = svc.resolve({ tenantStatus: 'active', plan: null });
    expect(state.enabledFeatures).toEqual(svc.resolve(input('active', 'free')).enabledFeatures);
    expect(state.plan).toBeNull();
  });
});
