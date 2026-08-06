/**
 * [SMG][DOMAIN][BILLING] billingEngine tests
 *
 * Cobre TODAS as transições aprovadas (tabela do PHASE_6_0_4_4 §3.2):
 *   trialing → activate_free (free) / start_past_due (pago)
 *   active   → finalize_cancellation / renew (+ invoice p/ pago) / none
 *   past_due → finalize_cancellation / none (grace)
 *   cancelled→ none
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it } from 'vitest';
import { processSubscription } from './billingEngine';
import type { BillingSubscription } from './types';

const BASE = {
  id: 'sub-1',
  tenantId: 'tenant-1',
  trialStartedAt: '2026-08-06T10:00:00.000Z',
  trialEndsAt: '2026-08-20T10:00:00.000Z',
  currentPeriodStart: '2026-08-06T10:00:00.000Z',
  currentPeriodEnd: '2026-09-06T10:00:00.000Z',
  cancelAtPeriodEnd: null,
  canceledAt: null,
  createdAt: '2026-08-06T10:00:00.000Z',
};

const sub = (overrides: Partial<BillingSubscription> = {}): BillingSubscription => ({
  ...BASE,
  plan: 'free',
  status: 'trialing',
  ...overrides,
});

describe('processSubscription — trialing', () => {
  it('should_activate_free_when_trial_ends_for_free_plan', () => {
    const action = processSubscription(sub({ plan: 'free' }), '2026-08-21T00:00:00.000Z');
    expect(action).toMatchObject({ type: 'activate_free' });
    if (action.type === 'activate_free') {
      expect(action.newPeriodStart).toBe('2026-08-21T00:00:00.000Z');
      expect(action.newPeriodEnd).toBe('2026-09-20T00:00:00.000Z');
    }
  });

  it('should_start_past_due_when_trial_ends_for_paid_plan', () => {
    const action = processSubscription(sub({ plan: 'pro' }), '2026-08-21T00:00:00.000Z');
    expect(action).toEqual({ type: 'start_past_due' });
  });

  it('should_do_nothing_when_trial_not_ended', () => {
    expect(processSubscription(sub(), '2026-08-10T00:00:00.000Z')).toEqual({ type: 'none' });
  });

  it('should_do_nothing_when_trial_ends_at_is_null', () => {
    const s = sub({ trialEndsAt: null });
    expect(processSubscription(s, '2026-12-01T00:00:00.000Z')).toEqual({ type: 'none' });
  });
});

describe('processSubscription — active', () => {
  it('should_finalize_cancellation_when_cancel_at_period_end_reached', () => {
    const s = sub({
      status: 'active',
      plan: 'pro',
      cancelAtPeriodEnd: '2026-09-06T10:00:00.000Z',
    });
    const action = processSubscription(s, '2026-09-06T12:00:00.000Z');
    expect(action).toEqual({ type: 'finalize_cancellation' });
  });

  it('should_do_nothing_when_cancel_pending_but_period_not_over', () => {
    const s = sub({
      status: 'active',
      plan: 'pro',
      cancelAtPeriodEnd: '2026-09-06T10:00:00.000Z',
    });
    // cancel_at_period_end no futuro: NUNCA renova (D-A), apenas aguarda
    const action = processSubscription(s, '2026-08-06T10:00:00.000Z');
    expect(action).toEqual({ type: 'none' });
  });

  it('should_renew_without_invoice_when_period_ends_for_free_plan', () => {
    const s = sub({ status: 'active', plan: 'free', currentPeriodEnd: '2026-09-06T10:00:00.000Z' });
    const action = processSubscription(s, '2026-09-07T00:00:00.000Z');
    expect(action).toMatchObject({ type: 'renew', issueInvoice: false });
    if (action.type === 'renew') {
      expect(action.newPeriodStart).toBe('2026-09-06T10:00:00.000Z');
      expect(action.newPeriodEnd).toBe('2026-10-06T10:00:00.000Z');
    }
  });

  it('should_renew_with_invoice_when_period_ends_for_paid_plan', () => {
    const s = sub({ status: 'active', plan: 'premium', currentPeriodEnd: '2026-09-06T10:00:00.000Z' });
    const action = processSubscription(s, '2026-09-07T00:00:00.000Z');
    expect(action).toMatchObject({ type: 'renew', issueInvoice: true });
  });

  it('should_do_nothing_when_period_not_over', () => {
    const s = sub({ status: 'active', plan: 'pro' });
    expect(processSubscription(s, '2026-08-10T00:00:00.000Z')).toEqual({ type: 'none' });
  });
});

describe('processSubscription — past_due', () => {
  it('should_finalize_cancellation_when_cancel_at_period_end_reached', () => {
    const s = sub({
      status: 'past_due',
      plan: 'pro',
      cancelAtPeriodEnd: '2026-09-06T10:00:00.000Z',
    });
    const action = processSubscription(s, '2026-09-06T12:00:00.000Z');
    expect(action).toEqual({ type: 'finalize_cancellation' });
  });

  it('should_do_nothing_in_grace_without_gateway', () => {
    const s = sub({ status: 'past_due', plan: 'pro' });
    expect(processSubscription(s, '2026-09-20T00:00:00.000Z')).toEqual({ type: 'none' });
  });
});

describe('processSubscription — cancelled', () => {
  it('should_do_nothing_when_already_cancelled', () => {
    const s = sub({ status: 'cancelled', plan: 'pro', cancelAtPeriodEnd: '2026-09-06T10:00:00.000Z' });
    expect(processSubscription(s, '2026-12-01T00:00:00.000Z')).toEqual({ type: 'none' });
  });
});
