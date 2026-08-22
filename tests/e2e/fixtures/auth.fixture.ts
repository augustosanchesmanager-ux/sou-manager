import { test as base, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { getFixtureState, type E2EUserState } from '../data/fixtureState';

/**
 * Vercel Deployment Protection bypass (Preview only).
 * Applied per-request to same-origin URLs only, so the header never leaks
 * to third-party origins (fonts.gstatic.com etc.) causing CORS failures.
 */
function loadBypassSecret(): string | undefined {
  const filePath = path.resolve(process.cwd(), '.env.local');
  const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('VERCEL_AUTOMATION_BYPASS_SECRET=')) {
      return line.slice('VERCEL_AUTOMATION_BYPASS_SECRET='.length).trim().replace(/^"(.*)"$/, '$1');
    }
  }
  return undefined;
}

const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || loadBypassSecret();
const targetOrigin = process.env.PLAYWRIGHT_BASE_URL ? new URL(process.env.PLAYWRIGHT_BASE_URL).origin : null;

/**
 * Auth fixtures for E2E tests
 *
 * Runs against REAL Supabase (local demo mode does not support the suite —
 * see tests/e2e/setup/globalSetup.ts). globalSetup seeds one fixture tenant
 * with a manager, a barber and a cashier via the Admin API (confirmed emails)
 * and stores the credentials in test-results/.e2e-fixture-state.json.
 *
 * Each fixture logs in through the UI with the matching seeded user:
 *   - loggedAdmin  -> manager (full access, ManagerRoute allowed)
 *   - loggedManager -> manager
 *   - loggedBarber1/2 -> barber
 *   - loggedCashier  -> receptionist
 *
 * IMPORTANT: The app root "/" shows the Landing page.
 * Login page is at "/#/login" (HashRouter).
 */
async function loginAsUser(page: Page, user: E2EUserState, timeout = 30_000): Promise<void> {
  // Navigate directly to login page (HashRouter)
  await page.goto('/#/login');

  // Wait for the login form — the email input is type="email"
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 15_000 });

  await emailInput.fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);

  // Click login button
  await page.locator('button[type="submit"]').click();

  // Wait for navigation to /#/dashboard (HashRouter). The app shell may take
  // a few seconds to resolve AuthContext + TenantContext before redirecting.
  await page.waitForURL(/#\/dashboard/, { timeout });
}

/**
 * Extend base test with auth fixtures. Each role uses its own seeded user so
 * role-specific behaviors can be tested against the real backend.
 */
export const test = base.extend<{
  loggedAdmin: Page;
  loggedManager: Page;
  loggedBarber1: Page;
  loggedBarber2: Page;
  loggedCashier: Page;
}>({
  page: async ({ page }, use) => {
    if (bypassSecret && targetOrigin) {
      await page.route(`${targetOrigin}/**`, async (route) => {
        const headers = {
          ...route.request().headers(),
          'x-vercel-protection-bypass': bypassSecret,
        };
        await route.continue({ headers });
      });
    }
    await use(page);
  },

  loggedAdmin: async ({ page }, use) => {
    await loginAsUser(page, getFixtureState().users.manager);
    await use(page);
  },

  loggedManager: async ({ page }, use) => {
    await loginAsUser(page, getFixtureState().users.manager);
    await use(page);
  },

  loggedBarber1: async ({ page }, use) => {
    await loginAsUser(page, getFixtureState().users.barber);
    await use(page);
  },

  loggedBarber2: async ({ page }, use) => {
    await loginAsUser(page, getFixtureState().users.barber);
    await use(page);
  },

  loggedCashier: async ({ page }, use) => {
    await loginAsUser(page, getFixtureState().users.cashier);
    await use(page);
  },
});

export { expect } from '@playwright/test';
