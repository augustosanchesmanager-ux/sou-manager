import { test, expect } from '../fixtures/auth.fixture';

// ─── Helpers ───────────────────────────────────────────────
const uniqueId = Date.now();
const TEST_AP_NAME = `E2E-AP-${uniqueId}`;
const TEST_RECURRING_NAME = `E2E-Rec-${uniqueId}`;

async function gotoExpenses(page: import('@playwright/test').Page) {
  await page.goto('/#/expenses');
  await expect(page.locator('h3:has-text("Contas a Pagar")')).toBeVisible({ timeout: 15_000 });
}

// Widget tabs use format "Pendentes (N)" — use exact text to disambiguate from expense filters
const widgetTab = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`${name} \\(\\d+\\)`) });

// ─── Smoke (existing page) ────────────────────────────────
test.describe('P0.4 — Smoke (existing page)', () => {
  test('should_render_expenses_page_without_crash', async ({ loggedAdmin }) => {
    await loggedAdmin.goto('/#/expenses');
    await loggedAdmin.waitForTimeout(3000);
    const heading = loggedAdmin.getByRole('heading', { name: 'Gestão de Saídas' });
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Widget rendering ─────────────────────────────────────
test.describe('P0.4 — Widget rendering', () => {
  test('should_render_widget_heading_and_kpis', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    await expect(loggedAdmin.locator('h3:has-text("Contas a Pagar")')).toBeVisible();

    // KPI labels are rendered as <p> with uppercase class inside the widget
    await expect(loggedAdmin.locator('p.uppercase:has-text("A Pagar")')).toBeVisible();
    await expect(loggedAdmin.locator('p.uppercase:has-text("Vencidas")')).toBeVisible();
    await expect(loggedAdmin.locator('p.uppercase:has-text("Pagas")').first()).toBeVisible();
  });

  test('should_render_widget_tabs_with_counts', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    await expect(widgetTab(loggedAdmin, 'Pendentes')).toBeVisible();
    await expect(widgetTab(loggedAdmin, 'Pagas')).toBeVisible();
    await expect(widgetTab(loggedAdmin, 'Canceladas')).toBeVisible();
    await expect(widgetTab(loggedAdmin, 'Recorrências')).toBeVisible();
  });

  test('should_render_create_buttons', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    await expect(loggedAdmin.getByRole('button', { name: /\+ Recorrência/ })).toBeVisible();
    await expect(loggedAdmin.getByRole('button', { name: /\+ Avulsa/ })).toBeVisible();
  });

  test('should_show_empty_state_when_no_accounts', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    const emptyState = loggedAdmin.locator('p:has-text("Nenhuma conta nesta categoria.")');
    const hasItems = loggedAdmin.locator('button:has-text("BAIXAR")');
    await expect(emptyState.or(hasItems).first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Tab switching ────────────────────────────────────────
test.describe('P0.4 — Tab switching', () => {
  test('should_switch_between_all_tabs', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    for (const tabName of ['Pagas', 'Canceladas', 'Recorrências', 'Pendentes']) {
      const tab = widgetTab(loggedAdmin, tabName);
      await tab.click();
      await loggedAdmin.waitForTimeout(500);
      await expect(tab).toBeVisible();
    }
  });
});

// ─── One-time AP modal ────────────────────────────────────
test.describe('P0.4 — One-time AP modal', () => {
  test('should_open_avulsa_modal_with_all_fields', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    await loggedAdmin.getByRole('button', { name: /\+ Avulsa/ }).click();

    await expect(loggedAdmin.locator('h3:has-text("Nova Conta Avulsa")')).toBeVisible({ timeout: 5_000 });
    await expect(loggedAdmin.locator('label:has-text("Nome")')).toBeVisible();
    await expect(loggedAdmin.locator('label:has-text("Valor")')).toBeVisible();
    await expect(loggedAdmin.locator('label:has-text("Data de Vencimento")')).toBeVisible();
    await expect(loggedAdmin.locator('label:has-text("Categoria")')).toBeVisible();
  });

  test('should_close_avulsa_modal_on_cancel', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    await loggedAdmin.getByRole('button', { name: /\+ Avulsa/ }).click();
    await expect(loggedAdmin.locator('h3:has-text("Nova Conta Avulsa")')).toBeVisible({ timeout: 5_000 });

    await loggedAdmin.getByRole('button', { name: 'Cancelar' }).click();

    await expect(loggedAdmin.locator('h3:has-text("Nova Conta Avulsa")')).not.toBeVisible({ timeout: 5_000 });
  });

  test('should_fill_form_and_submit_without_crash', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    await loggedAdmin.getByRole('button', { name: /\+ Avulsa/ }).click();
    await expect(loggedAdmin.locator('h3:has-text("Nova Conta Avulsa")')).toBeVisible({ timeout: 5_000 });

    // Fill form
    await loggedAdmin.locator('input[placeholder*="Compra"]').fill(TEST_AP_NAME);
    await loggedAdmin.locator('input[type="number"][step="0.01"]').fill('150.75');
    const today = new Date().toISOString().split('T')[0];
    await loggedAdmin.locator('input[type="date"]').fill(today);

    // Submit
    await loggedAdmin.getByRole('button', { name: 'Criar Conta' }).click();

    // Wait for any outcome — modal closes (success) or error toast
    await loggedAdmin.waitForTimeout(5_000);

    // No page crash — widget heading still visible
    await expect(loggedAdmin.locator('h3:has-text("Contas a Pagar")')).toBeVisible();
  });
});

// ─── Recurring bill modal ─────────────────────────────────
test.describe('P0.4 — Recurring bill modal', () => {
  test('should_open_recurring_modal_with_all_fields', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    await loggedAdmin.getByRole('button', { name: /\+ Recorrência/ }).click();

    await expect(loggedAdmin.locator('h3:has-text("Nova Recorrência")')).toBeVisible({ timeout: 5_000 });
    await expect(loggedAdmin.locator('label:has-text("Nome")')).toBeVisible();
    await expect(loggedAdmin.locator('label:has-text("Valor")')).toBeVisible();
    await expect(loggedAdmin.locator('label:has-text("Dia de Vencimento")')).toBeVisible();
    await expect(loggedAdmin.locator('label:has-text("Categoria")')).toBeVisible();
  });

  test('should_close_recurring_modal_on_cancel', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    await loggedAdmin.getByRole('button', { name: /\+ Recorrência/ }).click();
    await expect(loggedAdmin.locator('h3:has-text("Nova Recorrência")')).toBeVisible({ timeout: 5_000 });

    await loggedAdmin.getByRole('button', { name: 'Cancelar' }).click();

    await expect(loggedAdmin.locator('h3:has-text("Nova Recorrência")')).not.toBeVisible({ timeout: 5_000 });
  });

  test('should_fill_form_and_submit_without_crash', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    await loggedAdmin.getByRole('button', { name: /\+ Recorrência/ }).click();
    await expect(loggedAdmin.locator('h3:has-text("Nova Recorrência")')).toBeVisible({ timeout: 5_000 });

    await loggedAdmin.locator('input[placeholder*="Aluguel"]').fill(TEST_RECURRING_NAME);
    await loggedAdmin.locator('input[type="number"][step="0.01"]').fill('800');
    await loggedAdmin.locator('input[type="number"][min="1"]').fill('15');

    await loggedAdmin.getByRole('button', { name: 'Criar Recorrência' }).click();

    await loggedAdmin.waitForTimeout(5_000);

    // No page crash
    await expect(loggedAdmin.locator('h3:has-text("Contas a Pagar")')).toBeVisible();
  });
});

// ─── Recurring tab ────────────────────────────────────────
test.describe('P0.4 — Recurring tab', () => {
  test('should_switch_to_recurring_tab_and_show_list', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    await widgetTab(loggedAdmin, 'Recorrências').click();
    await loggedAdmin.waitForTimeout(500);

    const emptyState = loggedAdmin.locator('p:has-text("Nenhuma recorrência cadastrada.")');
    const hasItems = loggedAdmin.locator('.space-y-2 > div');
    await expect(emptyState.or(hasItems).first()).toBeVisible({ timeout: 5_000 });
  });
});
