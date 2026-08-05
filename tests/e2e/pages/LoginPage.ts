import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { getFixtureState } from '../data/fixtureState';

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
    // Default to the seeded fixture manager when no credentials are given.
    // Loaded lazily so callers that pass explicit credentials (flow6/flow6a)
    // do not require the fixture state file.
    if (!email || !password) {
      const state = getFixtureState();
      email = email || state.users.manager.email;
      password = password || state.users.manager.password;
    }

    await this.emailInput.waitFor({ state: 'visible', timeout: 10_000 });
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();

    // Wait for navigation to dashboard (HashRouter)
    await this.page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
  }

  async getErrorMessage(): Promise<string | null> {
    return this.errorAlert.textContent().catch(() => null);
  }

  async isDemoInfoVisible(): Promise<boolean> {
    return this.demoInfoBox.isVisible();
  }
}
