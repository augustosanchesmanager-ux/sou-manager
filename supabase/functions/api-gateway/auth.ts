/**
 * [SMG][API-GATEWAY] auth — Resolução criptográfica, validação e controle de escopos de API Keys
 *
 * Em conformidade com ADR-032 (ACCEPTED) e PHASE_8_ENTRY_AUDIT.md
 * Este módulo é 100% puro e testável em Vitest/Node e Deno (Edge Runtime).
 */

import type {
  ApiKeyRecord,
  ApiEnvironment,
  ApiScope,
  AuthContext,
  AuthResult,
} from './types.ts';

/**
 * Extrai o token Bearer do cabeçalho Authorization
 */
export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  const token = parts[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Identifica o ambiente da chave a partir do prefixo obrigatório
 */
export function resolveTokenEnvironment(token: string): ApiEnvironment | null {
  if (token.startsWith('smg_live_')) {
    return 'live';
  }
  if (token.startsWith('smg_test_')) {
    return 'test';
  }
  return null;
}

/**
 * Mascara o token para logs de telemetria sem expor o segredo completo
 * Ex: 'smg_live_a1b2c3d4...'
 */
export function maskApiKey(token: string): string {
  if (!token || typeof token !== 'string') {
    return '[invalid-token]';
  }
  const prefixLength = Math.min(token.length, 16);
  return `${token.slice(0, prefixLength)}...`;
}

/**
 * Calcula o digest SHA-256 do token usando a Web Crypto API nativa
 * Retorna uma string hexadecimal idêntica ao digest do PostgreSQL (extensions.digest(..., 'sha256'))
 */
export async function hashApiKey(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Valida se uma chave de API contém o escopo necessário para a operação
 * Suporta um escopo único ou array de escopos alternativos (basta atender a um deles)
 */
export function hasRequiredScope(
  assignedScopes: ApiScope[],
  requiredScope?: ApiScope | ApiScope[]
): boolean {
  if (!requiredScope) {
    return true;
  }
  if (!Array.isArray(assignedScopes)) {
    return false;
  }
  if (Array.isArray(requiredScope)) {
    return requiredScope.some((s) => assignedScopes.includes(s));
  }
  return assignedScopes.includes(requiredScope);
}

/**
 * Valida as regras de negócio de um registro de chave de API já recuperado
 */
export function validateKeyRecord(
  record: ApiKeyRecord | null,
  environment: ApiEnvironment,
  requiredScope?: ApiScope | ApiScope[],
  now: Date = new Date()
): AuthResult {
  if (!record) {
    return {
      ok: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Chave de API não encontrada ou inválida.',
      status: 401,
    };
  }

  // 1. Verificar revogação
  if (record.revoked_at !== null && record.revoked_at !== undefined) {
    return {
      ok: false,
      error: 'INVALID_CREDENTIALS',
      message: 'Chave de API revogada.',
      status: 401,
    };
  }

  // 2. Verificar expiração temporal
  if (record.expires_at) {
    const expiresAt = new Date(record.expires_at);
    if (expiresAt.getTime() <= now.getTime()) {
      return {
        ok: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Chave de API expirada.',
        status: 401,
      };
    }
  }

  // 3. Validar escopo obrigatório
  if (requiredScope && !hasRequiredScope(record.scopes, requiredScope)) {
    return {
      ok: false,
      error: 'INSUFFICIENT_SCOPE',
      message: `Permissão insuficiente: requer o escopo '${requiredScope}'.`,
      status: 403,
    };
  }

  const authContext: AuthContext = {
    apiKeyId: record.id,
    tenantId: record.tenant_id,
    name: record.name,
    scopes: record.scopes,
    environment,
    keyPrefix: record.key_prefix,
  };

  return {
    ok: true,
    auth: authContext,
  };
}

/**
 * Orquestrador central de autenticação da requisição
 */
export async function authenticateApiKey(
  authHeader: string | null | undefined,
  findRecordByHash: (hash: string) => Promise<ApiKeyRecord | null>,
  requiredScope?: ApiScope | ApiScope[],
  now: Date = new Date()
): Promise<AuthResult> {
  // 1. Extrair token do header
  const token = extractBearerToken(authHeader);
  if (!token) {
    return {
      ok: false,
      error: 'MISSING_OR_INVALID_TOKEN',
      message: 'Cabeçalho Authorization no formato Bearer obrigatório.',
      status: 401,
    };
  }

  // 2. Validar prefixo obrigatório
  const environment = resolveTokenEnvironment(token);
  if (!environment) {
    return {
      ok: false,
      error: 'MISSING_OR_INVALID_TOKEN',
      message: 'Prefixo de token inválido. Esperado smg_live_ ou smg_test_.',
      status: 401,
    };
  }

  // 3. Gerar hash SHA-256
  const keyHash = await hashApiKey(token);

  // 4. Buscar registro no banco via callback desacoplado
  let record: ApiKeyRecord | null = null;
  try {
    record = await findRecordByHash(keyHash);
  } catch (err) {
    return {
      ok: false,
      error: 'INTERNAL_AUTH_ERROR',
      message: 'Erro interno ao validar credenciais.',
      status: 500,
    };
  }

  // 5. Validar registro de chave
  return validateKeyRecord(record, environment, requiredScope, now);
}
