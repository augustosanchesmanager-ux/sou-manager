/**
 * [SMG][FINANCE][ADMIN_ADJUST] ADR-046 tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminAdjustComandaAudit,
  normalizeAdminAdjustDateToIso,
  type RpcClientLike,
} from './comandaAdminAdjust';

const mockRpc = vi.fn();
const mockSupabase: RpcClientLike = { rpc: mockRpc };

describe('ADR-046 — adminAdjustComandaAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_reject_when_reason_is_blank', async () => {
    await expect(
      adminAdjustComandaAudit({
        tenantId: 'tenant-1',
        comandaId: 'cmd-1',
        reason: '   ',
        newStatus: 'open',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow(/motivo obrigatório/i);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('should_reject_when_no_adjustment_field_is_provided', async () => {
    await expect(
      adminAdjustComandaAudit({
        tenantId: 'tenant-1',
        comandaId: 'cmd-1',
        reason: 'Conferência de caixa',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('ao menos um campo');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('should_require_audit_pin_when_adjusting_payment_date', async () => {
    await expect(
      adminAdjustComandaAudit({
        tenantId: 'tenant-1',
        comandaId: 'cmd-1',
        reason: 'Competência incorreta',
        newPaymentDate: '2026-11-09',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('PIN de gerente obrigatório');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('should_reject_invalid_pin_format', async () => {
    await expect(
      adminAdjustComandaAudit({
        tenantId: 'tenant-1',
        comandaId: 'cmd-1',
        reason: 'Competência incorreta',
        newPaymentDate: '2026-11-09',
        auditPin: '12ab',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('6 a 8 dígitos');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('should_reject_future_dates_in_normalizeAdminAdjustDateToIso', () => {
    const fixedNow = new Date(2026, 10, 10, 14, 0, 0);
    expect(() => normalizeAdminAdjustDateToIso('2026-11-11', fixedNow)).toThrow('inválida ou futura');
  });

  it('should_call_rpc_for_status_and_created_at_without_pin', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        changed: true,
        adjustment_id: 'adj-1',
        comanda_id: 'cmd-1',
        adjusted_fields: ['status', 'created_at'],
        before_snapshot: { status: 'blocked', created_at: '2026-11-11T01:00:00Z' },
        after_snapshot: { status: 'open', created_at: '2026-11-09T15:00:00Z' },
        pin_authorized: false,
        retroactive_adjustment: false,
        message: 'Ajuste gerencial registrado com sucesso.',
      },
      error: null,
    });

    const result = await adminAdjustComandaAudit({
      tenantId: 'tenant-1',
      comandaId: 'cmd-1',
      reason: 'Liberando comanda criada com fuso incorreto',
      newStatus: 'open',
      newCreatedAt: '2026-11-09',
      supabase: mockSupabase,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'admin_adjust_comanda_audit',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_comanda_id: 'cmd-1',
        p_reason: 'Liberando comanda criada com fuso incorreto',
        p_new_status: 'open',
        p_new_payment_date: null,
        p_audit_pin: null,
      }),
    );
    expect(result.changed).toBe(true);
    expect(result.adjustedFields).toEqual(['status', 'created_at']);
    expect(result.pinAuthorized).toBe(false);
  });

  it('should_forward_pin_and_return_retroactive_flag_for_payment_date', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        changed: true,
        adjustment_id: 'adj-2',
        comanda_id: 'cmd-paid-1',
        adjusted_fields: ['payment_date'],
        pin_authorized: true,
        retroactive_adjustment: true,
        message: 'Ajuste gerencial registrado com sucesso.',
      },
      error: null,
    });

    const result = await adminAdjustComandaAudit({
      tenantId: 'tenant-1',
      comandaId: 'cmd-paid-1',
      reason: 'Baixa caiu no dia errado',
      newPaymentDate: '2026-11-08',
      auditPin: ' 123456 ',
      supabase: mockSupabase,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'admin_adjust_comanda_audit',
      expect.objectContaining({
        p_comanda_id: 'cmd-paid-1',
        p_new_status: null,
        p_audit_pin: '123456',
      }),
    );
    expect(result.pinAuthorized).toBe(true);
    expect(result.retroactiveAdjustment).toBe(true);
  });

  it('should_propagate_rpc_error_message', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'PIN de autorizacao invalido' },
    });

    await expect(
      adminAdjustComandaAudit({
        tenantId: 'tenant-1',
        comandaId: 'cmd-paid-1',
        reason: 'Correção de competência',
        newPaymentDate: '2026-11-08',
        auditPin: '999999',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('PIN de autorizacao invalido');
  });
});
