import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for ChefClub Subscriptions page
 *
 * Route: /#/chef-club-subscriptions
 * Heading: "Assinaturas do Clube" (h1)
 */
export class ChefClubPage extends BasePage {
  readonly heading;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h1:has-text("Assinaturas do Clube")');
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/chef-club-subscriptions');
    await this.waitForLoading();
  }

  async isLoaded(): Promise<boolean> {
    return this.heading.isVisible({ timeout: 5_000 }).catch(() => false);
  }
}
