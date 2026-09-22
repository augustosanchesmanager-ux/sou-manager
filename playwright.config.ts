import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const isDeployedUrl = baseURL && !baseURL.includes('localhost');

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/setup/globalSetup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  // Generous assertion timeout: pages are React.lazy modules compiled on demand
  // by the Vite dev server. Under parallel workers a cold module compile can
  // take several seconds; a short default would make page-load tests flaky.
  expect: {
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Only start local dev server when testing against localhost.
  // When PLAYWRIGHT_BASE_URL is a deployed URL, skip webServer entirely.
  ...(isDeployedUrl
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
      }),
});
