import { describe, expect, it } from 'vitest';
import { evaluateRuntimeSupabaseMode } from '../../src/lib/supabase/client';
import { filterSidebarMenu } from '../../components/Sidebar';

describe('GTM-005: Demo fail-fast & Observability / Event Versioning gating', () => {
  it('should_fail_closed_outside_localhost_when_supabase_env_is_missing', () => {
    expect(
      evaluateRuntimeSupabaseMode({
        hasEnv: false,
        isBrowser: true,
        hostname: 'barber.soumanager.com',
      }),
    ).toBe('missing-config');

    expect(
      evaluateRuntimeSupabaseMode({
        hasEnv: false,
        isBrowser: true,
        hostname: 'localhost',
      }),
    ).toBe('local-demo');

    expect(
      evaluateRuntimeSupabaseMode({
        hasEnv: true,
        isBrowser: true,
        hostname: 'barber.soumanager.com',
      }),
    ).toBe('supabase');

    expect(
      evaluateRuntimeSupabaseMode({
        hasEnv: false,
        isBrowser: false,
      }),
    ).toBe('node-test');
  });

  it('should_hide_observability_from_non_superadmin_users_in_sidebar', () => {
    const rawMenu = [
      {
        name: 'Sistema',
        icon: (() => null) as never,
        type: 'group' as const,
        items: [
          { name: 'Avisos', icon: (() => null) as never },
          { name: 'Observabilidade', icon: (() => null) as never, path: '/observability', superAdminOnly: true },
          { name: 'Super Admin', icon: (() => null) as never, path: '/superadmin', superAdminOnly: true },
        ],
      },
    ];

    const managerFiltered = filterSidebarMenu({
      rawMenuStructure: rawMenu,
      isEsteticaApp: false,
      isOperationalOnly: false,
      canAccessSuperAdmin: false,
      isModuleAllowed: () => true,
    });

    const managerSubNames =
      managerFiltered[0]?.type === 'group' ? managerFiltered[0].items.map((i) => i.name) : [];
    expect(managerSubNames).toEqual(['Avisos']);

    const superAdminFiltered = filterSidebarMenu({
      rawMenuStructure: rawMenu,
      isEsteticaApp: false,
      isOperationalOnly: false,
      canAccessSuperAdmin: true,
      isModuleAllowed: () => true,
    });

    const superAdminSubNames =
      superAdminFiltered[0]?.type === 'group' ? superAdminFiltered[0].items.map((i) => i.name) : [];
    expect(superAdminSubNames).toContain('Observabilidade');
    expect(superAdminSubNames).toContain('Super Admin');
  });
});
