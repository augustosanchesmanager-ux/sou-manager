import type { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for ChefClub Subscription Detail page
 *
 * Route: /#/chef-club-subscriptions/:subscriptionId
 */
export class ChefClubSubscriptionDetailPage extends BasePage {
  readonly heading: Locator;
  readonly statusBadge: Locator;
  readonly cancelButton: Locator;
  readonly cancelModal: Locator;
  readonly reasonSelect: Locator;
  readonly observationTextarea: Locator;
  readonly receivableCheckbox: Locator;
  readonly confirmButton: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h1, h2').first();
    this.statusBadge = page.locator('[data-testid="status-badge"]').first();
    this.cancelButton = page.locator('button:has-text("Cancelar")').first();
    this.cancelModal = page.locator('[role="dialog"]').first();
    this.reasonSelect = this.cancelModal.locator('select').first();
    this.observationTextarea = this.cancelModal.locator('textarea').first();
    this.receivableCheckbox = this.cancelModal.locator('#cancelReceivables');
    this.confirmButton = this.cancelModal.locator('button:has-text("Confirmar")').first();
    this.backButton = this.cancelModal.locator('button:has-text("Voltar")').first();
  }

  async goto(subscriptionId: string): Promise<void> {
    await this.page.goto(`/#/chef-club-subscriptions/${subscriptionId}`);
    await this.waitForLoading();
  }

  async isLoaded(): Promise<boolean> {
    return this.heading.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  async clickCancel(): Promise<void> {
    await this.cancelButton.click();
    await this.cancelModal.waitFor({ state: 'visible', timeout: 5_000 });
  }

  async selectReason(reason: string): Promise<void> {
    await this.reasonSelect.selectOption(reason);
  }

  async fillObservation(text: string): Promise<void> {
    await this.observationTextarea.fill(text);
  }

  async checkCancelReceivables(): Promise<void> {
    await this.receivableCheckbox.check();
  }

  async uncheckCancelReceivables(): Promise<void> {
    await this.receivableCheckbox.uncheck();
  }

  async confirmCancel(): Promise<void> {
    await this.confirmButton.click();
  }

  async goBack(): Promise<void> {
    await this.backButton.click();
  }

  async getModalTitle(): Promise<string> {
    const title = this.cancelModal.locator('h2, h3, [role="heading"]').first();
    return (await title.textContent()) || '';
  }

  async isConfirmButtonDisabled(): Promise<boolean> {
    return this.confirmButton.isDisabled();
  }

  async getReasonOptions(): Promise<string[]> {
    const options = this.reasonSelect.locator('option');
    const count = await options.count();
    const values: string[] = [];
    for (let i = 0; i < count; i++) {
      const value = await options.nth(i).getAttribute('value');
      if (value) values.push(value);
    }
    return values;
  }
}
