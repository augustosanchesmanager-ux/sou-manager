/**
 * [SMG][APPLICATION][BILLING] BillingService tests
 *
 * Cobre:
 *   - issueInvoice (D-C: free/trial NUNCA emite; pago emite amount 0; idempotente)
 *   - markPaid (confirma pagamento; past_due → active; InvoicePaid + PaymentSucceeded)
 *   - handleFailure (registro append-only; PaymentFailed)
 *   - runCycle (TODAS as transições do engine + idempotência de invoice)
 *
 * Usa repositório in-memory (mesma semântica da produção) + EventBus mock.
 * Convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── Mocks (topo do arquivo) ──────────────────────────────────────
const mockEventBus = vi.hoisted(() => {
  const publish = vi.fn();
  return { publish };
});

vi.mock('../domain/events/app-bus', () => ({
  appEventBus: { publish: mockEventBus.publish },
}));

import { BillingService } from './billing';
import { createInMemoryBillingRepository } from '../domain/billing/repository';
import type { BillingSubscription } from '../domain/billing/types';

const BASE = {
  id: 'sub-1',
  tenantId: 'tenant-1',
  plan: 'pro' as const,
  status: 'active' as const,
  trialStartedAt: null,
  trialEndsAt: null,
  currentPeriodStart: '2026-08-06T10:00:00.000Z',
  currentPeriodEnd: '2026-09-06T10:00:00.000Z',
  graceEndsAt: null,
  cancelAtPeriodEnd: null,
  canceledAt: null,
  createdAt: '2026-08-06T10:00:00.000Z',
};

const sub = (overrides: Partial<BillingSubscription> = {}): BillingSubscription => ({
  ...BASE,
  ...overrides,
});

const makeService = (initial: BillingSubscription[]) => {
  const repo = createInMemoryBillingRepository(initial);
  const service = new BillingService(repo as any, mockEventBus as any);
  return { repo, service };
};

const eventTypes = () => mockEventBus.publish.mock.calls.map((c) => c[0].eventType);

beforeEach(() => {
  mockEventBus.publish.mockReset();
});

describe('BillingService.issueInvoice (D-C)', () => {
  it('should_throw_when_plan_is_free', async () => {
    const { service } = makeService([sub({ plan: 'free' })]);
    await expect(
      service.issueInvoice(sub({ plan: 'free' }), { start: 'a', end: 'b' }),
    ).rejects.toThrow('apenas planos pagos');
  });

  it('should_throw_when_status_is_trialing (trial nunca fatura)', async () => {
    const { service } = makeService([sub({ status: 'trialing', plan: 'pro' })]);
    await expect(
      service.issueInvoice(sub({ status: 'trialing', plan: 'pro' }), { start: 'a', end: 'b' }),
    ).rejects.toThrow('em renovação');
  });

  it('should_create_invoice_with_amount_zero_for_paid_plan', async () => {
    const { repo, service } = makeService([sub()]);
    const period = { start: '2026-09-06T10:00:00.000Z', end: '2026-10-06T10:00:00.000Z' };

    const invoice = await service.issueInvoice(sub(), period);

    expect(invoice.amount).toBe(0);
    expect(invoice.status).toBe('issued');
    expect(invoice.dueDate).toBe('2026-10-06T10:00:00.000Z');
    expect(repo.__listInvoices()).toHaveLength(1);
  });

  it('should_publish_InvoiceCreated', async () => {
    const { service } = makeService([sub()]);
    const period = { start: '2026-09-06T10:00:00.000Z', end: '2026-10-06T10:00:00.000Z' };

    await service.issueInvoice(sub(), period);

    expect(eventTypes()).toEqual(['InvoiceCreated']);
  });
});

describe('BillingService.markPaid', () => {
  it('should_throw_when_invoice_not_found', async () => {
    const { service } = makeService([sub()]);
    await expect(service.markPaid('inv-inexistente')).rejects.toThrow('não encontrada');
  });

  it('should_mark_paid_and_publish_InvoicePaid_plus_PaymentSucceeded', async () => {
    const { repo, service } = makeService([sub()]);
    await service.issueInvoice(sub(), { start: '2026-09-06T10:00:00.000Z', end: '2026-10-06T10:00:00.000Z' });
    const invoiceId = repo.__listInvoices()[0].id;
    mockEventBus.publish.mockReset(); // isola os eventos do markPaid

    const { invoice } = await service.markPaid(invoiceId);

    expect(invoice.status).toBe('paid');
    expect(repo.__listAttempts()).toHaveLength(1);
    expect(repo.__listAttempts()[0].status).toBe('success');
    expect(eventTypes().sort()).toEqual(['InvoicePaid', 'PaymentSucceeded']);
  });

  it('should_resolve_past_due_to_active_and_publish_Updated', async () => {
    const { repo, service } = makeService([sub({ status: 'past_due' })]);
    // D-C: issueInvoice exige status 'active' — invoice do ciclo é criada via repo
    // (simula invoice emitida no ciclo pago anterior e pendente no grace).
    const invoice = await repo.createInvoice({
      subscriptionId: 'sub-1',
      tenantId: 'tenant-1',
      amount: 0,
      dueDate: '2026-10-06T10:00:00.000Z',
      billingPeriodStart: '2026-09-06T10:00:00.000Z',
      billingPeriodEnd: '2026-10-06T10:00:00.000Z',
      idempotencyKey: 'cycle_sub-1_past_due',
    });

    const { invoice: paid } = await service.markPaid(invoice.id);

    expect(paid.status).toBe('paid');
    expect(repo.__listSubscriptions()[0].status).toBe('active');
    expect(repo.__listSubscriptions()[0].graceEndsAt).toBeNull(); // D-6.0.5.4-5
    expect(repo.__getTenantStatus('tenant-1')).toBe('active');
    expect(eventTypes().sort()).toEqual(['InvoicePaid', 'PaymentSucceeded', 'TenantSubscriptionUpdated']);
  });

  it('should_reactivate_suspended_to_active_and_publish_Reactivated', async () => {
    const { repo, service } = makeService([
      sub({ id: 'sub-susp', status: 'suspended', graceEndsAt: '2026-09-11T10:00:00.000Z' }),
    ]);
    const invoice = await repo.createInvoice({
      subscriptionId: 'sub-susp',
      tenantId: 'tenant-1',
      amount: 0,
      dueDate: '2026-10-06T10:00:00.000Z',
      billingPeriodStart: '2026-09-06T10:00:00.000Z',
      billingPeriodEnd: '2026-10-06T10:00:00.000Z',
      idempotencyKey: 'cycle_sub-susp_suspended',
    });

    const { invoice: paid } = await service.markPaid(invoice.id);

    expect(paid.status).toBe('paid');
    const updated = repo.__listSubscriptions()[0];
    expect(updated.status).toBe('active');
    expect(updated.graceEndsAt).toBeNull(); // D-6.0.5.4-5: limpo ao sair de suspended
    expect(repo.__getTenantStatus('tenant-1')).toBe('active');
    expect(eventTypes().sort()).toEqual([
      'InvoicePaid',
      'PaymentSucceeded',
      'TenantSubscriptionReactivated',
    ]);
  });

  it('should_not_reactivate_cancelled_subscription (matriz congelada — R1)', async () => {
    const { repo, service } = makeService([sub({ id: 'sub-cx', status: 'cancelled' })]);
    const invoice = await repo.createInvoice({
      subscriptionId: 'sub-cx',
      tenantId: 'tenant-1',
      amount: 0,
      dueDate: '2026-10-06T10:00:00.000Z',
      billingPeriodStart: '2026-09-06T10:00:00.000Z',
      billingPeriodEnd: '2026-10-06T10:00:00.000Z',
      idempotencyKey: 'cycle_sub-cx_cancelled',
    });

    await service.markPaid(invoice.id);

    expect(repo.__listSubscriptions()[0].status).toBe('cancelled');
    expect(eventTypes().sort()).toEqual(['InvoicePaid', 'PaymentSucceeded']);
  });
});

describe('BillingService.handleFailure', () => {
  it('should_record_failed_attempt_and_publish_PaymentFailed', async () => {
    const { repo, service } = makeService([sub()]);
    await service.issueInvoice(sub(), { start: '2026-09-06T10:00:00.000Z', end: '2026-10-06T10:00:00.000Z' });
    const invoiceId = repo.__listInvoices()[0].id;
    mockEventBus.publish.mockReset(); // isola os eventos do handleFailure

    await service.handleFailure(invoiceId, 'Cartão recusado');

    expect(repo.__listAttempts()).toHaveLength(1);
    expect(repo.__listAttempts()[0].status).toBe('failed');
    expect(repo.__listAttempts()[0].error).toBe('Cartão recusado');
    expect(eventTypes()).toEqual(['PaymentFailed']);
  });
});

describe('BillingService.runCycle', () => {
  it('should_activate_free_when_trial_ended', async () => {
    const { repo, service } = makeService([
      sub({
        id: 'sub-free',
        plan: 'free',
        status: 'trialing',
        trialEndsAt: '2026-08-20T10:00:00.000Z',
        currentPeriodEnd: '2026-08-20T10:00:00.000Z',
      }),
    ]);

    const report = await service.runCycle('2026-08-21T00:00:00.000Z');

    const updated = repo.__listSubscriptions()[0];
    expect(updated.status).toBe('active');
    expect(repo.__getTenantStatus('tenant-1')).toBe('active');
    expect(report.transitions[0].action).toBe('activate_free');
    expect(eventTypes().sort()).toEqual(['TenantSubscriptionUpdated', 'TenantTrialEnded']);
  });

  it('should_start_past_due_when_trial_ended_for_paid_plan', async () => {
    const { repo, service } = makeService([
      sub({
        id: 'sub-pro',
        plan: 'pro',
        status: 'trialing',
        trialEndsAt: '2026-08-20T10:00:00.000Z',
      }),
    ]);

    await service.runCycle('2026-08-21T00:00:00.000Z');

    const updated = repo.__listSubscriptions()[0];
    expect(updated.status).toBe('past_due');
    // D-6.0.5.4-5: janela de grace persistida (trial_ends_at + 5 dias)
    expect(updated.graceEndsAt).toBe('2026-08-25T10:00:00.000Z');
    expect(repo.__getTenantStatus('tenant-1')).toBe('past_due');
    expect(repo.__listInvoices()).toHaveLength(0); // trial não fatura
    expect(eventTypes().sort()).toEqual(['TenantSubscriptionUpdated', 'TenantTrialEnded']);
  });

  it('should_suspend_when_grace_expired', async () => {
    const { repo, service } = makeService([
      sub({
        id: 'sub-grace',
        plan: 'pro',
        status: 'past_due',
        graceEndsAt: '2026-08-25T10:00:00.000Z',
      }),
    ]);

    const report = await service.runCycle('2026-08-26T00:00:00.000Z');

    const updated = repo.__listSubscriptions()[0];
    expect(updated.status).toBe('suspended');
    expect(updated.graceEndsAt).toBeNull(); // janela encerrada (D-6.0.5.4-5)
    expect(repo.__getTenantStatus('tenant-1')).toBe('suspended');
    expect(report.transitions[0].action).toBe('suspend');
    expect(eventTypes()).toEqual(['TenantSubscriptionSuspended']);
  });

  it('should_not_reactivate_suspended_via_runCycle (D-6.0.5.4-2)', async () => {
    const { repo, service } = makeService([
      sub({ id: 'sub-susp', status: 'suspended', currentPeriodEnd: '2026-09-06T10:00:00.000Z' }),
    ]);

    await service.runCycle('2026-12-01T00:00:00.000Z');

    expect(repo.__listSubscriptions()[0].status).toBe('suspended');
    expect(eventTypes()).toEqual([]);
  });

  it('should_renew_and_issue_invoice_for_paid_plan', async () => {
    const { repo, service } = makeService([sub({ plan: 'pro' })]);

    await service.runCycle('2026-09-07T00:00:00.000Z');

    const updated = repo.__listSubscriptions()[0];
    expect(updated.status).toBe('active');
    expect(updated.currentPeriodStart).toBe('2026-09-06T10:00:00.000Z');
    expect(updated.currentPeriodEnd).toBe('2026-10-06T10:00:00.000Z');
    expect(repo.__listInvoices()).toHaveLength(1);
    expect(repo.__listInvoices()[0].amount).toBe(0);
    expect(eventTypes().sort()).toEqual(['InvoiceCreated', 'TenantSubscriptionRenewed']);
  });

  it('should_renew_without_invoice_for_free_plan', async () => {
    const { repo, service } = makeService([sub({ plan: 'free' })]);

    await service.runCycle('2026-09-07T00:00:00.000Z');

    expect(repo.__listSubscriptions()[0].status).toBe('active');
    expect(repo.__listInvoices()).toHaveLength(0);
    expect(eventTypes()).toEqual(['TenantSubscriptionRenewed']);
  });

  it('should_finalize_cancellation_when_cancel_period_reached', async () => {
    const { repo, service } = makeService([
      sub({ status: 'active', cancelAtPeriodEnd: '2026-09-06T10:00:00.000Z' }),
    ]);

    await service.runCycle('2026-09-06T12:00:00.000Z');

    const updated = repo.__listSubscriptions()[0];
    expect(updated.status).toBe('cancelled');
    expect(updated.canceledAt).toBe('2026-09-06T12:00:00.000Z');
    expect(repo.__getTenantStatus('tenant-1')).toBe('cancelled');
    expect(eventTypes()).toEqual(['TenantSubscriptionCancelled']);
  });

  it('should_be_idempotent_on_double_runCycle (no duplicate invoice)', async () => {
    const { repo, service } = makeService([sub({ plan: 'pro' })]);

    await service.runCycle('2026-09-07T00:00:00.000Z');
    await service.runCycle('2026-09-07T00:00:00.000Z'); // segunda execução: período já avançou

    expect(repo.__listInvoices()).toHaveLength(1);
    expect(repo.__listSubscriptions()[0].currentPeriodEnd).toBe('2026-10-06T10:00:00.000Z');
    expect(eventTypes().sort()).toEqual(['InvoiceCreated', 'TenantSubscriptionRenewed']);
  });

  it('should_do_nothing_when_nothing_due', async () => {
    const { repo, service } = makeService([sub()]);

    const report = await service.runCycle('2026-08-10T00:00:00.000Z');

    expect(report.transitions).toHaveLength(0);
    expect(repo.__listSubscriptions()[0].status).toBe('active');
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
