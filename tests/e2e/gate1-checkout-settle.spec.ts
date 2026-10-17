import { test, expect } from './fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { getFixtureState } from './data/fixtureState';
import { getAdminClient } from './helpers/supabaseAdmin';
import { signInAsUser } from './helpers/supabaseUser';

/**
 * GATE 1 — Validação da corretiva 20261010180000 no checkout real (STAGING).
 *
 * Cobre o caminho exato do bug: liquidação de comanda pela UI do checkout com
 * `p_record_comanda_payment = true`, que antes falhava com
 * `22P02 invalid input value for enum payment_type: "total"`.
 *
 * - Teste 1: liquidação direta → `comanda_payments` recebe `final` integral.
 * - Teste 2: parcial de R$ 30 via UI + liquidação via UI → `parcial 30` +
 *   `final 70` (saldo restante, sem duplicar receita).
 *
 * Seed/teardown próprios via service_role; a comanda é liquidada SOMENTE pela
 * UI (botões reais). NÃO commitar sem autorização do PO.
 *
 * Execução: PLAYWRIGHT_BASE_URL=https://staging.soumanager.com \
 *   npx playwright test gate1-checkout-settle --project=chromium
 */

interface Seed {
  comandaId: string;
  clientId: string;
  itemId: string;
}

async function seedOpenComanda(tenantId: string, total: number): Promise<Seed> {
  const admin = getAdminClient();
  // Leituras via service_role; escritas com o client autenticado do manager,
  // pois comandas possui trigger que exige auth.uid() (service_role é null).
  const { users } = getFixtureState();
  const userClient = await signInAsUser(users.manager.email, users.manager.password);
  const { data: client, error: clientError } = await admin
    .from('clients')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', 'Carlos E2E')
    .single();
  if (clientError || !client) throw new Error(`seed: client Carlos E2E: ${clientError?.message}`);
  const { data: service, error: serviceError } = await admin
    .from('services')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', 'Corte masculino')
    .single();
  if (serviceError || !service) throw new Error(`seed: service Corte masculino: ${serviceError?.message}`);

  const { data: comanda, error: comandaError } = await userClient
    .from('comandas')
    .insert({
      tenant_id: tenantId,
      client_id: client.id,
      status: 'open',
      total,
      payment_method: 'pix',
    })
    .select('id')
    .single();
  if (comandaError || !comanda) throw new Error(`seed: comandas insert: ${comandaError?.message}`);

  const { data: item, error: itemError } = await userClient
    .from('comanda_items')
    .insert({
      comanda_id: comanda.id,
      tenant_id: tenantId,
      service_id: service.id,
      product_name: 'Corte masculino',
      quantity: 1,
      unit_price: total,
    })
    .select('id')
    .single();
  if (itemError || !item) throw new Error(`seed: comanda_items insert: ${itemError?.message}`);

  return { comandaId: comanda.id as string, clientId: client.id as string, itemId: item.id as string };
}

async function cleanupComanda(tenantId: string, seed: Seed | null): Promise<void> {
  if (!seed) return;
  const admin = getAdminClient();
  await admin.from('comanda_payments').delete().eq('tenant_id', tenantId).eq('comanda_id', seed.comandaId);
  await admin
    .from('transactions')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('source_type', 'comanda')
    .eq('source_id', seed.comandaId);
  await admin.from('comanda_items').delete().eq('id', seed.itemId);
  await admin.from('comandas').delete().eq('id', seed.comandaId);
}

async function dismissChangelogModal(page: Page): Promise<void> {
  const heading = page.getByText('Novidades e melhorias da semana');
  if (await heading.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await heading.waitFor({ state: 'hidden', timeout: 10_000 });
  }
}

async function paymentRows(tenantId: string, comandaId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('comanda_payments')
    .select('payment_type, amount')
    .eq('tenant_id', tenantId)
    .eq('comanda_id', comandaId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`assert: comanda_payments select: ${error.message}`);
  return (data || []) as Array<{ payment_type: string; amount: number }>;
}

test.describe('Gate 1 — Liquidação de comanda grava payment_type final', () => {
  test('should_settle_comanda_with_final_payment_when_closing_via_checkout', async ({ loggedAdmin }) => {
    test.setTimeout(180_000);
    const { tenantId } = getFixtureState();
    let seed: Seed | null = null;
    try {
      // Arrange: comanda aberta de R$ 100, sem pagamentos prévios.
      seed = await seedOpenComanda(tenantId, 100);

      // Act: fecha pela UI real do checkout.
      await loggedAdmin.goto(`/#/checkout/${seed.comandaId}`);
      await expect(loggedAdmin.getByText('Fechamento de Comanda').first()).toBeVisible({ timeout: 30_000 });
      await dismissChangelogModal(loggedAdmin);
      await expect(loggedAdmin.getByText('R$ 100.00').first()).toBeVisible({ timeout: 15_000 });
      await loggedAdmin.getByRole('button', { name: 'Fechar agora' }).click();
      await loggedAdmin.getByRole('button', { name: 'Confirmar e fechar' }).click();
      await expect(loggedAdmin.getByText('Comanda fechada com sucesso!').first()).toBeVisible({
        timeout: 30_000,
      });
      // Tela de recibo pós-baixa (sem redirect automático): status Pago + total.
      await expect(loggedAdmin.getByText('TOTAL PAGO').first()).toBeVisible({ timeout: 15_000 });
      await expect(loggedAdmin.getByText('Pago').first()).toBeVisible({ timeout: 15_000 });

      // Assert: baixa + pagamento comprovado como 'final' integral.
      const admin = getAdminClient();
      const { data: comanda } = await admin
        .from('comandas')
        .select('status')
        .eq('id', seed.comandaId)
        .single();
      expect(comanda?.status).toBe('paid');
      const rows = await paymentRows(tenantId, seed.comandaId);
      expect(rows).toHaveLength(1);
      expect(rows[0].payment_type).toBe('final');
      expect(Number(rows[0].amount)).toBe(100);
      const { data: transactions } = await admin
        .from('transactions')
        .select('id, amount, status')
        .eq('tenant_id', tenantId)
        .eq('source_type', 'comanda')
        .eq('source_id', seed.comandaId);
      expect(transactions).toHaveLength(1);
      expect(Number(transactions?.[0].amount)).toBe(100);
      expect(transactions?.[0].status).toBe('paid');
    } finally {
      await cleanupComanda(tenantId, seed);
    }
  });

  test('should_record_only_remaining_balance_when_prior_partial_exists', async ({ loggedAdmin }) => {
    test.setTimeout(180_000);
    const { tenantId } = getFixtureState();
    let seed: Seed | null = null;
    try {
      // Arrange: comanda aberta de R$ 100.
      seed = await seedOpenComanda(tenantId, 100);

      // Act: parcial de R$ 30 pelo modal da UI, depois liquidação pela UI.
      await loggedAdmin.goto(`/#/checkout/${seed.comandaId}`);
      await expect(loggedAdmin.getByText('Fechamento de Comanda').first()).toBeVisible({ timeout: 30_000 });
      await dismissChangelogModal(loggedAdmin);
      await loggedAdmin.getByRole('button', { name: '+ Registrar Pagamento' }).click();
      await expect(loggedAdmin.getByText('Registrar Pagamento').first()).toBeVisible({ timeout: 15_000 });
      await loggedAdmin.getByRole('button', { name: 'Parcial', exact: true }).click();
      await loggedAdmin.locator('input[placeholder="0,00"]').fill('30');
      await loggedAdmin.getByRole('button', { name: 'Pix', exact: true }).click();
      await loggedAdmin.getByRole('button', { name: 'Registrar Pagamento', exact: true }).click();
      await expect(loggedAdmin.getByText('Restante').first()).toBeVisible({ timeout: 30_000 });
      await expect(loggedAdmin.getByText('R$ 70.00').first()).toBeVisible({ timeout: 15_000 });

      await loggedAdmin.getByRole('button', { name: 'Fechar agora' }).click();
      await loggedAdmin.getByRole('button', { name: 'Confirmar e fechar' }).click();
      await expect(loggedAdmin.getByText('Comanda fechada com sucesso!').first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(loggedAdmin.getByText('TOTAL PAGO').first()).toBeVisible({ timeout: 15_000 });
      await expect(loggedAdmin.getByText('Pago').first()).toBeVisible({ timeout: 15_000 });

      // Assert: parcial 30 + final 70 = 100 comprovado, sem duplicar receita.
      const rows = await paymentRows(tenantId, seed.comandaId);
      expect(rows).toHaveLength(2);
      expect(rows[0].payment_type).toBe('parcial');
      expect(Number(rows[0].amount)).toBe(30);
      expect(rows[1].payment_type).toBe('final');
      expect(Number(rows[1].amount)).toBe(70);
      const totalComprovado = rows.reduce((acc, r) => acc + Number(r.amount), 0);
      expect(totalComprovado).toBe(100);
    } finally {
      await cleanupComanda(tenantId, seed);
    }
  });
});
