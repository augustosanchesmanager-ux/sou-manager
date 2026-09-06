import { test, expect } from '../fixtures/auth.fixture';
import { ReportsPage } from '../pages/ReportsPage';

/**
 * P1.1 — Central de Relatórios: aba Vendas (regressão)
 *
 * Valida o design gate docs/audit/P1_1_DESIGN_GATE.md §9:
 *   - /reports permanece hub (h1 "Relatórios") e renderiza
 *   - Aba Vendas deixa de ser placeholder "Em breve"
 *   - Cards canônicos via RPC getDashboardKpis OU degradação graciosa
 *     explícita quando o RPC não existe no ambiente (migration P1.3 não
 *     aplicada — decisão 10: P1.1 não depende da migration)
 *   - Detalhamento (Comandas no período) sempre disponível
 *
 * Nota: o tenant E2E seedado pelo globalSetup NÃO possui o RPC
 * get_dashboard_kpis (migration P1.3 está sob STOP gate). Portanto o
 * caminho esperado é a degradação graciosa, nunca um crash da página.
 */
test.describe('P1.1 — Reports / Vendas', () => {
  test('01 — Reports page renders with heading', async ({ loggedAdmin }) => {
    const reportsPage = new ReportsPage(loggedAdmin);
    await reportsPage.goto();

    await expect(reportsPage.heading).toBeVisible({ timeout: 30_000 });
    await expect(reportsPage.chefClubTab).toBeVisible();
    await expect(reportsPage.salesTab).toBeVisible();
  });

  test('02 — Sales tab shows real report (not placeholder Em breve)', async ({ loggedAdmin }) => {
    const reportsPage = new ReportsPage(loggedAdmin);
    await reportsPage.goto();
    await reportsPage.switchToSales();

    // §9: Vendas deixa de ser placeholder — a seção real deve aparecer
    await expect(reportsPage.salesSection).toBeVisible({ timeout: 30_000 });
    await expect(loggedAdmin.locator('text=Em breve')).toHaveCount(0);

    // §9: detaçlhes sempre disponíveis (listagem local por tabela)
    await expect(reportsPage.comandasSection).toBeVisible({ timeout: 30_000 });
  });

  test('03 — Sales tab degrades gracefully without canonical RPC', async ({ loggedAdmin }) => {
    const reportsPage = new ReportsPage(loggedAdmin);
    await reportsPage.goto();
    await reportsPage.switchToSales();

    // Ambiente E2E: RPC get_dashboard_kpis não aplicado (STOP gate).
    // Ou os cards renderizam (RPC existe — label "Faturamento") ou o banner
    // explícito de indisponibilidade aparece — nunca um crash.
    const kpiCard = loggedAdmin.locator('text=Faturamento');
    const degradationBanner = loggedAdmin.locator(
      'text=KPIs canônicos indisponíveis'
    );

    await expect
      .poll(async () => {
        if (await kpiCard.count()) return 'cards';
        if (await degradationBanner.count()) return 'degraded';
        return 'none';
      }, { timeout: 20_000 })
      .toMatch(/cards|degraded/);

    // Página segue funcional nos dois caminhos
    await expect(reportsPage.comandasSection).toBeVisible({ timeout: 15_000 });
  });
});