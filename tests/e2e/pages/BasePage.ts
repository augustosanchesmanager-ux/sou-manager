import type { Page, Locator } from '@playwright/test';

/**
 * Base page object with common helpers
 */
export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForLoading(): Promise<void> {
    // Wait for any loading spinners to disappear
    await this.page.locator('.animate-spin').waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
  }

  async waitForToast(message?: string): Promise<void> {
    // Toast is rendered as a div with role="status" or a sonner toast
    const toast = message
      ? this.page.locator('[role="status"], [data-sonner-toast]').filter({ hasText: message })
      : this.page.locator('[role="status"], [data-sonner-toast]').first();
    await toast.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  }

  async getPageHeading(): Promise<string> {
    const heading = this.page.locator('h1, h2').first();
    return (await heading.textContent()) || '';
  }
}
