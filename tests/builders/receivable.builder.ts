import type { CustomerSubscriptionReceivable } from '../../domain/receivable/types';

let _rcvSeq = 0;

export const resetReceivableSeq = () => { _rcvSeq = 0; };

export const makeReceivable = (
  overrides: Partial<CustomerSubscriptionReceivable> = {},
): CustomerSubscriptionReceivable => ({
  id: `rcv-${++_rcvSeq}`,
  tenant_id: 'tenant-1',
  customer_id: 'client-1',
  subscription_id: 'sub-1',
  plan_id: 'plan-1',
  billing_cycle_start: '2026-07-01',
  billing_cycle_end: '2026-07-31',
  due_date: '2026-07-15',
  amount: 100,
  status: 'pending',
  payment_method: null,
  paid_at: null,
  transaction_id: null,
  notes: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

export const makePaidReceivable = (overrides: Partial<CustomerSubscriptionReceivable> = {}) =>
  makeReceivable({
    status: 'paid',
    paid_at: new Date().toISOString(),
    transaction_id: 'tx-1',
    ...overrides,
  });

export const makeOverdueReceivable = (overrides: Partial<CustomerSubscriptionReceivable> = {}) =>
  makeReceivable({ status: 'overdue', ...overrides });
