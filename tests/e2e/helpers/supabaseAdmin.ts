import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

type AdminClient = SupabaseClient<any, 'public', any>;

/**
 * Supabase Admin helpers for E2E tests (service role).
 *
 * Used by Flow 6 to CREATE and CONFIRM users via the Admin API. This makes the
 * main E2E suite deterministic: it removes the dependency on SMTP delivery,
 * GoTrue DNS/MX email validation, signup rate limits and external inboxes.
 *
 * Context (2026-08-05):
 *   - Email confirmation is ATIVADA (mailer_autoconfirm=false).
 *   - The environment uses the DEFAULT Supabase mailer (built-in) — no evidence
 *     of a custom SMTP provider. The built-in mailer only sends to Supabase
 *     organization members, so signUp to arbitrary domains fails with
 *     email_address_not_authorized / email_address_invalid.
 *   - The signup UI flow is therefore covered SEPARATELY by
 *     tests/e2e/flows/flow6a-signup-ui.spec.ts (gated, non-blocking).
 *
 * Credenciais lidas de `.env.local` (nunca commitadas):
 *   - VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */
function loadEnvLocal(): Record<string, string> {
  const filePath = path.resolve(process.cwd(), '.env.local');
  const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) env[key] = value.replace(/^"(.*)"$/, '$1');
  }
  return env;
}

let adminClient: AdminClient | null = null;

export function getAdminClient(): AdminClient {
  if (adminClient) return adminClient;
  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error('E2E requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }
  // The project has no generated Database types and the remote schema has
  // drifted, so the client uses the untyped generic (row shape = any).
  adminClient = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as AdminClient;
  return adminClient;
}

/**
 * Confirma o e-mail de um usuário via Admin API (equivalente a clicar no link
 * de confirmação enviado pelo Supabase).
 *
 * Mantido para uso pelo operador e pelo cenário de validação do Supabase Auth
 * (flow6a), onde o usuário é criado via signUp pela UI.
 */
export async function confirmUserEmail(email: string): Promise<void> {
  const admin = getAdminClient();
  const res = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (res.error) throw new Error(`listUsers failed: ${res.error.message}`);
  // listUsers returns `User[] | []` and TS cannot discriminate on `error`
  // (AuthError is not a literal type), which collapses `find`'s callback param
  // to `never`. The empty-tuple member is assignable to User[], so the cast is safe.
  const users = res.data.users as User[];
  const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`User ${email} not found in auth.users`);
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
  if (updateError) throw new Error(`updateUserById failed: ${updateError.message}`);
}

/**
 * Cria um usuário JÁ CONFIRMADO via Admin API (email_confirm=true).
 *
 * Bypassa SMTP, validação DNS/MX do GoTrue e rate limits de signUp — a suíte
 * principal de E2E não depende de caixa de entrada nem de entrega de e-mail.
 * O `user_metadata` deve conter first_name/last_name/shop_name para o app
 * detectar `pendingRegistration` e redirecionar para /onboarding/provision.
 */
export async function createConfirmedUser(opts: {
  email: string;
  password: string;
  userMetadata: Record<string, unknown>;
}): Promise<string> {
  const admin = getAdminClient();
  const { data: user, error } = await admin.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
    user_metadata: opts.userMetadata,
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);
  if (!user?.user?.id) throw new Error(`createUser returned no user id for ${opts.email}`);
  return user.user.id;
}

/**
 * Remove um usuário via Admin API (best-effort, para afterAll/afterEach).
 *
 * `profiles` e `user_tenants` têm ON DELETE CASCADE a partir de auth.users,
 * então a remoção é segura. O tenant criado pelo provisionamento NÃO referencia
 * auth.users e permanece órfão — a limpeza de tenants continua sob
 * responsabilidade do operador (ver MIGRATION_EXCEPTION_20260801.md).
 */
export async function deleteUserByEmail(email: string): Promise<void> {
  const admin = getAdminClient();
  const res = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (res.error) throw new Error(`listUsers failed: ${res.error.message}`);
  const users = res.data.users as User[];
  const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) return;
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) throw new Error(`deleteUser failed: ${deleteError.message}`);
}
