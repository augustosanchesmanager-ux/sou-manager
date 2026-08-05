import { test, expect } from '@playwright/test';
import { ShopSetupPage } from '../pages/ShopSetupPage';
import { LoginPage } from '../pages/LoginPage';
import { createConfirmedUser, deleteUserByEmail } from '../helpers/supabaseAdmin';

/**
 * FLOW 6: Tenant provisioning (new user registration)
 *
 * Requires REAL Supabase (demo mode does not support provisioning).
 * Gate: E2E_PROVISIONING=1
 *
 * DECISION 2026-08-05 (PO): the main E2E suite must be deterministic. The user
 * is created via the ADMIN API (email_confirm=true), which bypasses SMTP
 * delivery, GoTrue DNS/MX email validation, signup rate limits and external
 * inboxes. The app-side behavior being validated is unchanged:
 *
 *   1. Login of a user with user_metadata.shop_name and NO tenant triggers
 *      `pendingRegistration` (context/AuthContext.tsx);
 *   2. ProtectedRoute redirects to /onboarding/provision;
 *   3. Provision.tsx calls the authenticated RPC provision_new_tenant (the
 *      security-fixed one — rejects auth.uid() == NULL) and lands on
 *      /onboarding/shop-setup;
 *   4. complete_onboarding -> /dashboard.
 *
 * The UI signup flow (register -> verify-email) is covered SEPARATELY by
 * flow6a-signup-ui.spec.ts (gated, non-blocking) because the environment uses
 * the DEFAULT Supabase mailer (built-in, org-members-only) and signUp to
 * external emails is rejected/rate-limited — see MIGRATION_EXCEPTION_20260801.md.
 *
 * Cleanup: the created auth user is deleted in afterAll (profiles/user_tenants
 * cascade). The orphaned tenant remains operator-managed.
 */
const enabled = process.env.E2E_PROVISIONING === '1';

test.describe('Flow 6 — Tenant Provisioning (Phase 6.0.1)', () => {
  const email = `e2e-provision-${Date.now()}@gmail.com`;
  const password = 'E2e-Provision-2026!';

  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  test('create confirmed user -> login -> provision -> shop-setup -> complete -> dashboard', async ({ page }) => {
    test.setTimeout(120_000);

    // 1. Create the user directly via the Admin API (confirmed email). The app
    //    is NOT involved — this emulates a user who registered and confirmed
    //    their email through the Supabase flow.
    const userId = await createConfirmedUser({
      email,
      password,
      userMetadata: {
        first_name: 'E2E',
        last_name: 'Provisioning',
        shop_name: 'E2E Test Barbershop',
      },
    });
    expect(userId).toBeTruthy();

    // 2. Login through the UI. On first login the app detects the pending
    //    registration (session sem tenant) and auto-runs provision_new_tenant
    //    via /onboarding/provision, landing on shop-setup.
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.emailInput.fill(email);
    await loginPage.passwordInput.fill(password);
    await loginPage.submitButton.click();
    await page.waitForURL(/#\/onboarding\/shop-setup/, { timeout: 60_000 });

    // 3. Shop setup step 1 (phone required)
    const shopSetup = new ShopSetupPage(page);
    await shopSetup.completeStep1({ phone: '(11) 99999-9999', cnpj: '' });

    // 4. Shop setup step 2 (address + chairs) -> complete_onboarding -> /dashboard
    await shopSetup.completeStep2({
      zip: '01310-100',
      street: 'Av. Paulista',
      number: '1000',
      chairCount: 2,
    });

    // Expected: /dashboard. The app refreshes TenantContext after
    // complete_onboarding (so status becomes 'active' before navigating). We
    // wait for the dashboard URL, then hold briefly to catch any delayed
    // bounce back to shop-setup (the stale-draft regression).
    await page.waitForURL(/#\/dashboard/, { timeout: 20_000 });
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/#\/dashboard/);
  });

  test.afterEach(async () => {
    if (!enabled) return;
    try {
      await deleteUserByEmail(email);
    } catch (err) {
      // Best-effort: a failed cleanup must not hide the test result.
      console.warn(`[flow6] cleanup failed for ${email}:`, err);
    }
  });
});
