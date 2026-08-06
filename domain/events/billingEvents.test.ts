/**
 * [SMG][DOMAIN][EVENTS] Billing Events Catalog Tests (Fase 6.0.4)
 *
 * Verifica o catálogo de 17 eventos de billing aprovado pelo PO (D2, 2026-08-06):
 *   - 7 TenantSubscription*  (estado do contrato)
 *   - 3 TenantTrial*         (processo de trial)
 *   - 4 Invoice*             (processo de cobrança)
 *   - 3 Payment*             (processo de pagamento)
 *
 * Garantias:
 *   - Todos os nomes pertencem ao union SystemEvent / EventType (compile-time)
 *   - Nenhum nome colide com eventos ChefClub (SubscriptionCreated,
 *     SubscriptionCancelled, CreditsDeducted) — mitiga R2
 *   - createEvent produz eventos com payload/metadata separados
 *
 * Segue convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, it, expect } from 'vitest';
import { createEvent } from './types';
import type {
  SystemEvent,
  EventType,
  EventMetadata,
  TenantSubscriptionCreatedEvent,
  TenantSubscriptionCancelledEvent,
  TenantTrialStartedEvent,
  InvoiceCreatedEvent,
  PaymentSucceededEvent,
} from './types';

// ─── Catálogo oficial (D2) ─────────────────────────────────────────

export const BILLING_EVENT_NAMES = [
  'TenantSubscriptionCreated',
  'TenantSubscriptionUpdated',
  'TenantSubscriptionRenewed',
  'TenantSubscriptionCancelled',
  'TenantSubscriptionSuspended',
  'TenantSubscriptionReactivated',
  'TenantSubscriptionExpired',
  'TenantTrialStarted',
  'TenantTrialEnding',
  'TenantTrialEnded',
  'InvoiceCreated',
  'InvoicePaid',
  'InvoiceOverdue',
  'InvoiceCancelled',
  'PaymentSucceeded',
  'PaymentFailed',
  'PaymentRefunded',
] as const satisfies readonly EventType[];

const CHEF_CLUB_EVENT_NAMES = [
  'SubscriptionCreated',
  'SubscriptionCancelled',
  'CreditsDeducted',
] as const;

const defaultMetadata = (overrides?: Partial<EventMetadata>): EventMetadata => ({
  tenantId: 'tenant-1',
  userId: 'user-1',
  source: 'BillingService',
  ...overrides,
});

describe('Billing events catalog (D2 — 17 eventos aprovados)', () => {
  it('should_have_exactly_17_billing_events', () => {
    expect(BILLING_EVENT_NAMES).toHaveLength(17);
  });

  it('should_group_7_subscription_events', () => {
    const subscription = BILLING_EVENT_NAMES.filter((n) =>
      n.startsWith('TenantSubscription'),
    );
    expect(subscription).toHaveLength(7);
  });

  it('should_group_3_trial_events', () => {
    const trial = BILLING_EVENT_NAMES.filter((n) => n.startsWith('TenantTrial'));
    expect(trial).toHaveLength(3);
  });

  it('should_group_4_invoice_events', () => {
    const invoice = BILLING_EVENT_NAMES.filter((n) => n.startsWith('Invoice'));
    expect(invoice).toHaveLength(4);
  });

  it('should_group_3_payment_events', () => {
    const payment = BILLING_EVENT_NAMES.filter((n) => n.startsWith('Payment'));
    expect(payment).toHaveLength(3);
  });

  it('should_have_unique_names', () => {
    expect(new Set(BILLING_EVENT_NAMES).size).toBe(BILLING_EVENT_NAMES.length);
  });

  it('should_not_collide_with_chef_club_events', () => {
    for (const name of BILLING_EVENT_NAMES) {
      expect(CHEF_CLUB_EVENT_NAMES).not.toContain(name);
    }
  });
});

describe('Billing events factory', () => {
  it('should_create_tenant_subscription_created_event', () => {
    const event = createEvent<TenantSubscriptionCreatedEvent>({
      eventType: 'TenantSubscriptionCreated',
      aggregateId: 'tenant-1',
      aggregateType: 'tenant_subscription',
      payload: {
        subscriptionId: 'sub-1',
        tenantId: 'tenant-1',
        plan: 'premium',
        status: 'trialing',
        trialStartedAt: '2026-08-06T00:00:00Z',
        trialEndsAt: '2026-08-20T00:00:00Z',
      },
      metadata: defaultMetadata(),
    });

    expect(event.eventId).toMatch(/^evt_/);
    expect(event.eventTypeVersion).toBe(1);
    expect(event.payload.plan).toBe('premium');
    expect(event.payload.status).toBe('trialing');
    expect(event.metadata.tenantId).toBe('tenant-1');
  });

  it('should_create_tenant_trial_started_event_with_14_day_window', () => {
    const startedAt = '2026-08-06T00:00:00Z';
    const endsAt = '2026-08-20T00:00:00Z';

    const event = createEvent<TenantTrialStartedEvent>({
      eventType: 'TenantTrialStarted',
      aggregateId: 'tenant-1',
      aggregateType: 'tenant_subscription',
      payload: {
        subscriptionId: 'sub-1',
        tenantId: 'tenant-1',
        trialStartedAt: startedAt,
        trialEndsAt: endsAt,
      },
      metadata: defaultMetadata(),
    });

    const days = Math.round(
      (new Date(endsAt).getTime() - new Date(startedAt).getTime()) / 86_400_000,
    );
    expect(days).toBe(14);
    expect(event.payload.trialEndsAt).toBe(endsAt);
  });

  it('should_create_tenant_subscription_cancelled_event', () => {
    const event = createEvent<TenantSubscriptionCancelledEvent>({
      eventType: 'TenantSubscriptionCancelled',
      aggregateId: 'tenant-1',
      aggregateType: 'tenant_subscription',
      payload: {
        subscriptionId: 'sub-1',
        tenantId: 'tenant-1',
        reason: 'user_cancelled',
        canceledAt: '2026-08-06T12:00:00Z',
      },
      metadata: defaultMetadata(),
    });

    expect(event.eventType).toBe('TenantSubscriptionCancelled');
    expect(event.payload.reason).toBe('user_cancelled');
    expect(event.payload.tenantId).toBe('tenant-1');
    expect(event.metadata.tenantId).toBe('tenant-1');
  });

  it('should_create_invoice_created_event', () => {
    const event = createEvent<InvoiceCreatedEvent>({
      eventType: 'InvoiceCreated',
      aggregateId: 'inv-1',
      aggregateType: 'invoice',
      payload: {
        invoiceId: 'inv-1',
        tenantId: 'tenant-1',
        subscriptionId: 'sub-1',
        amount: 119.9,
        dueDate: '2026-08-20T00:00:00Z',
        billingPeriodStart: '2026-08-06T00:00:00Z',
        billingPeriodEnd: '2026-09-06T00:00:00Z',
      },
      metadata: defaultMetadata(),
    });

    expect(event.payload.amount).toBe(119.9);
    expect(event.payload.subscriptionId).toBe('sub-1');
  });

  it('should_create_payment_succeeded_event', () => {
    const event = createEvent<PaymentSucceededEvent>({
      eventType: 'PaymentSucceeded',
      aggregateId: 'pay-1',
      aggregateType: 'payment',
      payload: {
        attemptId: 'pay-1',
        invoiceId: 'inv-1',
        tenantId: 'tenant-1',
        provider: null,
      },
      metadata: defaultMetadata(),
    });

    expect(event.eventType).toBe('PaymentSucceeded');
    expect(event.payload.provider).toBeNull();
  });

  it('should_expose_all_billing_events_through_system_event_union', () => {
    // Compile-time: cada nome do catálogo precisa ser um EventType válido
    const asEvents: Array<Pick<SystemEvent, 'eventType'>> = BILLING_EVENT_NAMES.map(
      (name) => ({ eventType: name }),
    );
    expect(asEvents).toHaveLength(17);
  });
});
