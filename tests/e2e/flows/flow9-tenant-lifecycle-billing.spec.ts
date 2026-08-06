import { test, expect } from '@playwright/test';
import { WelcomePage } from '../pages/WelcomePage';
import { ShopSetupPage } from '../pages/ShopSetupPage';
import { OperationalSetupPage } from '../pages/OperationalSetupPage';
import { LoginPage } from '../pages/LoginPage';
import { createConfirmedUser, deleteUserByEmail, getAdminClient } from '../helpers/supabaseAdmin';
import { signInAsUser } from '../helpers/supabaseUser';

/**
 * FLOW 9: Lifecycle billing — onboarding → draft → trial → active (6.0.4.4)
 *
 * Requires REAL Supabase (demo mode does not support provisioning).
 * Gate: E2E_PROVISIONING=1
 *
 * Cobre o ciclo determinístico da 6.0.4.4:
 *   1. Onboarding completo pela UI (reuso do fluxo validado no flow6): o RPC
 *      complete_onboarding chama start_trial → subscription 'trialing' +
 *      tenants.status 'trial' (F10/D5: draft → trial, nunca draft → active).
 *   2. start_trial é idempotente: re-chamada devolve a subscription existente.
 *   3. Ativação MANUAL via RPC activate_subscription (D-D) por um gestor do
 *      tenant (owner/manager/admin) → subscription 'active' + tenants 'active'.
 *
 * Cleanup: usuário criado via Admin API é removido em afterEach (profiles/
 * user_tenants em CASCADE); o tenant órfão segue sob responsabilidade do
 * operador (ver MIGRATION_EXCEPTION_20260801.md).
 */
const enabled = process.env.E2E_PROVISIONING === '1';

test.describe('Flow 9 — Tenant Lifecycle Billing (Phase 6.0.4.4)', () => {
  const email = `e2e-flow9-${Date.now()}@gmail.com`;
  const password = 'E2e-Flow9-2026!';

  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  test('onboarding -> trial -> activate (RPC) -> active', async ({ page }) => {
    test.setTimeout(180_000);

    // 1. Confirmed user via Admin API (bypasses SMTP/MX/rate-limit).
    const userId = await createConfirmedUser({
      email,
      password,
      userMetadata: { first_name: 'E2E', last_name: 'Flow9', shop_name: 'E2E Flow9 Barbershop' },
    });
    expect(userId).toBeTruthy();

    // 2. Login through the UI -> pendingRegistration -> provision -> welcome.
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.emailInput.fill(email);
    await loginPage.passwordInput.fill(password);
    await loginPage.submitButton.click();
    await page.waitForURL(/#\/onboarding\/welcome/, { timeout: 60_000 });

    // 3. Complete onboarding (Blocos 1-3) -> /dashboard.
    const welcome = new WelcomePage(page);
    await expect(welcome.heading).toBeVisible({ timeout: 10_000 });
    await welcome.begin();

    const shopSetup = new ShopSetupPage(page);
    await expect(shopSetup.phoneInput).toBeVisible({ timeout: 15_000 });
    await shopSetup.completeStep1({ phone: '(11) 98888-7777', cnpj: '98.765.432/0001-10' });
    await expect(shopSetup.zipInput).toBeVisible({ timeout: 15_000 });
    await shopSetup.completeStep2({
      zip: '01310-100',
      street: 'Av. Paulista',
      number: '1500',
      city: 'São Paulo',
      state: 'SP',
      chairCount: 2,
    });
    await expect(shopSetup.timezoneSelect).toBeVisible({ timeout: 15_000 });
    await shopSetup.completeStep3({ timezone: 'America/Sao_Paulo', currency: 'BRL' });

    await page.waitForURL(/#\/onboarding\/operational-setup/, { timeout: 20_000 });
    const operational = new OperationalSetupPage(page);
    await expect(operational.heading).toBeVisible({ timeout: 15_000 });
    await operational.setInterval(30);
    await operational.setDuration(60);
    await operational.setHorizon(30);
    await operational.finish();

    await page.waitForURL(/#\/dashboard/, { timeout: 20_000 });
    await expect(page).toHaveURL(/#\/dashboard/);

    // 4. Estado pós-onboarding via clientes (não-UI): subscription 'trialing',
    //    tenants.status 'trial' (start_trial disparado por complete_onboarding).
    const user = await signInAsUser(email, password);
    const admin = getAdminClient();

    const sub = await user.rpc('get_subscription').single();
    if (sub.error) throw new Error(`get_subscription failed: ${sub.error.message}`);
    const subscription = sub.data as { id: string; tenant_id: string; status: string; plan: string };
    expect(subscription.status).toBe('trialing');
    expect(subscription.tenant_id).toBeTruthy();
    const tenantId = subscription.tenant_id;

    const tenant = await admin.from('tenants').select('status').eq('id', tenantId).single();
    if (tenant.error) throw new Error(`admin tenants read failed: ${tenant.error.message}`);
    expect((tenant.data as { status: string }).status).toBe('trial');

    // 5. start_trial é idempotente (mesma subscription de volta).
    const subAgain = await user.rpc('start_trial', { p_tenant_id: tenantId }).single();
    if (subAgain.error) throw new Error(`start_trial re-run failed: ${subAgain.error.message}`);
    expect((subAgain.data as { id: string }).id).toBe(subscription.id);
    expect((subAgain.data as { status: string }).status).toBe('trialing');

    // 6. Ativação MANUAL via RPC (D-D): subscription -> active, tenant -> active.
    const activated = await user.rpc('activate_subscription', { p_tenant_id: tenantId }).single();
    if (activated.error) throw new Error(`activate_subscription failed: ${activated.error.message}`);
    expect((activated.data as { status: string }).status).toBe('active');

    const active = await user.rpc('get_subscription').single();
    if (active.error) throw new Error(`get_subscription after activate failed: ${active.error.message}`);
    expect((active.data as { status: string }).status).toBe('active');

    const tenantAfter = await admin.from('tenants').select('status').eq('id', tenantId).single();
    if (tenantAfter.error) throw new Error(`admin tenants read (after) failed: ${tenantAfter.error.message}`);
    expect((tenantAfter.data as { status: string }).status).toBe('active');
  });

  test.afterEach(async () => {
    if (!enabled) return;
    try {
      await deleteUserByEmail(email);
    } catch (err) {
      console.warn(`[flow9] cleanup failed for ${email}:`, err);
    }
  });
});
