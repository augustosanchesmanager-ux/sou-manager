/**
 * [SMG][FINANCE][SETTLEMENT] D7 — settleCheckoutComandaAndEnqueue tests
 *
 * Validates that the composite RPC wrapper:
 *   - Calls finance_settle_comanda_and_enqueue with correct parameters
 *   - Passes outbox payload (eventId, eventType, payload, metadata) to RPC
 *   - Returns CheckoutSettlementResult shape correctly
 *   - Throws on RPC errors
 *   - Validates required parameters (comandaId, tenantId, paymentMethod, paidAmount)
 *   - Preserves idempotencyKey forwarding
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  settleCheckoutComandaAndEnqueue,
  type OutboxEnqueueData,
} from './settlement';

const mockRpc = vi.fn();
const mockSupabase = { rpc: mockRpc };

const baseInput = {
  comandaId: 'comanda-1',
  tenantId: 'tenant-1',
  supabase: mockSupabase,
  paymentMethod: 'pix',
  paidAmount: 100,
};

const baseOutbox: OutboxEnqueueData = {
  eventId: 'evt_test123_abc_1',
  eventType: 'CheckoutCompleted',
  payload: {
    operationType: 'create_commission_record',
    operationData: {
      tenantId: 'tenant-1',
      comandaId: 'comanda-1',
      clientId: 'client-1',
      staffId: 'staff-1',
      receivedValue: 100,
      paymentMethod: 'pix',
      hasClubCredit: false,
    },
    sourceEvent: 'CheckoutCompleted',
    idempotencyKey: 'evt_test123_abc_1_create_commission_record',
  },
  metadata: {
    tenantId: 'tenant-1',
    userId: 'user-1',
    correlationId: 'idem-key-1',
    causationId: 'evt_test123_abc_1',
    source: 'CheckoutApplicationService',
  },
};

describe('D7 — settleCheckoutComandaAndEnqueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls finance_settle_comanda_and_enqueue with all parameters', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, comanda_id: 'comanda-1', transaction_id: 'txn-1', status: 'paid', message: 'OK' },
      error: null,
    });

    await settleCheckoutComandaAndEnqueue({
      ...baseInput,
      outbox: baseOutbox,
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      'finance_settle_comanda_and_enqueue',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_comanda_id: 'comanda-1',
        p_payment_method: 'pix',
        p_paid_amount: 100,
        p_outbox_event_id: 'evt_test123_abc_1',
        p_outbox_event_type: 'CheckoutCompleted',
        p_outbox_payload: baseOutbox.payload,
        p_outbox_metadata: baseOutbox.metadata,
      }),
    );
  });

  it('returns CheckoutSettlementResult shape on success', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        comanda_id: 'comanda-1',
        transaction_id: 'txn-1',
        status: 'paid',
        message: 'Baixa registrada',
      },
      error: null,
    });

    const result = await settleCheckoutComandaAndEnqueue({
      ...baseInput,
      outbox: baseOutbox,
    });

    expect(result).toEqual({
      success: true,
      idempotent: false,
      comandaId: 'comanda-1',
      transactionId: 'txn-1',
      status: 'paid',
      message: 'Baixa registrada',
    });
  });

  it('detects idempotent responses', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        idempotent: true,
        comanda_id: 'comanda-1',
        transaction_id: 'txn-1',
        status: 'paid',
      },
      error: null,
    });

    const result = await settleCheckoutComandaAndEnqueue({
      ...baseInput,
      outbox: baseOutbox,
    });

    expect(result.idempotent).toBe(true);
  });

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'relation "outbox_items" does not exist' },
    });

    await expect(
      settleCheckoutComandaAndEnqueue({
        ...baseInput,
        outbox: baseOutbox,
      }),
    ).rejects.toThrow('Não foi possível registrar a baixa financeira');
  });

  it('throws on success=false from RPC', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, message: 'Comanda not found' },
      error: null,
    });

    await expect(
      settleCheckoutComandaAndEnqueue({
        ...baseInput,
        outbox: baseOutbox,
      }),
    ).rejects.toThrow('Não foi possível registrar a baixa financeira');
  });

  it('throws when tenantId is missing', async () => {
    await expect(
      settleCheckoutComandaAndEnqueue({
        ...baseInput,
        tenantId: '',
        outbox: baseOutbox,
      }),
    ).rejects.toThrow('tenant_id obrigatório');
  });

  it('throws when comandaId is missing', async () => {
    await expect(
      settleCheckoutComandaAndEnqueue({
        ...baseInput,
        comandaId: '',
        outbox: baseOutbox,
      }),
    ).rejects.toThrow('comanda_id obrigatório');
  });

  it('throws when paymentMethod is missing', async () => {
    await expect(
      settleCheckoutComandaAndEnqueue({
        ...baseInput,
        paymentMethod: '',
        outbox: baseOutbox,
      }),
    ).rejects.toThrow('Forma de pagamento obrigatória');
  });

  it('throws when paidAmount is zero', async () => {
    await expect(
      settleCheckoutComandaAndEnqueue({
        ...baseInput,
        paidAmount: 0,
        outbox: baseOutbox,
      }),
    ).rejects.toThrow('Valor pago deve ser maior que zero');
  });

  it('throws when paidAmount is negative', async () => {
    await expect(
      settleCheckoutComandaAndEnqueue({
        ...baseInput,
        paidAmount: -50,
        outbox: baseOutbox,
      }),
    ).rejects.toThrow('Valor pago deve ser maior que zero');
  });

  it('passes idempotencyKey to RPC when provided', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, comanda_id: 'comanda-1', transaction_id: 'txn-1', status: 'paid' },
      error: null,
    });

    await settleCheckoutComandaAndEnqueue({
      ...baseInput,
      idempotencyKey: 'custom-idem-key',
      outbox: baseOutbox,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'finance_settle_comanda_and_enqueue',
      expect.objectContaining({
        p_idempotency_key: 'custom-idem-key',
      }),
    );
  });

  it('passes outbox.targets to RPC when provided', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, comanda_id: 'comanda-1', transaction_id: 'txn-1', status: 'paid' },
      error: null,
    });

    const outboxWithTargets: OutboxEnqueueData = {
      ...baseOutbox,
      targets: [{ provider: 'finance', config: { mode: 'commission_only' } }],
    };

    await settleCheckoutComandaAndEnqueue({
      ...baseInput,
      outbox: outboxWithTargets,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'finance_settle_comanda_and_enqueue',
      expect.objectContaining({
        p_outbox_targets: [{ provider: 'finance', config: { mode: 'commission_only' } }],
      }),
    );
  });

  it('defaults outbox.targets to null when not provided', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, comanda_id: 'comanda-1', transaction_id: 'txn-1', status: 'paid' },
      error: null,
    });

    await settleCheckoutComandaAndEnqueue({
      ...baseInput,
      outbox: baseOutbox,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'finance_settle_comanda_and_enqueue',
      expect.objectContaining({
        p_outbox_targets: null,
      }),
    );
  });
});
