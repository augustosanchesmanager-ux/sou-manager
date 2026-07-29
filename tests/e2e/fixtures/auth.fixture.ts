import { test as base, type Page } from '@playwright/test';
import { DEMO_USER } from '../data/demo.data';

/**
 * Auth fixtures for E2E tests
 *
 * Local demo mode only supports ONE user (teste@soumanager.local / 12345678).
 * All fixtures login with the same credentials — role differences are
 * not available in demo mode.
 *
 * IMPORTANT: The app root "/" shows the Landing page.
 * Login page is at "/#/login" (HashRouter).
 */
async function loginAsDemo(page: Page): Promise<void> {
  // Navigate directly to login page (HashRouter)
  await page.goto('/#/login');

  // Wait for the login form — the email input is type="email"
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 15_000 });

  // Fill credentials (demo mode only accepts these)
  await emailInput.fill(DEMO_USER.email);
  await page.locator('input[type="password"]').fill(DEMO_USER.password);

  // Click login button
  await page.locator('button[type="submit"]').click();

  // Wait for navigation to /#/dashboard (HashRouter)
  await page.waitForURL(/#\/dashboard/, { timeout: 15_000 });
}

/**
 * Extend base test with auth fixtures
 *
 * In demo mode, all roles are the same user (manager).
 * Named fixtures are kept for API consistency — when running
 * against real Supabase, each would use different credentials.
 */
export const test = base.extend<{
  loggedAdmin: Page;
  loggedManager: Page;
  loggedBarber1: Page;
  loggedBarber2: Page;
  loggedCashier: Page;
}>({
  loggedAdmin: async ({ page }, use) => {
    await loginAsDemo(page);
    await use(page);
  },

  loggedManager: async ({ page }, use) => {
    await loginAsDemo(page);
    await use(page);
  },

  loggedBarber1: async ({ page }, use) => {
    await loginAsDemo(page);
    await use(page);
  },

  loggedBarber2: async ({ page }, use) => {
    await loginAsDemo(page);
    await use(page);
  },

  loggedCashier: async ({ page }, use) => {
    await loginAsDemo(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
