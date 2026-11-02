/**
 * [SMG][D8][WORKER] env — normalização das variáveis do Edge Runtime.
 *
 * Dois contratos da plataforma que o worker precisa respeitar:
 *
 *  1. `SUPABASE_PUBLISHABLE_KEYS` é um **dicionário JSON**
 *     (ex.: `{"default":"sb_publishable_..."}`), não uma chave crua.
 *     Passar a string JSON como `apikey` faz o gateway responder
 *     `401 Invalid API key` e derruba todo o ciclo do worker.
 *
 *  2. `SUPABASE_URL` é a base canônica da API. `APP_URL` é apenas fallback
 *     legado e pode chegar com sufixo `/rest/v1`, que o supabase-js duplicaria
 *     (`/rest/v1/rest/v1`).
 *
 * As funções puras (`resolvePublishableKey`/`normalizeProjectUrl`) existem para
 * serem testadas em Node/Vitest sem depender de `Deno.env`.
 */

const REST_PATH = /\/rest\/v1$/;

/** Extrai a chave publicável do dicionário JSON, tolerando chave crua legada. */
export function resolvePublishableKey(raw: string | undefined, fallback?: string): string {
  if (!raw) return fallback ?? '';

  try {
    const keys = JSON.parse(raw) as Record<string, unknown>;
    const candidate = keys.default ?? keys.anon;
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
    return fallback ?? '';
  } catch {
    // Valor já no formato de chave crua (compatibilidade com deploys antigos).
    return raw;
  }
}

/** Remove barras finais e o sufixo `/rest/v1` para o supabase-js montar a URL correta. */
export function normalizeProjectUrl(raw: string | undefined): string {
  return (raw ?? '').replace(/\/+$/, '').replace(REST_PATH, '');
}

/** Chave publicável efetiva no Edge Runtime. */
export function publishableKey(): string {
  return resolvePublishableKey(
    Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
    Deno.env.get('SUPABASE_ANON_KEY'),
  );
}

/** Base da API efetiva no Edge Runtime. */
export function projectUrl(): string {
  return normalizeProjectUrl(Deno.env.get('SUPABASE_URL') || Deno.env.get('APP_URL'));
}
