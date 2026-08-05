import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for Operational Setup (onboarding) page — Fase 6.0.2 (Bloco 3).
 *
 * Route: /#/onboarding/operational-setup
 * Selectors (from pages/onboarding/OperationalSetup.tsx):
 *   - Heading: "Horários de funcionamento"
 *   - 7 day rows (mon..sun) with toggle (aria-pressed) + open/close time inputs
 *   - Interval select (15/30/45/60): nth(0)
 *   - Duration select (30/45/60/90/120): nth(1)
 *   - Horizon select (15/30/60/90): nth(2)
 *   - Agenda por barbeiro toggle (aria-pressed, último do formulário)
 *   - Finish: button "Concluir onboarding" -> complete() -> /dashboard
 */
export class OperationalSetupPage extends BasePage {
  readonly heading;
  readonly intervalSelect;
  readonly durationSelect;
  readonly horizonSelect;
  readonly finishButton;
  readonly errorAlert;
  readonly dayToggles;
  readonly staffScheduleToggle;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'Horários de funcionamento' });
    this.intervalSelect = page.locator('select').nth(0);
    this.durationSelect = page.locator('select').nth(1);
    this.horizonSelect = page.locator('select').nth(2);
    this.finishButton = page.getByRole('button', { name: /Concluir onboarding/ });
    this.errorAlert = page.locator('div').filter({ hasText: /Tenant não identificado|Erro ao salvar configurações operacionais/i }).first();
    this.dayToggles = page.locator('button[aria-pressed]');
    this.staffScheduleToggle = this.dayToggles.last();
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/onboarding/operational-setup');
  }

  async isLoaded(): Promise<boolean> {
    return this.heading.isVisible({ timeout: 10_000 }).catch(() => false);
  }

  async setInterval(minutes: number): Promise<void> {
    await this.intervalSelect.selectOption(String(minutes));
  }

  async setDuration(minutes: number): Promise<void> {
    await this.durationSelect.selectOption(String(minutes));
  }

  async setHorizon(days: number): Promise<void> {
    await this.horizonSelect.selectOption(String(days));
  }

  async isStaffScheduleEnabled(): Promise<boolean> {
    return (await this.staffScheduleToggle.getAttribute('aria-pressed')) === 'true';
  }

  async finish(): Promise<void> {
    await this.finishButton.click();
  }

  async getErrorMessage(): Promise<string | null> {
    return this.errorAlert.textContent().catch(() => null);
  }
}
