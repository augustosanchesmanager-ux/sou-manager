import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for Shop Setup (onboarding) page
 *
 * Form selectors (from pages/onboarding/ShopSetup.tsx):
 *   Step 1:
 *     - Phone: input[type="tel"] (placeholder="(11) 99999-9999", required)
 *     - CNPJ: input[placeholder="00.000.000/0001-00"] (optional)
 *     - Continue: button with text "Continuar"
 *   Step 2:
 *     - CEP: input[placeholder="00000-000"]
 *     - Street: input[placeholder="Rua..."]
 *     - Number: input[placeholder="123"]
 *     - Chair count: select (2/5/10)
 *     - Finish: button with text "Finalizar Cadastro"
 */
export class ShopSetupPage extends BasePage {
  readonly phoneInput;
  readonly cnpjInput;
  readonly continueButton;
  readonly zipInput;
  readonly streetInput;
  readonly numberInput;
  readonly chairSelect;
  readonly finishButton;
  readonly errorAlert;

  constructor(page: Page) {
    super(page);
    this.phoneInput = page.locator('input[type="tel"]');
    this.cnpjInput = page.locator('input[placeholder="00.000.000/0001-00"]');
    this.continueButton = page.locator('button:has-text("Continuar")').first();
    this.zipInput = page.locator('input[placeholder="00000-000"]');
    this.streetInput = page.locator('input[placeholder="Rua..."]');
    this.numberInput = page.locator('input[placeholder="123"]');
    this.chairSelect = page.locator('select');
    this.finishButton = page.locator('button:has-text("Finalizar Cadastro")').first();
    this.errorAlert = page.locator('div').filter({ hasText: /Tenant não identificado|Erro ao finalizar/i }).first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/onboarding/shop-setup');
  }

  async completeStep1(opts: { phone: string; cnpj?: string }): Promise<void> {
    await this.phoneInput.waitFor({ state: 'visible', timeout: 10_000 });
    await this.phoneInput.fill(opts.phone);
    if (opts.cnpj) {
      await this.cnpjInput.fill(opts.cnpj);
    }
    await this.continueButton.click();
  }

  async completeStep2(opts?: {
    zip?: string;
    street?: string;
    number?: string;
    chairCount?: number;
  }): Promise<void> {
    if (opts?.zip) await this.zipInput.fill(opts.zip);
    if (opts?.street) await this.streetInput.fill(opts.street);
    if (opts?.number) await this.numberInput.fill(opts.number);
    if (opts?.chairCount) {
      await this.chairSelect.selectOption(String(opts.chairCount));
    }
    await this.finishButton.click();
  }

  async getErrorMessage(): Promise<string | null> {
    return this.errorAlert.textContent().catch(() => null);
  }
}
