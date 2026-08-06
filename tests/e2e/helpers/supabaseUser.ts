import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnvLocal } from './supabaseAdmin';

type UserClient = SupabaseClient<any, 'public', any>;

/**
 * Authenticated (anon-key, user-session) Supabase client for E2E lifecycle flows.
 *
 * Complementa o admin client (service role) usado pelo globalSetup: aqui a
 * sessão é de um USUÁRIO REAL (senha/email), então os RPCs SECURITY DEFINER
 * que exigem `auth.uid() IS NOT NULL` e o papel de gestor do tenant funcionam
 * exatamente como na produção.
 *
 * Usado pelos flows 9 e 12 (lifecycle billing 6.0.4.4) para dirigir:
 *   - start_trial / activate_subscription / get_subscription / cancel_subscription
 *   - apply_subscription_transition (efetivação do cancelamento pelo engine)
 *
 * Credenciais lidas de `.env.local` (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY).
 */
export async function signInAsUser(
  email: string,
  password: string,
): Promise<UserClient> {
  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('E2E requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
  }

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as UserClient;

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`signInAsUser(${email}) failed: ${error.message}`);
  }
  return client;
}
