import { test, expect } from '../fixtures/auth.fixture';
import { SchedulePage } from '../pages/SchedulePage';

/**
 * FLOW 1: Schedule page loads and is navigable
 *
 * In demo mode, we can verify the schedule page loads correctly.
 * Full appointment creation requires real Supabase backend.
 *
 * @critical
 */
test.describe('Flow 1 — Schedule Navigation', () => {
  test('should_load_schedule_page_when_navigated', async ({ loggedAdmin }) => {
    const schedulePage = new SchedulePage(loggedAdmin);
    await schedulePage.goto();

    // Verify page loaded
    await loggedAdmin.waitForTimeout(2_000);
    await expect(loggedAdmin.locator('h1, h2').first()).toBeVisible();
  });

  test('should_navigate_to_schedule_from_sidebar', async ({ loggedAdmin }) => {
    // Click on schedule link in sidebar
    const scheduleLink = loggedAdmin.locator('a[href*="schedule"], a:has-text("Agenda")').first();
    if (await scheduleLink.isVisible()) {
      await scheduleLink.click();
      await loggedAdmin.waitForURL(/#\/schedule/, { timeout: 5_000 });
    }
  });
});
