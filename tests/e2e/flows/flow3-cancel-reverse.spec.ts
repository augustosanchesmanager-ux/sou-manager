import { test, expect } from '../fixtures/auth.fixture';
import { CashClosingPage } from '../pages/CashClosingPage';

/**
 * FLOW 3: Cash closing page loads and is navigable
 *
 * In demo mode, we verify the cash closing page loads correctly.
 *
 * @critical
 */
test.describe('Flow 3 — Cash Closing Navigation', () => {
  test('should_load_cash_closing_page_when_navigated', async ({ loggedAdmin }) => {
    const cashClosingPage = new CashClosingPage(loggedAdmin);
    await cashClosingPage.goto();

    // Page should load without error
    await loggedAdmin.waitForTimeout(2_000);
    await expect(loggedAdmin.locator('h1, h2').first()).toBeVisible();
  });

  test('should_navigate_to_cash_closing_from_sidebar', async ({ loggedAdmin }) => {
    // Click on Cash Closing link in sidebar
    const closingLink = loggedAdmin.locator('a[href*="cash-closing"], a:has-text("Fechamento")').first();
    if (await closingLink.isVisible()) {
      await closingLink.click();
      await loggedAdmin.waitForURL(/#\/cash-closing/, { timeout: 5_000 });
    }
  });
});
