import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for Clients management page
 *
 * Route: /#/clients
 * Heading: "Clientes" (h2)
 * The page shows a list of clients with search and CRUD operations.
 */
export class ClientsPage extends BasePage {
  readonly heading;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h2:has-text("Clientes")');
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/clients');
    await this.waitForLoading();
  }

  async isLoaded(): Promise<boolean> {
    return this.heading.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  async getHeadingText(): Promise<string> {
    return (await this.heading.textContent()) || '';
  }
}
