/**
 * [SMG][APPLICATION][AUTHORIZATION] AuthorizationService tests
 *
 * API pública de navegação para App.tsx (ajuste PO #1). Espelha os guards
 * antigos de App.tsx:158/162 com a mudança aprovada D-6.0.5-2 (cancelled
 * deixa de redirecionar e passa a permitir acesso somente leitura).
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it } from 'vitest';
import { AuthorizationServiceImpl } from './AuthorizationService';
import { ONBOARDING_PATHS, BLOCKED_ROUTE } from './AuthorizationService';
import type { NavigationStateInput } from './AuthorizationService';
import type { TenantStatus } from '../../domain/tenant/types';
import type { TenantPlan } from '../../domain/billing/types';

const svc = new AuthorizationServiceImpl();

const nav = (
  tenantStatus: TenantStatus | null,
  pathname: string = '/dashboard',
  plan: TenantPlan | null = 'free',
  isSuperAdmin = false,
): NavigationStateInput => ({ tenantStatus, plan, pathname, isSuperAdmin });

describe('getNavigationState — superadmin bypass', () => {
  it('should_allow_superadmin_even_when_tenant_is_suspended', () => {
    const state = svc.getNavigationState(nav('suspended', '/dashboard', 'free', true));
    expect(state.allowed).toBe(true);
    expect(state.redirectTo).toBeNull();
    expect(state.accessLevel).toBe('full');
  });

  it('should_allow_superadmin_even_when_tenant_is_cancelled', () => {
    const state = svc.getNavigationState(nav('cancelled', '/dashboard', 'pro', true));
    expect(state.allowed).toBe(true);
    expect(state.redirectTo).toBeNull();
  });
});

describe('getNavigationState — pré-tenant', () => {
  it('should_allow_when_tenant_is_null', () => {
    const state = svc.getNavigationState(nav(null, '/dashboard'));
    expect(state.allowed).toBe(true);
    expect(state.redirectTo).toBeNull();
    expect(state.accessLevel).toBe('onboarding');
  });
});

describe('getNavigationState — onboarding (draft)', () => {
  it('should_allow_when_path_is_an_onboarding_route', () => {
    for (const path of ONBOARDING_PATHS) {
      const state = svc.getNavigationState(nav('draft', path));
      expect(state.allowed).toBe(true);
      expect(state.redirectTo).toBeNull();
    }
  });

  it('should_redirect_to_welcome_when_draft_outside_onboarding', () => {
    const state = svc.getNavigationState(nav('draft', '/dashboard'));
    expect(state.redirectTo).toBe('/onboarding/welcome');
    expect(state.allowed).toBe(true);
  });
});

describe('getNavigationState — bloqueio (none)', () => {
  it('should_redirect_to_blocked_route_when_suspended', () => {
    const state = svc.getNavigationState(nav('suspended'));
    expect(state.allowed).toBe(false);
    expect(state.redirectTo).toBe(BLOCKED_ROUTE);
  });

  it('should_redirect_to_blocked_route_when_archived', () => {
    const state = svc.getNavigationState(nav('archived'));
    expect(state.allowed).toBe(false);
    expect(state.redirectTo).toBe(BLOCKED_ROUTE);
  });
});

describe('getNavigationState — cancelled (D-6.0.5-2: somente leitura)', () => {
  it('should_allow_cancelled_with_readonly_warnings_instead_of_redirect', () => {
    // Mudança comportamental aprovada: NÃO redireciona para /pending-approval.
    const state = svc.getNavigationState(nav('cancelled', '/dashboard', 'pro'));
    expect(state.allowed).toBe(true);
    expect(state.redirectTo).toBeNull();
    expect(state.accessLevel).toBe('readonly');
    expect(state.warnings).toEqual(['readonly', 'cancelled']);
  });
});

describe('getNavigationState — restricted (past_due)', () => {
  it('should_allow_past_due_with_past_due_warnings', () => {
    const state = svc.getNavigationState(nav('past_due', '/dashboard', 'pro'));
    expect(state.allowed).toBe(true);
    expect(state.redirectTo).toBeNull();
    expect(state.accessLevel).toBe('restricted');
    expect(state.warnings).toEqual(['readonly', 'past_due']);
  });
});

describe('getNavigationState — full (trial/active)', () => {
  it('should_allow_active_without_redirect', () => {
    const state = svc.getNavigationState(nav('active', '/dashboard', 'premium'));
    expect(state.allowed).toBe(true);
    expect(state.redirectTo).toBeNull();
    expect(state.accessLevel).toBe('full');
    expect(state.enabledFeatures).toContain('bi');
  });

  it('should_allow_trial_without_redirect', () => {
    const state = svc.getNavigationState(nav('trial'));
    expect(state.allowed).toBe(true);
    expect(state.redirectTo).toBeNull();
    expect(state.accessLevel).toBe('full');
  });
});

describe('resolveRoute — conveniência', () => {
  it('should_return_redirect_for_blocked_tenant', () => {
    expect(svc.resolveRoute(nav('suspended'))).toBe(BLOCKED_ROUTE);
  });

  it('should_return_welcome_for_draft_outside_onboarding', () => {
    expect(svc.resolveRoute(nav('draft', '/reports'))).toBe('/onboarding/welcome');
  });

  it('should_return_null_when_allowed', () => {
    expect(svc.resolveRoute(nav('cancelled'))).toBeNull();
    expect(svc.resolveRoute(nav('active'))).toBeNull();
  });
});
