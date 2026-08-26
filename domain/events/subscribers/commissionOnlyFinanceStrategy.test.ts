/**
 * [SMG][DOMAIN][EVENTS][STRATEGY] commissionOnlyFinanceStrategy tests
 *
 * TD-001 B3.4-G Activation Gate + D7 (Transactional Outbox).
 *
 * D7: CheckoutCompleted now returns [] because the composite RPC
 * (finance_settle_comanda_and_enqueue) handles outbox enqueue atomically.
 * FinanceSubscriber should NOT create a second outbox item.
 *
 * Validates the activation matrix (filtering behavior):
 *   CheckoutCompleted      -> [] (D7: composite RPC handles atomically)
 *   CheckoutReverted       -> reverse_commission ONLY
 *   SubscriptionCancelled  -> none
 *   CreditsDeducted        -> none
 *   CashClosingCompleted   -> none
 *
 * Calculation rules themselves are covered by defaultFinanceStrategy.test.ts;
 * here we assert the activation matrix (filtering behavior).
 */

import { describe, it, expect } from 'vitest';
import { createCommissionOnlyFinanceStrategy } from './commissionOnlyFinanceStrategy';
import type {
  CheckoutCompletedEvent,
  CheckoutRevertedEvent,
  SubscriptionCancelledEvent,
  CreditsDeductedEvent,
  CashClosingCompletedEvent,
} from '../types';

const strategy = createCommissionOnlyFinanceStrategy();

const baseMeta = { tenantId: 't-1', userId: 'u-1', correlationId: 'corr-1', source: 'Test' };

const makeCheckoutCompleted = (
  overrides: Partial<CheckoutCompletedEvent['payload']> = {},
): CheckoutCompletedEvent => ({
  eventId: 'evt_1', eventType: 'CheckoutCompleted', eventTypeVersion: 1,
  aggregateId: 'comanda-1', aggregateType: 'comanda', occurredAt: '2026-08-23T12:00:00Z',
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
  aggregateId: 'comanda-1', aggregateType: 'comanda', occurredAt: '2026-08-23T12:00:00Z',
  metadata: baseMeta,
  payload: {
    comandaId: 'comanda-1', reason: 'wrong_settlement', reversedBy: 'u-1',
    originalTotal: 100, reversedAmount: 50, originalCommission: 25,
    originalReceivedValue: 100, ...overrides,
  },
});

const makeSubscriptionCancelled = (): SubscriptionCancelledEvent => ({
  eventId: 'evt_3', eventType: 'SubscriptionCancelled', eventTypeVersion: 1,
  aggregateId: 'sub-1', aggregateType: 'subscription', occurredAt: '2026-08-23T12:00:00Z',
  metadata: baseMeta,
  payload: { subscriptionId: 'sub-1', reason: 'customer_request' },
});

const makeCreditsDeducted = (): CreditsDeductedEvent => ({
  eventId: 'evt_4', eventType: 'CreditsDeducted', eventTypeVersion: 1,
  aggregateId: 'sub-1', aggregateType: 'subscription', occurredAt: '2026-08-23T12:00:00Z',
  metadata: baseMeta,
  payload: {
    subscriptionId: 'sub-1', serviceId: 'svc-1', amount: 1,
    reference: 'Comanda #comanda-1 - CORTE SIMPLES',
  },
});

const makeCashClosingCompleted = (): CashClosingCompletedEvent => ({
  eventId: 'evt_5', eventType: 'CashClosingCompleted', eventTypeVersion: 1,
  aggregateId: 'closing-1', aggregateType: 'cash_closing', occurredAt: '2026-08-23T12:00:00Z',
  metadata: baseMeta,
  payload: {
    closingId: 'closing-1', businessDate: '2026-08-23', closedBy: 'u-1',
    expectedBalance: 500, countedBalance: 498, difference: -2,
    extrasCount: 0, hasDiscrepancy: true,
  },
});

describe('CommissionOnlyFinanceStrategy - CheckoutCompleted', () => {
  it('produces nothing (D7: composite RPC handles outbox enqueue atomically)', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted());
    expect(ops).toHaveLength(0);
  });

  it('produces nothing even when financialEffect is true', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted({ financialEffect: true }));
    expect(ops).toHaveLength(0);
  });

  it('produces nothing even when staffId is present', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted({ staffId: 'staff-1' }));
    expect(ops).toHaveLength(0);
  });
});

describe('CommissionOnlyFinanceStrategy - CheckoutReverted', () => {
  it('produces reverse_commission with proportional calculation', () => {
    const ops = strategy.mapCheckoutReverted(makeCheckoutReverted());
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('reverse_commission');
    expect(ops[0].data).toMatchObject({ commissionReversal: 12.5 });
  });

  it('produces nothing when reversal computes to zero', () => {
    const ops = strategy.mapCheckoutReverted(
      makeCheckoutReverted({ reversedAmount: 0 }),
    );
    expect(ops).toHaveLength(0);
  });

  it('caps reversal at original commission', () => {
    const ops = strategy.mapCheckoutReverted(
      makeCheckoutReversed_over_100(),
    );
    expect(ops[0].data).toMatchObject({ commissionReversal: 25 });
  });

  function makeCheckoutReversed_over_100(): CheckoutRevertedEvent {
    return makeCheckoutReverted({
      reversedAmount: 150, originalCommission: 25, originalReceivedValue: 100,
    });
  }
});

describe('CommissionOnlyFinanceStrategy - Out-of-scope events produce NOTHING', () => {
  it('SubscriptionCancelled -> []', () => {
    expect(strategy.mapSubscriptionCancelled(makeSubscriptionCancelled())).toEqual([]);
  });

  it('CreditsDeducted -> []', () => {
    expect(strategy.mapCreditsDeducted(makeCreditsDeducted())).toEqual([]);
  });

  it('CashClosingCompleted -> []', () => {
    expect(strategy.mapCashClosingCompleted(makeCashClosingCompleted())).toEqual([]);
  });
});

describe('CommissionOnlyFinanceStrategy - Activation matrix compliance', () => {
  it('never produces forbidden operation types (D7: CheckoutCompleted excluded)', () => {
    const allOps = [
      ...strategy.mapCheckoutCompleted(makeCheckoutCompleted()),
      ...strategy.mapCheckoutCompleted(makeCheckoutCompleted({ hasClubCredit: true })),
      ...strategy.mapCheckoutCompleted(makeCheckoutCompleted({ paymentMethod: undefined })),
      ...strategy.mapCheckoutReverted(makeCheckoutReverted()),
      ...strategy.mapCheckoutReverted(makeCheckoutReverted({ reversedAmount: 150 })),
      ...strategy.mapSubscriptionCancelled(makeSubscriptionCancelled()),
      ...strategy.mapCreditsDeducted(makeCreditsDeducted()),
      ...strategy.mapCashClosingCompleted(makeCashClosingCompleted()),
    ];

    // D7: Only reverse_commission survives (CheckoutCompleted returns [])
    const allowed = new Set(['reverse_commission']);
    for (const op of allOps) {
      expect(allowed.has(op.type)).toBe(true);
    }
  });
});
