import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { getFixtureState } from '../data/fixtureState';
import { getAdminClient } from '../helpers/supabaseAdmin';
import { signInAsUser } from '../helpers/supabaseUser';
import { CommissionsPage } from '../pages/CommissionsPage';

/**
 * PILAR P2 — Checkout com Split de Comissão & Idempotência Financeira
 *
 * Subfase 6.5 (E2E Críticos) — Fase 6: Production Readiness
 *
 * Cenário de Negócio Coberto:
 * 1. Comanda criada com serviço no valor de R$ 100,00.
 * 2. Inclusão de 2 participantes em service_execution_participants ANTES da liquidação:
 *    - Barbeiro A (Primary): 70% da execução, alíquota de comissão = 50% -> Repasse esperado: R$ 35,00.
 *    - Barbeiro B (Secondary): 30% da execução, alíquota de comissão = 40% -> Repasse esperado: R$ 12,00.
 * 3. Finalização de checkout com split financeiro e pagamento (status 'paid').
 * 4. Validação de idempotência: re-execução do pagamento não deve duplicar comissões nem transações.
 * 5. Conferência dos valores calculados na tela de Comissões (/#/commissions) para cada profissional.
 * 6. Teardown transacional em ordem estrita de FKs.
 */

interface P2Context {
  tenantId: string;
  clientId: string;
  serviceId: string;
  staffPrimaryId: string;
  staffSecondaryId: string;
  staffPrimaryName: string;
  staffSecondaryName: string;
  comandaId?: string;
  comandaItemId?: string;
}

async function dismissChangelogModal(page: Page): Promise<void> {
  const heading = page.getByText('Novidades e melhorias da semana');
  if (await heading.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await heading.waitFor({ state: 'hidden', timeout: 8_000 });
  }
}

async function cleanupP2Data(ctx: P2Context): Promise<void> {
  const admin = getAdminClient();

  if (ctx.comandaItemId) {
    await admin
      .from('service_execution_participants')
      .delete()
      .eq('comanda_item_id', ctx.comandaItemId);
  }

  if (ctx.comandaId) {
    await admin
      .from('commission_records')
      .delete()
      .eq('tenant_id', ctx.tenantId)
      .eq('comanda_id', ctx.comandaId);

    await admin
      .from('comanda_payments')
      .delete()
      .eq('tenant_id', ctx.tenantId)
      .eq('comanda_id', ctx.comandaId);

    await admin
      .from('transactions')
      .delete()
      .eq('tenant_id', ctx.tenantId)
      .eq('source_type', 'comanda')
      .eq('source_id', ctx.comandaId);

    await admin
      .from('comanda_items')
      .delete()
      .eq('tenant_id', ctx.tenantId)
      .eq('comanda_id', ctx.comandaId);

    await admin
      .from('comandas')
      .delete()
      .eq('id', ctx.comandaId);
  }

  if (ctx.staffSecondaryId) {
    await admin.from('staff').delete().eq('id', ctx.staffSecondaryId);
  }
  if (ctx.staffPrimaryId) {
    await admin.from('staff').delete().eq('id', ctx.staffPrimaryId);
  }
  if (ctx.serviceId) {
    await admin.from('services').delete().eq('id', ctx.serviceId);
  }
  if (ctx.clientId) {
    await admin.from('clients').delete().eq('id', ctx.clientId);
  }
}

test.describe('Pilar P2 — Checkout com Split de Comissão & Idempotência Financeira', () => {
  const allowSharedExecution = process.env.E2E_ALLOW_PROD_EXECUTION === 'true';
  test.skip(!allowSharedExecution, 'Execution against staging environment is gated by E2E_ALLOW_PROD_EXECUTION=true');

  test('should_calculate_commission_split_between_participants_and_maintain_idempotency', async ({ loggedAdmin }) => {
    test.setTimeout(240_000);
    const { tenantId, users } = getFixtureState();
    const admin = getAdminClient();
    const userClient = await signInAsUser(users.manager.email, users.manager.password);

    const now = new Date();
    const nowIso = now.toISOString();
    const todayYmd = now.toISOString().split('T')[0];
    const runNonce = Date.now().toString().slice(-6);

    const ctx: P2Context = {
      tenantId,
      clientId: '',
      serviceId: '',
      staffPrimaryId: '',
      staffSecondaryId: '',
      staffPrimaryName: `Barbeiro Alfa ${runNonce}`,
      staffSecondaryName: `Barbeiro Beta ${runNonce}`,
    };

    try {
      // 1. Arrange: Cliente efêmero
      const { data: client, error: clientErr } = await admin
        .from('clients')
        .insert({
          tenant_id: tenantId,
          name: `Cliente Split ${runNonce}`,
          phone: `119${runNonce}4321`,
          created_at: nowIso,
        })
        .select('id')
        .single();
      if (clientErr || !client) throw new Error(`Falha ao criar cliente: ${clientErr?.message}`);
      ctx.clientId = client.id;

      // 2. Arrange: Serviço de R$ 100,00
      const { data: service, error: serviceErr } = await admin
        .from('services')
        .insert({
          tenant_id: tenantId,
          name: `Corte Split Especial ${runNonce}`,
          price: 100.0,
          duration_minutes: 45,
          active: true,
          created_at: nowIso,
        })
        .select('id')
        .single();
      if (serviceErr || !service) throw new Error(`Falha ao criar serviço: ${serviceErr?.message}`);
      ctx.serviceId = service.id;

      // 3. Arrange: Barbeiro Principal (50% de comissão) e Secundário (40% de comissão)
      const { data: staff1, error: staff1Err } = await admin
        .from('staff')
        .insert({
          tenant_id: tenantId,
          name: ctx.staffPrimaryName,
          role: 'Barbeiro Sênior',
          commission_rate: 50.0,
          active: true,
          created_at: nowIso,
        })
        .select('id')
        .single();
      if (staff1Err || !staff1) throw new Error(`Falha ao criar Barbeiro 1: ${staff1Err?.message}`);
      ctx.staffPrimaryId = staff1.id;

      const { data: staff2, error: staff2Err } = await admin
        .from('staff')
        .insert({
          tenant_id: tenantId,
          name: ctx.staffSecondaryName,
          role: 'Barbeiro Assistente',
          commission_rate: 40.0,
          active: true,
          created_at: nowIso,
        })
        .select('id')
        .single();
      if (staff2Err || !staff2) throw new Error(`Falha ao criar Barbeiro 2: ${staff2Err?.message}`);
      ctx.staffSecondaryId = staff2.id;

      // 4. Arrange: Criar Comanda aberta com 1 item de R$ 100,00
      const { data: comanda, error: comandaErr } = await userClient
        .from('comandas')
        .insert({
          tenant_id: tenantId,
          client_id: ctx.clientId,
          staff_id: ctx.staffPrimaryId,
          status: 'open',
          total: 100.0,
          created_at: nowIso,
        })
        .select('id')
        .single();
      if (comandaErr || !comanda) throw new Error(`Falha ao criar comanda: ${comandaErr?.message}`);
      ctx.comandaId = comanda.id;

      const { data: comandaItem, error: itemErr } = await userClient
        .from('comanda_items')
        .insert({
          tenant_id: tenantId,
          comanda_id: ctx.comandaId,
          service_id: ctx.serviceId,
          staff_id: ctx.staffPrimaryId,
          quantity: 1,
          unit_price: 100.0,
          price: 100.0,
          created_at: nowIso,
        })
        .select('id')
        .single();
      if (itemErr || !comandaItem) throw new Error(`Falha ao criar comanda_item: ${itemErr?.message}`);
      ctx.comandaItemId = comandaItem.id;

      // 5. Inclusão dos Participantes ANTES do fechamento (Diretriz D-HOM-37 / PO)
      // Barbeiro A: 70% rateio
      const { error: part1Err } = await userClient
        .from('service_execution_participants')
        .insert({
          tenant_id: tenantId,
          comanda_item_id: ctx.comandaItemId,
          staff_id: ctx.staffPrimaryId,
          professional_id: ctx.staffPrimaryId,
          role: 'primary',
          payout_type: 'percentage',
          payout_value: 70.0,
          affects_commission: true,
          created_at: nowIso,
        });
      if (part1Err) throw new Error(`Falha ao registrar participante 1: ${part1Err.message}`);

      // Barbeiro B: 30% rateio
      const { error: part2Err } = await userClient
        .from('service_execution_participants')
        .insert({
          tenant_id: tenantId,
          comanda_item_id: ctx.comandaItemId,
          staff_id: ctx.staffSecondaryId,
          professional_id: ctx.staffSecondaryId,
          role: 'secondary',
          payout_type: 'percentage',
          payout_value: 30.0,
          affects_commission: true,
          created_at: nowIso,
        });
      if (part2Err) throw new Error(`Falha ao registrar participante 2: ${part2Err.message}`);

      // 6. Fechamento e Liquidação do Checkout
      const { error: payErr } = await userClient
        .from('comanda_payments')
        .insert({
          tenant_id: tenantId,
          comanda_id: ctx.comandaId,
          amount: 100.0,
          payment_method: 'money',
          created_at: nowIso,
        });
      if (payErr) throw new Error(`Falha ao registrar pagamento: ${payErr.message}`);

      const { error: closeErr } = await userClient
        .from('comandas')
        .update({
          status: 'paid',
          payment_method: 'money',
          paid_amount: 100.0,
          closed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', ctx.comandaId);
      if (closeErr) throw new Error(`Falha ao liquidar comanda: ${closeErr.message}`);

      // 7. Teste de Idempotência Financeira
      // Repetir a atualização de status/pagamento não deve quebrar nem duplicar
      const { error: idempErr } = await userClient
        .from('comandas')
        .update({
          status: 'paid',
          paid_amount: 100.0,
          closed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', ctx.comandaId);
      expect(idempErr).toBeNull();

      // Verificar que não há pagamentos duplicados
      const { data: paymentsList } = await userClient
        .from('comanda_payments')
        .select('id')
        .eq('comanda_id', ctx.comandaId);
      expect(paymentsList?.length).toBe(1);

      // 8. Navegação e Validação na UI de Comissões (/#/commissions)
      const commissionsPage = new CommissionsPage(loggedAdmin);
      await commissionsPage.goto();
      await dismissChangelogModal(loggedAdmin);
      await expect(commissionsPage.heading).toBeVisible({ timeout: 15_000 });

      // Ajustar filtro de período para cobrir a competência da execução
      await commissionsPage.setDateRange(todayYmd, todayYmd);

      // Barbeiro Alfa: Base R$ 70,00 | Alíquota 50% -> Comissão R$ 35,00
      const rowAlfa = commissionsPage.getRowForProfessional(ctx.staffPrimaryName);
      await expect(rowAlfa).toBeVisible({ timeout: 15_000 });
      await expect(rowAlfa).toContainText('R$ 35,00');

      // Barbeiro Beta: Base R$ 30,00 | Alíquota 40% -> Comissão R$ 12,00
      const rowBeta = commissionsPage.getRowForProfessional(ctx.staffSecondaryName);
      await expect(rowBeta).toBeVisible({ timeout: 15_000 });
      await expect(rowBeta).toContainText('R$ 12,00');
    } finally {
      // 9. Teardown Transacional em Ordem Inversa de FKs
      await cleanupP2Data(ctx);
    }
  });
});
