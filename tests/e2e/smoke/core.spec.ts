import { test, expect } from '../fixtures/auth.fixture';
import { LoginPage } from '../pages/LoginPage';
import { SchedulePage } from '../pages/SchedulePage';
import { CashClosingPage } from '../pages/CashClosingPage';
import { ChefClubPage } from '../pages/ChefClubPage';
import { ClientsPage } from '../pages/ClientsPage';
import { CommissionsPage } from '../pages/CommissionsPage';

/**
 * SMOKE SUITE — 10 Critical Tests
 *
 * Runs on every PR. Must complete in < 3 minutes.
 * Tests the most basic functionality that can never break.
 *
 * All routes use HashRouter: /#/path
 * Login credentials (demo mode): teste@soumanager.local / 12345678
 */
test.describe('Smoke — Core Functionality', { tag: '@smoke' }, () => {
  test('01 — Login page loads', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Verify login form is visible
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('02 — Login form is ready for input', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Login form should always be visible (demo mode or real Supabase)
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
    await expect(loginPage.submitButton).toContainText('Entrar');
  });

  test('03 — Admin can login', async ({ loggedAdmin }) => {
    // If we reach this point, login was successful
    // (the fixture handles login and waits for dashboard)
    await expect(loggedAdmin).not.toHaveURL(/login/);
  });

  test('04 — Schedule page loads', async ({ loggedAdmin }) => {
    const schedulePage = new SchedulePage(loggedAdmin);
    await schedulePage.goto();

    // Wait for page content to appear
    await loggedAdmin.waitForTimeout(2_000);

    // Page should have some visible content
    await expect(loggedAdmin.locator('h1, h2').first()).toBeVisible();
  });

  test('05 — Clients page loads', async ({ loggedAdmin }) => {
    const clientsPage = new ClientsPage(loggedAdmin);
    await clientsPage.goto();

    // Verify heading "Clientes" is visible
    await expect(clientsPage.heading).toBeVisible({ timeout: 5_000 });
  });

  test('06 — Cash closing page loads', async ({ loggedAdmin }) => {
    const cashClosingPage = new CashClosingPage(loggedAdmin);
    await cashClosingPage.goto();

    // Page should load without error
    await loggedAdmin.waitForTimeout(2_000);
    await expect(loggedAdmin.locator('h1, h2').first()).toBeVisible();
  });

  test('07 — ChefClub page loads', async ({ loggedAdmin }) => {
    const chefClubPage = new ChefClubPage(loggedAdmin);
    await chefClubPage.goto();

    // Verify heading is visible
    await expect(chefClubPage.heading).toBeVisible({ timeout: 5_000 });
  });

  test('08 — Commissions page loads', async ({ loggedAdmin }) => {
    const commissionsPage = new CommissionsPage(loggedAdmin);
    await commissionsPage.goto();

    // Verify heading is visible
    await expect(commissionsPage.heading).toBeVisible({ timeout: 5_000 });
  });

  test('09 — Dashboard page loads after login', async ({ loggedAdmin }) => {
    // After login, we should be on the dashboard
    await expect(loggedAdmin).toHaveURL(/#\/dashboard/);

    // Dashboard should have some content
    await loggedAdmin.waitForTimeout(1_000);
    await expect(loggedAdmin.locator('h1, h2').first()).toBeVisible();
  });

  test('10 — No critical console errors on login', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login();
    await page.waitForTimeout(2_000);

    // Filter out known non-critical errors (favicon, analytics, etc.)
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('analytics') && !e.includes('404') && !e.includes('WebSocket')
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
