import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for Commissions page
 *
 * Route: /#/commissions
 * Heading: "Comissões" (h2)
 */
export class CommissionsPage extends BasePage {
  readonly heading;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h2:has-text("Comissões")');
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/commissions');
    await this.waitForLoading();
  }

  async isLoaded(): Promise<boolean> {
    return this.heading.isVisible({ timeout: 5_000 }).catch(() => false);
  }
}
