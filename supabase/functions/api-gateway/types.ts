/**
 * [SMG][API-GATEWAY] types — Contratos de tipos da Public API e Gateway de Autenticação (Fase 8)
 *
 * Em conformidade com ADR-032 (ACCEPTED) e PHASE_8_ENTRY_AUDIT.md
 */

export type ApiEnvironment = 'live' | 'test';

export type ApiScope =
  | 'appointments:read'
  | 'appointments:write'
  | 'comandas:read'
  | 'comandas:write'
  | 'financial:read'
  | 'customers:read'
  | 'customers:write'
  | 'services:read'
  | 'products:read'
  | 'catalog:read';

export const VALID_API_SCOPES: readonly ApiScope[] = [
  'appointments:read',
  'appointments:write',
  'comandas:read',
  'comandas:write',
  'financial:read',
  'customers:read',
  'customers:write',
  'services:read',
  'products:read',
  'catalog:read',
] as const;

export interface ApiKeyRecord {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: ApiScope[];
  revoked_at: string | null;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface AuthContext {
  apiKeyId: string;
  tenantId: string;
  name: string;
  scopes: ApiScope[];
  environment: ApiEnvironment;
  keyPrefix: string;
}

export type AuthErrorCode =
  | 'MISSING_OR_INVALID_TOKEN'
  | 'INVALID_CREDENTIALS'
  | 'INSUFFICIENT_SCOPE'
  | 'INTERNAL_AUTH_ERROR';

export interface AuthSuccess {
  ok: true;
  auth: AuthContext;
}

export interface AuthFailure {
  ok: false;
  error: AuthErrorCode;
  message: string;
  status: 401 | 403 | 500;
}

export type AuthResult = AuthSuccess | AuthFailure;

export interface ApiErrorResponse {
  error: {
    code: AuthErrorCode | string;
    message: string;
    request_id?: string;
  };
}

export interface ApiSuccessResponse<T = unknown> {
  data: T;
  meta?: {
    request_id: string;
    timestamp: string;
  };
}
