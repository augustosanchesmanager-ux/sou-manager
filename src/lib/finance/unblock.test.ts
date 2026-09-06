/**
 * [SMG][FINANCE][UNBLOCK] M4-P6 tests
 *
 * Validates unblockComanda and batchUnblockComandas:
 *   - Calls RPCs with correct parameters
 *   - Requires reason for manual mode
 *   - Returns typed result shape
 *   - Throws on RPC errors and success=false
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  unblockComanda,
  batchUnblockComandas,
} from './unblock';

const mockRpc = vi.fn();
const mockSupabase = { rpc: mockRpc };

describe('M4-P6 — unblockComanda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls unblock_comanda in manual mode with reason', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        comanda_id: 'comanda-1',
        previous_status: 'blocked',
        new_status: 'open',
        mode: 'manual',
        message: 'OK',
      },
      error: null,
    });

    await unblockComanda({
      tenantId: 'tenant-1',
      comandaId: 'comanda-1',
      mode: 'manual',
      reason: 'Cliente confirmou presença',
      operatorId: 'user-1',
      supabase: mockSupabase,
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      'unblock_comanda',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_comanda_id: 'comanda-1',
        p_mode: 'manual',
        p_reason: 'Cliente confirmou presença',
        p_operator_id: 'user-1',
      }),
    );
  });

  it('calls unblock_comanda in auto mode without reason', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        comanda_id: 'comanda-1',
        previous_status: 'blocked',
        new_status: 'open',
        mode: 'auto',
        message: 'OK',
      },
      error: null,
    });

    await unblockComanda({
      tenantId: 'tenant-1',
      comandaId: 'comanda-1',
      mode: 'auto',
      supabase: mockSupabase,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'unblock_comanda',
      expect.objectContaining({
        p_mode: 'auto',
        p_reason: null,
      }),
    );
  });

  it('throws when manual mode has no reason', async () => {
    await expect(
      unblockComanda({
        tenantId: 'tenant-1',
        comandaId: 'comanda-1',
        mode: 'manual',
        reason: '',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Motivo obrigatório para desbloqueio manual');
  });

  it('throws on invalid mode', async () => {
    await expect(
      unblockComanda({
        tenantId: 'tenant-1',
        comandaId: 'comanda-1',
        mode: 'invalid' as any,
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Modo de desbloqueio inválido');
  });

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Comanda nao esta bloqueada' },
    });

    await expect(
      unblockComanda({
        tenantId: 'tenant-1',
        comandaId: 'comanda-1',
        mode: 'auto',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Comanda nao esta bloqueada');
  });
});

describe('M4-P6 — batchUnblockComandas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls batch_unblock_comandas with comanda ids array', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        unblocked_count: 2,
        comanda_ids: ['comanda-1', 'comanda-2'],
        message: 'OK',
      },
      error: null,
    });

    const result = await batchUnblockComandas({
      tenantId: 'tenant-1',
      comandaIds: ['comanda-1', 'comanda-2'],
      supabase: mockSupabase,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'batch_unblock_comandas',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_comanda_ids: ['comanda-1', 'comanda-2'],
      }),
    );
    expect(result.unblockedCount).toBe(2);
  });

  it('throws when no comanda ids provided', async () => {
    await expect(
      batchUnblockComandas({
        tenantId: 'tenant-1',
        comandaIds: [],
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Nenhuma comanda selecionada');
  });

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Tenant nao encontrado' },
    });

    await expect(
      batchUnblockComandas({
        tenantId: 'tenant-1',
        comandaIds: ['comanda-1'],
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Tenant nao encontrado');
  });
});