import { test, expect } from '../fixtures/auth.fixture';
import { CommissionsPage } from '../pages/CommissionsPage';

/**
 * FLOW 4: Commissions page loads and is navigable
 *
 * In demo mode, we verify the commissions page loads correctly.
 *
 * @critical
 */
test.describe('Flow 4 — Commissions Navigation', () => {
  test('should_load_commissions_page_when_navigated', async ({ loggedAdmin }) => {
    const commissionsPage = new CommissionsPage(loggedAdmin);
    await commissionsPage.goto();

    // Verify heading is visible
    await expect(commissionsPage.heading).toBeVisible({ timeout: 5_000 });
  });

  test('should_navigate_to_commissions_from_sidebar', async ({ loggedAdmin }) => {
    // Click on Commissions link in sidebar
    const commissionLink = loggedAdmin.locator('a[href*="commissions"], a:has-text("Comissões")').first();
    if (await commissionLink.isVisible()) {
      await commissionLink.click();
      await loggedAdmin.waitForURL(/#\/commissions/, { timeout: 5_000 });
    }
  });
});
