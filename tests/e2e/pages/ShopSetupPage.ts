import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for Shop Setup (onboarding) page — Fase 6.0.2 (Bloco 2).
 *
 * Form selectors (from pages/onboarding/ShopSetup.tsx):
 *   Step 1 (empresa):
 *     - Nome fantasia (read-only, não interage)
 *     - Phone: input[type="tel"] (placeholder="(11) 99999-9999", required)
 *     - CNPJ: input[placeholder="00.000.000/0001-00"] (optional)
 *     - Continue: button with text "Continuar"
 *   Step 2 (endereço + cadeiras):
 *     - CEP: input[placeholder="00000-000"]
 *     - Street: input[placeholder="Rua..."]
 *     - Number: input[placeholder="123"]
 *     - City: input[placeholder="São Paulo"]
 *     - State: input[placeholder="SP"] (maxLength 2)
 *     - Chair count: select (2/5/10)
 *     - Continue: button with text "Continuar"
 *   Step 3 (regional):
 *     - Timezone: select (default America/Sao_Paulo)
 *     - Currency: select (default BRL)
 *     - Save: button with text "Salvar empresa" -> navigates to /onboarding/operational-setup
 */
export class ShopSetupPage extends BasePage {
  readonly phoneInput;
  readonly cnpjInput;
  readonly continueButton;
  readonly zipInput;
  readonly streetInput;
  readonly numberInput;
  readonly cityInput;
  readonly stateInput;
  readonly chairSelect;
  readonly timezoneSelect;
  readonly currencySelect;
  readonly saveButton;
  readonly errorAlert;
  readonly shopNameInput;

  constructor(page: Page) {
    super(page);
    this.shopNameInput = page.locator('input[readonly]').first();
    this.phoneInput = page.locator('input[type="tel"]');
    this.cnpjInput = page.locator('input[placeholder="00.000.000/0001-00"]');
    this.continueButton = page.locator('button:has-text("Continuar")').first();
    this.zipInput = page.locator('input[placeholder="00000-000"]');
    this.streetInput = page.locator('input[placeholder="Rua..."]');
    this.numberInput = page.locator('input[placeholder="123"]');
    this.cityInput = page.locator('input[placeholder="São Paulo"]');
    this.stateInput = page.locator('input[placeholder="SP"]');
    this.chairSelect = page.locator('select').first();
    this.timezoneSelect = page.locator('select').first();
    this.currencySelect = page.locator('select').nth(1);
    this.saveButton = page.locator('button:has-text("Salvar empresa")').first();
    this.errorAlert = page.locator('div').filter({ hasText: /Tenant não identificado|Erro ao salvar dados da empresa/i }).first();
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
    city?: string;
    state?: string;
    chairCount?: number;
  }): Promise<void> {
    if (opts?.zip) await this.zipInput.fill(opts.zip);
    if (opts?.street) await this.streetInput.fill(opts.street);
    if (opts?.number) await this.numberInput.fill(opts.number);
    if (opts?.city) await this.cityInput.fill(opts.city);
    if (opts?.state) await this.stateInput.fill(opts.state);
    if (opts?.chairCount) {
      await this.chairSelect.selectOption(String(opts.chairCount));
    }
    await this.continueButton.click();
  }

  async completeStep3(opts?: {
    timezone?: string;
    currency?: string;
  }): Promise<void> {
    if (opts?.timezone) {
      await this.timezoneSelect.selectOption(opts.timezone);
    }
    if (opts?.currency) {
      await this.currencySelect.selectOption(opts.currency);
    }
    await this.saveButton.click();
  }

  async getErrorMessage(): Promise<string | null> {
    return this.errorAlert.textContent().catch(() => null);
  }
}
