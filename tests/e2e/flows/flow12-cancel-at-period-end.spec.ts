import { test, expect } from '@playwright/test';
import { createConfirmedUser, deleteUserByEmail, getAdminClient } from '../helpers/supabaseAdmin';
import { signInAsUser } from '../helpers/supabaseUser';

/**
 * FLOW 12: Cancelamento — cancel_at_period_end → acesso mantido → efetivação (6.0.4.4)
 *
 * Requires REAL Supabase. Gate: E2E_PROVISIONING=1
 *
 * Cobre o contrato D-A aprovado pelo PO:
 *   1. cancel_subscription() = PEDIDO: marca cancel_at_period_end = fim do
 *      período contratado, NÃO altera status e NÃO altera tenants.status
 *      (acesso mantido até o fim do período).
 *   2. Idempotência: re-cancelamento não sobrescreve cancel_at_period_end.
 *   3. Trilha operacional: billing_events registra TenantSubscriptionCancelled
 *      Requested.
 *   4. Efetivação pelo ENGINE (aqui simulada pela RPC fina de persistência
 *      apply_subscription_transition — a decisão é do BillingService.runCycle,
 *      coberta por testes unitários): subscription -> cancelled + tenant -> cancelled.
 *
 * O tenant é semeado diretamente (via service role) para isolar o ciclo de
 * cancelamento; a limpeza remove todas as linhas do tenant no afterEach.
 */
const enabled = process.env.E2E_PROVISIONING === '1';

test.describe('Flow 12 — Cancel at Period End (Phase 6.0.4.4)', () => {
  const email = `e2e-flow12-${Date.now()}@gmail.com`;
  const password = 'E2e-Flow12-2026!';
  const runId = Date.now();

  let tenantId = '';
  let subscriptionId = '';

  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  test.beforeEach(async () => {
    if (!enabled) return;
    const admin = getAdminClient();

    // Manager user (confirmed, no shop_name -> no pendingRegistration).
    const userId = await createConfirmedUser({
      email,
      password,
      userMetadata: { first_name: 'E2E', last_name: 'Flow12' },
    });
    expect(userId).toBeTruthy();

    // Tenant activo (pro) + subscription ativa (período corrente até +30d).
    const tenant = await admin
      .from('tenants')
      .insert({ name: `E2E Flow12 ${runId}`, slug: `e2e-flow12-${runId}`, app_slug: 'barber', plan: 'pro', status: 'active' })
      .select('id')
      .single();
    if (tenant.error || !tenant.data) throw new Error(`seed tenants failed: ${tenant.error?.message}`);
    tenantId = (tenant.data as { id: string }).id;

    // user_tenants é criado automaticamente pelo trigger sync_profile_to_user_tenants
    // (AFTER INSERT em profiles) com role do profile + is_primary=true — NÃO inserir
    // manualmente, senão viola user_tenants_user_id_tenant_id_key.
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      tenant_id: tenantId,
      full_name: 'E2E Flow12 Manager',
      role: 'manager',
      status: 'active',
      onboarding_completed: true,
    });
    if (profileError) throw new Error(`seed profile failed: ${profileError.message}`);

    const { error: staffError } = await admin.from('staff').insert({
      id: userId,
      name: 'E2E Flow12 Manager',
      email,
      phone: '',
      role: 'manager',
      avatar: '',
      commission_rate: 0,
      status: 'active',
      tenant_id: tenantId,
    });
    if (staffError) throw new Error(`seed staff failed: ${staffError.message}`);

    const sub = await admin
      .from('subscriptions')
      .insert({
        tenant_id: tenantId,
        plan: 'pro',
        status: 'active',
        trial_started_at: null,
        trial_ends_at: null,
        current_period_start: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        current_period_end: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();
    if (sub.error || !sub.data) throw new Error(`seed subscriptions failed: ${sub.error?.message}`);
    subscriptionId = (sub.data as { id: string }).id;
  });

  test('cancel = pedido (acesso mantido) -> efetivação pelo engine', async ({ page }) => {
    test.setTimeout(120_000);

    // Login via UI valida que o acesso é mantido mesmo com pedido de cancelamento.
    await page.goto('/#/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/dashboard/);

    const manager = await signInAsUser(email, password);
    const admin = getAdminClient();

    // 1. PEDIDO de cancelamento (D-A): status NÃO muda.
    const cancelled = await manager.rpc('cancel_subscription', { p_tenant_id: tenantId }).single();
    if (cancelled.error) throw new Error(`cancel_subscription failed: ${cancelled.error.message}`);
    const row = cancelled.data as {
      id: string;
      status: string;
      current_period_end: string;
      cancel_at_period_end: string | null;
    };
    expect(row.id).toBe(subscriptionId);
    expect(row.status).toBe('active'); // acesso mantido
    expect(row.cancel_at_period_end).toBe(row.current_period_end); // pedido = fim do período

    const tenantAfterCancel = await admin.from('tenants').select('status').eq('id', tenantId).single();
    if (tenantAfterCancel.error) throw new Error(`admin tenants read failed: ${tenantAfterCancel.error.message}`);
    expect((tenantAfterCancel.data as { status: string }).status).toBe('active'); // tenant NÃO cancela

    // 2. Idempotência: re-cancelamento não sobrescreve cancel_at_period_end.
    const again = await manager.rpc('cancel_subscription', { p_tenant_id: tenantId }).single();
    if (again.error) throw new Error(`cancel_subscription re-run failed: ${again.error.message}`);
    expect((again.data as { cancel_at_period_end: string | null }).cancel_at_period_end).toBe(row.cancel_at_period_end);

    // 3. Trilha operacional em billing_events.
    const events = await admin
      .from('billing_events')
      .select('event_type, payload')
      .eq('tenant_id', tenantId);
    if (events.error) throw new Error(`billing_events read failed: ${events.error.message}`);
    const types = (events.data as { event_type: string }[]).map((e) => e.event_type);
    expect(types).toContain('TenantSubscriptionCancellationRequested');
    expect(types).not.toContain('TenantSubscriptionCancelled'); // efetivação ainda não ocorreu

    // 4. Efetivação (o que o BillingService.runCycle faria ao atingir o fim do
    //    período): apply_subscription_transition é a RPC de persistência fina.
    const finalized = await manager
      .rpc('apply_subscription_transition', {
        p_subscription_id: subscriptionId,
        p_status: 'cancelled',
        p_canceled_at: new Date().toISOString(),
      })
      .single();
    if (finalized.error) throw new Error(`apply_subscription_transition failed: ${finalized.error.message}`);
    expect((finalized.data as { status: string }).status).toBe('cancelled');

    const tenantFinal = await admin.from('tenants').select('status').eq('id', tenantId).single();
    if (tenantFinal.error) throw new Error(`admin tenants read (final) failed: ${tenantFinal.error.message}`);
    expect((tenantFinal.data as { status: string }).status).toBe('cancelled');
  });

  test.afterEach(async () => {
    if (!enabled) return;
    try {
      const admin = getAdminClient();
      if (tenantId) {
        await admin.from('billing_events').delete().eq('tenant_id', tenantId);
        await admin.from('payment_attempts').delete().eq('tenant_id', tenantId);
        await admin.from('invoices').delete().eq('tenant_id', tenantId);
        await admin.from('subscriptions').delete().eq('tenant_id', tenantId);
        await admin.from('staff').delete().eq('tenant_id', tenantId);
        await admin.from('user_tenants').delete().eq('tenant_id', tenantId);
        await admin.from('tenant_settings').delete().eq('tenant_id', tenantId);
        await admin.from('tenants').delete().eq('id', tenantId);
      }
      await deleteUserByEmail(email);
    } catch (err) {
      console.warn(`[flow12] cleanup failed for ${email}:`, err);
    }
  });
});
