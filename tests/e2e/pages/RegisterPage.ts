import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for Register page
 *
 * Form selectors (from pages/Register.tsx):
 *   - First name: input[placeholder="Seu nome"]
 *   - Last name: input[placeholder="Sobrenome"]
 *   - Shop name: input[placeholder="Ex: Barbearia do Zé"]
 *   - Email: input[type="email"] (placeholder="seu@email.com")
 *   - Password: input[type="password"] (minLength 8)
   *   - Submit: button[type="submit"] (text: "Criar Conta")
   *   - Error: div with red styling containing error message
   *
   * The error alert shows `err.message` from the Supabase signUp call, so its
   * text is dynamic (e.g. "Email rate limit exceeded"). The locator targets the
   * red container itself, not a fixed message.
   */
export class RegisterPage extends BasePage {
  readonly firstNameInput;
  readonly lastNameInput;
  readonly shopNameInput;
  readonly emailInput;
  readonly passwordInput;
  readonly submitButton;
  readonly errorAlert;

  constructor(page: Page) {
    super(page);
    this.firstNameInput = page.locator('input[placeholder="Seu nome"]');
    this.lastNameInput = page.locator('input[placeholder="Sobrenome"]');
    this.shopNameInput = page.locator('input[placeholder="Ex: Barbearia do Zé"]');
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorAlert = page.locator('div.bg-red-500\\/10').first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/register');
  }

  async register(opts: {
    firstName: string;
    lastName: string;
    shopName: string;
    email: string;
    password: string;
  }): Promise<void> {
    await this.firstNameInput.waitFor({ state: 'visible', timeout: 10_000 });
    await this.firstNameInput.fill(opts.firstName);
    await this.lastNameInput.fill(opts.lastName);
    await this.shopNameInput.fill(opts.shopName);
    await this.emailInput.fill(opts.email);
    await this.passwordInput.fill(opts.password);
    await this.submitButton.click();
  }

  async getErrorMessage(): Promise<string | null> {
    return this.errorAlert.textContent().catch(() => null);
  }
}
