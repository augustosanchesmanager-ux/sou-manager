import type { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for Cash Closing page
 *
 * Route: /#/cash-closing
 * Uses ClosingHeader component from components/financial/closing
 * The page has complex financial data with summaries and actions.
 */
export class CashClosingPage extends BasePage {
  readonly heading: Locator;
  readonly dateInput: Locator;
  readonly refreshButton: Locator;
  readonly openCashButton: Locator;
  readonly saveButton: Locator;
  readonly closeCashActionButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h2:has-text("Fechamento de Caixa")');
    this.dateInput = page.locator('input[type="date"]');
    this.refreshButton = page.getByRole('button', { name: /atualizar/i });
    this.openCashButton = page.getByRole('button', { name: /abrir caixa/i });
    this.saveButton = page.getByRole('button', { name: /salvar/i }).first();
    this.closeCashActionButton = page.getByRole('button', { name: /fechar caixa/i }).last();
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/cash-closing');
    await this.waitForLoading();
  }

  async isLoaded(): Promise<boolean> {
    await this.page.waitForTimeout(1_500);
    return this.heading.isVisible();
  }

  async setDate(dateStr: string): Promise<void> {
    await this.dateInput.fill(dateStr);
    await this.waitForLoading();
  }

  async openCashIfNeeded(): Promise<boolean> {
    if (await this.openCashButton.isVisible()) {
      await this.openCashButton.click();
      await this.waitForToast();
      return true;
    }
    return false;
  }

  async closeCash(): Promise<void> {
    if (await this.closeCashActionButton.isVisible() && await this.closeCashActionButton.isEnabled()) {
      await this.closeCashActionButton.click();
      // Click confirmation in modal
      const confirmBtn = this.page.getByRole('button', { name: /confirmar|fechar/i }).last();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }
      await this.waitForToast();
    }
  }
}
