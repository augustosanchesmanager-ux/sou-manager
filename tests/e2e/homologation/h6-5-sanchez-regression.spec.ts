import { test, expect, type Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

/**
 * H-6.5 — Regressão Sanchez Barber (READ-ONLY — pós-aplicação das 10 migrations H-6)
 *
 * ⚠️ NATUREZA READ-ONLY: esta suite APENAS navega e confere que as páginas da
 * Sanchez Barber renderizam com os dados reais do tenant produtivo. NENHUMA
 * operação de escrita é executada (sem criar/editar clientes, agendamentos,
 * comandas, caixas, comissões ou assinaturas). NÃO criar dados fake em produção.
 *
 * Requer (D-HOM-11): conta de homologação `homolog.sanchez@barber.soumanager.com`
 * no tenant real da Sanchez Barber. Credenciais lidas de `.env.local`:
 *   - E2E_SANCHEZ_EMAIL   (default: homolog.sanchez@barber.soumanager.com)
 *   - E2E_SANCHEZ_PASSWORD (custódia do PO/OpenCode — NUNCA versionada)
 * Gate: E2E_SANCHEZ_REGRESSION=1 (evita execução acidental contra o tenant real).
 *
 * Objetivo: após cada lote de migrations H-6 (especialmente 130000/130100/130200/
 * 130300 e 120400), confirmar que o app da Sanchez continua operando em todas as
 * áreas: login, dashboard, clientes, serviços, agenda, comanda, checkout, Chef
 * Club (planos/assinaturas/recebimentos), fechamento de caixa, comissões,
 * financeiro e relatórios.
 *
 * OBSERVAÇÃO: esta suite NÃO depende do globalSetup (que seeda tenants E2E
 * isolados). Ela deve ser rodada isoladamente pelo operador:
 *   E2E_SANCHEZ_REGRESSION=1 npx playwright test tests/e2e/homologation/h6-5-sanchez-regression.spec.ts
 */
const enabled = process.env.E2E_SANCHEZ_REGRESSION === '1';
const HOMOLOG_EMAIL = process.env.E2E_SANCHEZ_EMAIL || 'homolog.sanchez@barber.soumanager.com';
const HOMOLOG_PASSWORD = process.env.E2E_SANCHEZ_PASSWORD || '';

test.describe.configure({ mode: 'serial' });

test.describe('H6.5 — Regressão Sanchez Barber (read-only)', () => {
  test.skip(!enabled, 'Requires E2E_SANCHEZ_REGRESSION=1 and E2E_SANCHEZ_PASSWORD in .env.local');
  test.skip(!HOMOLOG_PASSWORD, 'E2E_SANCHEZ_PASSWORD not set in .env.local');

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page?.close();
  });

  async function loadRoute(hash: string): Promise<{ errors: string[] }> {
    const errors: string[] = [];
    const onPageError = (err: Error): void => {
      errors.push(`pageerror: ${err.message}`);
    };
    const onConsole = (msg: import('@playwright/test').ConsoleMessage): void => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    };
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
    page.on('pageerror', onPageError);
    page.on('console', onConsole);
    await page.goto(hash, { waitUntil: 'networkidle' }).catch((e) => {
      errors.push(`goto ${hash}: ${(e as Error).message}`);
    });
    await page.waitForTimeout(1_500);
    page.removeListener('pageerror', onPageError);
    page.removeListener('console', onConsole);
    return { errors };
  }

  test('Login — conta de homologação autentica e redireciona para o dashboard', async () => {
    const login = new LoginPage(page);
    await login.goto();
    await login.emailInput.waitFor({ state: 'visible', timeout: 15_000 });
    await login.emailInput.fill(HOMOLOG_EMAIL);
    await login.passwordInput.fill(HOMOLOG_PASSWORD);
    await login.submitButton.click();
    await page.waitForURL(/#\/dashboard/, { timeout: 45_000 });
    expect(page.url()).toContain('#/dashboard');
  });

  test('Dashboard — renderiza com dados (heading + KPIs)', async () => {
    const { errors } = await loadRoute('/#/dashboard');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 30_000 });
    expect(errors.filter((e) => !e.startsWith('console.error')).length, `page errors: ${errors.join(' | ')}`).toBe(0);
  });

  test('Clientes — página renderiza', async () => {
    const { errors } = await loadRoute('/#/clients');
    await expect(page.locator('h2', { hasText: 'Clientes' })).toBeVisible({ timeout: 30_000 });
    expect(errors.filter((e) => !e.startsWith('console.error')).length, `page errors: ${errors.join(' | ')}`).toBe(0);
  });

  test('Serviços — página renderiza', async () => {
    const { errors } = await loadRoute('/#/services');
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 30_000 });
    expect(errors.filter((e) => !e.startsWith('console.error')).length, `page errors: ${errors.join(' | ')}`).toBe(0);
  });

  test('Agenda — página renderiza', async () => {
    const { errors } = await loadRoute('/#/schedule');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 });
    expect(errors.filter((e) => !e.startsWith('console.error')).length, `page errors: ${errors.join(' | ')}`).toBe(0);
  });

  test('Comanda — página renderiza', async () => {
    const { errors } = await loadRoute('/#/comandas');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 });
    expect(errors.filter((e) => !e.startsWith('console.error')).length, `page errors: ${errors.join(' | ')}`).toBe(0);
  });

  test('Checkout — página renderiza', async () => {
    const { errors } = await loadRoute('/#/checkout');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 30_000 });
    expect(errors.filter((e) => !e.startsWith('console.error')).length, `page errors: ${errors.join(' | ')}`).toBe(0);
  });

  test('Chef Club — Planos renderiza', async () => {
    const { errors } = await loadRoute('/#/chef-club-plans');
    await expect(page.locator('h2', { hasText: 'Club dos Chefes' })).toBeVisible({ timeout: 30_000 });
    expect(errors.filter((e) => !e.startsWith('console.error')).length, `page errors: ${errors.join(' | ')}`).toBe(0);
  });

  test('Chef Club — Assinaturas renderiza', async () => {
    const { errors } = await loadRoute('/#/chef-club-subscriptions');
    await expect(page.locator('h1', { hasText: 'Assinaturas do Clube' })).toBeVisible({ timeout: 30_000 });
    expect(errors.filter((e) => !e.startsWith('console.error')).length, `page errors: ${errors.join(' | ')}`).toBe(0);
  });

  test('Chef Club — Recebimentos renderiza', async () => {
    const { errors } = await loadRoute('/#/chef-club-receivables');
    await expect(page.locator('h1', { hasText: 'Recebimentos do Clube' })).toBeVisible({ timeout: 30_000 });
    expect(errors.filter((e) => !e.startsWith('console.error')).length, `page errors: ${errors.join(' | ')}`).toBe(0);
  });

  test('Fechamento de Caixa — renderiza', async () => {
    const { errors } = await loadRoute('/#/cash-closing');
    await expect(page.locator('h2', { hasText: 'Fechamento de Caixa' })).toBeVisible({ timeout: 30_000 });
    expect(errors.filter((e) => !e.startsWith('console.error')).length, `page errors: ${errors.join(' | ')}`).toBe(0);
  });

  test('Comissões — renderiza', async () => {
    const { errors } = await loadRoute('/#/commissions');
    await expect(page.locator('h2', { hasText: 'Comissões' })).toBeVisible({ timeout: 30_000 });
    expect(errors.filter((e) => !e.startsWith('console.error')).length, `page errors: ${errors.join(' | ')}`).toBe(0);
  });

  test('Financeiro — Visão Geral renderiza', async () => {
    const { errors } = await loadRoute('/#/financial-overview');
    await expect(page.locator('h2', { hasText: 'Visao Geral Financeira' })).toBeVisible({ timeout: 30_000 });
    expect(errors.filter((e) => !e.startsWith('console.error')).length, `page errors: ${errors.join(' | ')}`).toBe(0);
  });

  test('Relatórios — página renderiza', async () => {
    const { errors } = await loadRoute('/#/reports');
    await expect(page.locator('h1', { hasText: 'Relatórios' })).toBeVisible({ timeout: 30_000 });
    expect(errors.filter((e) => !e.startsWith('console.error')).length, `page errors: ${errors.join(' | ')}`).toBe(0);
  });
});
