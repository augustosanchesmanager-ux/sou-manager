import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appEventBus } from '../../../domain/events/app-bus';
import { createReversalKey, reverseFinancialTransaction } from './reversal';
import { isManagerLikeRole } from './zeroClose';

vi.mock('../../../domain/events/app-bus', () => ({
  appEventBus: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

const createMockSupabase = ({
  rpcResult = {
    data: {
      success: true,
      idempotent: false,
      financial_reversal_id: 'rev-1',
      original_transaction_id: 'tx-1',
      reversal_transaction_id: 'tx-rev-1',
      message: 'Reversao financeira registrada com sucesso.',
    },
    error: null,
  },
  originalTx = {
    source_id: 'comanda-1',
    amount: 120,
    source_type: 'comanda',
  },
  comandaRow = {
    id: 'comanda-1',
    total: 120,
  },
  itemRows = [
    {
      id: 'item-1',
      unit_price: 120,
      quantity: 1,
    },
  ],
  participantRows = [] as Array<Record<string, unknown>>,
}: {
  rpcResult?: { data: Record<string, unknown> | null; error: { message: string } | null };
  originalTx?: { source_id: string; amount: number; source_type: string } | null;
  comandaRow?: { id: string; total: number } | null;
  itemRows?: Array<{ id: string; unit_price: number; quantity: number }>;
  participantRows?: Array<Record<string, unknown>>;
} = {}) => {
  const rpc = vi.fn().mockResolvedValue(rpcResult);

  const from = vi.fn((table: string) => {
    if (table === 'transactions') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: originalTx, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === 'comandas') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: comandaRow, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === 'comanda_items') {
      return {
        select: () => ({
          eq: () => ({
            eq: vi.fn().mockResolvedValue({ data: itemRows, error: null }),
          }),
        }),
      };
    }
    if (table === 'service_execution_participants') {
      return {
        select: () => ({
          eq: () => ({
            in: vi.fn().mockResolvedValue({ data: participantRows, error: null }),
          }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };
  });

  return { rpc, from };
};

describe('reverseFinancialTransaction — wrong_settlement comanda reopen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_generate_prefixed_idempotency_key_when_createReversalKey_is_called', () => {
    const key = createReversalKey('tx-123');
    expect(key).toMatch(/^finance-reversal-tx-123-/);
  });

  it('should_call_finance_reverse_transaction_rpc_with_wrong_settlement_and_publish_event_when_valid', async () => {
    // Arrange
    const supabase = createMockSupabase();

    // Act
    const result = await reverseFinancialTransaction({
      tenantId: 'tenant-1',
      originalTransactionId: 'tx-1',
      supabase,
      reversalType: 'wrong_settlement',
      amount: 120,
      reasonType: 'baixa_indevida',
      reasonNote: 'Comanda baixada por engano antes de incluir produto',
      refundMethod: null,
      reversalDate: '2026-10-19T15:00:00.000Z',
      idempotencyKey: 'idem-reopen-1',
    });

    // Assert
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith('finance_reverse_transaction', {
      p_tenant_id: 'tenant-1',
      p_original_transaction_id: 'tx-1',
      p_reversal_type: 'wrong_settlement',
      p_amount: 120,
      p_reason_type: 'baixa_indevida',
      p_reason_note: 'Comanda baixada por engano antes de incluir produto',
      p_refund_method: null,
      p_reversal_date: '2026-10-19T15:00:00.000Z',
      p_idempotency_key: 'idem-reopen-1',
    });
    expect(result).toEqual({
      success: true,
      idempotent: false,
      financialReversalId: 'rev-1',
      originalTransactionId: 'tx-1',
      reversalTransactionId: 'tx-rev-1',
      message: 'Reversao financeira registrada com sucesso.',
    });
    expect(appEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('should_throw_validation_error_when_reasonNote_or_amount_is_invalid', async () => {
    const supabase = createMockSupabase();

    await expect(
      reverseFinancialTransaction({
        tenantId: 'tenant-1',
        originalTransactionId: 'tx-1',
        supabase,
        reversalType: 'wrong_settlement',
        amount: 120,
        reasonType: 'baixa_indevida',
        reasonNote: '   ',
      }),
    ).rejects.toThrow('Observação obrigatória para reversão financeira.');

    await expect(
      reverseFinancialTransaction({
        tenantId: 'tenant-1',
        originalTransactionId: 'tx-1',
        supabase,
        reversalType: 'wrong_settlement',
        amount: 0,
        reasonType: 'baixa_indevida',
        reasonNote: 'Teste',
      }),
    ).rejects.toThrow('Valor de reversão deve ser maior que zero.');
  });

  it('should_throw_error_when_rpc_returns_error', async () => {
    const supabase = createMockSupabase({
      rpcResult: {
        data: null,
        error: { message: 'Usuario sem permissao para reversao financeira' },
      },
    });

    await expect(
      reverseFinancialTransaction({
        tenantId: 'tenant-1',
        originalTransactionId: 'tx-1',
        supabase,
        reversalType: 'wrong_settlement',
        amount: 120,
        reasonType: 'baixa_indevida',
        reasonNote: 'Estorno de comanda',
      }),
    ).rejects.toThrow('Usuario sem permissao para reversao financeira');
  });

  it('should_restrict_manager_like_role_correctly_when_checking_rbac', () => {
    expect(isManagerLikeRole('admin', false)).toBe(true);
    expect(isManagerLikeRole('manager', false)).toBe(true);
    expect(isManagerLikeRole('owner', false)).toBe(true);
    expect(isManagerLikeRole('gerente', false)).toBe(true);
    expect(isManagerLikeRole('barber', true)).toBe(true);
    expect(isManagerLikeRole('barber', false)).toBe(false);
    expect(isManagerLikeRole('receptionist', false)).toBe(false);
    expect(isManagerLikeRole(null, false)).toBe(false);
  });
});
