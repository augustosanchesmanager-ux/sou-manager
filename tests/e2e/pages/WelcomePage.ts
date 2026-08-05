import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for Welcome (onboarding) page — Fase 6.0.2 (Bloco 1).
 *
 * Route: /#/onboarding/welcome
 * Selectors (from pages/onboarding/Welcome.tsx):
 *   - Heading: "Bem-vindo ao SMG Barber!"
 *   - Plan badge: "Plano Free"
 *   - Progress card with 5 steps (Empresa/Horários/Serviços/Equipe/Finalizar)
 *   - CTA: "Começar" (novo) ou "Continuar configuração" (retomada)
 */
export class WelcomePage extends BasePage {
  readonly heading;
  readonly planBadge;
  readonly progressPercent;
  readonly startButton;
  readonly continueButton;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'Bem-vindo ao SMG Barber!' });
    this.planBadge = page.locator('header').getByText(/Plano (Free|Pro|Elite)/);
    this.progressPercent = page.locator('div').filter({ hasText: /^Progresso/ }).locator('text=100%').last();
    this.startButton = page.getByRole('button', { name: /Começar/ });
    this.continueButton = page.getByRole('button', { name: /Continuar configuração/ });
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/onboarding/welcome');
  }

  async isLoaded(): Promise<boolean> {
    return this.heading.isVisible({ timeout: 10_000 }).catch(() => false);
  }

  async getPlanBadgeText(): Promise<string> {
    return (await this.planBadge.textContent()) || '';
  }

  async begin(): Promise<void> {
    await this.startButton.click();
  }

  async resume(): Promise<void> {
    await this.continueButton.click();
  }
}
