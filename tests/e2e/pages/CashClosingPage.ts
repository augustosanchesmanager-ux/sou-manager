import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for Cash Closing page
 *
 * Route: /#/cash-closing
 * Uses ClosingHeader component from components/financial/closing
 * The page has complex financial data with summaries and actions.
 */
export class CashClosingPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/cash-closing');
    await this.waitForLoading();
  }

  async isLoaded(): Promise<boolean> {
    // Wait for the closing page content to appear
    await this.page.waitForTimeout(2_000);
    return this.page.locator('h1, h2, [class*="closing"]').first().isVisible();
  }
}
