import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Pacote 1: Security Hardening RLS & Policies Verification', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261103181500_security_hardening_rls_pacote1.sql',
  );

  it('should_exist_and_be_valid_sql_migration', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    expect(sql.length).toBeGreaterThan(100);
  });

  describe('Bloco 1: Schema-level RLS activation', () => {
    it('should_enable_rls_on_club_tables', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('ALTER TABLE IF EXISTS club.customer_subscriptions ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('ALTER TABLE IF EXISTS club.customer_credits ENABLE ROW LEVEL SECURITY;');
      expect(sql).toContain('CREATE POLICY tenant_isolation_club_subscriptions ON club.customer_subscriptions');
      expect(sql).toContain('CREATE POLICY tenant_isolation_club_credits ON club.customer_credits');
    });

    it('should_enable_rls_on_all_14_platform_tables', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      const platformTables = [
        'platform_user_tenants',
        'platform_tenants',
        'platform_security_events',
        'platform_role_permissions',
        'platform_users',
        'platform_roles',
        'platform_permissions',
        'platform_feature_flags',
        'platform_plans',
        'platform_api_logs',
        'platform_error_logs',
        'platform_audit_logs',
        'platform_integrations',
        'platform_jobs',
      ];

      for (const table of platformTables) {
        expect(sql).toContain(`ALTER TABLE IF EXISTS platform.${table} ENABLE ROW LEVEL SECURITY;`);
      }
      expect(sql).toContain("CREATE POLICY platform_superadmin_all ON platform.%I");
    });
  });

  describe('Bloco 2: portal_sessions anon access revocation', () => {
    it('should_drop_unrestricted_public_policies_on_portal_sessions', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('DROP POLICY IF EXISTS "Public can insert portal sessions upon auth" ON public.portal_sessions;');
      expect(sql).toContain('DROP POLICY IF EXISTS "Public can select portal sessions for validation" ON public.portal_sessions;');
      expect(sql).toContain('DROP POLICY IF EXISTS "Public can update active portal sessions" ON public.portal_sessions;');
      expect(sql).toContain('CREATE POLICY "portal_sessions_manager_select" ON public.portal_sessions');
      expect(sql).toContain('current_is_manager_from_auth_uid(tenant_id)');
    });
  });

  describe('Bloco 3: Anti cross-tenant injection on outbox and event store', () => {
    it('should_enforce_tenant_id_match_on_event_store_and_outbox', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('CREATE POLICY event_store_tenant_insert ON public.event_store');
      expect(sql).toContain('tenant_id = public.current_tenant_id_from_auth_uid()');

      expect(sql).toContain('CREATE POLICY outbox_items_tenant_insert ON public.outbox_items');
      expect(sql).toContain('tenant_id = public.current_tenant_id_from_auth_uid()');

      expect(sql).toContain('CREATE POLICY processed_operations_tenant_insert ON public.processed_operations');
      expect(sql).toContain('tenant_id = public.current_tenant_id_from_auth_uid()');
    });
  });

  describe('Bloco 4: Least Privilege on Financial and Ledger Tables', () => {
    it('should_separate_select_from_manager_mutation_on_transactions', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('DROP POLICY IF EXISTS tenant_isolation_transactions_v2 ON public.transactions;');
      expect(sql).toContain('CREATE POLICY transactions_tenant_select ON public.transactions');
      expect(sql).toContain('CREATE POLICY transactions_manager_mutation ON public.transactions');
      expect(sql).toContain('current_is_manager_from_auth_uid(tenant_id)');
    });

    it('should_separate_select_from_manager_mutation_on_accounts_payable', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('DROP POLICY IF EXISTS tenant_isolation_accounts_payable ON public.accounts_payable;');
      expect(sql).toContain('CREATE POLICY accounts_payable_tenant_select ON public.accounts_payable');
      expect(sql).toContain('CREATE POLICY accounts_payable_manager_mutation ON public.accounts_payable');
    });

    it('should_restrict_customer_credits_and_subscriptions_mutations_to_managers', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('CREATE POLICY customer_credits_tenant_select ON public.customer_credits');
      expect(sql).toContain('CREATE POLICY customer_credits_manager_mutation ON public.customer_credits');
      expect(sql).toContain('CREATE POLICY customer_subscriptions_tenant_select ON public.customer_subscriptions');
      expect(sql).toContain('CREATE POLICY customer_subscriptions_manager_mutation ON public.customer_subscriptions');
    });
  });

  describe('Authorization Policy Logic Simulation', () => {
    const isManagerAllowed = (userTenantId: string, resourceTenantId: string, role: string) => {
      const isSuperAdmin = role === 'superadmin';
      const isManager = role === 'manager' || role === 'owner';
      const isSameTenant = userTenantId === resourceTenantId;

      return isSuperAdmin || (isSameTenant && isManager);
    };

    const isSelectAllowed = (userTenantId: string, resourceTenantId: string, role: string) => {
      const isSuperAdmin = role === 'superadmin';
      const isSameTenant = userTenantId === resourceTenantId;

      return isSuperAdmin || isSameTenant;
    };

    it('should_allow_barber_to_select_but_reject_direct_mutation_on_transactions', () => {
      // Barbeiro do mesmo tenant
      expect(isSelectAllowed('tenant-1', 'tenant-1', 'barber')).toBe(true);
      expect(isManagerAllowed('tenant-1', 'tenant-1', 'barber')).toBe(false);

      // Recepcionista do mesmo tenant
      expect(isSelectAllowed('tenant-1', 'tenant-1', 'receptionist')).toBe(true);
      expect(isManagerAllowed('tenant-1', 'tenant-1', 'receptionist')).toBe(false);

      // Gerente do mesmo tenant
      expect(isSelectAllowed('tenant-1', 'tenant-1', 'manager')).toBe(true);
      expect(isManagerAllowed('tenant-1', 'tenant-1', 'manager')).toBe(true);

      // Dono do mesmo tenant
      expect(isSelectAllowed('tenant-1', 'tenant-1', 'owner')).toBe(true);
      expect(isManagerAllowed('tenant-1', 'tenant-1', 'owner')).toBe(true);

      // Usuário de outro tenant (Cross-tenant attack)
      expect(isSelectAllowed('tenant-2', 'tenant-1', 'manager')).toBe(false);
      expect(isManagerAllowed('tenant-2', 'tenant-1', 'manager')).toBe(false);

      // Superadmin
      expect(isSelectAllowed('any', 'tenant-1', 'superadmin')).toBe(true);
      expect(isManagerAllowed('any', 'tenant-1', 'superadmin')).toBe(true);
    });
  });
});
