import * as fs from 'fs';
import * as path from 'path';

/**
 * E2E Fixture State — created by globalSetup (tests/e2e/setup/globalSetup.ts).
 *
 * The deterministic suite runs against REAL Supabase. globalSetup provisions a
 * fresh tenant + confirmed users via the Admin API and writes their credentials
 * here. Auth fixtures (loggedAdmin, loggedManager, ...) read this file to log in
 * through the UI.
 *
 * Do NOT commit: the file lives under test-results/ (gitignored).
 */
export interface E2EUserState {
  email: string;
  password: string;
}

export interface E2EFixtureState {
  runId: number;
  tenantId: string;
  users: {
    manager: E2EUserState;
    barber: E2EUserState;
    cashier: E2EUserState;
  };
}

const STATE_FILE = path.resolve(process.cwd(), 'test-results', '.e2e-fixture-state.json');

let cached: E2EFixtureState | null = null;

export function getFixtureState(): E2EFixtureState {
  if (cached) return cached;
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      `E2E fixture state not found at ${STATE_FILE}. ` +
        'Playwright globalSetup (tests/e2e/setup/globalSetup.ts) must run before auth fixtures. ' +
        'Check that VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local.',
    );
  }
  cached = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as E2EFixtureState;
  return cached;
}
