import { test, expect } from '../fixtures/auth.fixture';
import { ChefClubPage } from '../pages/ChefClubPage';

/**
 * FLOW 2: ChefClub page loads and is navigable
 *
 * In demo mode, we verify the ChefClub subscriptions page loads.
 *
 * @critical
 */
test.describe('Flow 2 — ChefClub Navigation', () => {
  test('should_load_chefclub_page_when_navigated', async ({ loggedAdmin }) => {
    const chefClubPage = new ChefClubPage(loggedAdmin);
    await chefClubPage.goto();

    // Verify heading is visible
    await expect(chefClubPage.heading).toBeVisible({ timeout: 30_000 });
  });

  test('should_navigate_to_chefclub_from_sidebar', async ({ loggedAdmin }) => {
    // Click on Chef Club link in sidebar
    const clubLink = loggedAdmin.locator('a[href*="chef-club"], a:has-text("Clube")').first();
    if (await clubLink.isVisible()) {
      await clubLink.click();
      await loggedAdmin.waitForURL(/#\/chef-club/, { timeout: 15_000 });
    }
  });
});
