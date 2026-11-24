import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ASSISTED_UPGRADE_WHATSAPP_NUMBER,
  buildAssistedUpgradeWhatsAppUrl,
  formatTenantPlanLabel,
  normalizeTenantPlanSlug,
} from '../../src/lib/billing/assistedUpgrade';

const ROOT = process.cwd();
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20261124182000_security_fix_gtm001_stack_a_assisted_billing.sql'
);

describe('GTM-001 (#380 / ADR-055) Stack A canonical billing & assisted upgrade', () => {
  it('should_port_rls_and_grant_hardening_to_stack_a_tables_and_rpcs', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

    for (const table of [
      'public.plans',
      'public.features',
      'public.plan_features',
      'public.subscriptions',
      'public.invoices',
      'public.billing_events',
      'public.payment_attempts',
    ]) {
      expect(sql).toContain(`REVOKE ALL ON TABLE ${table} FROM PUBLIC, anon, authenticated;`);
    }

    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.activate_subscription');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mark_invoice_paid');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.record_billing_event');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.activate_assisted_plan_upgrade');
  });

  it('should_define_atomic_assisted_upgrade_rpc_with_row_locks_and_phased_deprecation_without_drop', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.activate_assisted_plan_upgrade');
    expect(sql).toContain('public.current_is_super_admin_from_auth_uid()');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('UPDATE public.tenants');
    expect(sql).toContain('UPDATE public.subscriptions');
    expect(sql).toContain('INSERT INTO public.billing_events');

    // Mandate 3: phased deprecation WITHOUT immediate DROP TABLE
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).toContain('COMMENT ON TABLE public.platform_plans');
    expect(sql).toContain('COMMENT ON TABLE public.platform_subscriptions');
    expect(sql).toContain('COMMENT ON TABLE public.platform_invoices');
  });

  it('should_eliminate_user_metadata_plan_split_brain_in_layout_and_settings', () => {
    const layoutSource = fs.readFileSync(path.join(ROOT, 'components/Layout.tsx'), 'utf8');
    const settingsSource = fs.readFileSync(path.join(ROOT, 'pages/Settings.tsx'), 'utf8');

    expect(layoutSource).not.toContain('supabase.auth.updateUser');
    expect(layoutSource).not.toContain('user_metadata?.plan');
    expect(layoutSource).toContain('openAssistedUpgradeChannel');

    expect(settingsSource).not.toContain('user_metadata?.plan');
    expect(settingsSource).toContain('openAssistedUpgradeChannel');
  });

  it('should_build_assisted_upgrade_whatsapp_url_and_normalize_plan_labels', () => {
    expect(normalizeTenantPlanSlug('pro_annual')).toBe('pro');
    expect(normalizeTenantPlanSlug('elite')).toBe('premium');
    expect(normalizeTenantPlanSlug(null)).toBe('free');

    expect(formatTenantPlanLabel('free')).toBe('Starter (Free)');
    expect(formatTenantPlanLabel('pro')).toBe('Pro');
    expect(formatTenantPlanLabel('premium')).toBe('Premium');

    const url = buildAssistedUpgradeWhatsAppUrl({
      tenantName: 'Barbearia Modelo',
      currentPlan: 'free',
      targetPlan: 'pro',
      billingCycle: 'annual',
    });

    expect(url).toContain(`https://wa.me/${ASSISTED_UPGRADE_WHATSAPP_NUMBER}?text=`);
    const decoded = decodeURIComponent(url.split('?text=')[1]);
    expect(decoded).toContain('Barbearia Modelo');
    expect(decoded).toContain('Starter (Free)');
    expect(decoded).toContain('Pro (anual)');
  });
});
