import { test, expect } from '../fixtures/auth.fixture';

// ─── Helpers ───────────────────────────────────────────────
const uniqueId = Date.now();
const TEST_AP_NAME = `E2E-AP-${uniqueId}`;
const TEST_RECURRING_NAME = `E2E-Rec-${uniqueId}`;
const TEST_AP_PAY = `E2E-Pay-${uniqueId}`;
const TEST_AP_CANCEL = `E2E-Cancel-${uniqueId}`;
const TEST_AP_IDEMPOTENT = `E2E-Idem-${uniqueId}`;

async function gotoExpenses(page: import('@playwright/test').Page) {
  await page.goto('/#/expenses');
  await expect(page.locator('h3:has-text("Contas a Pagar")')).toBeVisible({ timeout: 30_000 });
}

// Widget tabs use format "Pendentes (N)" — use exact text to disambiguate from expense filters
const widgetTab = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`${name} \\(\\d+\\)`) });

/** Wait for a toast with the given message to appear, then wait for it to disappear */
async function waitForToast(page: import('@playwright/test').Page, message: string, timeoutMs = 10_000) {
  const toast = page.locator(`span.text-sm.font-bold:has-text("${message}")`);
  await expect(toast).toBeVisible({ timeout: timeoutMs });
  await page.waitForTimeout(1_000);
}

/** Fill and submit the one-time AP form */
async function createOneTimeAP(page: import('@playwright/test').Page, name: string, amount: string) {
  await page.getByRole('button', { name: /\+ Avulsa/ }).click();
  await expect(page.locator('h3:has-text("Nova Conta Avulsa")')).toBeVisible({ timeout: 5_000 });

  await page.locator('input[placeholder*="Compra"]').fill(name);
  await page.locator('input[type="number"][step="0.01"]').fill(amount);
  const today = new Date().toISOString().split('T')[0];
  await page.locator('input[type="date"]').fill(today);

  await page.getByRole('button', { name: 'Criar Conta' }).click();
}

/** Fill and submit the recurring bill form */
async function createRecurringBill(page: import('@playwright/test').Page, name: string, amount: string, dueDay: string) {
  await page.getByRole('button', { name: /\+ Recorrência/ }).click();
  await expect(page.locator('h3:has-text("Nova Recorrência")')).toBeVisible({ timeout: 5_000 });

  await page.locator('input[placeholder*="Aluguel"]').fill(name);
  await page.locator('input[type="number"][step="0.01"]').fill(amount);
  await page.locator('input[type="number"][min="1"]').fill(dueDay);

  await page.getByRole('button', { name: 'Criar Recorrência' }).click();
}

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

// ─── REAL CRUD: Create One-time AP ────────────────────────
test.describe('P0.4 — CRUD: Create one-time AP', () => {
  test('should_create_avulsa_and_appear_in_pending_tab', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    // Read initial pending count from tab button text
    const pendingTab = widgetTab(loggedAdmin, 'Pendentes');
    const initialTabText = await pendingTab.textContent();
    const initialCount = parseInt(initialTabText?.match(/\((\d+)\)/)?.[1] || '0', 10);

    // Create
    await createOneTimeAP(loggedAdmin, TEST_AP_NAME, '150.75');

    // Assert: success toast appears
    await waitForToast(loggedAdmin, 'Conta avulsa criada!');

    // Assert: no error banner
    await expect(loggedAdmin.locator('[data-testid="widget-error"]')).not.toBeVisible({ timeout: 3_000 });

    // Assert: item appears in the pending list
    await expect(loggedAdmin.locator(`p:has-text("${TEST_AP_NAME}")`).first()).toBeVisible({ timeout: 5_000 });

    // Assert: pending count incremented
    const newTabText = await pendingTab.textContent();
    const newCount = parseInt(newTabText?.match(/\((\d+)\)/)?.[1] || '0', 10);
    expect(newCount).toBeGreaterThanOrEqual(initialCount + 1);
  });

  test('should_create_avulsa_and_appear_after_page_reload', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    // Create
    await createOneTimeAP(loggedAdmin, `E2E-Persist-${uniqueId}`, '200.00');
    await waitForToast(loggedAdmin, 'Conta avulsa criada!');

    // Reload page and verify item persists
    await loggedAdmin.goto('/#/expenses');
    await expect(loggedAdmin.locator('h3:has-text("Contas a Pagar")')).toBeVisible({ timeout: 15_000 });

    await expect(loggedAdmin.locator(`p:has-text("E2E-Persist-${uniqueId}")`).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─── REAL CRUD: Pay AP ───────────────────────────────────
test.describe('P0.4 — CRUD: Pay AP', () => {
  test('should_pay_pending_ap_and_move_to_paid_tab', { timeout: 60_000 }, async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    // Create a payable item first
    await createOneTimeAP(loggedAdmin, TEST_AP_PAY, '300.00');
    await waitForToast(loggedAdmin, 'Conta avulsa criada!');

    const itemRow = loggedAdmin.locator('div.space-y-2 > div').filter({ hasText: TEST_AP_PAY }).first();
    await expect(itemRow).toBeVisible({ timeout: 5_000 });

    // Click BAIXAR
    const payButton = itemRow.locator('button:has-text("BAIXAR")');
    await payButton.click();

    // Assert: success toast
    await waitForToast(loggedAdmin, 'Baixa realizada');

    // Assert: no error banner
    await expect(loggedAdmin.locator('[data-testid="widget-error"]')).not.toBeVisible({ timeout: 3_000 });

    // Assert: item no longer in pending tab
    const pendingTab = widgetTab(loggedAdmin, 'Pendentes');
    await pendingTab.click();
    await loggedAdmin.waitForTimeout(500);
    await expect(itemRow).not.toBeVisible({ timeout: 5_000 });

    // Assert: item appears in paid tab
    const paidTab = widgetTab(loggedAdmin, 'Pagas');
    await paidTab.click();
    await loggedAdmin.waitForTimeout(500);
    await expect(loggedAdmin.locator(`p:has-text("${TEST_AP_PAY}")`).first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── REAL CRUD: Cancel AP ────────────────────────────────
test.describe('P0.4 — CRUD: Cancel AP', () => {
  test('should_cancel_pending_ap_and_move_to_cancelled_tab', { timeout: 60_000 }, async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    // Create a payable item first
    await createOneTimeAP(loggedAdmin, TEST_AP_CANCEL, '450.00');
    await waitForToast(loggedAdmin, 'Conta avulsa criada!');

    // Find the item row and click cancel (the X icon button)
    const itemRow = loggedAdmin.locator('div.space-y-2 > div').filter({ hasText: TEST_AP_CANCEL }).first();
    await expect(itemRow).toBeVisible({ timeout: 5_000 });

    // Click the cancel button (title="Cancelar")
    const cancelButton = itemRow.locator('button[title="Cancelar"]');
    await cancelButton.click();

    // Assert: success toast (info type)
    await waitForToast(loggedAdmin, 'Conta cancelada');

    // Assert: no error banner
    await expect(loggedAdmin.locator('[data-testid="widget-error"]')).not.toBeVisible({ timeout: 3_000 });

    // Assert: item no longer in pending tab
    const pendingTab = widgetTab(loggedAdmin, 'Pendentes');
    await pendingTab.click();
    await loggedAdmin.waitForTimeout(500);
    await expect(itemRow).not.toBeVisible({ timeout: 5_000 });

    // Assert: item appears in cancelled tab
    const cancelledTab = widgetTab(loggedAdmin, 'Canceladas');
    await cancelledTab.click();
    await loggedAdmin.waitForTimeout(500);
    await expect(loggedAdmin.locator(`p:has-text("${TEST_AP_CANCEL}")`).first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── REAL CRUD: Recurring bill ───────────────────────────
test.describe('P0.4 — CRUD: Recurring bill', () => {
  test('should_create_recurring_bill_and_appear_in_recurring_tab', { timeout: 60_000 }, async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    // Switch to recurring tab first to see initial state
    await widgetTab(loggedAdmin, 'Recorrências').click();
    await loggedAdmin.waitForTimeout(500);

    // Create recurring bill
    await createRecurringBill(loggedAdmin, TEST_RECURRING_NAME, '800', '15');

    // Assert: success toast
    await waitForToast(loggedAdmin, 'Recorrência criada!');

    // Assert: no error banner
    await expect(loggedAdmin.locator('[data-testid="widget-error"]')).not.toBeVisible({ timeout: 3_000 });

    // Assert: item appears in recurring tab
    await expect(loggedAdmin.locator(`p:has-text("${TEST_RECURRING_NAME}")`).first()).toBeVisible({ timeout: 5_000 });

    // Assert: recurring tab count incremented
    const recurringTab = widgetTab(loggedAdmin, 'Recorrências');
    const tabText = await recurringTab.textContent();
    const count = parseInt(tabText?.match(/\((\d+)\)/)?.[1] || '0', 10);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should_deactivate_recurring_bill', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    // Create a recurring bill to deactivate
    const deactivateName = `E2E-Deact-${uniqueId}`;
    await createRecurringBill(loggedAdmin, deactivateName, '500', '20');
    await waitForToast(loggedAdmin, 'Recorrência criada!');

    // Switch to recurring tab
    await widgetTab(loggedAdmin, 'Recorrências').click();
    await loggedAdmin.waitForTimeout(500);

    // Find the item and click deactivate (pause_circle icon)
    const itemRow = loggedAdmin.locator(`div:has(> div > p:has-text("${deactivateName}"))`).first();
    await expect(itemRow).toBeVisible({ timeout: 5_000 });

    const deactivateButton = itemRow.locator('button[title="Desativar"]');
    await deactivateButton.click();

    // Assert: info toast
    await waitForToast(loggedAdmin, 'Recorrência desativada');

    // Assert: item shows "Inativa" label
    await expect(itemRow.locator('p:has-text("Inativa")')).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Idempotency: duplicate prevention ────────────────────
test.describe('P0.4 — Idempotency', () => {
  test('should_prevent_duplicate_recurring_bill_on_double_submit', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    // Open recurring modal
    await loggedAdmin.getByRole('button', { name: /\+ Recorrência/ }).click();
    await expect(loggedAdmin.locator('h3:has-text("Nova Recorrência")')).toBeVisible({ timeout: 5_000 });

    // Fill form
    await loggedAdmin.locator('input[placeholder*="Aluguel"]').fill(TEST_AP_IDEMPOTENT);
    await loggedAdmin.locator('input[type="number"][step="0.01"]').fill('999');
    await loggedAdmin.locator('input[type="number"][min="1"]').fill('25');

    // Submit twice rapidly
    const submitBtn = loggedAdmin.getByRole('button', { name: 'Criar Recorrência' });
    await submitBtn.click();
    await loggedAdmin.waitForTimeout(500);
    // Second submit — modal may have closed, skip if so
    const modalStillOpen = await loggedAdmin.locator('h3:has-text("Nova Recorrência")').isVisible().catch(() => false);
    if (modalStillOpen) {
      await submitBtn.click();
    }

    await loggedAdmin.waitForTimeout(5_000);

    // Switch to recurring tab and count items with this name
    await widgetTab(loggedAdmin, 'Recorrências').click();
    await loggedAdmin.waitForTimeout(500);

    const matchingItems = loggedAdmin.locator(`p:has-text("${TEST_AP_IDEMPOTENT}")`);
    const count = await matchingItems.count();
    // At most 1 item should exist (idempotency prevents duplicates)
    expect(count).toBeLessThanOrEqual(1);
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

// ─── Error visibility ─────────────────────────────────────
test.describe('P0.4 — Error visibility', () => {
  test('should_not_show_error_banner_on_successful_operations', async ({ loggedAdmin }) => {
    await gotoExpenses(loggedAdmin);

    // Perform a successful create
    await createOneTimeAP(loggedAdmin, `E2E-NoError-${uniqueId}`, '100');
    await waitForToast(loggedAdmin, 'Conta avulsa criada!');

    // Assert: no error banner visible
    await expect(loggedAdmin.locator('[data-testid="widget-error"]')).not.toBeVisible({ timeout: 3_000 });
  });
});
