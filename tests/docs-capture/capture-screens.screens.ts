import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { DEMO_DB_KEY, DEMO_SESSION_KEY, buildDemoFixture } from './demo-fixture';

/**
 * SMG — Captura automatizada de telas (documentação e material comercial).
 *
 * Execução: `npm run docs:screens`
 * Saída:    `docs/screenshots/<viewport>-<tela>.png` (pasta fora do versionamento)
 *
 * ─── Decisões de arquitetura (não "otimizar" sem ler) ────────────────────
 *
 * 1. ROTEAMENTO — o app usa HashRouter (`App.tsx`): a URL é `/#/dashboard`,
 *    nunca `/dashboard`. O nome da tela no material é pt-BR (`financeiro`),
 *    mas o caminho é o do router real (`/#/cashflow`).
 *
 * 2. AUTENTICAÇÃO — não se injeta JWT falso. O `AuthContext` resolve o tenant
 *    pela RPC `get_auth_access_context` (SECURITY DEFINER, depende de
 *    `auth.uid()`), então token sintético é descartado e o app cai em
 *    `/#/login`. O bypass correto aqui é o Local Demo Mode: a flag
 *    `soumanager.local.demo.session` no localStorage faz o client emulado
 *    responder auth + RPCs localmente (`src/lib/supabase/client.ts`).
 *
 * 3. DADOS — demo mode nunca fala com o Supabase (nenhum fetch para o
 *    backend): o seed em memória cobre clients/staff/services/appointments/
 *    transactions/comandas. Por isso não há mock de REST aqui; mockar
 *    `/dashboard_metrics` seria código morto — esse endpoint não existe (o
 *    dashboard lê `appointments`, `comandas`, `staff`, `clients`).
 *
 * 4. GUARDA — se o alvo local subir com `.env.local` (Supabase real), o demo
 *    mode não ativa e a captura exibiria dados de inquilino. O teste ABORTA
 *    em vez de gerar material com dado real.
 */

const BASE_URL = process.env.DOCS_BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.resolve(process.cwd(), process.env.DOCS_SCREENSHOTS_DIR || 'docs/screenshots');

const ROUTES = [
  { name: 'dashboard', path: '/#/dashboard' },
  { name: 'agenda', path: '/#/schedule' },
  { name: 'financeiro', path: '/#/cashflow' },
  { name: 'clientes', path: '/#/clients' },
  { name: 'comandas', path: '/#/comandas' },
  { name: 'fechamento-caixa', path: '/#/cash-closing' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'mobile', width: 390, height: 844 }, // referência iPhone 12/13/14
];

/** Lê uma chave do `.env.local` sem depender de dotenv. */
const readLocalEnv = (key: string): string | undefined => {
  const filePath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(filePath)) return undefined;
  for (const line of fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)) {
    if (line.startsWith(`${key}=`)) {
      return line.slice(key.length + 1).trim().replace(/^"(.*)"$/, '$1');
    }
  }
  return undefined;
};

/**
 * Pré-voo determinístico: se o alvo for local e existir credencial Supabase
 * (no ambiente do processo ou no `.env.local`), o dev server subiria em modo
 * real. Melhor falhar antes de abrir o browser.
 */
const assertSafeLocalTarget = (): void => {
  if (!/localhost|127\.0\.0\.1/.test(BASE_URL)) return;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || readLocalEnv('VITE_SUPABASE_URL');
  if (!supabaseUrl) return;

  throw new Error(
    [
      `Captura abortada: alvo ${BASE_URL} é local, mas há VITE_SUPABASE_URL configurado`,
      '(processo ou .env.local). O Local Demo Mode não ativaria e as telas seriam',
      'capturadas com dados reais de inquilino.',
      '',
      'Como resolver (escolha uma):',
      '  a) rode a captura em um checkout/worktree sem .env.local;',
      '  b) aponte para um ambiente de demonstração:',
      '     DOCS_BASE_URL=https://<preview-ou-demo> npm run docs:screens',
    ].join('\n'),
  );
};

/**
 * O primeiro mount em demo mode avalia o guard `pendingRegistration`
 * (`App.tsx`) antes de o tenant resolver e cai em `/#/onboarding/provision`
 * → `/#/onboarding/welcome`. A partir daí a rota é "permitida" e o app não
 * volta sozinho. Renavegar depois do boot resolve, sem tocar em produto.
 */
async function gotoAppRoute(page: import('@playwright/test').Page, routePath: string): Promise<void> {
  const target = `${BASE_URL}${routePath}`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const url = page.url();
    if (!/#\/(onboarding|login)/.test(url)) return;

    if (/#\/login/.test(url)) {
      throw new Error(
        [
          `Captura abortada em ${routePath}: o app redirecionou para /#/login.`,
          'O Local Demo Mode não está ativo neste alvo. Inicie o servidor sem',
          'VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY, ou use DOCS_BASE_URL',
          'apontando para um ambiente de demonstração.',
        ].join('\n'),
      );
    }

    // onboarding: dá tempo do AuthContext/TenantContext assentarem e tenta de novo.
    await page.waitForTimeout(1_200);
  }

  throw new Error(
    `Captura abortada em ${routePath}: a rota continuou redirecionando para onboarding após 3 tentativas.`,
  );
}

/** Mesmo fechamento usado pelos specs de E2E existentes. */
async function dismissReleaseNotes(page: import('@playwright/test').Page): Promise<void> {
  const heading = page.getByText('Novidades e melhorias da semana');
  if (await heading.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await heading.waitFor({ state: 'hidden', timeout: 8_000 });
  }
}

test.describe('SMG — captura automatizada de telas', () => {
  test.beforeAll(() => {
    assertSafeLocalTarget();
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  for (const viewport of VIEWPORTS) {
    test(`captura o fluxo em resolução ${viewport.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        colorScheme: 'light',
      });

      const page = await context.newPage();

      // Bypass de auth válido neste app: sessão do Local Demo Mode.
      // A fixture substitui o seed de abril/2026 por dados fictícios ancorados
      // em hoje, para as telas não saírem zeradas no material comercial.
      const fixtureJson = JSON.stringify(buildDemoFixture());
      await page.addInitScript(
        ({ sessionKey, dbKey, dbJson }) => {
          window.localStorage.setItem(sessionKey, '1');
          window.localStorage.setItem(dbKey, dbJson);
        },
        { sessionKey: DEMO_SESSION_KEY, dbKey: DEMO_DB_KEY, dbJson: fixtureJson },
      );

      for (const route of ROUTES) {
        await gotoAppRoute(page, route.path);

        await page.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => {});

        // Gráficos (Recharts) montam depois do primeiro paint.
        await page
          .locator('.recharts-wrapper')
          .first()
          .waitFor({ state: 'visible', timeout: 5_000 })
          .catch(() => {});

        await dismissReleaseNotes(page);

        // Esconde (não remove!) elementos flutuantes e congela animações.
        // Remover nós gerenciados pelo React quebra a reconciliação na próxima
        // rota e derruba a tela no error boundary ("Algo deu errado").
        await page.addStyleTag({
          content: [
            '*, *::before, *::after {',
            '  animation-duration: 0s !important;',
            '  animation-delay: 0s !important;',
            '  transition: none !important;',
            '  caret-color: transparent !important;',
            '}',
            '::-webkit-scrollbar { display: none !important; }',
            // FAB do SupportWidget (components/SupportWidget.tsx): fixed + z-50 + rounded-full
            'button.fixed.z-50.rounded-full { display: none !important; }',
            '#intercom-container { display: none !important; }',
            '.toast-container { display: none !important; }',
          ].join('\n'),
        });

        const filePath = path.join(OUTPUT_DIR, `${viewport.name}-${route.name}.png`);

        // Print de error boundary nunca serve como material: falha explícita.
        await expect(
          page.getByText('Algo deu errado'),
          `a tela ${route.path} caiu no error boundary`,
        ).toHaveCount(0);

        await page.screenshot({
          path: filePath,
          fullPage: true,
          animations: 'disabled',
        });

        // Um print válido tem conteúdo; PNG de 1px ou vazio indica página não
        // renderizada e deve falhar em vez de contaminar o material.
        const { size } = fs.statSync(filePath);
        expect(size, `screenshot vazio ou suspeito: ${filePath}`).toBeGreaterThan(10_000);
      }

      await context.close();
    });
  }
});
