/**
 * [SMG][D8][WORKER] jwt — HS256 JWT minting for the worker_dispatcher role.
 *
 * ADR-016 Amendment-01 (PO-approved): the worker authenticates as the dedicated
 * `worker_dispatcher` DB role (minimum privilege, NOLOGIN) — it MUST NOT use
 * service_role on the data path. PostgREST switches execution role from the
 * JWT `role` claim, so we sign a short-lived JWT carrying `role: worker_dispatcher`.
 *
 * Uses Deno Web Crypto (crypto.subtle) — zero external dependencies.
 */

const encoder = new TextEncoder();
const b64url = (buf: Uint8Array): string =>
  btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const b64urlFromBase64 = (base64: string): string =>
  base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return new Uint8Array(sig);
}

export interface MintOptions {
  role?: string;
  subject?: string;
  ttlSeconds?: number;
}

/**
 * Mint a signed JWT. When `role` is not provided the JWT still carries a safe
 * default claim set (used for command-invocation + observability heartbeat).
 */
export async function mintWorkerJwt(
  jwtSecret: string,
  options: MintOptions = {},
): Promise<string> {
  const role = options.role || 'worker_dispatcher';
  const now = Math.floor(Date.now() / 1000);
  const ttl = options.ttlSeconds || 3600;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    role,
    sub: options.subject || 'd8-worker',
    iat: now,
    exp: now + ttl,
    iss: 'supabase',
    aud: 'authenticated',
  };

  const p1 = b64url(encoder.encode(JSON.stringify(header)));
  const p2 = b64url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${p1}.${p2}`;
  const sig = await hmacSha256(jwtSecret, signingInput);
  return `${signingInput}.${b64url(sig)}`;
}
