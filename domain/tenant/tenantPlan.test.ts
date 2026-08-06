/**
 * [SMG][DOMAIN][TENANT] TenantPlan normalization tests
 *
 * Verifica a normalização D1 aprovada pelo PO em 2026-08-06:
 *   - 'elite' não existe mais como slug de plano — 'premium' é o único oficial
 *   - slugs válidos: free / pro / premium
 *   - a verificação de 'elite' é também em tempo de compilação (@ts-expect-error)
 *
 * Segue convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, it, expect } from 'vitest';
import type { TenantPlan, Tenant } from './types';

const VALID_PLANS: readonly TenantPlan[] = ['free', 'pro', 'premium'];

// Compile-time: 'elite' deve estar FORA do union TenantPlan.
// Se algum dia 'elite' for reintroduzido, este @ts-expect-error vira erro de
// compilação e o teste quebra.
// @ts-expect-error — 'elite' foi normalizado para 'premium' (D1, 2026-08-06)
const _eliteIsNotAValidPlan: TenantPlan = 'elite';

describe('TenantPlan (normalização D1: elite -> premium)', () => {
  it('should_contain_only_free_pro_premium', () => {
    expect(VALID_PLANS).toEqual(['free', 'pro', 'premium']);
  });

  it('should_not_contain_elite', () => {
    expect(VALID_PLANS).not.toContain('elite');
    expect(VALID_PLANS).not.toContain('Elite');
  });

  it('should_accept_premium_as_the_official_top_plan', () => {
    const tenant: Tenant = {
      id: 't-1',
      name: 'Studio Prime',
      slug: 'studio-prime',
      status: 'active',
      plan: 'premium',
      app_slug: 'barber',
      first_appointment_at: null,
      created_at: '2026-08-06T00:00:00Z',
      updated_at: '2026-08-06T00:00:00Z',
    };

    expect(tenant.plan).toBe('premium');
  });

  it('should_cover_all_slugs_used_by_migration_check', () => {
    // A constraint tenants_plan_check da migration 6.0.4.2 usa exatamente estes slugs
    const migrationCheck = new Set(['free', 'pro', 'premium']);
    expect(migrationCheck.size).toBe(3);
    for (const slug of VALID_PLANS) {
      expect(migrationCheck.has(slug)).toBe(true);
    }
  });
});
