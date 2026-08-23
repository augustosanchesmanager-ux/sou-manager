/**
 * [SMG][DOMAIN][EVENTS][STRATEGY] commissionOnlyFinanceStrategy tests
 *
 * TD-001 B3.4-G Activation Gate.
 *
 * Validates that ONLY commission operations survive the gate:
 *   CheckoutCompleted      -> create_commission_record ONLY
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
  it('produces ONLY create_commission_record (create_transaction filtered out)', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted());
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('create_commission_record');
  });

  it('preserves commission data contract (receivedValue, staffId)', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted({ total: 80 }));
    expect(ops[0].data).toMatchObject({
      tenantId: 't-1', comandaId: 'comanda-1', staffId: 'staff-1', receivedValue: 80,
    });
  });

  it('produces nothing when financialEffect is false', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted({ financialEffect: false }));
    expect(ops).toHaveLength(0);
  });

  it('produces nothing when staffId is missing', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted({ staffId: undefined }));
    expect(ops).toHaveLength(0);
  });

  it('produces nothing when total is 0', () => {
    const ops = strategy.mapCheckoutCompleted(makeCheckoutCompleted({ total: 0 }));
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
  it('never produces forbidden operation types', () => {
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

    const allowed = new Set(['create_commission_record', 'reverse_commission']);
    for (const op of allOps) {
      expect(allowed.has(op.type)).toBe(true);
    }
  });
});
