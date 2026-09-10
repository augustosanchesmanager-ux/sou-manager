import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for Reports (Central de Relatórios)
 *
 * Route: /#/reports
 * Heading: "Relatórios" (h1)
 * Tabs: Clube dos Chefs | Vendas
 */
export class ReportsPage extends BasePage {
  readonly heading;
  readonly salesTab;
  readonly chefClubTab;
  readonly salesSection;
  readonly comandasSection;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h1:has-text("Relatórios")');
    this.chefClubTab = page.locator('button:has-text("Clube dos Chefs")');
    this.salesTab = page.locator('button:has-text("Vendas")');
    this.salesSection = page.locator('h3:has-text("Relatório de Vendas")');
    this.comandasSection = page.locator('h4:has-text("Comandas no período")');
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/reports');
    await this.waitForLoading();
  }

  async switchToSales(): Promise<void> {
    await this.salesTab.click();
  }

  async isLoaded(): Promise<boolean> {
    return this.heading.isVisible({ timeout: 5_000 }).catch(() => false);
  }
}