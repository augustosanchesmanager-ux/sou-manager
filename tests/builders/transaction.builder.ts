import type { Transaction } from '../../domain/transaction/types';

let _txSeq = 0;

export const resetTransactionSeq = () => { _txSeq = 0; };

export const makeTransaction = (
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: `tx-${++_txSeq}`,
  tenant_id: 'tenant-1',
  type: 'income',
  category: 'service',
  amount: 50,
  description: 'Corte masculino',
  payment_method: 'Dinheiro',
  date: new Date().toISOString().split('T')[0],
  status: 'completed',
  source_type: 'comanda',
  source_id: 'comanda-1',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const makeIncomeTransaction = (amount = 50, overrides: Partial<Transaction> = {}) =>
  makeTransaction({ type: 'income', amount, ...overrides });

export const makeExpenseTransaction = (amount = 20, overrides: Partial<Transaction> = {}) =>
  makeTransaction({ type: 'expense', amount, category: 'expense', ...overrides });
