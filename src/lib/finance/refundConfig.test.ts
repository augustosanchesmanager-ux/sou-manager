/**
 * [SMG][FINANCE][REFUND_CONFIG] M4-P8 tests
 *
 * Validates getTenantRefundMethod and upsertTenantRefundMethod:
 *   - Calls RPCs with correct parameters
 *   - Falls back to default refund method when RPC returns invalid value
 *   - Validates refundMethod enum before upsert
 *   - Returns typed result shape
 *   - Throws on RPC errors and success=false
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTenantRefundMethod,
  upsertTenantRefundMethod,
  DEFAULT_REFUND_METHOD,
} from './refundConfig';

const mockRpc = vi.fn();
const mockSupabase = { rpc: mockRpc };

describe('M4-P8 — getTenantRefundMethod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns configured refund method', async () => {
    mockRpc.mockResolvedValue({
      data: {
        tenant_id: 'tenant-1',
        refund_method: 'pix',
        settings: { refund_method: 'pix' },
      },
      error: null,
    });

    const result = await getTenantRefundMethod({
      tenantId: 'tenant-1',
      supabase: mockSupabase,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'get_tenant_refund_method',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
      }),
    );
    expect(result).toEqual({
      tenantId: 'tenant-1',
      refundMethod: 'pix',
      settings: { refund_method: 'pix' },
    });
  });

  it('falls back to internal_credit when unset', async () => {
    mockRpc.mockResolvedValue({
      data: {
        tenant_id: 'tenant-1',
        refund_method: 'internal_credit',
        settings: {},
      },
      error: null,
    });

    const result = await getTenantRefundMethod({
      tenantId: 'tenant-1',
      supabase: mockSupabase,
    });

    expect(result.refundMethod).toBe(DEFAULT_REFUND_METHOD);
  });

  it('falls back to default when RPC returns invalid value', async () => {
    mockRpc.mockResolvedValue({
      data: {
        tenant_id: 'tenant-1',
        refund_method: 'crypto',
        settings: {},
      },
      error: null,
    });

    const result = await getTenantRefundMethod({
      tenantId: 'tenant-1',
      supabase: mockSupabase,
    });

    expect(result.refundMethod).toBe(DEFAULT_REFUND_METHOD);
  });

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Tenant nao encontrado' },
    });

    await expect(
      getTenantRefundMethod({
        tenantId: 'tenant-1',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Tenant nao encontrado');
  });
});

describe('M4-P8 — upsertTenantRefundMethod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls upsert_tenant_refund_method with refund method', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        tenant_id: 'tenant-1',
        refund_method: 'store_credit',
        message: 'OK',
      },
      error: null,
    });

    const result = await upsertTenantRefundMethod({
      tenantId: 'tenant-1',
      refundMethod: 'store_credit',
      supabase: mockSupabase,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'upsert_tenant_refund_method',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_refund_method: 'store_credit',
      }),
    );
    expect(result.refundMethod).toBe('store_credit');
  });

  it('throws on invalid refund method', async () => {
    await expect(
      upsertTenantRefundMethod({
        tenantId: 'tenant-1',
        refundMethod: 'bitcoin' as any,
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Método de reembolso inválido');
  });

  it('throws on success=false from RPC', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, message: 'Somente gestao pode alterar' },
      error: null,
    });

    await expect(
      upsertTenantRefundMethod({
        tenantId: 'tenant-1',
        refundMethod: 'pix',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Não foi possível salvar a configuração de reembolso');
  });

  it('throws on RPC error (management gate)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Somente gestao pode alterar configuracoes de reembolso' },
    });

    await expect(
      upsertTenantRefundMethod({
        tenantId: 'tenant-1',
        refundMethod: 'pix',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Somente gestao pode alterar configuracoes de reembolso');
  });
});