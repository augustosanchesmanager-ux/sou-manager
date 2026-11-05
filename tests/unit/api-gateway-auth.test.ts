/**
 * [TEST][API-GATEWAY] Testes Unitários de Autenticação da Public API (Fase 8)
 *
 * Em conformidade com ADR-032 e requisitos de segurança multi-tenant.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  extractBearerToken,
  resolveTokenEnvironment,
  hashApiKey,
  hasRequiredScope,
  validateKeyRecord,
  authenticateApiKey,
  maskApiKey,
} from '../../supabase/functions/api-gateway/auth.ts';
import type { ApiKeyRecord, ApiScope } from '../../supabase/functions/api-gateway/types.ts';

describe('Public API Gateway — Token Extraction & Environment', () => {
  it('should_return_null_when_auth_header_is_missing_or_empty', () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken('   ')).toBeNull();
  });

  it('should_return_null_when_auth_header_is_not_bearer_scheme', () => {
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
    expect(extractBearerToken('Token smg_live_123')).toBeNull();
    expect(extractBearerToken('smg_live_123')).toBeNull();
  });

  it('should_extract_token_when_bearer_header_is_valid', () => {
    expect(extractBearerToken('Bearer smg_live_abcdef123456')).toBe('smg_live_abcdef123456');
    expect(extractBearerToken('bearer smg_test_xyz789')).toBe('smg_test_xyz789');
  });

  it('should_resolve_live_environment_from_smg_live_prefix', () => {
    expect(resolveTokenEnvironment('smg_live_abc123')).toBe('live');
  });

  it('should_resolve_test_environment_from_smg_test_prefix', () => {
    expect(resolveTokenEnvironment('smg_test_abc123')).toBe('test');
  });

  it('should_reject_invalid_token_prefixes', () => {
    expect(resolveTokenEnvironment('sk_live_123')).toBeNull();
    expect(resolveTokenEnvironment('smg_dev_123')).toBeNull();
    expect(resolveTokenEnvironment('random_token')).toBeNull();
  });

  it('should_mask_token_safely_for_logs', () => {
    const masked = maskApiKey('smg_live_a1b2c3d4e5f67890abcdef');
    expect(masked).toBe('smg_live_a1b2c3d...');
    expect(masked.includes('7890abcdef')).toBe(false);
  });
});

describe('Public API Gateway — SHA-256 Hashing Compatibility', () => {
  it('should_produce_exact_sha256_hex_digest_compatible_with_node_and_postgres', async () => {
    const testToken = 'smg_live_4f8b2c1d9e7a6f5e4d3c2b1a0f9e8d7c';

    // Digest esperado usando o crypto nativo do Node.js
    const expectedHash = createHash('sha256').update(testToken).digest('hex');

    // Digest gerado pela função do Gateway (Web Crypto API)
    const gatewayHash = await hashApiKey(testToken);

    expect(gatewayHash).toBe(expectedHash);
    expect(gatewayHash).toHaveLength(64);
  });
});

describe('Public API Gateway — Scope Validation', () => {
  it('should_return_true_when_no_required_scope_is_specified', () => {
    expect(hasRequiredScope(['appointments:read'])).toBe(true);
  });

  it('should_return_true_when_required_scope_is_present', () => {
    const scopes: ApiScope[] = ['appointments:read', 'comandas:write'];
    expect(hasRequiredScope(scopes, 'appointments:read')).toBe(true);
    expect(hasRequiredScope(scopes, 'comandas:write')).toBe(true);
  });

  it('should_return_false_when_required_scope_is_absent', () => {
    const scopes: ApiScope[] = ['appointments:read'];
    expect(hasRequiredScope(scopes, 'financial:read')).toBe(false);
  });
});

describe('Public API Gateway — Key Record Validation & Status', () => {
  const baseRecord: ApiKeyRecord = {
    id: 'key-123',
    tenant_id: 'tenant-456',
    name: 'Integration Partner',
    key_prefix: 'smg_live_a1b2c3d4',
    key_hash: 'mock-hash',
    scopes: ['appointments:read', 'comandas:write'],
    revoked_at: null,
    expires_at: null,
    last_used_at: null,
    created_at: '2026-11-05T00:00:00Z',
    created_by: 'user-789',
  };

  it('should_return_401_when_key_record_does_not_exist', () => {
    const result = validateKeyRecord(null, 'live');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe('INVALID_CREDENTIALS');
    }
  });

  it('should_return_401_when_key_is_revoked', () => {
    const revokedRecord: ApiKeyRecord = {
      ...baseRecord,
      revoked_at: '2026-11-05T10:00:00Z',
    };
    const result = validateKeyRecord(revokedRecord, 'live');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe('INVALID_CREDENTIALS');
      expect(result.message).toContain('revogada');
    }
  });

  it('should_return_401_when_key_is_expired', () => {
    const expiredRecord: ApiKeyRecord = {
      ...baseRecord,
      expires_at: '2026-11-01T00:00:00Z',
    };
    const now = new Date('2026-11-05T12:00:00Z');
    const result = validateKeyRecord(expiredRecord, 'live', undefined, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe('INVALID_CREDENTIALS');
      expect(result.message).toContain('expirada');
    }
  });

  it('should_return_403_when_key_does_not_have_required_scope', () => {
    const result = validateKeyRecord(baseRecord, 'live', 'financial:read');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe('INSUFFICIENT_SCOPE');
    }
  });

  it('should_return_200_and_auth_context_when_key_is_valid', () => {
    const result = validateKeyRecord(baseRecord, 'live', 'appointments:read');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.auth.tenantId).toBe('tenant-456');
      expect(result.auth.apiKeyId).toBe('key-123');
      expect(result.auth.environment).toBe('live');
      expect(result.auth.scopes).toContain('appointments:read');
    }
  });
});

describe('Public API Gateway — End-to-End authenticateApiKey Orchestration', () => {
  const activeRecord: ApiKeyRecord = {
    id: 'k-999',
    tenant_id: 't-888',
    name: 'Production Bot',
    key_prefix: 'smg_live_11223344',
    key_hash: createHash('sha256').update('smg_live_11223344556677889900aabb').digest('hex'),
    scopes: ['appointments:read', 'comandas:read'],
    revoked_at: null,
    expires_at: null,
    last_used_at: null,
    created_at: '2026-11-05T00:00:00Z',
    created_by: 'user-admin',
  };

  it('should_reject_with_401_when_no_auth_header_is_provided', async () => {
    const result = await authenticateApiKey(null, async () => activeRecord);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe('MISSING_OR_INVALID_TOKEN');
    }
  });

  it('should_reject_with_401_when_prefix_is_invalid', async () => {
    const result = await authenticateApiKey('Bearer other_prefix_token', async () => activeRecord);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe('MISSING_OR_INVALID_TOKEN');
    }
  });

  it('should_authenticate_successfully_with_valid_token_and_scope', async () => {
    const rawToken = 'smg_live_11223344556677889900aabb';
    const result = await authenticateApiKey(
      `Bearer ${rawToken}`,
      async (hash) => {
        if (hash === activeRecord.key_hash) {
          return activeRecord;
        }
        return null;
      },
      'appointments:read'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.auth.tenantId).toBe('t-888');
      expect(result.auth.name).toBe('Production Bot');
      expect(result.auth.environment).toBe('live');
    }
  });

  it('should_return_500_if_database_lookup_throws', async () => {
    const rawToken = 'smg_live_11223344556677889900aabb';
    const result = await authenticateApiKey(
      `Bearer ${rawToken}`,
      async () => {
        throw new Error('Connection timeout');
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBe('INTERNAL_AUTH_ERROR');
    }
  });
});
