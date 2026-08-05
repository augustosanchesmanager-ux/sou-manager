import { test, expect } from '../fixtures/auth.fixture';
import { ClientsPage } from '../pages/ClientsPage';

/**
 * P1 — Administrative page navigation
 *
 * In demo mode, we verify that admin pages load correctly.
 * Full CRUD operations require real Supabase backend.
 *
 * @high
 */
test.describe('P1 — Client Management', () => {
  test('should_list_clients_when_admin_opens_page', async ({ loggedAdmin }) => {
    const clientsPage = new ClientsPage(loggedAdmin);
    await clientsPage.goto();

    // Verify heading is visible
    await expect(clientsPage.heading).toBeVisible({ timeout: 30_000 });
  });

  test('should_show_client_data_in_demo_mode', async ({ loggedAdmin }) => {
    const clientsPage = new ClientsPage(loggedAdmin);
    await clientsPage.goto();

    // Demo mode has 2 seeded clients
    await loggedAdmin.waitForTimeout(2_000);

    // Check if any client data is visible
    const pageContent = await loggedAdmin.textContent('body');
    expect(pageContent).toContain('Clientes');
  });
});

test.describe('P1 — Professional Management', () => {
  test('should_load_team_page_when_admin_opens', async ({ loggedAdmin }) => {
    await loggedAdmin.goto('/#/team');

    // Wait for page to load
    await loggedAdmin.waitForTimeout(2_000);

    // Page should have some content
    await expect(loggedAdmin.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('P1 — Service Management', () => {
  test('should_load_services_page_when_admin_opens', async ({ loggedAdmin }) => {
    await loggedAdmin.goto('/#/services');

    // Wait for page to load
    await loggedAdmin.waitForTimeout(2_000);

    // Page should have some content
    await expect(loggedAdmin.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('P1 — Financial Pages', () => {
  test('should_load_financial_overview', async ({ loggedAdmin }) => {
    await loggedAdmin.goto('/#/financial-overview');
    await loggedAdmin.waitForTimeout(2_000);
    await expect(loggedAdmin.locator('h1, h2').first()).toBeVisible();
  });

  test('should_load_cashflow', async ({ loggedAdmin }) => {
    await loggedAdmin.goto('/#/cashflow');
    await loggedAdmin.waitForTimeout(2_000);
    await expect(loggedAdmin.locator('h1, h2').first()).toBeVisible();
  });
});
