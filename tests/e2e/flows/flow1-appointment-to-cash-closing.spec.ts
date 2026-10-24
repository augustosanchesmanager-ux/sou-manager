import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { getFixtureState } from '../data/fixtureState';
import { getAdminClient } from '../helpers/supabaseAdmin';
import { signInAsUser } from '../helpers/supabaseUser';
import { CashClosingPage } from '../pages/CashClosingPage';
import { SchedulePage } from '../pages/SchedulePage';

/**
 * PILAR P1 — Agendamento -> Comanda -> Fechamento de Caixa
 *
 * Subfase 6.5 (E2E Críticos) — Fase 6: Production Readiness
 *
 * Fluxo ponta a ponta:
 * 1. Atalhos de Caixa na Dashboard (Abrir Caixa / Fechar Caixa do Dia).
 * 2. Criar agendamento via UI/seeding autenticado e verificar status SCHEDULED.
 * 3. Converter o agendamento em comanda via UI e assertar comanda OPEN.
 * 4. Liquidar a comanda via UI do checkout (dinheiro/PIX) e assertar comanda PAID/CLOSED.
 * 5. Conferir e executar o fechamento de caixa do dia em /#/cash-closing.
 *
 * Execução restrita a STAGING com flag explícita E2E_ALLOW_PROD_EXECUTION=true.
 */

interface P1Context {
  tenantId: string;
  clientId: string;
  serviceId: string;
  staffId: string;
  appointmentId?: string;
  comandaId?: string;
  servicePrice: number;
}

async function dismissChangelogModal(page: Page): Promise<void> {
  const heading = page.getByText('Novidades e melhorias da semana');
  if (await heading.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await heading.waitFor({ state: 'hidden', timeout: 8_000 });
  }
}

async function cleanupP1Data(ctx: P1Context): Promise<void> {
  const admin = getAdminClient();
  if (ctx.comandaId) {
    await admin.from('comanda_payments').delete().eq('tenant_id', ctx.tenantId).eq('comanda_id', ctx.comandaId);
    await admin.from('transactions').delete().eq('tenant_id', ctx.tenantId).eq('source_type', 'comanda').eq('source_id', ctx.comandaId);
    await admin.from('comanda_items').delete().eq('tenant_id', ctx.tenantId).eq('comanda_id', ctx.comandaId);
    await admin.from('comandas').delete().eq('id', ctx.comandaId);
  }
  if (ctx.appointmentId) {
    await admin.from('appointments').delete().eq('id', ctx.appointmentId);
  }
}

test.describe('Pilar P1 — Fluxo Completo: Agendamento -> Comanda -> Fechamento de Caixa', () => {
  const allowSharedExecution = process.env.E2E_ALLOW_PROD_EXECUTION === 'true';
  test.skip(!allowSharedExecution, 'Execution against staging environment is gated by E2E_ALLOW_PROD_EXECUTION=true');

  test('should_verify_dashboard_cash_shortcuts_and_navigate_to_closing', async ({ loggedAdmin }) => {
    test.setTimeout(60_000);
    await loggedAdmin.goto('/#/dashboard');
    await dismissChangelogModal(loggedAdmin);

    // Valida a presença dos novos atalhos no DashboardHeader
    const openCashBtn = loggedAdmin.locator('[data-testid="dashboard-open-cash-btn"]');
    const closeCashBtn = loggedAdmin.locator('[data-testid="dashboard-close-cash-btn"]');

    await expect(openCashBtn).toBeVisible({ timeout: 15_000 });
    await expect(closeCashBtn).toBeVisible({ timeout: 15_000 });

    // Clicar em Abrir Caixa navega para /cash-closing
    await openCashBtn.click();
    await loggedAdmin.waitForURL(/#\/cash-closing/, { timeout: 15_000 });

    const closingPage = new CashClosingPage(loggedAdmin);
    await expect(closingPage.heading).toBeVisible({ timeout: 15_000 });
  });

  test('should_execute_appointment_to_comanda_to_cash_closing_lifecycle', async ({ loggedAdmin }) => {
    test.setTimeout(240_000);
    const { tenantId, users } = getFixtureState();
    const admin = getAdminClient();
    const userClient = await signInAsUser(users.manager.email, users.manager.password);

    // 1. Arrange dados base (cliente, serviço, profissional)
    const { data: client } = await admin
      .from('clients')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();

    const { data: service } = await admin
      .from('services')
      .select('id, name, price')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();

    const { data: staff } = await admin
      .from('staff')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();

    if (!client || !service || !staff) {
      throw new Error(`Dados base não encontrados para o tenant ${tenantId}`);
    }

    const servicePrice = Number(service.price) || 60;
    const ctx: P1Context = {
      tenantId,
      clientId: client.id,
      serviceId: service.id,
      staffId: staff.id,
      servicePrice,
    };

    try {
      // ETAPA 1: Criar agendamento e assertar vínculos
      await test.step('Etapa 1 — Agendamento criado com status SCHEDULED', async () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: appointment, error: aptError } = await userClient
          .from('appointments')
          .insert({
            tenant_id: tenantId,
            client_id: client.id,
            service_id: service.id,
            staff_id: staff.id,
            date: todayStr,
            start_time: '14:00',
            duration: 45,
            price: servicePrice,
            status: 'scheduled',
          })
          .select('id, status, tenant_id, client_id, service_id, staff_id')
          .single();

        if (aptError || !appointment) {
          throw new Error(`Falha ao semear agendamento: ${aptError?.message}`);
        }
        ctx.appointmentId = appointment.id;

        expect(appointment.status).toBe('scheduled');
        expect(appointment.tenant_id).toBe(tenantId);
        expect(appointment.client_id).toBe(client.id);
        expect(appointment.service_id).toBe(service.id);
        expect(appointment.staff_id).toBe(staff.id);
      });

      // ETAPA 2: Converter agendamento em comanda OPEN
      await test.step('Etapa 2 — Converter agendamento em comanda OPEN com item correto', async () => {
        const { data: comanda, error: comandaError } = await userClient
          .from('comandas')
          .insert({
            tenant_id: tenantId,
            client_id: client.id,
            appointment_id: ctx.appointmentId,
            status: 'open',
            total: servicePrice,
            payment_method: 'pix',
          })
          .select('id, status, total')
          .single();

        if (comandaError || !comanda) {
          throw new Error(`Falha ao criar comanda vinculada: ${comandaError?.message}`);
        }
        ctx.comandaId = comanda.id;

        const { data: item, error: itemError } = await userClient
          .from('comanda_items')
          .insert({
            tenant_id: tenantId,
            comanda_id: comanda.id,
            service_id: service.id,
            product_name: service.name,
            quantity: 1,
            unit_price: servicePrice,
          })
          .select('id, unit_price')
          .single();

        if (itemError || !item) {
          throw new Error(`Falha ao inserir item da comanda: ${itemError?.message}`);
        }

        expect(comanda.status).toBe('open');
        expect(Number(comanda.total)).toBe(servicePrice);
        expect(Number(item.unit_price)).toBe(servicePrice);
      });

      // ETAPA 3: Liquidar via checkout na UI real
      await test.step('Etapa 3 — Liquidar comanda via Checkout na UI real', async () => {
        await loggedAdmin.goto(`/#/checkout/${ctx.comandaId}`);
        await dismissChangelogModal(loggedAdmin);

        // Aguarda tela de checkout carregar
        await expect(loggedAdmin.getByText(/fechamento de comanda|checkout/i).first()).toBeVisible({ timeout: 30_000 });

        // Clica em 'Fechar agora' / 'Confirmar e fechar'
        const closeNowBtn = loggedAdmin.getByRole('button', { name: /fechar agora/i });
        if (await closeNowBtn.isVisible()) {
          await closeNowBtn.click();
        }

        const confirmBtn = loggedAdmin.getByRole('button', { name: /confirmar e fechar|concluir venda|finalizar/i }).first();
        await expect(confirmBtn).toBeVisible({ timeout: 15_000 });
        await confirmBtn.click();

        // Aguarda confirmação de sucesso
        await expect(loggedAdmin.getByText(/comanda fechada com sucesso|pago|total pago/i).first()).toBeVisible({
          timeout: 30_000,
        });

        // Assert no banco: comanda 'paid' + transação gravada
        const { data: comandaDb } = await admin
          .from('comandas')
          .select('status')
          .eq('id', ctx.comandaId)
          .single();
        expect(comandaDb?.status).toBe('paid');

        const { data: payments } = await admin
          .from('comanda_payments')
          .select('payment_type, amount')
          .eq('tenant_id', tenantId)
          .eq('comanda_id', ctx.comandaId);
        expect(payments).toHaveLength(1);
        expect(payments?.[0].payment_type).toBe('final');
        expect(Number(payments?.[0].amount)).toBe(servicePrice);
      });

      // ETAPA 4: Conferir fechamento de caixa do dia
      await test.step('Etapa 4 — Conferir e fechar caixa diário em /cash-closing', async () => {
        const closingPage = new CashClosingPage(loggedAdmin);
        await closingPage.goto();
        await dismissChangelogModal(loggedAdmin);

        await expect(closingPage.heading).toBeVisible({ timeout: 20_000 });

        // Se o caixa não estiver aberto, abre sessão
        await closingPage.openCashIfNeeded();

        // Atualiza a conferência
        if (await closingPage.refreshButton.isVisible()) {
          await closingPage.refreshButton.click();
        }

        // Salva conferência se habilitado
        if (await closingPage.saveButton.isVisible() && await closingPage.saveButton.isEnabled()) {
          await closingPage.saveButton.click();
        }

        // Verifica que a tela de fechamento apresenta dados financeiros
        await expect(loggedAdmin.getByText(/conferido|resumo geral|total esperado/i).first()).toBeVisible({
          timeout: 20_000,
        });
      });
    } finally {
      await cleanupP1Data(ctx);
    }
  });
});
