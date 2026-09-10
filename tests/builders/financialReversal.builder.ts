/**
 * P1.3 — Builder para registros de financial_reversals
 *
 * Usado em testes de equivalência para simular estornos legados
 * (transação de reversão + registro em financial_reversals).
 */

export interface FinancialReversalRecord {
  id: string;
  tenant_id: string;
  original_transaction_id: string;
  reversal_transaction_id: string;
  amount: number;
  reversal_type: string;
  reason: string;
  created_at: string;
}

let _frSeq = 0;

export const resetFinancialReversalSeq = () => { _frSeq = 0; };

export const makeFinancialReversal = (
  overrides: Partial<FinancialReversalRecord> = {},
): FinancialReversalRecord => ({
  id: `fr-${++_frSeq}`,
  tenant_id: 'tenant-1',
  original_transaction_id: 'tx-1',
  reversal_transaction_id: 'tx-reversal-1',
  amount: 50,
  reversal_type: 'full_refund',
  reason: 'Cancelamento do cliente',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const makeFullRefundReversal = (
  originalTxId: string,
  reversalTxId: string,
  amount: number,
  overrides: Partial<FinancialReversalRecord> = {},
) =>
  makeFinancialReversal({
    original_transaction_id: originalTxId,
    reversal_transaction_id: reversalTxId,
    amount,
    reversal_type: 'full_refund',
    ...overrides,
  });

export const makePartialRefundReversal = (
  originalTxId: string,
  reversalTxId: string,
  amount: number,
  overrides: Partial<FinancialReversalRecord> = {},
) =>
  makeFinancialReversal({
    original_transaction_id: originalTxId,
    reversal_transaction_id: reversalTxId,
    amount,
    reversal_type: 'partial_refund',
    ...overrides,
  });
