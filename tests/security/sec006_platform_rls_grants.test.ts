import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'supabase/migrations/20261124122000_security_fix_sec006_platform_rls_and_grants.sql'
);

const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

function extractCreatePolicy(policyName: string): string {
  const escaped = policyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sql.match(new RegExp(`CREATE POLICY\\s+${escaped}[\\s\\S]*?;`, 'i'));
  expect(match, `Expected CREATE POLICY for ${policyName}`).not.toBeNull();
  return match?.[0] ?? '';
}

describe('SEC-006 (#376) platform RLS & grants hardening migration', () => {
  it('should_enforce_superadmin_only_for_platform_subscriptions_writes', () => {
    const selectPolicy = extractCreatePolicy('platform_subscriptions_select_policy');
    expect(selectPolicy).toContain('TO authenticated');
    expect(selectPolicy).toContain('tenant_id = public.current_effective_tenant_id()');
    expect(selectPolicy).toContain('public.current_is_super_admin_from_auth_uid()');

    for (const writePolicyName of [
      'platform_subscriptions_insert_policy',
      'platform_subscriptions_update_policy',
      'platform_subscriptions_delete_policy',
    ]) {
      const policySql = extractCreatePolicy(writePolicyName);
      expect(policySql).toContain('TO authenticated');
      expect(policySql).toContain('public.current_is_super_admin_from_auth_uid()');
      expect(policySql).not.toContain('current_effective_tenant_id');
    }
  });

  it('should_enforce_superadmin_only_for_platform_invoices_writes', () => {
    const selectPolicy = extractCreatePolicy('platform_invoices_select_policy');
    expect(selectPolicy).toContain('TO authenticated');
    expect(selectPolicy).toContain('tenant_id = public.current_effective_tenant_id()');
    expect(selectPolicy).toContain('public.current_is_super_admin_from_auth_uid()');

    for (const writePolicyName of [
      'platform_invoices_insert_policy',
      'platform_invoices_update_policy',
      'platform_invoices_delete_policy',
    ]) {
      const policySql = extractCreatePolicy(writePolicyName);
      expect(policySql).toContain('TO authenticated');
      expect(policySql).toContain('public.current_is_super_admin_from_auth_uid()');
      expect(policySql).not.toContain('current_effective_tenant_id');
    }
  });

  it('should_replace_case_sensitive_superadmin_checks_on_access_requests', () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "superadmin full access access_requests"');
    expect(sql).toContain('DROP POLICY IF EXISTS "superadmin_requests_visibility"');

    const superadminPolicy = extractCreatePolicy('"superadmin full access access_requests"');
    expect(superadminPolicy).toContain('TO authenticated');
    expect(superadminPolicy).toContain('public.current_is_super_admin_from_auth_uid()');
    expect(superadminPolicy).not.toContain("role = 'superadmin'");

    const publicInsertPolicy = extractCreatePolicy('"public insert access_requests"');
    expect(publicInsertPolicy).toContain('FOR INSERT');
    expect(publicInsertPolicy).toContain('TO anon, authenticated');
  });

  it('should_revoke_excessive_public_anon_and_authenticated_grants_without_disabling_rls', () => {
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);

    for (const table of [
      'public.platform_subscriptions',
      'public.platform_invoices',
      'public.access_requests',
      'public.feature_flags',
      'public.plans',
      'public.subscriptions',
      'public.invoices',
    ]) {
      expect(sql).toContain(`REVOKE ALL ON TABLE ${table} FROM PUBLIC, anon, authenticated;`);
    }

    expect(sql).toContain('GRANT INSERT ON TABLE public.access_requests TO anon;');
    expect(sql).toContain('GRANT SELECT ON TABLE public.feature_flags TO authenticated;');
    expect(sql).toContain('GRANT SELECT ON TABLE public.plans TO anon, authenticated;');
    expect(sql).toContain('GRANT SELECT ON TABLE public.subscriptions TO authenticated;');
    expect(sql).toContain('GRANT SELECT ON TABLE public.invoices TO authenticated;');
  });
});
