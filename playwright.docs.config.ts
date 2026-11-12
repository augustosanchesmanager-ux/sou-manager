import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração exclusiva da captura de telas para documentação e material
 * comercial (`npm run docs:screens`).
 *
 * Por que um config separado de `playwright.config.ts`:
 *
 * 1. `playwright.config.ts` aponta `testDir` para `./tests/e2e` e registra
 *    `globalSetup` que CRIA e APAGA um tenant fixture no Supabase real
 *    (via Admin API + SERVICE_ROLE_KEY). Captura de tela não pode ter esse
 *    efeito colateral.
 * 2. O alvo da captura é o Local Demo Mode (`hasSupabaseEnv === false` +
 *    host localhost), cujos dados são 100% emulados — nenhum inquilino real
 *    é consultado. Ver `src/lib/supabase/client.ts`.
 * 3. `testMatch` restrito a `*.screens.ts` mantém a captura fora do alcance
 *    do Vitest (que coleta `*.spec.ts` / `*.test.ts` e é gate bloqueador de
 *    CI em `npm run test`) e fora do alcance do `playwright test` padrão.
 */

const baseURL = process.env.DOCS_BASE_URL || 'http://localhost:3000';
const isLocalTarget = /localhost|127\.0\.0\.1/.test(baseURL);

export default defineConfig({
  testDir: './tests/docs-capture',
  testMatch: /.*\.screens\.ts$/,

  // Captura é sequencial de propósito: o Vite compila cada página React.lazy
  // sob demanda e prints concorrentes disputam o dev server.
  fullyParallel: false,
  workers: 1,
  forbidOnly: false,
  retries: 0,

  timeout: 180_000,
  reporter: [['list']],
  outputDir: 'test-results/docs-capture',

  use: {
    baseURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  // Páginas são módulos React.lazy compilados on-demand pelo dev server.
  expect: {
    timeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Só sobe o dev server quando o alvo é local. Para ambiente publicado,
  // use DOCS_BASE_URL=https://<preview-ou-staging> e nada é iniciado aqui.
  ...(isLocalTarget
    ? {
        webServer: {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }
    : {}),
});
