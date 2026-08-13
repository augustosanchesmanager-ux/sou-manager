import { test, expect, type Page } from '@playwright/test';
import { createConfirmedUser, deleteUserByEmail, getAdminClient } from '../helpers/supabaseAdmin';
import { signInAsUser } from '../helpers/supabaseUser';

/**
 * H-4 Billing/Lifecycle — matriz de estados ADR-013 (D-6.0.5-1/2, D-6.0.5.4-*)
 *
 * Requires REAL Supabase (tenant E2E isolado — D-HOM-19). Gate: E2E_PROVISIONING=1
 *
 * Executa os checks H4-1..H4-9 em tenant de teste isolado (NUNCA no tenant real):
 *   H4-1  active: acesso pleno (sem banner)
 *   H4-2  past_due: restrito read-only + banner (D-6.0.5-1); escrita DB NÃO bloqueada
 *         (by design — grace; enforcement de escrita na UI é gap registrado, não testado como PASS)
 *   H4-3  suspended: acesso bloqueado (/pending-approval) + evento TenantSubscriptionSuspended
 *   H4-4  reactivation: acesso restaurado + evento TenantSubscriptionReactivated
 *   H4-5  cancel_at_period_end: pedido registrado + efetivação (cancelled)
 *   H4-6  billing engine: invoice (idempotente) + record_payment_attempt (status válidos)
 *   H4-7  limites por plano (max_staff pro=5): 3 staff → invite1(4) OK, invite2(5) OK, invite3(6) bloqueado
 *   H4-8  change_tenant_plan (upgrade/downgrade espelho) + feature indisponível (UpgradePrompt)
 *   H4-9  runCycle grace: past_due grace expirado é candidata (get_due_subscriptions) → suspend; fail-fast
 *
 * Estado é SEMEADO via service role (padrão globalSetup/flow14), RPCs dirigidas por
 * sessões de usuário real (signInAsUser): manager (staff id=userId) e superadmin
 * (profiles.role='superadmin' em tenant OPS isolado).
 *
 * OBS (raízes corrigidas vs execução ad hoc anterior):
 *   - Seed: após insert de profiles, o trigger handle_new_manager_profile cria staff
 *     com id GERADO (superadmin→owner). Sem limpeza, o tenant acumula 5 staff ativos e
 *     o invite3 falha cedo. Aqui: DELETE staff/user_tenants pós-trigger + inserts explícitos (3 staff).
 *   - H4-3: apply_subscription_transition NÃO grava eventos; suspend_subscription (superadmin) grava.
 *   - H4-6b: CHECK aceita 'pending'|'success'|'failed' — o status 'succeeded' (usado antes) é
 *     inválido por contrato; aqui é teste NEGATIVO documentado (23514), não bug de schema.
 *   - H4-2e: escrita em past_due não é bloqueada no DB (RLS por role/tenant) nem na UI
 *     (banner cosmético). O check valida "sem bloqueio + aviso presente" e REGISTRA o gap.
 */
const enabled = process.env.E2E_PROVISIONING === '1';
const PASSWORD = 'E2e-H4-2026!';
const runId = Date.now();

const emails = {
  manager: `e2e-h4-${runId}-manager@gmail.com`,
  barber1: `e2e-h4-${runId}-barber1@gmail.com`,
  barber2: `e2e-h4-${runId}-barber2@gmail.com`,
  superadmin: `e2e-h4-${runId}-superadmin@gmail.com`,
};

test.describe.configure({ mode: 'serial' });

test.describe('H4 — Billing/Lifecycle matrix (ADR-013)', () => {
  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  let tenantId = '';
  let opsTenantId = '';
  let subscriptionId = '';
  let managerEmail = '';
  let superadminEmail = '';

  // Sessões reais (auth.uid() <> null) para os RPCs SECURITY DEFINER.
  let manager: Awaited<ReturnType<typeof signInAsUser>> | null = null;
  let superadmin: Awaited<ReturnType<typeof signInAsUser>> | null = null;

  async function loginAs(page: Page, email: string): Promise<void> {
    await page.goto('/#/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
  }

  function managerClient(): NonNullable<typeof manager> {
    if (!manager) throw new Error('manager session not ready');
    return manager;
  }

  function superadminClient(): NonNullable<typeof superadmin> {
    if (!superadmin) throw new Error('superadmin session not ready');
    return superadmin;
  }

  async function tenantStatus(): Promise<string> {
    const admin = getAdminClient();
    const { data, error } = await admin.from('tenants').select('status').eq('id', tenantId).single();
    if (error) throw new Error(`admin tenants read failed: ${error.message}`);
    return (data as { status: string }).status;
  }

  async function subscriptionRow(): Promise<{ status: string; grace_ends_at: string | null }> {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('subscriptions')
      .select('status, grace_ends_at')
      .eq('id', subscriptionId)
      .single();
    if (error) throw new Error(`admin subscriptions read failed: ${error.message}`);
    return data as { status: string; grace_ends_at: string | null };
  }

  async function billingEvents(): Promise<string[]> {
    const admin = getAdminClient();
    const { data, error } = await admin.from('billing_events').select('event_type').eq('tenant_id', tenantId);
    if (error) throw new Error(`admin billing_events read failed: ${error.message}`);
    return (data as { event_type: string }[]).map((e) => e.event_type);
  }

  // Transition via RPC oficial de persistência (superadmin ou gestor).
  async function transition(status: string, graceDays?: number): Promise<void> {
    const params: Record<string, unknown> = {
      p_subscription_id: subscriptionId,
      p_status: status,
    };
    if (graceDays !== undefined) {
      params.p_grace_ends_at = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000).toISOString();
    }
    const res = await managerClient().rpc('apply_subscription_transition', params).single();
    if (res.error) throw new Error(`transition('${status}') failed: ${res.error.message}`);
  }

  test.beforeAll(async () => {
    if (!enabled) return;
    const admin = getAdminClient();

    // 1. Usuários confirmados via Admin API.
    const userIds = {
      manager: await createConfirmedUser({ email: emails.manager, password: PASSWORD, userMetadata: { first_name: 'H4', last_name: 'Manager' } }),
      barber1: await createConfirmedUser({ email: emails.barber1, password: PASSWORD, userMetadata: { first_name: 'H4', last_name: 'Barber1' } }),
      barber2: await createConfirmedUser({ email: emails.barber2, password: PASSWORD, userMetadata: { first_name: 'H4', last_name: 'Barber2' } }),
      superadmin: await createConfirmedUser({ email: emails.superadmin, password: PASSWORD, userMetadata: { first_name: 'H4', last_name: 'Superadmin' } }),
    };
    managerEmail = emails.manager;
    superadminEmail = emails.superadmin;

    // 2. Tenants: H4 (alvo dos cenários) + OPS (isolamento do superadmin).
    const t = await admin
      .from('tenants')
      .insert({ name: `E2E H4 ${runId}`, slug: `e2e-h4-${runId}`, app_slug: 'barber', plan: 'pro', status: 'active' })
      .select('id')
      .single();
    if (t.error || !t.data) throw new Error(`seed tenants (H4) failed: ${t.error?.message}`);
    tenantId = (t.data as { id: string }).id;

    const ops = await admin
      .from('tenants')
      .insert({ name: `E2E H4 OPS ${runId}`, slug: `e2e-h4-ops-${runId}`, app_slug: 'barber', plan: 'pro', status: 'active' })
      .select('id')
      .single();
    if (ops.error || !ops.data) throw new Error(`seed tenants (OPS) failed: ${ops.error?.message}`);
    opsTenantId = (ops.data as { id: string }).id;

    // 3. Profiles (disparam triggers: handle_new_manager_profile + sync_profile_to_user_tenants).
    const { error: profilesError } = await admin.from('profiles').insert([
      { id: userIds.manager, tenant_id: tenantId, full_name: 'H4 Manager', role: 'manager', status: 'active', onboarding_completed: true },
      { id: userIds.barber1, tenant_id: tenantId, full_name: 'H4 Barber1', role: 'barber', status: 'active', onboarding_completed: true },
      { id: userIds.barber2, tenant_id: tenantId, full_name: 'H4 Barber2', role: 'barber', status: 'active', onboarding_completed: true },
      { id: userIds.superadmin, tenant_id: opsTenantId, full_name: 'H4 Superadmin', role: 'superadmin', status: 'active', onboarding_completed: true },
    ]);
    if (profilesError) throw new Error(`seed profiles failed: ${profilesError.message}`);

    // 4. Limpa linhas criadas por trigger (RAIZ H4-7) e insere o seed DETERMINÍSTICO:
    //    user_tenants + staff explícitos. H4 = 3 staff (manager id=userId + 2 barbers).
    for (const tid of [tenantId, opsTenantId]) {
      await admin.from('staff').delete().eq('tenant_id', tid);
      await admin.from('user_tenants').delete().eq('tenant_id', tid);
    }

    const { error: membershipsError } = await admin.from('user_tenants').insert([
      { user_id: userIds.manager, tenant_id: tenantId, role: 'manager', is_primary: true },
      { user_id: userIds.barber1, tenant_id: tenantId, role: 'barber', is_primary: false },
      { user_id: userIds.barber2, tenant_id: tenantId, role: 'barber', is_primary: false },
      { user_id: userIds.superadmin, tenant_id: opsTenantId, role: 'superadmin', is_primary: true },
    ]);
    if (membershipsError) throw new Error(`seed user_tenants failed: ${membershipsError.message}`);

    const { error: staffError } = await admin.from('staff').insert([
      { id: userIds.manager, name: 'H4 Manager', email: emails.manager, phone: '', role: 'manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantId },
      { id: userIds.barber1, name: 'H4 Barber1', email: emails.barber1, phone: '', role: 'barber', avatar: '', commission_rate: 40, status: 'active', tenant_id: tenantId },
      { id: userIds.barber2, name: 'H4 Barber2', email: emails.barber2, phone: '', role: 'barber', avatar: '', commission_rate: 40, status: 'active', tenant_id: tenantId },
      { id: userIds.superadmin, name: 'H4 Superadmin', email: emails.superadmin, phone: '', role: 'owner', avatar: '', commission_rate: 0, status: 'active', tenant_id: opsTenantId },
    ]);
    if (staffError) throw new Error(`seed staff failed: ${staffError.message}`);

    // 5. Subscription ativa do tenant H4 (pro).
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

    // 6. Config mínima do tenant (chair_count) para o Layout renderizar.
    const { error: settingsError } = await admin
      .from('tenant_settings')
      .upsert({ tenant_id: tenantId, chair_count: 2 }, { onConflict: 'tenant_id' });
    if (settingsError) throw new Error(`seed tenant_settings failed: ${settingsError.message}`);

    // 7. Sessões reais para dirigir os RPCs.
    manager = await signInAsUser(emails.manager, PASSWORD);
    superadmin = await signInAsUser(emails.superadmin, PASSWORD);

    console.log(`[h4] seeded tenant ${tenantId} (sub ${subscriptionId}) — staff count asserted later`);
  });

  test('H4-1 active: acesso pleno', async ({ page }) => {
    test.setTimeout(120_000);

    expect(await tenantStatus()).toBe('active');
    const row = await subscriptionRow();
    expect(row.status).toBe('active');

    await loginAs(page, managerEmail);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/dashboard/);

    // Sem banner em active.
    await expect(page.getByText('Pagamento em atraso')).toHaveCount(0, { timeout: 10_000 });
  });

  test('H4-2 past_due: restricted read-only + banner (D-6.0.5-1)', async ({ page }) => {
    test.setTimeout(120_000);

    // H4-2a/b: transição oficial -> past_due com janela de graça futura (3d).
    await transition('past_due', 3);
    const row = await subscriptionRow();
    expect(row.status).toBe('past_due');
    const graceMs = new Date(row.grace_ends_at as string).getTime() - Date.now();
    expect(graceMs).toBeGreaterThan(0);
    expect(graceMs).toBeLessThanOrEqual(5 * 24 * 60 * 60 * 1000); // GRACE_PERIOD_DAYS=5

    // H4-2c: espelho do tenant.
    expect(await tenantStatus()).toBe('past_due');

    // H4-2d: banner global de aviso (raiz: race de timing → waitFor explícito + screenshot).
    await loginAs(page, managerEmail);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/dashboard/);
    const banner = page.getByText('Pagamento em atraso');
    try {
      await expect(banner).toBeVisible({ timeout: 20_000 });
    } catch (err) {
      const body = await page.locator('body').innerText().catch(() => '');
      const url = page.url();
      await page.screenshot({ path: `test-results/h4-2d-banner-fail-${runId}.png`, fullPage: true });
      console.error(`[h4-2d] banner not visible. url=${url}\nbody=${body.slice(0, 2000)}`);
      throw err;
    }
    await page.screenshot({ path: `test-results/h4-2d-past-due-banner-${runId}.png` });

    // H4-2e: escrita no DB NÃO bloqueada em past_due (by design — janela de graça;
    // RLS é por role/tenant, não por status). Prova empírica p/ o achado:
    // enforcement de escrita na UI (D-6.0.5-1 read-only) NÃO está implementado (gap).
    const { error: writeError } = await managerClient()
      .from('clients')
      .insert({ tenant_id: tenantId, name: 'H4 PastDue Write Probe', phone: '11999990000', email: 'h4-pastdue@test.local', status: 'active' });
    expect(writeError).toBeNull();
  });

  test('H4-3 suspended: acesso bloqueado + evento (D-6.0.5.4)', async ({ page }) => {
    test.setTimeout(120_000);

    // RPC oficial de superadmin (grava TenantSubscriptionSuspended) — raiz corrigida.
    const res = await superadminClient().rpc('suspend_subscription', { p_subscription_id: subscriptionId }).single();
    if (res.error) throw new Error(`suspend_subscription failed: ${res.error.message}`);
    expect((res.data as { status: string }).status).toBe('suspended');

    const row = await subscriptionRow();
    expect(row.status).toBe('suspended');
    expect(row.grace_ends_at).toBeNull(); // D-6.0.5.4-5: grace limpo ao sair de past_due

    expect(await tenantStatus()).toBe('suspended');

    const events = await billingEvents();
    expect(events).toContain('TenantSubscriptionSuspended');

    // UI: acesso bloqueado → /pending-approval.
    await loginAs(page, managerEmail);
    await page.waitForURL(/#\/pending-approval/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/pending-approval/);
  });

  test('H4-4 reactivation: acesso restaurado + evento (D-6.0.5.4-2)', async ({ page }) => {
    test.setTimeout(120_000);

    const res = await superadminClient().rpc('reactivate_subscription', { p_subscription_id: subscriptionId }).single();
    if (res.error) throw new Error(`reactivate_subscription failed: ${res.error.message}`);
    expect((res.data as { status: string }).status).toBe('active');

    expect((await subscriptionRow()).status).toBe('active');
    expect(await tenantStatus()).toBe('active');

    const events = await billingEvents();
    expect(events).toContain('TenantSubscriptionReactivated');

    await loginAs(page, managerEmail);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/dashboard/);
  });

  test('H4-5 cancel_at_period_end: pedido + efetivação', async ({ page }) => {
    test.setTimeout(120_000);

    // H4-5a: pedido (cancel_subscription) — status MANTIDO, cancel_at_period_end = fim do período.
    const req = await managerClient().rpc('cancel_subscription', { p_tenant_id: tenantId }).single();
    if (req.error) throw new Error(`cancel_subscription failed: ${req.error.message}`);
    const sub = req.data as { status: string; current_period_end: string; cancel_at_period_end: string | null };
    expect(sub.status).toBe('active');
    expect(sub.cancel_at_period_end).toBe(sub.current_period_end);
    expect(await tenantStatus()).toBe('active');

    const events = await billingEvents();
    expect(events).toContain('TenantSubscriptionCancellationRequested');

    // H4-5b: efetivação pelo engine (finalize_cancellation -> apply ... 'cancelled').
    await transition('cancelled');
    const cancelled = await subscriptionRow();
    expect(cancelled.status).toBe('cancelled');
    expect(await tenantStatus()).toBe('cancelled');

    // H4-5c: acesso mantido (somente leitura, D-6.0.5-2 — sem redirect).
    await loginAs(page, managerEmail);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/dashboard/);
    await expect(page.getByText('Assinatura cancelada')).toBeVisible({ timeout: 20_000 });

    // Restaura active para os checks seguintes (caminho de persistência p/ teste),
    // limpando o pedido de cancelamento (não grava evento — transição fina).
    const restore = await managerClient()
      .rpc('apply_subscription_transition', {
        p_subscription_id: subscriptionId,
        p_status: 'active',
        p_clear_cancel_request: true,
      })
      .single();
    if (restore.error) throw new Error(`restore active failed: ${restore.error.message}`);
    expect((restore.data as { cancel_at_period_end: string | null }).cancel_at_period_end).toBeNull();
    expect((await subscriptionRow()).status).toBe('active');
  });

  test('H4-6 billing engine: invoice idempotente + payment attempt', async () => {
    test.setTimeout(120_000);

    // H4-6a: create_invoice (persistência do runCycle) + idempotência por chave.
    const invoiceParams = {
      p_subscription_id: subscriptionId,
      p_tenant_id: tenantId,
      p_amount: 99.9,
      p_due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      p_billing_period_start: new Date().toISOString(),
      p_billing_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      p_idempotency_key: `h4-invoice-${runId}`,
    };
    const inv = await managerClient().rpc('create_invoice', invoiceParams).single();
    if (inv.error) throw new Error(`create_invoice failed: ${inv.error.message}`);
    const invoice = inv.data as { id: string; status: string; amount: number };
    expect(invoice.status).toBe('issued');
    expect(Number(invoice.amount)).toBe(99.9);

    const invAgain = await managerClient().rpc('create_invoice', invoiceParams).single();
    if (invAgain.error) throw new Error(`create_invoice (idempotency) failed: ${invAgain.error.message}`);
    expect((invAgain.data as { id: string }).id).toBe(invoice.id);

    // H4-6b: record_payment_attempt — statuses VÁLIDOS (CHECK pending|success|failed).
    //   (O status 'succeeded' usado na execução anterior é INVALIDO por contrato — teste negativo.)
    const ok = await managerClient()
      .rpc('record_payment_attempt', { p_invoice_id: invoice.id, p_tenant_id: tenantId, p_status: 'success', p_provider: 'manual-test' })
      .single();
    if (ok.error) throw new Error(`record_payment_attempt('success') failed: ${ok.error.message}`);
    expect((ok.data as { status: string }).status).toBe('success');

    const failed = await managerClient()
      .rpc('record_payment_attempt', { p_invoice_id: invoice.id, p_tenant_id: tenantId, p_status: 'failed', p_provider: 'manual-test', p_error: 'card_declined' })
      .single();
    if (failed.error) throw new Error(`record_payment_attempt('failed') failed: ${failed.error.message}`);
    expect((failed.data as { status: string }).status).toBe('failed');

    const invalid = await managerClient()
      .rpc('record_payment_attempt', { p_invoice_id: invoice.id, p_tenant_id: tenantId, p_status: 'succeeded' })
      .single();
    expect(invalid.error).toBeTruthy();
    expect(String(invalid.error?.code)).toBe('23514');
    expect(String(invalid.error?.message)).toContain('payment_attempts_status_check');

    // mark_invoice_paid → paid (idempotente).
    const paid = await managerClient().rpc('mark_invoice_paid', { p_invoice_id: invoice.id }).single();
    if (paid.error) throw new Error(`mark_invoice_paid failed: ${paid.error.message}`);
    expect((paid.data as { status: string }).status).toBe('paid');
  });

  test('H4-7 limites por plano (max_staff pro=5)', async () => {
    test.setTimeout(120_000);

    const admin = getAdminClient();
    const { count: activeStaff } = await admin
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active');
    expect(activeStaff).toBe(3);

    const invite = async (n: number) =>
      managerClient()
        .rpc('invite_team_member', { p_tenant_id: tenantId, p_email: `h4-invite-${runId}-${n}@test.local`, p_role: 'barber' })
        .single();

    // invite1 → total 4 (< 5) OK; invite2 → total 5 (= 5) OK; invite3 → total 6 bloqueado.
    const invite1 = await invite(1);
    expect(invite1.error).toBeNull();
    const invite2 = await invite(2);
    expect(invite2.error).toBeNull();
    const invite3 = await invite(3);
    expect(invite3.error).toBeTruthy();
    expect(String(invite3.error?.message)).toContain('Team limit reached');

    // D2: apenas barber/receptionist são convidáveis.
    const invalidRole = await managerClient()
      .rpc('invite_team_member', { p_tenant_id: tenantId, p_email: `h4-invite-${runId}-admin@test.local`, p_role: 'manager' })
      .single();
    expect(invalidRole.error).toBeTruthy();
    expect(String(invalidRole.error?.message)).toContain('Invalid invite role');

    const { data: pending } = await admin
      .from('team_invitations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending');
    expect((pending as unknown[]).length).toBe(2);
  });

  test('H4-8 change_tenant_plan + feature indisponível (UpgradePrompt)', async ({ page }) => {
    test.setTimeout(120_000);

    const admin = getAdminClient();

    // H4-8a: downgrade free (single writer transacional + evento).
    const down = await superadminClient().rpc('change_tenant_plan', { p_tenant_id: tenantId, p_plan: 'free', p_reason: 'H4-test-downgrade' }).single();
    if (down.error) throw new Error(`change_tenant_plan(free) failed: ${down.error.message}`);

    const tenantRow = await admin.from('tenants').select('plan').eq('id', tenantId).single();
    expect((tenantRow.data as { plan: string }).plan).toBe('free');
    const subRow = await admin.from('subscriptions').select('plan').eq('id', subscriptionId).single();
    expect((subRow.data as { plan: string }).plan).toBe('free');
    expect(await billingEvents()).toContain('TenantPlanChanged');

    // Limite free (max_staff=1): 3 staff ativos → invite bloqueado.
    const freeInvite = await managerClient()
      .rpc('invite_team_member', { p_tenant_id: tenantId, p_email: `h4-invite-${runId}-free@test.local`, p_role: 'barber' })
      .single();
    expect(freeInvite.error).toBeTruthy();
    expect(String(freeInvite.error?.message)).toContain('Team limit reached');

    // H4-8b: chef_club indisponível no free → UpgradePrompt (nunca 403).
    await loginAs(page, managerEmail);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/dashboard/);
    await page.goto('/#/chef-club-plans');
    await expect(page.getByText(/não está disponível no plano atual/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Ver Meu Plano' })).toBeVisible();
    await page.screenshot({ path: `test-results/h4-8b-upgrade-prompt-${runId}.png` });

    // H4-8c: restore pro → espelho + chef_club volta a renderizar (sem UpgradePrompt).
    const up = await superadminClient().rpc('change_tenant_plan', { p_tenant_id: tenantId, p_plan: 'pro', p_reason: 'H4-test-restore' }).single();
    if (up.error) throw new Error(`change_tenant_plan(pro) failed: ${up.error.message}`);

    const tenantRow2 = await admin.from('tenants').select('plan').eq('id', tenantId).single();
    expect((tenantRow2.data as { plan: string }).plan).toBe('pro');
    const subRow2 = await admin.from('subscriptions').select('plan').eq('id', subscriptionId).single();
    expect((subRow2.data as { plan: string }).plan).toBe('pro');

    await page.reload();
    await page.goto('/#/chef-club-plans');
    await expect(page.getByText(/não está disponível no plano atual/)).toHaveCount(0, { timeout: 20_000 });
  });

  test('H4-9 runCycle grace window: past_due grace expirado → suspensão + fail-fast', async () => {
    test.setTimeout(120_000);

    // Candidata do runCycle: past_due com grace expirado (get_due_subscriptions).
    await transition('past_due', -1); // grace_ends_at = agora - 1 dia
    const due = await managerClient().rpc('get_due_subscriptions', { p_as_of: new Date().toISOString() });
    if (due.error) throw new Error(`get_due_subscriptions failed: ${due.error.message}`);
    const candidates = (due.data as { id: string; status: string; grace_ends_at: string | null }[]).filter(
      (r) => r.id === subscriptionId,
    );
    expect(candidates.length).toBe(1);
    expect(candidates[0].status).toBe('past_due');
    expect(candidates[0].grace_ends_at).toBeTruthy(); // grace expirado devolvido — input do engine

    // Decisão do runCycle (past_due + grace expirado → suspend) via RPC oficial.
    const suspended = await superadminClient().rpc('suspend_subscription', { p_subscription_id: subscriptionId }).single();
    if (suspended.error) throw new Error(`suspend_subscription (grace) failed: ${suspended.error.message}`);
    expect((suspended.data as { status: string }).status).toBe('suspended');
    expect(await tenantStatus()).toBe('suspended');

    // Fail-fast da matriz ADR-013 §5.2: suspend só é válido a partir de past_due.
    await transition('active');
    const denied = await superadminClient().rpc('suspend_subscription', { p_subscription_id: subscriptionId }).single();
    expect(denied.error).toBeTruthy();
    expect(String(denied.error?.message)).toContain('Invalid transition: cannot suspend subscription in status active');
  });

  test.afterAll(async () => {
    if (!enabled) return;
    const admin = getAdminClient();
    try {
      for (const tid of [tenantId, opsTenantId]) {
        if (!tid) continue;
        await admin.from('billing_events').delete().eq('tenant_id', tid);
        await admin.from('payment_attempts').delete().eq('tenant_id', tid);
        await admin.from('invoices').delete().eq('tenant_id', tid);
        await admin.from('team_invitations').delete().eq('tenant_id', tid);
        await admin.from('subscriptions').delete().eq('tenant_id', tid);
        await admin.from('clients').delete().eq('tenant_id', tid);
        await admin.from('staff').delete().eq('tenant_id', tid);
        await admin.from('user_tenants').delete().eq('tenant_id', tid);
        await admin.from('tenant_settings').delete().eq('tenant_id', tid);
        await admin.from('tenants').delete().eq('id', tid);
      }
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(email);
      }
      console.log('[h4] teardown complete');
    } catch (err) {
      console.warn('[h4] teardown failed (tenants left for operator cleanup):', err);
    }
  });
});
