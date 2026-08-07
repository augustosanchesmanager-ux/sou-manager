import { test, expect } from '@playwright/test';
import { createConfirmedUser, deleteUserByEmail, getAdminClient } from '../helpers/supabaseAdmin';

/**
 * FLOW 13: Navegação por Estado Efetivo (6.0.5.1)
 *
 * Requires REAL Supabase. Gate: E2E_PROVISIONING=1
 *
 * Valida o comportamento OBSERVÁVEL da camada de autorização (AuthorizationService
 * em App.tsx): o destino da navegação pós-login para cada status de tenant.
 * Cobre os cenários das D-6.0.5-1/2 e o restante da matriz de acesso:
 *   - trial/active            -> acesso total (/dashboard)
 *   - past_due (D-6.0.5-1)    -> restrito, LOGIN PERMITIDO (/dashboard, sem redirect)
 *   - cancelled (D-6.0.5-2)   -> somente leitura, LOGIN PERMITIDO (/dashboard, sem redirect)
 *   - suspended/archived      -> bloqueado (/pending-approval)
 *   - draft                   -> wizard de onboarding (/onboarding/welcome)
 *
 * LIMITES DE ESCOPO (6.0.5.1): o aviso na UI ("estado limitado") e o enforcement
 * de escrita (read-only efetivo) pertencem à 6.0.5.3 (Entry Check §1.2). Aqui o
 * aviso é validado em nível unitário (accessPolicy.getWarnings) e a navegação
 * em E2E — a UI ainda não renderiza banner de estado nesta subfase.
 *
 * O tenant é semeado diretamente (via service role) e o status é alterado por
 * UPDATE direto apenas para dirigir o frontend; o WRITER oficial de
 * tenants.status é o TenantLifecycleService (Single Writer, ADR-013 §3.1) e é
 * coberto por testes unitários.
 */
const enabled = process.env.E2E_PROVISIONING === '1';

test.describe('Flow 13 — Access Level Navigation (Phase 6.0.5.1)', () => {
  const runId = Date.now();
  const password = 'E2e-Flow13-2026!';

  let scenario = 0;

  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  test.beforeEach(async () => {
    if (!enabled) return;
    const admin = getAdminClient();
    scenario += 1;
    const email = `e2e-flow13-${runId}-${scenario}@gmail.com`;

    test.info().annotations.push({ type: 'scenario', description: `tenant status scenario ${scenario} (${email})` });

    // Manager user (confirmed, no shop_name -> no pendingRegistration).
    const userId = await createConfirmedUser({
      email,
      password,
      userMetadata: { first_name: 'E2E', last_name: `Flow13-${scenario}` },
    });
    expect(userId).toBeTruthy();

    // Tenant pro ativo — o status alvo é aplicado dentro de cada teste.
    const tenant = await admin
      .from('tenants')
      .insert({
        name: `E2E Flow13 ${runId}-${scenario}`,
        slug: `e2e-flow13-${runId}-${scenario}`,
        app_slug: 'barber',
        plan: 'pro',
        status: 'active',
      })
      .select('id')
      .single();
    if (tenant.error || !tenant.data) throw new Error(`seed tenants failed: ${tenant.error?.message}`);
    test.info().annotations.push({ type: 'tenantId', description: (tenant.data as { id: string }).id });

    // user_tenants é criado automaticamente pelo trigger sync_profile_to_user_tenants
    // (AFTER INSERT em profiles) — NÃO inserir manualmente (chave única violada).
    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      tenant_id: (tenant.data as { id: string }).id,
      full_name: `E2E Flow13 Manager ${scenario}`,
      role: 'manager',
      status: 'active',
      onboarding_completed: true,
    });
    if (profileError) throw new Error(`seed profile failed: ${profileError.message}`);

    const { error: staffError } = await admin.from('staff').insert({
      id: userId,
      name: `E2E Flow13 Manager ${scenario}`,
      email,
      phone: '',
      role: 'manager',
      avatar: '',
      commission_rate: 0,
      status: 'active',
      tenant_id: (tenant.data as { id: string }).id,
    });
    if (staffError) throw new Error(`seed staff failed: ${staffError.message}`);
  });

  test.afterEach(async () => {
    if (!enabled) return;
    try {
      const admin = getAdminClient();
      const tenant = await admin
        .from('tenants')
        .select('id')
        .eq('slug', `e2e-flow13-${runId}-${scenario}`)
        .single();
      const tenantId = tenant.data ? (tenant.data as { id: string }).id : '';
      if (tenantId) {
        await admin.from('staff').delete().eq('tenant_id', tenantId);
        await admin.from('user_tenants').delete().eq('tenant_id', tenantId);
        await admin.from('tenants').delete().eq('id', tenantId);
      }
      await deleteUserByEmail(`e2e-flow13-${runId}-${scenario}@gmail.com`);
    } catch (err) {
      console.warn(`[flow13] cleanup failed (scenario ${scenario}):`, err);
    }
  });

  async function setTenantStatus(status: string): Promise<void> {
    const admin = getAdminClient();
    const tenant = await admin
      .from('tenants')
      .select('id')
      .eq('slug', `e2e-flow13-${runId}-${scenario}`)
      .single();
    if (tenant.error || !tenant.data) throw new Error(`read tenant for status failed: ${tenant.error?.message}`);
    const { error } = await admin
      .from('tenants')
      .update({ status })
      .eq('id', (tenant.data as { id: string }).id);
    if (error) throw new Error(`set tenant status ${status} failed: ${error.message}`);
  }

  async function login(page: import('@playwright/test').Page): Promise<void> {
    const email = `e2e-flow13-${runId}-${scenario}@gmail.com`;
    await page.goto('/#/login');
    const emailInput = page.locator('input[type="email"]');
    await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
    await emailInput.fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
  }

  test('trial -> acesso total (/dashboard)', async ({ page }) => {
    test.setTimeout(120_000);
    await setTenantStatus('trial');
    await login(page);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/dashboard/);
  });

  test('active -> acesso total (/dashboard)', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/dashboard/);
  });

  test('past_due -> restrito, login permitido, sem redirect (D-6.0.5-1)', async ({ page }) => {
    test.setTimeout(120_000);
    await setTenantStatus('past_due');
    await login(page);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/dashboard/);
    await expect(page).not.toHaveURL(/#\/pending-approval/);
  });

  test('cancelled -> somente leitura, login permitido, sem redirect (D-6.0.5-2)', async ({ page }) => {
    test.setTimeout(120_000);
    await setTenantStatus('cancelled');
    await login(page);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/dashboard/);
    await expect(page).not.toHaveURL(/#\/pending-approval/);
  });

  test('suspended -> bloqueado (/pending-approval)', async ({ page }) => {
    test.setTimeout(120_000);
    await setTenantStatus('suspended');
    await login(page);
    await page.waitForURL(/#\/pending-approval/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/pending-approval/);
  });

  test('archived -> bloqueado (/pending-approval)', async ({ page }) => {
    test.setTimeout(120_000);
    await setTenantStatus('archived');
    await login(page);
    await page.waitForURL(/#\/pending-approval/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/pending-approval/);
  });

  test('draft -> wizard de onboarding (/onboarding/welcome)', async ({ page }) => {
    test.setTimeout(120_000);
    await setTenantStatus('draft');
    await login(page);
    await page.waitForURL(/#\/onboarding\/welcome/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/onboarding\/welcome/);
  });

  test('free plan -> app carrega (/dashboard) sem erro de feature resolution', async ({ page }) => {
    test.setTimeout(120_000);
    const admin = getAdminClient();
    const tenant = await admin
      .from('tenants')
      .select('id')
      .eq('slug', `e2e-flow13-${runId}-${scenario}`)
      .single();
    if (tenant.error || !tenant.data) throw new Error(`read tenant failed: ${tenant.error?.message}`);
    const { error } = await admin
      .from('tenants')
      .update({ plan: 'free', status: 'active' })
      .eq('id', (tenant.data as { id: string }).id);
    if (error) throw new Error(`set free plan failed: ${error.message}`);
    await login(page);
    await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
    await expect(page).toHaveURL(/#\/dashboard/);
  });
});
