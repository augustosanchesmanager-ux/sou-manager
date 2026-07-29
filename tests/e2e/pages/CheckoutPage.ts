import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object for Checkout/Payment page
 */
export class CheckoutPage extends BasePage {
  readonly paymentMethodButton;
  readonly confirmButton;
  readonly totalDisplay;
  readonly discountInput;
  readonly notesInput;
  readonly clientNameDisplay;
  readonly serviceNameDisplay;

  constructor(page: Page) {
    super(page);
    this.paymentMethodButton = page.locator('[data-testid="payment-method"], button:has-text("Dinheiro"), button:has-text("Pix")');
    this.confirmButton = page.getByRole('button', { name: /confirmar|finalizar|pay/i });
    this.totalDisplay = page.locator('[data-testid="total"], .total-amount');
    this.discountInput = page.locator('input[placeholder*="desconto" i], input[name="discount"]');
    this.notesInput = page.locator('textarea[placeholder*="observa" i], input[name="notes"]');
    this.clientNameDisplay = page.locator('[data-testid="client-name"]');
    this.serviceNameDisplay = page.locator('[data-testid="service-name"]');
  }

  async selectPaymentMethod(method: 'dinheiro' | 'pix' | 'cartao' | 'credit'): Promise<void> {
    const methodMap: Record<string, string> = {
      dinheiro: 'Dinheiro',
      pix: 'Pix',
      cartao: 'Cartão',
      credit: 'Crédito',
    };
    await this.page.getByRole('button', { name: methodMap[method] || method }).click();
  }

  async addDiscount(amount: number): Promise<void> {
    await this.discountInput.fill(String(amount));
  }

  async addNotes(text: string): Promise<void> {
    await this.notesInput.fill(text);
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
    await this.waitForToast();
  }

  async getTotal(): Promise<string> {
    return (await this.totalDisplay.textContent()) || '';
  }
}
