import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object do wizard de onboarding (3 passos) — Fase 6.0.2 (reestruturação).
 *
 * Rota única: /#/onboarding/shop-setup. Os passos são in-page:
 *   Passo 1 "Sua Barbearia": nome (read-only), link público, telefone, CNPJ,
 *     CEP, rua, número, cidade, estado, cadeiras, fuso e moeda.
 *   Passo 2 "Como você atende": horário de funcionamento + catálogo inicial.
 *   Passo 3 "Publicação": resumo + visibilidade (Publicar agora / Salvar rascunho).
 *
 * A rota legada /#/onboarding/operational-setup agora redireciona para o passo 1.
 *
 * Selectors (from pages/onboarding/ShopSetup.tsx + steps/*):
 *   Passo 1: input[readonly] (nome), input[type=tel], CNPJ, CEP, rua, número,
 *     cidade, estado; selects nth(0)=cadeiras, nth(1)=fuso, nth(2)=moeda.
 *   Passo 2: 7 toggles de dia + toggle "agenda por barbeiro" (último
 *     button[aria-pressed]); selects nth(0)=intervalo, nth(1)=duração,
 *     nth(2)=horizonte; editor de serviços com default de 3 linhas.
 *   Passo 3: cards de visibilidade; botões "Publicar agora" / "Salvar rascunho".
 */
export class ShopSetupPage extends BasePage {
  readonly shopNameInput;
  readonly phoneInput;
  readonly cnpjInput;
  readonly zipInput;
  readonly streetInput;
  readonly numberInput;
  readonly cityInput;
  readonly stateInput;
  readonly chairSelect;
  readonly timezoneSelect;
  readonly currencySelect;
  readonly intervalSelect;
  readonly durationSelect;
  readonly horizonSelect;
  readonly dayToggles;
  readonly staffScheduleToggle;
  readonly continueButton;
  readonly publishButton;
  readonly saveDraftButton;
  readonly errorAlert;
  readonly step1Heading;
  readonly step2Heading;
  readonly step3Heading;

  constructor(page: Page) {
    super(page);
    this.shopNameInput = page.locator('input[readonly]').first();
    this.phoneInput = page.locator('input[type="tel"]');
    this.cnpjInput = page.locator('input[placeholder="00.000.000/0001-00"]');
    this.zipInput = page.locator('input[placeholder="00000-000"]');
    this.streetInput = page.locator('input[placeholder="Rua..."]');
    this.numberInput = page.locator('input[placeholder="123"]');
    this.cityInput = page.locator('input[placeholder="São Paulo"]');
    this.stateInput = page.locator('input[placeholder="SP"]');
    this.chairSelect = page.locator('select').nth(0);
    this.timezoneSelect = page.locator('select').nth(1);
    this.currencySelect = page.locator('select').nth(2);
    this.intervalSelect = page.locator('select').nth(0);
    this.durationSelect = page.locator('select').nth(1);
    this.horizonSelect = page.locator('select').nth(2);
    this.dayToggles = page.locator('button[aria-pressed]');
    this.staffScheduleToggle = this.dayToggles.last();
    this.continueButton = page.locator('button:has-text("Continuar")').first();
    this.publishButton = page.getByRole('button', { name: 'Publicar agora' });
    this.saveDraftButton = page.getByRole('button', { name: 'Salvar rascunho' });
    this.errorAlert = page.locator('div').filter({ hasText: /Tenant não identificado|Erro ao salvar|Erro ao finalizar/i }).first();
    this.step1Heading = page.getByRole('heading', { name: 'Sua Barbearia', exact: true });
    this.step2Heading = page.getByRole('heading', { name: 'Como você atende', exact: true });
    this.step3Heading = page.getByRole('heading', { name: 'Publicação', exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/onboarding/shop-setup');
  }

  async completeStep1(opts: {
    phone: string;
    cnpj?: string;
    zip?: string;
    street?: string;
    number?: string;
    city?: string;
    state?: string;
    chairCount?: number;
    timezone?: string;
    currency?: string;
  }): Promise<void> {
    await this.step1Heading.waitFor({ state: 'visible', timeout: 15_000 });
    await this.phoneInput.fill(opts.phone);
    if (opts.cnpj) await this.cnpjInput.fill(opts.cnpj);
    if (opts.zip) await this.zipInput.fill(opts.zip);
    if (opts.street) await this.streetInput.fill(opts.street);
    if (opts.number) await this.numberInput.fill(opts.number);
    if (opts.city) await this.cityInput.fill(opts.city);
    if (opts.state) await this.stateInput.fill(opts.state);
    if (opts.chairCount) await this.chairSelect.selectOption(String(opts.chairCount));
    if (opts.timezone) await this.timezoneSelect.selectOption(opts.timezone);
    if (opts.currency) await this.currencySelect.selectOption(opts.currency);
    await this.continueButton.click();
    await this.step2Heading.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async completeStep2(opts?: {
    interval?: number;
    duration?: number;
    horizon?: number;
  }): Promise<void> {
    await this.step2Heading.waitFor({ state: 'visible', timeout: 15_000 });
    if (opts?.interval) await this.intervalSelect.selectOption(String(opts.interval));
    if (opts?.duration) await this.durationSelect.selectOption(String(opts.duration));
    if (opts?.horizon) await this.horizonSelect.selectOption(String(opts.horizon));
    await this.continueButton.click();
    await this.step3Heading.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async isStaffScheduleEnabled(): Promise<boolean> {
    return (await this.staffScheduleToggle.getAttribute('aria-pressed')) === 'true';
  }

  async publish(): Promise<void> {
    await this.publishButton.click();
  }

  async saveDraft(): Promise<void> {
    await this.saveDraftButton.click();
  }

  async getErrorMessage(): Promise<string | null> {
    return this.errorAlert.textContent().catch(() => null);
  }
}
