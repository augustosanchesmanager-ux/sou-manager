import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for Schedule/Appointment page
 *
 * Route: /#/schedule
 * The schedule page is complex (3600+ lines) with calendar/list views.
 * We focus on basic navigation and key elements.
 */
export class SchedulePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/schedule');
    await this.waitForLoading();
  }

  /**
   * Get the page heading text (Schedule page uses h1/h2)
   */
  async getHeading(): Promise<string> {
    return this.getPageHeading();
  }

  /**
   * Check if the schedule page loaded successfully
   */
  async isLoaded(): Promise<boolean> {
    // Schedule page should have some content after loading
    await this.page.waitForTimeout(2_000);
    return this.page.locator('h1, h2, [class*="schedule"]').first().isVisible();
  }
}
