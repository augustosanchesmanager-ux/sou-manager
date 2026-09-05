import { test, expect } from '../fixtures/auth.fixture';

test.describe('P0.4 — Contas a Pagar (E2E)', () => {
  test('should_render_expenses_page_without_crash', async ({ loggedAdmin }) => {
    await loggedAdmin.goto(`/#/expenses`);
    await loggedAdmin.waitForTimeout(3000);

    await expect(loggedAdmin.locator('h2:has-text("Gestão de Saídas")')).toBeVisible({ timeout: 10_000 });
  });

  test('should_render_expenses_table', async ({ loggedAdmin }) => {
    await loggedAdmin.goto(`/#/expenses`);
    await loggedAdmin.waitForTimeout(3000);

    await expect(loggedAdmin.locator('th:has-text("Descrição")')).toBeVisible({ timeout: 10_000 });
    await expect(loggedAdmin.locator('th:has-text("Categoria")')).toBeVisible({ timeout: 5_000 });
    await expect(loggedAdmin.locator('th:has-text("Valor")')).toBeVisible({ timeout: 5_000 });
    await expect(loggedAdmin.locator('th:has-text("Status")')).toBeVisible({ timeout: 5_000 });
  });

  test('should_have_new_expense_button', async ({ loggedAdmin }) => {
    await loggedAdmin.goto(`/#/expenses`);
    await loggedAdmin.waitForTimeout(3000);

    await expect(loggedAdmin.getByRole('button', { name: /NOVA SAÍDA/ })).toBeVisible({ timeout: 10_000 });
  });

  test('should_have_search_and_filter_controls', async ({ loggedAdmin }) => {
    await loggedAdmin.goto(`/#/expenses`);
    await loggedAdmin.waitForTimeout(3000);

    await expect(loggedAdmin.locator('input[placeholder*="Buscar"]')).toBeVisible({ timeout: 10_000 });
    await expect(loggedAdmin.getByRole('button', { name: 'Todas' })).toBeVisible({ timeout: 5_000 });
    await expect(loggedAdmin.getByRole('button', { name: 'Pagas' })).toBeVisible({ timeout: 5_000 });
    await expect(loggedAdmin.getByRole('button', { name: 'Pendentes' })).toBeVisible({ timeout: 5_000 });
  });

  test('should_open_new_expense_modal', async ({ loggedAdmin }) => {
    await loggedAdmin.goto(`/#/expenses`);
    await loggedAdmin.waitForTimeout(3000);

    const newExpenseButton = loggedAdmin.getByRole('button', { name: /NOVA SAÍDA/ });
    await expect(newExpenseButton).toBeVisible({ timeout: 10_000 });
    await newExpenseButton.click();

    const modal = loggedAdmin.locator('.fixed.inset-0.z-\\[100\\]').first();
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await expect(modal.locator('label:has-text("Descrição")')).toBeVisible({ timeout: 5_000 });
  });
});
