import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20261124185500_security_fix_gtm007_superadmin_operational_rpcs.sql'
);

describe('GTM-007 + SEC-004 (#383) SuperAdmin operational MVP & Admin.tsx removal', () => {
  it('should_remove_orphan_admin_page_and_redirect_admin_route_to_superadmin', () => {
    expect(fs.existsSync(path.join(ROOT, 'pages/Admin.tsx'))).toBe(false);

    const appSource = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
    expect(appSource).not.toContain("./pages/Admin");
    expect(appSource).toContain('<Route path="/admin" element={<SuperAdminRoute><Navigate to="/superadmin" replace /></SuperAdminRoute>} />');
  });

  it('should_define_superadmin_only_operational_rpcs_with_audit_logs_and_valid_ticket_status', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

    for (const fnName of [
      'superadmin_update_tenant_status',
      'superadmin_extend_tenant_trial',
      'superadmin_change_tenant_plan',
      'superadmin_decide_profile_status',
      'superadmin_respond_support_ticket',
    ]) {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${fnName}`);
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${fnName}`);
    }

    expect(sql).toContain('public.current_is_super_admin_from_auth_uid()');
    expect(sql).toContain('INSERT INTO public.audit_logs');
    expect(sql).not.toContain('awaiting_response');
  });

  it('should_enforce_limits_in_profile_repository_and_operational_mutations_in_superadmin', () => {
    const repoSource = fs.readFileSync(path.join(ROOT, 'domain/profile/repository.ts'), 'utf8');
    const superAdminSource = fs.readFileSync(path.join(ROOT, 'pages/SuperAdmin.tsx'), 'utf8');

    expect(repoSource).toContain('listAllProfiles(limit = 200)');
    expect(repoSource).toContain('listTenants(limit = 200)');
    expect(repoSource).toContain('superadminUpdateTenantStatus');
    expect(repoSource).toContain('superadminExtendTenantTrial');
    expect(repoSource).toContain('superadminChangeTenantPlan');
    expect(repoSource).toContain('superadminDecideProfileStatus');
    expect(repoSource).toContain('superadminRespondSupportTicket');

    expect(superAdminSource).not.toContain('supabase.auth.admin');
    expect(superAdminSource).toContain('superadminUpdateTenantStatus');
    expect(superAdminSource).toContain('superadminExtendTenantTrial');
    expect(superAdminSource).toContain('superadminChangeTenantPlan');
    expect(superAdminSource).toContain('superadminDecideProfileStatus');
  });
});
