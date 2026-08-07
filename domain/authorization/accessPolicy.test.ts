/**
 * [SMG][DOMAIN][AUTHORIZATION] accessPolicy tests
 *
 * Testes por MATRIZ (ajuste PO #4): Tenant × Subscription → AccessLevel,
 * além do catálogo completo de ações × níveis e fail-fast (ADR-013 §4.7).
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it } from 'vitest';
import { evaluateAccess, can, getWarnings } from './accessPolicy';
import { accessPolicy } from './accessPolicy';
import type { TenantStatus } from '../tenant/types';
import type { SubscriptionStatus } from '../billing/types';
import type { AccessLevel } from './effectiveState';

const TENANT_STATUSES: readonly TenantStatus[] = [
  'draft',
  'trial',
  'active',
  'past_due',
  'suspended',
  'cancelled',
  'archived',
];

const SUB_STATUSES: readonly SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'cancelled',
];

describe('evaluateAccess — matriz Tenant → AccessLevel', () => {
  const MATRIX: Readonly<Record<TenantStatus, AccessLevel>> = {
    draft: 'onboarding',
    trial: 'full',
    active: 'full',
    past_due: 'restricted',
    suspended: 'none',
    cancelled: 'readonly',
    archived: 'none',
  };

  it('should_map_each_tenant_status_to_the_congelada_level', () => {
    for (const status of TENANT_STATUSES) {
      expect(evaluateAccess({ tenantStatus: status })).toBe(MATRIX[status]);
    }
  });

  it('should_keep_level_stable_across_subscription_statuses_6_0_5_1', () => {
    // DIV-3/D-6.0.5.1: o nível é dominado por tenants.status (fonte de
    // acesso); subscriptions.status é informativo nesta subfase.
    for (const tenant of TENANT_STATUSES) {
      for (const sub of SUB_STATUSES) {
        expect(evaluateAccess({ tenantStatus: tenant, subscriptionStatus: sub })).toBe(
          MATRIX[tenant],
        );
      }
    }
  });

  it('should_ignore_null_subscription_status', () => {
    for (const tenant of TENANT_STATUSES) {
      expect(evaluateAccess({ tenantStatus: tenant, subscriptionStatus: null })).toBe(
        MATRIX[tenant],
      );
    }
  });
});

describe('evaluateAccess — fail-fast (ADR-013 §4.7)', () => {
  it('should_throw_when_tenant_status_is_unknown', () => {
    expect(() =>
      evaluateAccess({ tenantStatus: 'galaxy' as unknown as TenantStatus }),
    ).toThrow(/desconhecido/);
  });

  it('should_never_fall_back_to_active_on_unknown_status', () => {
    // Proibido ELSE → active: a chamada falha em vez de retornar full.
    expect(() =>
      evaluateAccess({ tenantStatus: 'mystery' as unknown as TenantStatus }),
    ).not.toBe('full');
  });
});

describe('can — matriz ação × nível', () => {
  const LEVELS: readonly AccessLevel[] = [
    'onboarding',
    'full',
    'restricted',
    'readonly',
    'none',
  ];

  const MATRIX: Readonly<Record<string, readonly AccessLevel[]>> = {
    'system.access': ['onboarding', 'full', 'restricted', 'readonly'],
    'system.onboarding': ['onboarding'],
    'system.read': ['full', 'restricted', 'readonly'],
    'system.write': ['full'],
    'system.export': ['full', 'restricted', 'readonly'],
    'system.financial': ['full'],
    'system.stock': ['full'],
    'system.cadastral': ['full'],
  };

  it('should_allow_each_action_exactly_on_its_levels', () => {
    for (const [action, allowed] of Object.entries(MATRIX)) {
      for (const level of LEVELS) {
        expect(can(action as never, level), `${action} @ ${level}`).toBe(allowed.includes(level));
      }
    }
  });

  it('should_deny_write_financial_stock_cadastral_in_restricted_and_readonly', () => {
    // D-6.0.5-1 (past_due) e D-6.0.5-2 (cancelled): escrita bloqueada.
    for (const action of ['system.write', 'system.financial', 'system.stock', 'system.cadastral'] as const) {
      for (const level of ['restricted', 'readonly', 'none'] as const) {
        expect(can(action, level)).toBe(false);
      }
    }
  });

  it('should_allow_read_and_export_in_restricted_and_readonly', () => {
    // D-6.0.5-1/2: consulta e exportação permitidas durante inadimplência e
    // após cancelamento.
    for (const action of ['system.read', 'system.export'] as const) {
      for (const level of ['restricted', 'readonly'] as const) {
        expect(can(action, level)).toBe(true);
      }
    }
  });

  it('should_deny_all_actions_in_none', () => {
    for (const action of Object.keys(MATRIX)) {
      expect(can(action as never, 'none')).toBe(false);
    }
  });

  it('should_throw_when_action_is_unknown', () => {
    expect(() => can('system.magic' as never, 'full')).toThrow(/desconhecida/);
  });
});

describe('getWarnings — sinais para a UI (D-6.0.5-1/2)', () => {
  it('should_warn_readonly_and_past_due_in_restricted', () => {
    expect(getWarnings('restricted')).toEqual(['readonly', 'past_due']);
  });

  it('should_warn_readonly_and_cancelled_in_readonly', () => {
    expect(getWarnings('readonly')).toEqual(['readonly', 'cancelled']);
  });

  it('should_have_no_warnings_in_onboarding_full_and_none', () => {
    for (const level of ['onboarding', 'full', 'none'] as const) {
      expect(getWarnings(level)).toEqual([]);
    }
  });
});

describe('accessPolicy — interface singleton', () => {
  it('should_expose_evaluate_can_and_get_warnings', () => {
    expect(typeof accessPolicy.evaluateAccess).toBe('function');
    expect(typeof accessPolicy.can).toBe('function');
    expect(typeof accessPolicy.getWarnings).toBe('function');
  });
});
