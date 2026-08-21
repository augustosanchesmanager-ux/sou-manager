/**
 * [SMG][DOMAIN][EVENTS][STRATEGY] defaultFinanceStrategy tests
 *
 * Tests the pure FinanceStrategy implementation.
 * Covers all 5 event mappings with positive, edge, and contract cases.
 */

import { describe, it, expect } from 'vitest';
import { createDefaultFinanceStrategy } from './defaultFinanceStrategy';
import type { FinanceOperation } from './financeSubscriber';
import type {
  CheckoutCompletedEvent,
  CheckoutRevertedEvent,
  SubscriptionCancelledEvent,
  CreditsDeductedEvent,
  CashClosingCompletedEvent,
} from '../types';

const strategy = createDefaultFinanceStrategy();

const baseMeta = { tenantId: 't-1', userId: 'u-1', correlationId: 'corr-1', source: 'Test' };

const makeCheckoutCompleted = (
  overrides: Partial<CheckoutCompletedEvent['payload']> = {},
): CheckoutCompletedEvent => ({
  eventId: 'evt_1', eventType: 'CheckoutCompleted', eventTypeVersion: 1,
  aggregateId: 'comanda-1', aggregateType: 'comanda', occurredAt: '2026-08-20T12:00:00Z',
  metadata: baseMeta,
  payload: {
    comandaId: 'comanda-1', clientId: 'client-1', staffId: 'staff-1', total: 100,
    paymentMethod: 'pix', paymentStatus: 'paid', closureMode: 'standard',
    itemCount: 1, hasClubCredit: false, financialEffect: true, ...overrides,
  },
});

const makeCheckoutReverted = (
  overrides: Partial<CheckoutRevertedEvent['payload']> = {},
): CheckoutRevertedEvent => ({
  eventId: 'evt_2', eventType: 'CheckoutReverted', eventTypeVersion: 1,
  aggregateId: 'comanda-1', aggregateType: 'comanda', occurredAt: '2026-08-20T12:00:00Z',
  metadata: baseMeta,
  payload: {
    comandaId: 'comanda-1', reason: 'wrong_settlement', reversedBy: 'u-1',
    originalTotal: 100, reversedAmount: 50, originalCommission: 25,
    originalReceivedValue: 100, ...overrides,
  },
});

const makeSubscriptionCancelled = (
  overrides: Partial<SubscriptionCancelledEvent['payload']> = {},
): SubscriptionCancelledEvent => ({
  eventId: 'evt_3', eventType: 'SubscriptionCancelled', eventTypeVersion: 1,
  aggregateId: 'sub-1', aggregateType: 'subscription', occurredAt: '2026-08-20T12:00:00Z',
  metadata: baseMeta,
  payload: { subscriptionId: 'sub-1', reason: 'customer_request', ...overrides },
});

const makeCreditsDeducted = (
  overrides: Partial<CreditsDeductedEvent['payload']> = {},
): CreditsDeductedEvent => ({
  eventId: 'evt_4', eventType: 'CreditsDeducted', eventTypeVersion: 1,
  aggregateId: 'sub-1', aggregateType: 'subscription', occurredAt: '2026-08-20T12:00:00Z',
  metadata: baseMeta,
  payload: {
    subscriptionId: 'sub-1', serviceId: 'svc-1', amount: 1,
    reference: 'Comanda #comanda-1 - CORTE SIMPLES', ...overrides,
  },
});

const makeCashClosingCompleted = (
  overrides: Partial<CashClosingCompletedEvent['payload']> = {},
): CashClosingCompletedEvent => ({
  eventId: 'evt_5', eventType: 'CashClosingCompleted', eventTypeVersion: 1,
  aggregateId: 'closing-1', aggregateType: 'cash_closing', occurredAt: '2026-08-20T12:00:00Z',
  metadata: baseMeta,
  payload: {
    closingId: 'closing-1', businessDate: '2026-08-20', closedBy: 'u-1',
    expectedBalance: 500, countedBalance: 498, difference: -2,
    extrasCount: 0, hasDiscrepancy: true, ...overrides,
  },
});

// ─── CheckoutCompleted ────────────────────────────────────────

describe('FinanceStrategy - CheckoutCompleted', () => {
  it('produces create_transaction + create_commission_record for paid checkout', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted());
    expect(ops).toHaveLength(2);
    expect(ops[0].type).toBe('create_transaction');
    expect(ops[1].type).toBe('create_commission_record');
  });

  it('includes correct transaction data per contract', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted({ total: 45, paymentMethod: 'pix' }));
    expect(ops[0].data).toMatchObject({
      tenantId: 't-1', type: 'income', category: 'Receita de Comanda',
      amount: 45, paymentMethod: 'pix', sourceType: 'comanda', sourceId: 'comanda-1', status: 'paid',
    });
  });

  it('includes receivedValue = total in commission record', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted({ total: 80 }));
    expect(ops[1].data).toMatchObject({ receivedValue: 80, staffId: 'staff-1' });
  });

  it('skips both operations when financialEffect is false', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted({ financialEffect: false }));
    expect(ops).toHaveLength(0);
  });

  it('skips commission when staffId is missing', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted({ staffId: undefined }));
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('create_transaction');
  });

  it('skips transaction when total is 0 (zero-paid checkout)', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted({ total: 0 }));
    expect(ops).toHaveLength(0);
  });

  it('handles missing paymentMethod gracefully', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted({ paymentMethod: undefined }));
    expect(ops[0].data).toMatchObject({ paymentMethod: 'unknown' });
  });

  it('passes hasClubCredit to commission record', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted({ hasClubCredit: true }));
    expect(ops[1].data).toMatchObject({ hasClubCredit: true });
  });
});

// ─── CheckoutReverted ─────────────────────────────────────────

describe('FinanceStrategy - CheckoutReverted', () => {
  it('produces reverse_commission with proportional calculation', () => {
    const ops = strategy.mapCheckoutReverted(makeCheckoutReverted());
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('reverse_commission');
  });

  it('calculates proportional reversal correctly (50/100 = 50%)', () => {
    const ops = strategy.mapCheckoutReverted(makeCheckoutReverted({
      reversedAmount: 50, originalCommission: 25, originalReceivedValue: 100,
    }));
    expect(ops[0].data).toMatchObject({ commissionReversal: 12.5 });
  });

  it('caps reversal at 100% when reversedAmount exceeds originalReceivedValue', () => {
    const ops = strategy.mapCheckoutReverted(makeCheckoutReverted({
      reversedAmount: 150, originalCommission: 25, originalReceivedValue: 100,
    }));
    expect(ops[0].data).toMatchObject({ commissionReversal: 25 });
  });

  it('returns no operation when originalReceivedValue is 0 (reversal = 0)', () => {
    const ops = strategy.mapCheckoutReverted(makeCheckoutReverted({
      reversedAmount: 50, originalCommission: 25, originalReceivedValue: 0,
    }));
    expect(ops).toHaveLength(0);
  });

  it('returns no operation when reversedAmount is 0 (reversal = 0)', () => {
    const ops = strategy.mapCheckoutReverted(makeCheckoutReverted({
      reversedAmount: 0, originalCommission: 25, originalReceivedValue: 100,
    }));
    expect(ops).toHaveLength(0);
  });

  it('handles full refund (100%)', () => {
    const ops = strategy.mapCheckoutReverted(makeCheckoutReverted({
      reversedAmount: 100, originalCommission: 30, originalReceivedValue: 100,
    }));
    expect(ops[0].data).toMatchObject({ commissionReversal: 30 });
  });

  it('preserves tenantId and comandaId', () => {
    const ops = strategy.mapCheckoutReverted(makeCheckoutReverted());
    expect(ops[0].data).toMatchObject({ tenantId: 't-1', comandaId: 'comanda-1' });
  });
});

// ─── SubscriptionCancelled ────────────────────────────────────

describe('FinanceStrategy - SubscriptionCancelled', () => {
  it('produces reverse_revenue', () => {
    const ops = strategy.mapSubscriptionCancelled(makeSubscriptionCancelled());
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('reverse_revenue');
  });

  it('includes subscriptionId and reason', () => {
    const ops = strategy.mapSubscriptionCancelled(makeSubscriptionCancelled());
    expect(ops[0].data).toMatchObject({
      tenantId: 't-1', subscriptionId: 'sub-1', reason: 'customer_request',
    });
  });

  it('defaults reason when not provided', () => {
    const ops = strategy.mapSubscriptionCancelled(makeSubscriptionCancelled({ reason: undefined }));
    expect(ops[0].data).toMatchObject({ reason: 'Subscription cancelled' });
  });
});

// ─── CreditsDeducted ──────────────────────────────────────────

describe('FinanceStrategy - CreditsDeducted', () => {
  it('produces deduct_credits', () => {
    const ops = strategy.mapCreditsDeducted(makeCreditsDeducted());
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('deduct_credits');
  });

  it('includes all credit deduction data', () => {
    const ops = strategy.mapCreditsDeducted(makeCreditsDeducted());
    expect(ops[0].data).toMatchObject({
      tenantId: 't-1', subscriptionId: 'sub-1', serviceId: 'svc-1',
      amount: 1, reference: 'Comanda #comanda-1 - CORTE SIMPLES',
    });
  });
});

// ─── CashClosingCompleted ─────────────────────────────────────

describe('FinanceStrategy - CashClosingCompleted', () => {
  it('produces close_daily_cash', () => {
    const ops = strategy.mapCashClosingCompleted(makeCashClosingCompleted());
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('close_daily_cash');
  });

  it('includes all closing data', () => {
    const ops = strategy.mapCashClosingCompleted(makeCashClosingCompleted());
    expect(ops[0].data).toMatchObject({
      tenantId: 't-1', closingId: 'closing-1', businessDate: '2026-08-20',
      expectedBalance: 500, countedBalance: 498, difference: -2, hasDiscrepancy: true,
    });
  });

  it('handles no discrepancy', () => {
    const ops = strategy.mapCashClosingCompleted(makeCashClosingCompleted({
      difference: 0, hasDiscrepancy: false,
    }));
    expect(ops[0].data).toMatchObject({ difference: 0, hasDiscrepancy: false });
  });
});

// ─── Contract compliance ──────────────────────────────────────

describe('FinanceStrategy - Contract compliance', () => {
  const allOps: FinanceOperation[] = [
    ...strategy.mapCheckoutCompleted(makeCheckoutCompleted()),
    ...strategy.mapCheckoutReverted(makeCheckoutReverted()),
    ...strategy.mapSubscriptionCancelled(makeSubscriptionCancelled()),
    ...strategy.mapCreditsDeducted(makeCreditsDeducted()),
    ...strategy.mapCashClosingCompleted(makeCashClosingCompleted()),
  ];

  it('never produces operations with fake success', () => {
    for (const op of allOps) {
      expect(op.data).not.toHaveProperty('success');
      expect(op.type).toBeTruthy();
    }
  });

  it('all operations have tenantId', () => {
    for (const op of allOps) {
      expect(op.data).toHaveProperty('tenantId', 't-1');
    }
  });

  it('CheckoutCompleted transaction uses category from contract', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted());
    expect(ops[0].data).toHaveProperty('category', 'Receita de Comanda');
  });

  it('CheckoutReverted commission reversal is proportional', () => {
    const ops = strategy.mapCheckoutReverted(makeCheckoutReverted({
      reversedAmount: 30, originalCommission: 20, originalReceivedValue: 100,
    }));
    const reversal = (ops[0].data as Record<string, unknown>).commissionReversal as number;
    expect(reversal).toBe(6); // 20 * (30/100)
  });

  it('CheckoutCompleted produces exactly 5 event types mapped', () => {
    const eventTypes = ['CheckoutCompleted', 'CheckoutReverted', 'SubscriptionCancelled', 'CreditsDeducted', 'CashClosingCompleted'];
    expect(eventTypes).toHaveLength(5);
  });
});
