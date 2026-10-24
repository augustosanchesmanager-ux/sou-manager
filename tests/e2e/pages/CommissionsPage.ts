import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for Commissions page
 *
 * Route: /#/commissions
 * Heading: "Comissões" (h2)
 */
export class CommissionsPage extends BasePage {
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly refreshButton: Locator;
  readonly typeFilter: Locator;
  readonly statusFilter: Locator;
  readonly tableRows: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h2:has-text("Comissões")');
    this.searchInput = page.locator('input[placeholder*="Buscar por profissional"]');
    this.refreshButton = page.locator('button:has-text("Recalcular")');
    this.typeFilter = page.locator('select').first();
    this.statusFilter = page.locator('select').nth(1);
    this.tableRows = page.locator('tbody tr');
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/commissions');
    await this.waitForLoading();
  }

  async isLoaded(): Promise<boolean> {
    return this.heading.isVisible({ timeout: 10_000 }).catch(() => false);
  }

  async setDateRange(startDateYmd: string, endDateYmd: string): Promise<void> {
    const inputs = this.page.locator('input[type="date"]');
    const count = await inputs.count();
    if (count >= 2) {
      await inputs.nth(0).fill(startDateYmd);
      await inputs.nth(1).fill(endDateYmd);
      await this.refreshButton.click();
      await this.waitForLoading();
    }
  }

  getRowForProfessional(name: string): Locator {
    return this.page.locator(`tbody tr:has-text("${name}")`);
  }
}
