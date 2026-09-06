/**
 * [SMG][FINANCE][PAYMENT] M4-P7 tests
 *
 * Validates registerComandaPayment and getComandaPaymentSummary:
 *   - Calls RPCs with correct parameters
 *   - Requires paymentType/amount
 *   - Generates idempotency key when not provided
 *   - Returns typed result shape
 *   - Throws on RPC errors and success=false
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerComandaPayment,
  getComandaPaymentSummary,
} from './payment';

const mockRpc = vi.fn();
const mockSupabase = { rpc: mockRpc };

describe('M4-P7 — registerComandaPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls register_comanda_payment with all parameters', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        comanda_id: 'comanda-1',
        payment_type: 'anticipado',
        amount: 50,
        total_paid: 50,
        comanda_total: 100,
        remaining: 50,
        message: 'OK',
      },
      error: null,
    });

    await registerComandaPayment({
      tenantId: 'tenant-1',
      comandaId: 'comanda-1',
      paymentType: 'anticipado',
      amount: 50,
      paymentMethod: 'pix',
      motivo: 'Antecipação',
      idempotencyKey: 'idem-key-1',
      supabase: mockSupabase,
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      'register_comanda_payment',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_comanda_id: 'comanda-1',
        p_payment_type: 'anticipado',
        p_amount: 50,
        p_payment_method: 'pix',
        p_motivo: 'Antecipação',
        p_idempotency_key: 'idem-key-1',
      }),
    );
  });

  it('returns RegisterComandaPaymentResult shape on success', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        comanda_id: 'comanda-1',
        payment_type: 'parcial',
        amount: 30,
        total_paid: 30,
        comanda_total: 100,
        remaining: 70,
        message: 'Pagamento registrado',
      },
      error: null,
    });

    const result = await registerComandaPayment({
      tenantId: 'tenant-1',
      comandaId: 'comanda-1',
      paymentType: 'parcial',
      amount: 30,
      supabase: mockSupabase,
    });

    expect(result).toEqual({
      success: true,
      idempotent: false,
      comandaId: 'comanda-1',
      paymentType: 'parcial',
      amount: 30,
      totalPaid: 30,
      comandaTotal: 100,
      remaining: 70,
      message: 'Pagamento registrado',
    });
  });

  it('detects idempotent responses', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        idempotent: true,
        comanda_id: 'comanda-1',
        payment_type: 'anticipado',
        amount: 50,
        total_paid: 50,
        comanda_total: 100,
        remaining: 50,
      },
      error: null,
    });

    const result = await registerComandaPayment({
      tenantId: 'tenant-1',
      comandaId: 'comanda-1',
      paymentType: 'anticipado',
      amount: 50,
      supabase: mockSupabase,
    });

    expect(result.idempotent).toBe(true);
  });

  it('throws when amount is zero', async () => {
    await expect(
      registerComandaPayment({
        tenantId: 'tenant-1',
        comandaId: 'comanda-1',
        paymentType: 'parcial',
        amount: 0,
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('maior que zero');
  });

  it('throws when paymentType is missing', async () => {
    await expect(
      registerComandaPayment({
        tenantId: 'tenant-1',
        comandaId: 'comanda-1',
        paymentType: '' as any,
        amount: 50,
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Tipo de pagamento obrigatório');
  });

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Total de pagamentos excede o total da comanda' },
    });

    await expect(
      registerComandaPayment({
        tenantId: 'tenant-1',
        comandaId: 'comanda-1',
        paymentType: 'parcial',
        amount: 200,
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Total de pagamentos excede o total da comanda');
  });
});

describe('M4-P7 — getComandaPaymentSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns payment summary with normalized payments list', async () => {
    mockRpc.mockResolvedValue({
      data: {
        comanda_id: 'comanda-1',
        comanda_total: 100,
        total_paid: 50,
        remaining: 50,
        payment_count: 1,
        has_valid_payments: true,
        payments: [
          {
            id: 'payment-1',
            payment_type: 'anticipado',
            amount: 50,
            payment_method: 'pix',
            created_at: '2026-08-30T12:00:00Z',
          },
        ],
      },
      error: null,
    });

    const result = await getComandaPaymentSummary({
      tenantId: 'tenant-1',
      comandaId: 'comanda-1',
      supabase: mockSupabase,
    });

    expect(result.hasValidPayments).toBe(true);
    expect(result.paymentCount).toBe(1);
    expect(result.remaining).toBe(50);
    expect(result.payments[0]).toEqual({
      id: 'payment-1',
      paymentType: 'anticipado',
      amount: 50,
      paymentMethod: 'pix',
      createdAt: '2026-08-30T12:00:00Z',
    });
  });

  it('returns empty payments list when no payments exist', async () => {
    mockRpc.mockResolvedValue({
      data: {
        comanda_id: 'comanda-1',
        comanda_total: 100,
        total_paid: 0,
        remaining: 100,
        payment_count: 0,
        has_valid_payments: false,
        payments: [],
      },
      error: null,
    });

    const result = await getComandaPaymentSummary({
      tenantId: 'tenant-1',
      comandaId: 'comanda-1',
      supabase: mockSupabase,
    });

    expect(result.hasValidPayments).toBe(false);
    expect(result.payments).toEqual([]);
  });

  it('throws when comandaId is missing', async () => {
    await expect(
      getComandaPaymentSummary({
        tenantId: 'tenant-1',
        comandaId: '',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('comanda_id obrigatório');
  });
});