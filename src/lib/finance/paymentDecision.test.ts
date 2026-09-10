/**
 * [SMG][FINANCE][PAYMENT_DECISION] M4-P1 tests
 *
 * Validates reverseComandaPayment and checkComandaHasValidPayments:
 *   - Calls RPCs with correct parameters
 *   - Requires tenantId/comandaPaymentId/motivo
 *   - Returns typed result shape
 *   - Throws on RPC errors and success=false
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reverseComandaPayment,
  checkComandaHasValidPayments,
} from './paymentDecision';

const mockRpc = vi.fn();
const mockSupabase = { rpc: mockRpc };

describe('M4-P1 — reverseComandaPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls reverse_comanda_payment with required parameters', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        comanda_payment_id: 'payment-1',
        comanda_id: 'comanda-1',
        amount: 50,
        payment_type: 'anticipado',
        reversed_at: '2026-08-30T12:00:00Z',
        message: 'OK',
      },
      error: null,
    });

    await reverseComandaPayment({
      tenantId: 'tenant-1',
      comandaPaymentId: 'payment-1',
      motivo: 'Cancelamento do agendamento',
      supabase: mockSupabase,
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      'reverse_comanda_payment',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_comanda_payment_id: 'payment-1',
        p_motivo: 'Cancelamento do agendamento',
        p_refund_method: 'internal_credit',
      }),
    );
  });

  it('returns ReverseComandaPaymentResult shape on success', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        comanda_payment_id: 'payment-1',
        comanda_id: 'comanda-1',
        amount: 50,
        payment_type: 'anticipado',
        reversed_at: '2026-08-30T12:00:00Z',
        message: 'Reversão registrada',
      },
      error: null,
    });

    const result = await reverseComandaPayment({
      tenantId: 'tenant-1',
      comandaPaymentId: 'payment-1',
      motivo: 'Cancelamento do agendamento',
      supabase: mockSupabase,
    });

    expect(result).toEqual({
      success: true,
      idempotent: false,
      comandaPaymentId: 'payment-1',
      comandaId: 'comanda-1',
      amount: 50,
      paymentType: 'anticipado',
      reversedAt: '2026-08-30T12:00:00Z',
      message: 'Reversão registrada',
    });
  });

  it('throws when motivo is missing', async () => {
    await expect(
      reverseComandaPayment({
        tenantId: 'tenant-1',
        comandaPaymentId: 'payment-1',
        motivo: '',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Motivo obrigatório');
  });

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Usuario sem permissao para reversao de pagamento' },
    });

    await expect(
      reverseComandaPayment({
        tenantId: 'tenant-1',
        comandaPaymentId: 'payment-1',
        motivo: 'Cancelamento',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Usuario sem permissao para reversao de pagamento');
  });

  it('throws on success=false from RPC', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, message: 'Pagamento ja foi revertido' },
      error: null,
    });

    await expect(
      reverseComandaPayment({
        tenantId: 'tenant-1',
        comandaPaymentId: 'payment-1',
        motivo: 'Cancelamento',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Não foi possível processar a solicitação');
  });
});

describe('M4-P1 — checkComandaHasValidPayments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls check_comanda_has_valid_payments and returns true when payments exist', async () => {
    mockRpc.mockResolvedValue({
      data: {
        has_valid_payments: true,
        payment_count: 1,
        total_paid: 100,
      },
      error: null,
    });

    const result = await checkComandaHasValidPayments({
      tenantId: 'tenant-1',
      comandaId: 'comanda-1',
      supabase: mockSupabase,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'check_comanda_has_valid_payments',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_comanda_id: 'comanda-1',
      }),
    );
    expect(result).toEqual({
      hasValidPayments: true,
      paymentCount: 1,
      totalPaid: 100,
    });
  });

  it('returns false when no valid payments exist', async () => {
    mockRpc.mockResolvedValue({
      data: {
        has_valid_payments: false,
        payment_count: 0,
        total_paid: 0,
      },
      error: null,
    });

    const result = await checkComandaHasValidPayments({
      tenantId: 'tenant-1',
      comandaId: 'comanda-1',
      supabase: mockSupabase,
    });

    expect(result.hasValidPayments).toBe(false);
    expect(result.paymentCount).toBe(0);
  });

  it('throws when comandaId is missing', async () => {
    await expect(
      checkComandaHasValidPayments({
        tenantId: 'tenant-1',
        comandaId: '',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('comanda_id obrigatório');
  });
});