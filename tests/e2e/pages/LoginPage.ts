import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { DEMO_USER } from '../data/demo.data';

/**
 * Page Object for Login page
 *
 * Login form selectors (from pages/Login.tsx):
 *   - Email: input[type="email"] (no name attribute, placeholder="seu@email.com")
 *   - Password: input[type="password"] (no name attribute, placeholder="........")
 *   - Submit: button[type="submit"] (text: "Entrar no Sistema")
 *   - Error: div with red styling containing error text
 *   - Demo info: green box with credentials (visible on localhost)
 */
export class LoginPage extends BasePage {
  readonly emailInput;
  readonly passwordInput;
  readonly submitButton;
  readonly errorAlert;
  readonly demoInfoBox;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorAlert = page.locator('div').filter({ hasText: /E-mail ou senha invalidos|Ocorreu um erro/i }).first();
    this.demoInfoBox = page.locator('text=Acesso de teste local').first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/login');
  }

  async login(email?: string, password?: string): Promise<void> {
    const e = email || DEMO_USER.email;
    const p = password || DEMO_USER.password;

    await this.emailInput.waitFor({ state: 'visible', timeout: 10_000 });
    await this.emailInput.fill(e);
    await this.passwordInput.fill(p);
    await this.submitButton.click();

    // Wait for navigation to dashboard (HashRouter)
    await this.page.waitForURL(/#\/dashboard/, { timeout: 15_000 });
  }

  async getErrorMessage(): Promise<string | null> {
    return this.errorAlert.textContent().catch(() => null);
  }

  async isDemoInfoVisible(): Promise<boolean> {
    return this.demoInfoBox.isVisible();
  }
}
