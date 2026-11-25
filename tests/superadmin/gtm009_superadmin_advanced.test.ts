import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calculateExecutiveBillingMetrics,
  type BillingInvoiceSnapshot,
  type BillingPlanSnapshot,
  type BillingSubscriptionSnapshot,
} from '../../src/modules/superadmin/executiveMetrics';

const PLANS: BillingPlanSnapshot[] = [
  { slug: 'free', name: 'Free', price_cents: 0, status: 'active' },
  { slug: 'pro', name: 'Pro', price_cents: 14900, status: 'active' },
  { slug: 'premium', name: 'Premium', price_cents: 29900, status: 'active' },
];

describe('GTM-009: Super Admin Avançado', () => {
  it('should_compute_real_mrr_arr_and_30d_churn_from_stack_a_subscriptions', () => {
    const now = new Date('2026-11-25T12:00:00Z');
    const subscriptions: BillingSubscriptionSnapshot[] = [
      { id: 's1', tenant_id: 't1', plan: 'pro', status: 'active' },
      { id: 's2', tenant_id: 't2', plan: 'premium', status: 'active' },
      { id: 's3', tenant_id: 't3', plan: 'free', status: 'active' },
      { id: 's4', tenant_id: 't4', plan: 'pro', status: 'trialing' },
      { id: 's5', tenant_id: 't5', plan: 'pro', status: 'past_due' },
      { id: 's6', tenant_id: 't6', plan: 'pro', status: 'canceled', canceled_at: '2026-11-15T12:00:00Z' },
      { id: 's7', tenant_id: 't7', plan: 'pro', status: 'canceled', canceled_at: '2026-09-01T12:00:00Z' },
    ];
    const invoices: BillingInvoiceSnapshot[] = [
      { id: 'i1', status: 'paid', amount: 149 },
      { id: 'i2', status: 'paid', amount: 299 },
      { id: 'i3', status: 'open', amount: 149 },
    ];

    const metrics = calculateExecutiveBillingMetrics(PLANS, subscriptions, invoices, now);

    expect(metrics.mrr).toBe(448);
    expect(metrics.arr).toBe(5376);
    expect(metrics.activePaidCount).toBe(2);
    expect(metrics.activeFreeCount).toBe(1);
    expect(metrics.trialingCount).toBe(1);
    expect(metrics.pastDueCount).toBe(1);
    expect(metrics.canceledLast30d).toBe(1);
    expect(metrics.churnRatePct).toBe(33.3);
    expect(metrics.paidInvoicesTotal).toBe(448);
    expect(metrics.paidInvoicesCount).toBe(2);
    expect(metrics.planBreakdown[0]?.slug).toBe('premium');
    expect(metrics.planBreakdown[1]?.slug).toBe('pro');
  });

  it('should_return_zero_metrics_without_nan_when_no_subscriptions_exist', () => {
    const metrics = calculateExecutiveBillingMetrics(PLANS, [], []);

    expect(metrics.mrr).toBe(0);
    expect(metrics.arr).toBe(0);
    expect(metrics.churnRatePct).toBe(0);
    expect(metrics.activePaidCount).toBe(0);
    expect(metrics.planBreakdown).toEqual([]);
  });

  it('should_not_use_mock_fallback_in_SupabaseMonitoring', () => {
    const monitoringSource = readFileSync(resolve(process.cwd(), 'pages/SupabaseMonitoring.tsx'), 'utf8');

    expect(monitoringSource).not.toContain('supabaseMonitorMock');
    expect(monitoringSource).not.toContain('supabase-monitor/mockData');
  });

  it('should_mount_supabase_monitoring_exclusively_under_SuperAdminRoute', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'App.tsx'), 'utf8');

    expect(appSource).toContain(
      '<Route path="/admin/supabase-monitoring" element={<SuperAdminRoute><SupabaseMonitoring /></SuperAdminRoute>} />'
    );
    expect(appSource).not.toContain(
      '<Route path="/admin/supabase-monitoring" element={<ManagerRoute><SupabaseMonitoring /></ManagerRoute>} />'
    );
  });

  it('should_connect_SuperAdmin_to_executive_metrics_and_enterprise_governance_tables', () => {
    const superAdminSource = readFileSync(resolve(process.cwd(), 'pages/SuperAdmin.tsx'), 'utf8');

    expect(superAdminSource).toContain('calculateExecutiveBillingMetrics');
    expect(superAdminSource).toContain('listEnterpriseAuditLogs');
    expect(superAdminSource).toContain('listEnterpriseDataExports');
    expect(superAdminSource).toContain("navigate('/admin/supabase-monitoring')");
  });
});
