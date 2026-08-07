import { test, expect } from '@playwright/test';
import { createConfirmedUser, deleteUserByEmail, getAdminClient } from '../helpers/supabaseAdmin';
import { signInAsUser } from '../helpers/supabaseUser';

/**
 * FLOW 14: Ciclo past_due → suspended → active (6.0.5.4)
 *
 * Requires REAL Supabase. Gate: E2E_PROVISIONING=1
 *
 * Cobre o contrato D-A aprovado pelo PO (D-6.0.5.4-1..5) e o critério E2E da
 * Entry Audit (PHASE_6_0_5_4_ENTRY_AUDIT.md §7):
 *   1. Candidata à suspensão: `get_due_subscriptions(asOf)` devolve
 *      `grace_ends_at` e inclui `past_due` com grace expirado (D-6.0.5.4-5).
 *   2. Guarda superadmin: `suspend_subscription`/`reactivate_subscription` são
 *      RPCs manuais de superadmin (D-6.0.5-4) — manager recebe erro.
 *   3. Suspensão pelo ENGINE (decisão do BillingService.runCycle coberta por
 *      testes unitários; aqui simulada pela RPC fina de persistência
 *      `apply_subscription_transition`) -> subscription + tenant `suspended`
 *      e `grace_ends_at` limpo (D-6.0.5.4-5).
 *   4. Idempotência da transição `suspended`.
 *   5. Reativação (persistência usada por `markPaid`/`reactivate_subscription`)
 *      -> subscription + tenant `active` (acesso restaurado).
 *
 * O tenant é semeado diretamente (via service role) para isolar o ciclo; a
 * limpeza remove todas as linhas do tenant no afterEach (padrão flow12).
 *
 * NOTA (janela única): o estado `suspended` chega a `tenants.status`, que é o
 * input do Estado Efetivo (EffectiveState -> `none`, unit-tested em
 * domain/authorization/accessPolicy) e das flags (tenant_has_feature false para
 * suspended/archived, 6.0.5.3). A checagem funcional dessas duas camadas no
 * Supabase real depende das migrations 07010000 (esta fase) e 07000000 (6.0.5.3,
 * pendente na janela única) — este flow valida o ciclo de estado ponta a ponta.
 */
const enabled = process.env.E2E_PROVISIONING === '1';

test.describe('Flow 14 — past_due → suspended → active (Phase 6.0.5.4)', () => {
  const email = `e2e-flow14-${Date.now()}@gmail.com`;
  const password = 'E2e-Flow14-2026!';
  const runId = Date.now();

  let tenantId = '';
  let subscriptionId = '';

  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  test.beforeEach(async () => {
    if (!enabled) return;
    const admin = getAdminClient();

    const userId = await createConfirmedUser({
      email,
      password,
      userMetadata: { first_name: 'E2E', last_name: 'Flow14' },
    });
    expect(userId).toBeTruthy();

    // Tenant em past_due (grace expirado — o estado de entrada do ciclo).
    const tenant = await admin
      .from('tenants')
      .insert({ name: `E2E Flow14 ${runId}`, slug: `e2e-flow14-${runId}`, app_slug: 'barber', plan: 'pro', status: 'past_due' })
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
      full_name: 'E2E Flow14 Manager',
      role: 'manager',
      status: 'active',
      onboarding_completed: true,
    });
    if (profileError) throw new Error(`seed profile failed: ${profileError.message}`);

    const { error: staffError } = await admin.from('staff').insert({
      id: userId,
      name: 'E2E Flow14 Manager',
      email,
      phone: '',
      role: 'manager',
      avatar: '',
      commission_rate: 0,
      status: 'active',
      tenant_id: tenantId,
    });
    if (staffError) throw new Error(`seed staff failed: ${staffError.message}`);

    // Subscription past_due com grace_ends_at EXPIRADO (D-6.0.5.4-5):
    //   current_period_end no passado + grace_ends_at = agora - 1 dia.
    const sub = await admin
      .from('subscriptions')
      .insert({
        tenant_id: tenantId,
        plan: 'pro',
        status: 'past_due',
        trial_started_at: null,
        trial_ends_at: null,
        current_period_start: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        current_period_end: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        grace_ends_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();
    if (sub.error || !sub.data) throw new Error(`seed subscriptions failed: ${sub.error?.message}`);
    subscriptionId = (sub.data as { id: string }).id;
  });

  test('past_due (grace expirado) -> suspensão -> acesso restaurado (reativação)', async ({ page }) => {
    test.setTimeout(120_000);

    // Login via UI é permitido em past_due (restricted/read-only — D-6.0.5-1).
    await page.goto('/#/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/dashboard/);

    const manager = await signInAsUser(email, password);
    const admin = getAdminClient();

    // 1. Candidata à suspensão: get_due_subscriptions(asOf) devolve grace_ends_at
    //    e inclui a past_due com grace expirado (D-6.0.5.4-5 / entrada do engine).
    const due = await manager.rpc('get_due_subscriptions', { p_as_of: new Date().toISOString() });
    if (due.error) throw new Error(`get_due_subscriptions failed: ${due.error.message}`);
    const candidates = (due.data as { id: string; status: string; grace_ends_at: string | null }[]).filter(
      (r) => r.id === subscriptionId,
    );
    expect(candidates.length).toBe(1);
    expect(candidates[0].status).toBe('past_due');
    expect(candidates[0].grace_ends_at).toBeTruthy(); // grace expirado devolvido

    // 2. Guarda superadmin (D-6.0.5-4): manager NÃO consegue suspender via RPC manual.
    const denied = await manager.rpc('suspend_subscription', { p_subscription_id: subscriptionId }).single();
    expect(denied.error).toBeTruthy();
    expect(denied.error?.message).toContain('superadmin required');

    // 3. Suspensão pelo engine (decisão de runCycle coberta por testes unitários;
    //    aqui a RPC fina de persistência): subscription + tenant -> suspended,
    //    grace_ends_at limpo (D-6.0.5.4-5).
    const suspended = await manager
      .rpc('apply_subscription_transition', {
        p_subscription_id: subscriptionId,
        p_status: 'suspended',
      })
      .single();
    if (suspended.error) throw new Error(`apply_subscription_transition (suspended) failed: ${suspended.error.message}`);
    expect((suspended.data as { status: string; grace_ends_at: string | null }).status).toBe('suspended');
    expect((suspended.data as { grace_ends_at: string | null }).grace_ends_at).toBeNull();

    const tenantSuspended = await admin.from('tenants').select('status').eq('id', tenantId).single();
    if (tenantSuspended.error) throw new Error(`admin tenants read (suspended) failed: ${tenantSuspended.error.message}`);
    // Estado que o Estado Efetivo mapeia para accessLevel 'none' (unit-tested).
    expect((tenantSuspended.data as { status: string }).status).toBe('suspended');

    // 4. Idempotência: reaplicar a transição 'suspended' mantém o estado.
    const again = await manager
      .rpc('apply_subscription_transition', {
        p_subscription_id: subscriptionId,
        p_status: 'suspended',
      })
      .single();
    if (again.error) throw new Error(`apply_subscription_transition (re-suspend) failed: ${again.error.message}`);
    expect((again.data as { status: string }).status).toBe('suspended');

    // 5. Reativação (persistência usada por markPaid/reactivate_subscription):
    //    subscription + tenant -> active (acesso restaurado).
    const reactivated = await manager
      .rpc('apply_subscription_transition', {
        p_subscription_id: subscriptionId,
        p_status: 'active',
      })
      .single();
    if (reactivated.error) throw new Error(`apply_subscription_transition (active) failed: ${reactivated.error.message}`);
    expect((reactivated.data as { status: string }).status).toBe('active');

    const tenantFinal = await admin.from('tenants').select('status').eq('id', tenantId).single();
    if (tenantFinal.error) throw new Error(`admin tenants read (final) failed: ${tenantFinal.error.message}`);
    expect((tenantFinal.data as { status: string }).status).toBe('active');
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
      console.warn(`[flow14] cleanup failed for ${email}:`, err);
    }
  });
});
