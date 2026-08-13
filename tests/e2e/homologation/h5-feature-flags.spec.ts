import { test, expect, type Page } from '@playwright/test';
import { createConfirmedUser, deleteUserByEmail, getAdminClient } from '../helpers/supabaseAdmin';
import { signInAsUser } from '../helpers/supabaseUser';

/**
 * H-5 Feature Flags — matriz por plano + enforcement de UI (D-6.0.5.3-1..6)
 *
 * Requires REAL Supabase (tenant E2E isolado — D-HOM-19). Gate: E2E_PROVISIONING=1
 *
 * Executa os checks H5-1..H5-9 em tenant de teste isolado (NUNCA no tenant real):
 *   H5-1/2/3  matriz de flags por plano (free 14 / pro 15 / premium 20) via SQL
 *   H5-4      feature habilitada → acesso à rota/UI liberado
 *   H5-5      feature desabilitada → FeatureUnavailablePage ("não está disponível no plano atual")
 *   H5-6      UpgradePrompt (CTA "Ver Meu Plano") exibido quando aplicável
 *   H5-7      URL direta de feature desabilitada → bloqueio (UpgradePrompt, nunca 403)
 *   H5-8      (inspeção grep fora do spec — zero SELECT direto no frontend)
 *   H5-9      override por tenant (feature_flags, escrita superadmin) vence a matriz
 *             (A: premium + override false → bloqueia; B: free + override true → libera)
 *
 * Estado é SEMEADO via service role (padrão h4), RPCs dirigidas por sessões de
 * usuário real (signInAsUser): manager (staff id=userId) e superadmin
 * (profiles.role='superadmin' em tenant OPS isolado).
 *
 * Pontos de atenção (verificados na implementação):
 *   - Fonte de verdade = RPC `tenant_has_feature` (auth.uid(), SECURITY DEFINER,
 *     override > matriz plan_features > suspensão). A UI resolve flags via
 *     `useFeatureFlags` (cache por tenant|plan|status). Para validações de override
 *     (H5-9), o cache não muda quando o override muda → uso de page.goto pleno
 *     (recarga total → cache novo por sessão de página).
 *   - feature_flags NÃO possui policy SELECT para autenticados (D-6.0.5.3-6):
 *     escrita via superadmin (policy feature_flags_superadmin_all).
 */
const enabled = process.env.E2E_PROVISIONING === '1';
const PASSWORD = 'E2e-H5-2026!';
const runId = Date.now();

const emails = {
  manager: `e2e-h5-${runId}-manager@gmail.com`,
  superadmin: `e2e-h5-${runId}-superadmin@gmail.com`,
};

// Matriz congelada (FEATURE_FLAGS_MODEL §5 / seed 20260806090000) — espelho para o SQL check.
const MATRIX = {
  free: [
    'appointments', 'pos', 'clients', 'services', 'products', 'team',
    'dashboard', 'finance', 'cash_closing', 'commissions', 'receivables',
    'expenses', 'vouchers', 'promotions',
  ],
  pro: [
    'appointments', 'pos', 'clients', 'services', 'products', 'team',
    'dashboard', 'finance', 'cash_closing', 'commissions', 'receivables',
    'expenses', 'vouchers', 'promotions', 'chef_club',
  ],
  premium: [
    'appointments', 'pos', 'clients', 'services', 'products', 'team',
    'dashboard', 'finance', 'cash_closing', 'commissions', 'receivables',
    'expenses', 'vouchers', 'promotions', 'chef_club',
    'bi', 'api', 'whatsapp', 'marketplace', 'multi_unit',
  ],
};

test.describe.configure({ mode: 'serial' });

test.describe('H5 — Feature Flags matrix + UI enforcement (D-6.0.5.3)', () => {
  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  let tenantId = '';
  let opsTenantId = '';
  let managerEmail = '';
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

  async function tenantPlan(): Promise<string> {
    const admin = getAdminClient();
    const { data, error } = await admin.from('tenants').select('plan').eq('id', tenantId).single();
    if (error) throw new Error(`admin tenants read failed: ${error.message}`);
    return (data as { plan: string }).plan;
  }

  async function matrixRows(plan: string): Promise<string[]> {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('plan_features')
      .select('feature_key')
      .eq('plan_slug', plan);
    if (error) throw new Error(`plan_features read failed: ${error.message}`);
    return (data as { feature_key: string }[]).map((r) => r.feature_key).sort();
  }

  async function hasFeature(feature: string): Promise<boolean> {
    const { data, error } = await managerClient()
      .rpc('tenant_has_feature', { p_tenant_id: tenantId, p_feature: feature })
      .single();
    if (error) throw new Error(`tenant_has_feature('${feature}') failed: ${error.message}`);
    return data === true;
  }

  async function changePlan(plan: string, reason: string): Promise<void> {
    const res = await superadminClient()
      .rpc('change_tenant_plan', { p_tenant_id: tenantId, p_plan: plan, p_reason: reason })
      .single();
    if (res.error) throw new Error(`change_tenant_plan('${plan}') failed: ${res.error.message}`);
  }

  async function setOverride(feature: string, override: boolean): Promise<void> {
    const admin = getAdminClient();
    await admin.from('feature_flags').delete().eq('tenant_id', tenantId).eq('feature_key', feature);
    const { error } = await superadminClient().from('feature_flags').insert({
      tenant_id: tenantId,
      feature_key: feature,
      override,
      reason: 'H5-test-override',
    });
    if (error) throw new Error(`feature_flags insert failed: ${error.message}`);
  }

  test.beforeAll(async () => {
    if (!enabled) return;
    const admin = getAdminClient();

    const userIds = {
      manager: await createConfirmedUser({ email: emails.manager, password: PASSWORD, userMetadata: { first_name: 'H5', last_name: 'Manager' } }),
      superadmin: await createConfirmedUser({ email: emails.superadmin, password: PASSWORD, userMetadata: { first_name: 'H5', last_name: 'Superadmin' } }),
    };
    managerEmail = emails.manager;

    const t = await admin
      .from('tenants')
      .insert({ name: `E2E H5 ${runId}`, slug: `e2e-h5-${runId}`, app_slug: 'barber', plan: 'pro', status: 'active' })
      .select('id')
      .single();
    if (t.error || !t.data) throw new Error(`seed tenants (H5) failed: ${t.error?.message}`);
    tenantId = (t.data as { id: string }).id;

    const ops = await admin
      .from('tenants')
      .insert({ name: `E2E H5 OPS ${runId}`, slug: `e2e-h5-ops-${runId}`, app_slug: 'barber', plan: 'pro', status: 'active' })
      .select('id')
      .single();
    if (ops.error || !ops.data) throw new Error(`seed tenants (OPS) failed: ${ops.error?.message}`);
    opsTenantId = (ops.data as { id: string }).id;

    const { error: profilesError } = await admin.from('profiles').insert([
      { id: userIds.manager, tenant_id: tenantId, full_name: 'H5 Manager', role: 'manager', status: 'active', onboarding_completed: true },
      { id: userIds.superadmin, tenant_id: opsTenantId, full_name: 'H5 Superadmin', role: 'superadmin', status: 'active', onboarding_completed: true },
    ]);
    if (profilesError) throw new Error(`seed profiles failed: ${profilesError.message}`);

    for (const tid of [tenantId, opsTenantId]) {
      await admin.from('staff').delete().eq('tenant_id', tid);
      await admin.from('user_tenants').delete().eq('tenant_id', tid);
    }

    const { error: membershipsError } = await admin.from('user_tenants').insert([
      { user_id: userIds.manager, tenant_id: tenantId, role: 'manager', is_primary: true },
      { user_id: userIds.superadmin, tenant_id: opsTenantId, role: 'superadmin', is_primary: true },
    ]);
    if (membershipsError) throw new Error(`seed user_tenants failed: ${membershipsError.message}`);

    const { error: staffError } = await admin.from('staff').insert([
      { id: userIds.manager, name: 'H5 Manager', email: emails.manager, phone: '', role: 'manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantId },
      { id: userIds.superadmin, name: 'H5 Superadmin', email: emails.superadmin, phone: '', role: 'owner', avatar: '', commission_rate: 0, status: 'active', tenant_id: opsTenantId },
    ]);
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
    if (sub.error) throw new Error(`seed subscriptions failed: ${sub.error?.message}`);

    const { error: settingsError } = await admin
      .from('tenant_settings')
      .upsert({ tenant_id: tenantId, chair_count: 2 }, { onConflict: 'tenant_id' });
    if (settingsError) throw new Error(`seed tenant_settings failed: ${settingsError.message}`);

    manager = await signInAsUser(emails.manager, PASSWORD);
    superadmin = await signInAsUser(emails.superadmin, PASSWORD);

    console.log(`[h5] seeded tenant ${tenantId} (plan pro)`);
  });

  test('H5-1/2/3 matriz por plano: free 14 / pro 15 / premium 20', async () => {
    for (const plan of ['free', 'pro', 'premium'] as const) {
      const rows = await matrixRows(plan);
      expect(rows).toEqual([...MATRIX[plan]].sort());
      expect(rows.length).toBe(MATRIX[plan].length);
    }
    // Spot-check das flags de fronteira (Regra 2 — plano conhece as flags).
    const free = await matrixRows('free');
    expect(free).not.toContain('chef_club');
    expect(free).not.toContain('bi');
    const pro = await matrixRows('pro');
    expect(pro).toContain('chef_club');
    expect(pro).not.toContain('bi');
    const premium = await matrixRows('premium');
    expect(premium).toContain('chef_club');
    expect(premium).toContain('bi');
  });

  test('H5-4 feature habilitada (pro → chef_club): acesso à rota/UI liberado', async ({ page }) => {
    test.setTimeout(120_000);

    expect(await tenantPlan()).toBe('pro');
    expect(await hasFeature('chef_club')).toBe(true);

    await loginAs(page, managerEmail);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });

    await page.goto('/#/chef-club-plans');
    await expect(page.getByText(/não está disponível no plano atual/)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Novo plano' })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `test-results/h5-4-feature-enabled-${runId}.png` });
  });

  test('H5-5/6 feature desabilitada (free): FeatureUnavailablePage + UpgradePrompt', async ({ page }) => {
    test.setTimeout(120_000);

    // Downgrade free (single writer transacional — change_tenant_plan).
    await changePlan('free', 'H5-test-downgrade');
    expect(await tenantPlan()).toBe('free');
    expect(await hasFeature('chef_club')).toBe(false);

    await loginAs(page, managerEmail);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });

    // H5-5: FeatureUnavailablePage (nunca 403/404 genérico).
    await page.goto('/#/chef-club-plans');
    await expect(page.getByText(/não está disponível no plano atual/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Novo plano' })).toHaveCount(0);

    // H5-6: UpgradePrompt com CTA de upgrade (D-6.0.5.5-2).
    await expect(page.getByText(/Faça upgrade do plano/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver Meu Plano' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voltar ao Início' })).toBeVisible();
    await page.screenshot({ path: `test-results/h5-5-6-upgrade-prompt-${runId}.png` });
  });

  test('H5-7 URL direta de feature desabilitada (free → /bi) bloqueada', async ({ page }) => {
    test.setTimeout(120_000);

    expect(await tenantPlan()).toBe('free');
    expect(await hasFeature('bi')).toBe(false);

    await loginAs(page, managerEmail);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });

    await page.goto('/#/bi');
    await expect(page.getByText(/não está disponível no plano atual/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Visão do Negócio' })).toHaveCount(0);
    await page.screenshot({ path: `test-results/h5-7-direct-url-blocked-${runId}.png` });
  });

  test('H5-9 override por tenant (feature_flags, escrita superadmin) vence a matriz', async ({ page }) => {
    test.setTimeout(120_000);

    // --- Cenário A: premium SEM chef_club na matriz → override false bloqueia ---
    await changePlan('premium', 'H5-test-upgrade');
    expect(await tenantPlan()).toBe('premium');
    expect(await hasFeature('chef_club')).toBe(true); // matriz vence sem override

    await setOverride('chef_club', false);
    expect(await hasFeature('chef_club')).toBe(false); // override false vence a matriz
    expect(await hasFeature('bi')).toBe(true);          // matriz preservada p/ outras flags

    await loginAs(page, managerEmail);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
    await page.goto('/#/chef-club-plans'); // recarga plena → cache de RPC novo
    await expect(page.getByText(/não está disponível no plano atual/)).toBeVisible({ timeout: 20_000 });

    // --- Cenário B: free SEM chef_club na matriz → override true libera ---
    await changePlan('free', 'H5-test-downgrade-2');
    expect(await tenantPlan()).toBe('free');
    expect(await hasFeature('chef_club')).toBe(false); // matriz nega sem override

    await setOverride('chef_club', true);
    expect(await hasFeature('chef_club')).toBe(true);  // override true vence a matriz

    // page.goto para hash diferente é navegação SPA (sem recarga): o cache de flags
    // da sessão de página atual (plan premium) ficaria obsoleto. page.reload() força
    // recarga plena → cache novo → override true resolvido no boot.
    await page.reload();
    await expect(page.getByText(/não está disponível no plano atual/)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Novo plano' })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `test-results/h5-9-override-${runId}.png` });
  });

  test.afterAll(async () => {
    if (!enabled) return;
    const admin = getAdminClient();
    try {
      for (const tid of [tenantId, opsTenantId]) {
        if (!tid) continue;
        await admin.from('feature_flags').delete().eq('tenant_id', tid);
        await admin.from('billing_events').delete().eq('tenant_id', tid);
        await admin.from('subscriptions').delete().eq('tenant_id', tid);
        await admin.from('staff').delete().eq('tenant_id', tid);
        await admin.from('user_tenants').delete().eq('tenant_id', tid);
        await admin.from('tenant_settings').delete().eq('tenant_id', tid);
        await admin.from('tenants').delete().eq('id', tid);
      }
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(email);
      }
      console.log('[h5] teardown complete');
    } catch (err) {
      console.warn('[h5] teardown failed (tenants left for operator cleanup):', err);
    }
  });
});
