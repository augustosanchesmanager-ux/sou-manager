import { test, expect } from '@playwright/test';
import { RegisterPage } from '../pages/RegisterPage';
import { deleteUserByEmail } from '../helpers/supabaseAdmin';

/**
 * FLOW 6a: Register UI + Verify-email (Supabase Auth validation scenario)
 *
 * NON-BLOCKING scenario — NOT part of the deterministic main E2E suite.
 * Gate: E2E_SIGNUP_UI=1
 *
 * Context (2026-08-05): the environment uses the DEFAULT Supabase mailer
 * (built-in), which only sends to Supabase organization members, and GoTrue
 * rejects/rate-limits signups to external emails (email_address_invalid for
 * null-MX domains, email_address_not_authorized for non-org members, 429 rate
 * limits). The main suite therefore provisions users via the Admin API
 * (flow6-tenant-provisioning.spec.ts).
 *
 * This scenario validates that the APP responds correctly to whatever GoTrue
 * actually returns when a real signUp is attempted through the UI:
 *
 *   - If signUp SUCCEEDS (confirmation ON, no session) -> the app must navigate
 *     to /register/verify-email and the screen must render correctly
 *     ("Já confirmei, continuar" -> "Ainda não detectamos a confirmação").
 *   - If signUp FAILS -> the app must surface the GoTrue error in the form.
 *
 * Both outcomes are recorded as attachments. Requires a real, deliverable,
 * operator-managed email (E2E_SIGNUP_EMAIL) that is NOT currently rate-limited.
 * The email must not be pre-registered.
 */
const enabled = process.env.E2E_SIGNUP_UI === '1';

test.describe('Flow 6a — Register UI + Verify-email (Supabase Auth validation)', () => {
  const email = process.env.E2E_SIGNUP_EMAIL || '';

  test.skip(!enabled, 'Requires E2E_SIGNUP_UI=1 and E2E_SIGNUP_EMAIL (operator-managed)');

  test('register submits against real Supabase Auth and app responds correctly', async ({ page }) => {
    test.setTimeout(60_000);

    const registerPage = new RegisterPage(page);
    await registerPage.goto();
    await expect(page).toHaveURL(/#\/register/);
    await expect(registerPage.submitButton).toBeVisible({ timeout: 15_000 });

    await registerPage.register({
      firstName: 'E2E',
      lastName: 'Signup',
      shopName: 'E2E Signup Barbershop',
      email,
      password: 'E2e-Signup-2026!',
    });

    // Either the app navigates to verify-email (signUp succeeded) or it shows
    // the GoTrue error in the form (environment constraint). Race both.
    const outcome = await Promise.race([
      page.waitForURL(/#\/register\/verify-email/, { timeout: 30_000 }).then(() => 'verify-email'),
      registerPage.errorAlert
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(async () => (await registerPage.getErrorMessage()) || 'unknown'),
    ]);

    if (outcome === 'verify-email') {
      // signUp succeeded (confirmation ON, no session) -> assert the screen.
      await expect(page.getByRole('heading', { name: 'Confirme seu e-mail' })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(email, { exact: true })).toBeVisible();
      const continueBtn = page.getByRole('button', { name: 'Já confirmei, continuar' });
      await continueBtn.click();
      // Email NOT confirmed -> the screen must report it and stay put.
      await expect(page.getByText('Ainda não detectamos a confirmação.')).toBeVisible({ timeout: 15_000 });
      test.info().attach('signup-ui-outcome', {
        body: `signUp SUCCEEDED for ${email}. App navigated to /register/verify-email and ` +
          'correctly reported "confirmation not detected" after "Já confirmei, continuar".',
        contentType: 'text/plain',
      });
    } else {
      // signUp failed -> app surfaced the GoTrue error. Record it and the
      // environment constraint. This is a VALIDATION scenario, not a failure.
      test.info().attach('signup-ui-outcome', {
        body: `signUp FAILED for ${email} with GoTrue error: "${outcome}". ` +
          'App correctly surfaced the error in the register form. ' +
          'Environment uses the default Supabase mailer (built-in, org-members-only) ' +
          'and/or signup rate limits are active — see MIGRATION_EXCEPTION_20260801.md.',
        contentType: 'text/plain',
      });
    }
  });

  test.afterEach(async () => {
    if (!enabled || !email) return;
    try {
      // If signUp succeeded, a user was created. Clean it up (best-effort).
      await deleteUserByEmail(email);
    } catch (err) {
      console.warn(`[flow6a] cleanup failed for ${email}:`, err);
    }
  });
});
