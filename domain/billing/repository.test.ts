/**
 * [SMG][DOMAIN][BILLING] repository (in-memory) tests
 *
 * Valida a SEMÂNTICA de persistência do repositório (mesma da produção):
 *   - createInvoice idempotente por (tenantId, idempotencyKey)
 *   - applyTransition espelha tenants.status (1:1 com status da subscription)
 *   - clearCancelRequest limpa cancel_at_period_end
 *   - findDueSubscriptions filtra candidatas vencidas (exclui cancelled)
 *   - recordPaymentAttempt é append-only
 */

import { describe, expect, it } from 'vitest';
import { createInMemoryBillingRepository } from './repository';
import type { BillingSubscription } from './types';

const BASE = {
  id: 'sub-1',
  tenantId: 'tenant-1',
  plan: 'pro' as const,
  status: 'active' as const,
  trialStartedAt: null,
  trialEndsAt: null,
  currentPeriodStart: '2026-08-06T10:00:00.000Z',
  currentPeriodEnd: '2026-09-06T10:00:00.000Z',
  cancelAtPeriodEnd: null,
  canceledAt: null,
  createdAt: '2026-08-06T10:00:00.000Z',
};

const sub = (overrides: Partial<BillingSubscription> = {}): BillingSubscription => ({
  ...BASE,
  ...overrides,
});

describe('createInMemoryBillingRepository.createInvoice', () => {
  it('should_return_same_invoice_for_same_idempotency_key', async () => {
    const repo = createInMemoryBillingRepository([sub()]);
    const draft = {
      subscriptionId: 'sub-1',
      tenantId: 'tenant-1',
      amount: 0,
      dueDate: '2026-10-06T10:00:00.000Z',
      billingPeriodStart: '2026-09-06T10:00:00.000Z',
      billingPeriodEnd: '2026-10-06T10:00:00.000Z',
      idempotencyKey: 'cycle_sub-1_2026-09-06T10:00:00.000Z',
    };

    const first = await repo.createInvoice(draft);
    const second = await repo.createInvoice(draft);

    expect(second.id).toBe(first.id);
    expect(repo.__listInvoices()).toHaveLength(1);
  });
});

describe('createInMemoryBillingRepository.applyTransition', () => {
  it('should_mirror_tenant_status_for_active', async () => {
    const repo = createInMemoryBillingRepository([sub()]);
    repo.__seedTenantStatus('tenant-1', 'trial');

    await repo.applyTransition({ subscriptionId: 'sub-1', status: 'active' });

    expect(repo.__getTenantStatus('tenant-1')).toBe('active');
  });

  it('should_mirror_tenant_status_for_cancelled', async () => {
    const repo = createInMemoryBillingRepository([sub()]);

    await repo.applyTransition({
      subscriptionId: 'sub-1',
      status: 'cancelled',
      canceledAt: '2026-09-06T10:00:00.000Z',
    });

    expect(repo.__getTenantStatus('tenant-1')).toBe('cancelled');
    const updated = repo.__listSubscriptions()[0];
    expect(updated.status).toBe('cancelled');
    expect(updated.canceledAt).toBe('2026-09-06T10:00:00.000Z');
  });

  it('should_clear_cancel_request_when_requested', async () => {
    const repo = createInMemoryBillingRepository([
      sub({ cancelAtPeriodEnd: '2026-09-06T10:00:00.000Z' }),
    ]);

    await repo.applyTransition({
      subscriptionId: 'sub-1',
      status: 'active',
      clearCancelRequest: true,
    });

    expect(repo.__listSubscriptions()[0].cancelAtPeriodEnd).toBeNull();
  });
});

describe('createInMemoryBillingRepository.findDueSubscriptions', () => {
  it('should_return_period_due_subscription', async () => {
    const repo = createInMemoryBillingRepository([sub()]);
    const due = await repo.findDueSubscriptions('2026-09-07T00:00:00.000Z');
    expect(due.map((s) => s.id)).toEqual(['sub-1']);
  });

  it('should_return_cancel_pending_subscription_when_due', async () => {
    const repo = createInMemoryBillingRepository([
      sub({ status: 'active', cancelAtPeriodEnd: '2026-09-06T10:00:00.000Z' }),
    ]);
    const due = await repo.findDueSubscriptions('2026-09-06T12:00:00.000Z');
    expect(due.map((s) => s.id)).toEqual(['sub-1']);
  });

  it('should_exclude_cancelled_subscriptions', async () => {
    const repo = createInMemoryBillingRepository([
      sub({ id: 'sub-x', status: 'cancelled' }),
    ]);
    const due = await repo.findDueSubscriptions('2027-01-01T00:00:00.000Z');
    expect(due).toHaveLength(0);
  });

  it('should_return_empty_when_nothing_due', async () => {
    const repo = createInMemoryBillingRepository([sub()]);
    const due = await repo.findDueSubscriptions('2026-08-10T00:00:00.000Z');
    expect(due).toHaveLength(0);
  });
});

describe('createInMemoryBillingRepository.recordPaymentAttempt', () => {
  it('should_append_attempts', async () => {
    const repo = createInMemoryBillingRepository([sub()]);

    await repo.recordPaymentAttempt({ invoiceId: 'inv-1', tenantId: 'tenant-1', status: 'failed', error: 'cartão recusado' });
    await repo.recordPaymentAttempt({ invoiceId: 'inv-1', tenantId: 'tenant-1', status: 'success' });

    expect(repo.__listAttempts()).toHaveLength(2);
    expect(repo.__listAttempts()[0].status).toBe('failed');
    expect(repo.__listAttempts()[1].status).toBe('success');
  });
});
