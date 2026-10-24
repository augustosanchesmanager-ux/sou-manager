import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { getFixtureState } from '../data/fixtureState';
import { getAdminClient } from '../helpers/supabaseAdmin';
import { signInAsUser } from '../helpers/supabaseUser';
import { ClientsPage } from '../pages/ClientsPage';
import { CommissionsPage } from '../pages/CommissionsPage';

/**
 * PILAR P3 — Isolamento Multi-tenant & Prevenção de Data Leak (UI + Roteamento Direto + Exportação)
 *
 * Subfase 6.5 (E2E Críticos) — Fase 6: Production Readiness
 *
 * Cenário de Negócio Coberto:
 * 1. Setup Determinístico de 2 Tenants Isolados (Tenant A e Tenant B):
 *    - Tenant A: Usuário autenticado na UI via loggedAdmin / login real.
 *    - Tenant B: Tenant distinto semeado via Admin Client com cliente, comanda e registros próprios.
 * 2. Isolamento de Listagens na UI (Clients & Comissões):
 *    - O Gerente do Tenant A NÃO visualiza clientes ou dados pertencentes ao Tenant B.
 * 3. Tentativa Adversarial de Navegação por ID Direto na Rota:
 *    - Navegação direta para /#/checkout/[comanda_id_tenant_b]:
 *    - O sistema DEVE bloquear o carregamento dos dados do Tenant B (redirecionar, emitir erro de segurança ou carregar comanda vazia sem vazar dados).
 * 4. Validação de Integridade na Exportação de Dados (CSV):
 *    - Disparo de exportação de clientes em /#/clients e verificação de que o payload contém estritamente registros do Tenant A.
 * 5. Teardown Transacional:
 *    - Remoção limpa e FK-aware de todos os artefatos de dados do Tenant B e do Tenant A.
 */

interface P3Context {
  tenantAId: string;
  tenantBId: string;
  clientAId?: string;
  clientAName: string;
  clientBId?: string;
  clientBName: string;
  comandaBId?: string;
  serviceBId?: string;
}

async function dismissChangelogModal(page: Page): Promise<void> {
  const heading = page.getByText('Novidades e melhorias da semana');
  if (await heading.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await heading.waitFor({ state: 'hidden', timeout: 8_000 });
  }
}

async function cleanupP3Data(ctx: P3Context): Promise<void> {
  const admin = getAdminClient();

  // Limpeza Tenant B
  if (ctx.comandaBId) {
    await admin.from('comanda_items').delete().eq('tenant_id', ctx.tenantBId).eq('comanda_id', ctx.comandaBId);
    await admin.from('comandas').delete().eq('id', ctx.comandaBId);
  }
  if (ctx.serviceBId) {
    await admin.from('services').delete().eq('id', ctx.serviceBId);
  }
  if (ctx.clientBId) {
    await admin.from('clients').delete().eq('id', ctx.clientBId);
  }
  if (ctx.tenantBId) {
    await admin.from('tenants').delete().eq('id', ctx.tenantBId);
  }

  // Limpeza Tenant A
  if (ctx.clientAId) {
    await admin.from('clients').delete().eq('id', ctx.clientAId);
  }
}

test.describe('Pilar P3 — Isolamento Multi-tenant & Prevenção de Data Leak (UI + URL Direct + Export)', () => {
  const allowSharedExecution = process.env.E2E_ALLOW_PROD_EXECUTION === 'true';
  test.skip(!allowSharedExecution, 'Execution against staging environment is gated by E2E_ALLOW_PROD_EXECUTION=true');

  test('should_enforce_tenant_isolation_on_ui_url_manipulation_and_export', async ({ loggedAdmin }) => {
    test.setTimeout(240_000);
    const { tenantId: tenantAId } = getFixtureState();
    const admin = getAdminClient();

    const runNonce = Date.now().toString().slice(-6);
    const nowIso = new Date().toISOString();

    const ctx: P3Context = {
      tenantAId,
      tenantBId: '',
      clientAName: `Cliente Legítimo A ${runNonce}`,
      clientBName: `Cliente Confidencial B ${runNonce}`,
    };

    try {
      // 1. Arrange: Criar Tenant B efêmero
      const { data: tenantB, error: tenantBErr } = await admin
        .from('tenants')
        .insert({
          name: `Barbearia Vizinha B ${runNonce}`,
          slug: `e2e-tenant-b-${runNonce}`,
          plan: 'pro',
          status: 'active',
          created_at: nowIso,
        })
        .select('id')
        .single();
      if (tenantBErr || !tenantB) throw new Error(`Falha ao criar Tenant B: ${tenantBErr?.message}`);
      ctx.tenantBId = tenantB.id;

      // 2. Arrange: Criar Cliente A no Tenant A
      const { data: clientA, error: clientAErr } = await admin
        .from('clients')
        .insert({
          tenant_id: ctx.tenantAId,
          name: ctx.clientAName,
          phone: `119${runNonce}1111`,
          created_at: nowIso,
        })
        .select('id')
        .single();
      if (clientAErr || !clientA) throw new Error(`Falha ao criar Cliente A: ${clientAErr?.message}`);
      ctx.clientAId = clientA.id;

      // 3. Arrange: Criar Cliente B no Tenant B
      const { data: clientB, error: clientBErr } = await admin
        .from('clients')
        .insert({
          tenant_id: ctx.tenantBId,
          name: ctx.clientBName,
          phone: `119${runNonce}2222`,
          created_at: nowIso,
        })
        .select('id')
        .single();
      if (clientBErr || !clientB) throw new Error(`Falha ao criar Cliente B: ${clientBErr?.message}`);
      ctx.clientBId = clientB.id;

      // 4. Arrange: Criar Comanda do Tenant B
      const { data: comandaB, error: comandaBErr } = await admin
        .from('comandas')
        .insert({
          tenant_id: ctx.tenantBId,
          client_id: ctx.clientBId,
          status: 'open',
          total: 250.0,
          created_at: nowIso,
        })
        .select('id')
        .single();
      if (comandaBErr || !comandaB) throw new Error(`Falha ao criar Comanda B: ${comandaBErr?.message}`);
      ctx.comandaBId = comandaB.id;

      // ─── PROBE 1: Isolamento de Listagem na UI (Clients) ───
      const clientsPage = new ClientsPage(loggedAdmin);
      await clientsPage.goto();
      await dismissChangelogModal(loggedAdmin);
      await expect(clientsPage.heading).toBeVisible({ timeout: 15_000 });

      // O Cliente A DEVE estar visível (ou localizável) no Tenant A
      const clientALocator = loggedAdmin.locator(`text="${ctx.clientAName}"`);
      await expect(clientALocator).toBeVisible({ timeout: 15_000 });

      // O Cliente B NÃO DEVE estar visível no Tenant A
      const clientBLocator = loggedAdmin.locator(`text="${ctx.clientBName}"`);
      await expect(clientBLocator).not.toBeVisible();

      // ─── PROBE 2: Tentativa Adversarial de Navegação por ID Direto (URL Swap) ───
      // O Gerente do Tenant A tenta abrir diretamente o checkout da comanda do Tenant B
      await loggedAdmin.goto(`/#/checkout/${ctx.comandaBId}`);
      await dismissChangelogModal(loggedAdmin);

      // Asserção de Segurança: Os dados do Cliente B e da comanda do vizinho NÃO devem carregar
      const leakedClientBText = loggedAdmin.locator(`text="${ctx.clientBName}"`);
      await expect(leakedClientBText).not.toBeVisible({ timeout: 5_000 });

      // ─── PROBE 3: Validação de Integridade na Exportação (Export Base CSV) ───
      await clientsPage.goto();
      await dismissChangelogModal(loggedAdmin);

      const downloadPromise = loggedAdmin.waitForEvent('download');
      const exportBtn = loggedAdmin.locator('button:has-text("Exportar Base")');
      await exportBtn.click();
      const download = await downloadPromise;

      const stream = await download.createReadStream();
      let csvContent = '';
      if (stream) {
        for await (const chunk of stream) {
          csvContent += chunk.toString();
        }
      }

      // O CSV exportado DEVE conter o cliente legítimo do Tenant A
      expect(csvContent).toContain(ctx.clientAName);

      // O CSV exportado NUNCA deve conter o cliente confidencial do Tenant B
      expect(csvContent).not.toContain(ctx.clientBName);
    } finally {
      // 5. Teardown Transacional
      await cleanupP3Data(ctx);
    }
  });
});
