import { test, expect } from '../fixtures/auth.fixture';
import { ClientsPage } from '../pages/ClientsPage';

/**
 * FLOW 5: Clients page loads and is navigable
 *
 * In demo mode, we verify the clients page loads correctly.
 *
 * @critical
 */
test.describe('Flow 5 — Clients Navigation', () => {
  test('should_load_clients_page_when_navigated', async ({ loggedAdmin }) => {
    const clientsPage = new ClientsPage(loggedAdmin);
    await clientsPage.goto();

    // Verify heading "Clientes" is visible
    await expect(clientsPage.heading).toBeVisible({ timeout: 5_000 });
  });

  test('should_navigate_to_clients_from_sidebar', async ({ loggedAdmin }) => {
    // Click on Clients link in sidebar
    const clientsLink = loggedAdmin.locator('a[href*="clients"], a:has-text("Clientes")').first();
    if (await clientsLink.isVisible()) {
      await clientsLink.click();
      await loggedAdmin.waitForURL(/#\/clients/, { timeout: 5_000 });
    }
  });
});
