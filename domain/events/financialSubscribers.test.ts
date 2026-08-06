/**
 * [SMG][DOMAIN][EVENTS] Financial Subscribers Tests
 *
 * Suite de testes para CommissionSubscriber e FinanceSubscriber.
 * Segue convenções do projeto: AAA, should_<result>_when_<condition>.
 *
 * GRUPO A: CommissionSubscriber (read-only)
 * GRUPO B: FinanceSubscriber (outbox enqueue)
 * GRUPO C: Integration with SubscriberRegistry
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriberRegistry } from './subscriber';
import { InMemoryEventBus } from './memory-bus';
import { createEvent } from './types';
import { createCommissionSubscriber } from './subscribers/commissionSubscriber';
import { createFinanceSubscriber } from './subscribers/financeSubscriber';
import type { CommissionCalculator, CommissionCalculationResult } from './subscribers/commissionSubscriber';
import type { FinanceStrategy, FinanceOperation } from './subscribers/financeSubscriber';
import type { OutboxRepository } from './outbox/outboxRepository';
import { InMemoryOutbox } from './outbox/inMemoryOutbox';
import type {
  CheckoutCompletedEvent,
  SubscriptionCancelledEvent,
  CreditsDeductedEvent,
  CashClosingCompletedEvent,
  TenantSubscriptionCancelledEvent,
  TenantTrialStartedEvent,
  InvoicePaidEvent,
  PaymentSucceededEvent,
  EventMetadata,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────

const defaultMetadata = (overrides?: Partial<EventMetadata>): EventMetadata => ({
  tenantId: 'tenant-1',
  userId: 'user-1',
  source: 'TestService',
  ...overrides,
});

const buildCheckoutEvent = (
  overrides?: {
    payload?: Partial<CheckoutCompletedEvent['payload']>;
    metadata?: Partial<EventMetadata>;
  },
): CheckoutCompletedEvent =>
  createEvent<CheckoutCompletedEvent>({
    eventType: 'CheckoutCompleted',
    aggregateId: 'comanda-1',
    aggregateType: 'comanda',
    payload: {
      comandaId: 'comanda-1',
      clientId: 'client-1',
      staffId: 'staff-1',
      total: 150,
      paymentMethod: 'pix',
      paymentStatus: 'paid',
      closureMode: 'standard',
      itemCount: 3,
      hasClubCredit: false,
      financialEffect: true,
      ...overrides?.payload,
    },
    metadata: defaultMetadata(overrides?.metadata),
  });

const buildSubscriptionCancelledEvent = (
  overrides?: {
    payload?: Partial<SubscriptionCancelledEvent['payload']>;
    metadata?: Partial<EventMetadata>;
  },
): SubscriptionCancelledEvent =>
  createEvent<SubscriptionCancelledEvent>({
    eventType: 'SubscriptionCancelled',
    aggregateId: 'sub-1',
    aggregateType: 'subscription',
    payload: {
      subscriptionId: 'sub-1',
      reason: 'customer_request',
      ...overrides?.payload,
    },
    metadata: defaultMetadata(overrides?.metadata),
  });

const buildCreditsDeductedEvent = (
  overrides?: {
    payload?: Partial<CreditsDeductedEvent['payload']>;
    metadata?: Partial<EventMetadata>;
  },
): CreditsDeductedEvent =>
  createEvent<CreditsDeductedEvent>({
    eventType: 'CreditsDeducted',
    aggregateId: 'sub-1',
    aggregateType: 'subscription',
    payload: {
      subscriptionId: 'sub-1',
      serviceId: 'svc-1',
      amount: 1,
      reference: 'comanda-1',
      ...overrides?.payload,
    },
    metadata: defaultMetadata(overrides?.metadata),
  });

const buildCashClosingEvent = (
  overrides?: {
    payload?: Partial<CashClosingCompletedEvent['payload']>;
    metadata?: Partial<EventMetadata>;
  },
): CashClosingCompletedEvent =>
  createEvent<CashClosingCompletedEvent>({
    eventType: 'CashClosingCompleted',
    aggregateId: 'closing-1',
    aggregateType: 'cash_closing',
    payload: {
      closingId: 'closing-1',
      businessDate: '2026-07-23',
      closedBy: 'user-1',
      expectedBalance: 1000,
      countedBalance: 995,
      difference: -5,
      extrasCount: 2,
      hasDiscrepancy: true,
      ...overrides?.payload,
    },
    metadata: defaultMetadata(overrides?.metadata),
  });

// ─── Billing events (Fase 6.0.4) — NUNCA confundir com ChefClub (R2) ──

const buildTenantSubscriptionCancelledEvent = (
  overrides?: Partial<TenantSubscriptionCancelledEvent>,
): TenantSubscriptionCancelledEvent =>
  createEvent<TenantSubscriptionCancelledEvent>({
    eventType: 'TenantSubscriptionCancelled',
    aggregateId: 'tenant-1',
    aggregateType: 'tenant_subscription',
    payload: {
      subscriptionId: 'tenant-sub-1',
      tenantId: 'tenant-1',
      reason: 'user_cancelled',
      canceledAt: '2026-08-06T12:00:00Z',
      ...overrides?.payload,
    },
    metadata: defaultMetadata(overrides?.metadata as Partial<EventMetadata>),
    ...overrides,
  });

const buildTenantTrialStartedEvent = (
  overrides?: Partial<TenantTrialStartedEvent>,
): TenantTrialStartedEvent =>
  createEvent<TenantTrialStartedEvent>({
    eventType: 'TenantTrialStarted',
    aggregateId: 'tenant-1',
    aggregateType: 'tenant_subscription',
    payload: {
      subscriptionId: 'tenant-sub-1',
      tenantId: 'tenant-1',
      trialStartedAt: '2026-08-06T00:00:00Z',
      trialEndsAt: '2026-08-20T00:00:00Z',
      ...overrides?.payload,
    },
    metadata: defaultMetadata(overrides?.metadata as Partial<EventMetadata>),
    ...overrides,
  });

const buildInvoicePaidEvent = (
  overrides?: Partial<InvoicePaidEvent>,
): InvoicePaidEvent =>
  createEvent<InvoicePaidEvent>({
    eventType: 'InvoicePaid',
    aggregateId: 'inv-1',
    aggregateType: 'invoice',
    payload: {
      invoiceId: 'inv-1',
      tenantId: 'tenant-1',
      amount: 119.9,
      paidAt: '2026-08-06T12:00:00Z',
      ...overrides?.payload,
    },
    metadata: defaultMetadata(overrides?.metadata as Partial<EventMetadata>),
    ...overrides,
  });

const buildPaymentSucceededEvent = (
  overrides?: Partial<PaymentSucceededEvent>,
): PaymentSucceededEvent =>
  createEvent<PaymentSucceededEvent>({
    eventType: 'PaymentSucceeded',
    aggregateId: 'pay-1',
    aggregateType: 'payment',
    payload: {
      attemptId: 'pay-1',
      invoiceId: 'inv-1',
      tenantId: 'tenant-1',
      provider: null,
      ...overrides?.payload,
    },
    metadata: defaultMetadata(overrides?.metadata as Partial<EventMetadata>),
    ...overrides,
  });

const buildMockCalculator = (
  result: CommissionCalculationResult | null = {
    staffId: 'staff-1',
    period: '2026-07',
    totalSales: 150,
    totalCommission: 75,
    lineCount: 3,
  },
): CommissionCalculator => ({
  calculate: vi.fn().mockResolvedValue(result),
});

const buildFailingCalculator = (): CommissionCalculator => ({
  calculate: vi.fn().mockRejectedValue(new Error('RPC timeout')),
});

const buildMockStrategy = (
  overrides?: {
    checkout?: FinanceOperation[];
    subscriptionCancelled?: FinanceOperation[];
    creditsDeducted?: FinanceOperation[];
    cashClosing?: FinanceOperation[];
  },
): FinanceStrategy => ({
  mapCheckoutCompleted: vi.fn().mockReturnValue(overrides?.checkout ?? [
    { type: 'create_transaction', data: { amount: 150, method: 'pix' } },
  ]),
  mapSubscriptionCancelled: vi.fn().mockReturnValue(overrides?.subscriptionCancelled ?? [
    { type: 'reverse_revenue', data: { subscriptionId: 'sub-1' } },
  ]),
  mapCreditsDeducted: vi.fn().mockReturnValue(overrides?.creditsDeducted ?? [
    { type: 'deduct_credits', data: { amount: 1 } },
  ]),
  mapCashClosingCompleted: vi.fn().mockReturnValue(overrides?.cashClosing ?? [
    { type: 'close_daily_cash', data: { closingId: 'closing-1' } },
  ]),
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO A: CommissionSubscriber (read-only)
// ═══════════════════════════════════════════════════════════════════

describe('CommissionSubscriber', () => {
  let bus: InMemoryEventBus;

  beforeEach(() => {
    bus = new InMemoryEventBus();
  });

  // ── Group A1: Basic Behavior ─────────────────────────────────

  describe('basic behavior', () => {
    it('should_have_correct_interface', () => {
      const calculator = buildMockCalculator();
      const sub = createCommissionSubscriber(bus, calculator);

      expect(sub.name).toBe('CommissionSubscriber');
      expect(sub.eventType).toBe('CheckoutCompleted');
      expect(sub.description).toContain('commission');
    });

    it('should_register_on_event_bus', () => {
      const calculator = buildMockCalculator();
      const sub = createCommissionSubscriber(bus, calculator);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      expect(bus.handlerCount('CheckoutCompleted')).toBe(1);
    });

    it('should_call_calculator_when_checkout_completed', async () => {
      const calculator = buildMockCalculator();
      const sub = createCommissionSubscriber(bus, calculator);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildCheckoutEvent());

      expect(calculator.calculate).toHaveBeenCalledTimes(1);
      expect(calculator.calculate).toHaveBeenCalledWith({
        comandaId: 'comanda-1',
        tenantId: 'tenant-1',
        total: 150,
        staffId: 'staff-1',
      });
    });

    it('should_publish_commission_calculated_event', async () => {
      const calculator = buildMockCalculator();
      const sub = createCommissionSubscriber(bus, calculator);
      const commissionHandler = vi.fn();
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      bus.subscribe('CommissionCalculated', commissionHandler);
      await bus.publish(buildCheckoutEvent());

      expect(commissionHandler).toHaveBeenCalledTimes(1);
      const event = commissionHandler.mock.calls[0][0];
      expect(event.eventType).toBe('CommissionCalculated');
      expect(event.payload.staffId).toBe('staff-1');
      expect(event.payload.totalCommission).toBe(75);
      expect(event.payload.lineCount).toBe(3);
    });
  });

  // ── Group A2: Skip Conditions ────────────────────────────────

  describe('skip conditions', () => {
    it('should_skip_when_no_financial_effect', async () => {
      const calculator = buildMockCalculator();
      const sub = createCommissionSubscriber(bus, calculator);
      const commissionHandler = vi.fn();
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      bus.subscribe('CommissionCalculated', commissionHandler);
      await bus.publish(buildCheckoutEvent({
        payload: { financialEffect: false },
      }));

      expect(calculator.calculate).not.toHaveBeenCalled();
      expect(commissionHandler).not.toHaveBeenCalled();
    });

    it('should_skip_when_no_staff_assigned', async () => {
      const calculator = buildMockCalculator();
      const sub = createCommissionSubscriber(bus, calculator);
      const commissionHandler = vi.fn();
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      bus.subscribe('CommissionCalculated', commissionHandler);
      await bus.publish(buildCheckoutEvent({
        payload: { staffId: undefined },
      }));

      expect(calculator.calculate).not.toHaveBeenCalled();
      expect(commissionHandler).not.toHaveBeenCalled();
    });

    it('should_skip_when_calculator_returns_null', async () => {
      const calculator = buildMockCalculator(null);
      const sub = createCommissionSubscriber(bus, calculator);
      const commissionHandler = vi.fn();
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      bus.subscribe('CommissionCalculated', commissionHandler);
      await bus.publish(buildCheckoutEvent());

      expect(calculator.calculate).toHaveBeenCalledTimes(1);
      expect(commissionHandler).not.toHaveBeenCalled();
    });
  });

  // ── Group A3: Error Handling ─────────────────────────────────

  describe('error handling', () => {
    it('should_not_propagate_calculator_error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const calculator = buildFailingCalculator();
      const sub = createCommissionSubscriber(bus, calculator);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await expect(bus.publish(buildCheckoutEvent())).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should_log_error_with_comanda_context', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const calculator = buildFailingCalculator();
      const sub = createCommissionSubscriber(bus, calculator);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildCheckoutEvent());

      const errorCall = consoleSpy.mock.calls.find((call) =>
        call[0]?.toString().includes('comanda-1'),
      );
      expect(errorCall).toBeTruthy();
      consoleSpy.mockRestore();
    });
  });

  // ── Group A4: Metadata Propagation ──────────────────────────

  describe('metadata propagation', () => {
    it('should_set_correlation_id_to_source_event_id', async () => {
      const calculator = buildMockCalculator();
      const sub = createCommissionSubscriber(bus, calculator);
      const commissionHandler = vi.fn();
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      bus.subscribe('CommissionCalculated', commissionHandler);
      const checkoutEvent = buildCheckoutEvent();
      await bus.publish(checkoutEvent);

      const event = commissionHandler.mock.calls[0][0];
      expect(event.metadata.correlationId).toBe(checkoutEvent.eventId);
      expect(event.metadata.causationId).toBe(checkoutEvent.eventId);
      expect(event.metadata.source).toBe('CommissionSubscriber');
    });

    it('should_preserve_tenant_id_from_source_event', async () => {
      const calculator = buildMockCalculator();
      const sub = createCommissionSubscriber(bus, calculator);
      const commissionHandler = vi.fn();
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      bus.subscribe('CommissionCalculated', commissionHandler);
      await bus.publish(buildCheckoutEvent({
        metadata: { tenantId: 'tenant-42' },
      }));

      const event = commissionHandler.mock.calls[0][0];
      expect(event.metadata.tenantId).toBe('tenant-42');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO B: FinanceSubscriber (outbox enqueue)
// ═══════════════════════════════════════════════════════════════════

describe('FinanceSubscriber', () => {
  let bus: InMemoryEventBus;
  let outbox: InMemoryOutbox;

  beforeEach(() => {
    bus = new InMemoryEventBus();
    outbox = new InMemoryOutbox();
  });

  // ── Group B1: Basic Behavior ─────────────────────────────────

  describe('basic behavior', () => {
    it('should_have_correct_interface', () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);

      expect(sub.name).toBe('FinanceSubscriber');
      expect(sub.eventType).toBe('*');
      expect(sub.description).toContain('Outbox');
    });

    it('should_register_on_event_bus_with_subscribeAll', () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      // subscribeAll registers one handler for all events
      expect(bus.handlerCount()).toBe(1);
    });
  });

  // ── Group B2: CheckoutCompleted Handling ─────────────────────

  describe('CheckoutCompleted handling', () => {
    it('should_enqueue_operations_for_checkout', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildCheckoutEvent());

      expect(strategy.mapCheckoutCompleted).toHaveBeenCalledTimes(1);
      const count = await outbox.count('pending');
      expect(count).toBe(1);
    });

    it('should_enqueue_multiple_operations', async () => {
      const strategy = buildMockStrategy({
        checkout: [
          { type: 'create_transaction', data: { amount: 150 } },
          { type: 'create_commission_record', data: { staffId: 'staff-1' } },
        ],
      });
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildCheckoutEvent());

      const count = await outbox.count('pending');
      expect(count).toBe(2);
    });

    it('should_set_idempotency_key', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      const event = buildCheckoutEvent();
      await bus.publish(event);

      const items = await outbox.find({ status: 'pending' });
      expect(items.length).toBe(1);
      expect(items[0].payload.idempotencyKey).toBe(
        `${event.eventId}_create_transaction`,
      );
    });

    it('should_propagate_tenant_id', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildCheckoutEvent({
        metadata: { tenantId: 'tenant-42' },
      }));

      const items = await outbox.find({ status: 'pending' });
      expect(items[0].tenantId).toBe('tenant-42');
    });
  });

  // ── Group B3: SubscriptionCancelled Handling ─────────────────

  describe('SubscriptionCancelled handling', () => {
    it('should_enqueue_reversal_operation', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildSubscriptionCancelledEvent());

      expect(strategy.mapSubscriptionCancelled).toHaveBeenCalledTimes(1);
      const count = await outbox.count('pending');
      expect(count).toBe(1);
    });

    it('should_set_correct_event_type_in_outbox', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildSubscriptionCancelledEvent());

      const items = await outbox.find({ status: 'pending' });
      expect(items[0].eventType).toBe('SubscriptionCancelled');
    });
  });

  // ── Group B4: CreditsDeducted Handling ───────────────────────

  describe('CreditsDeducted handling', () => {
    it('should_enqueue_credit_deduction_operation', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildCreditsDeductedEvent());

      expect(strategy.mapCreditsDeducted).toHaveBeenCalledTimes(1);
      const count = await outbox.count('pending');
      expect(count).toBe(1);
    });
  });

  // ── Group B5: CashClosingCompleted Handling ──────────────────

  describe('CashClosingCompleted handling', () => {
    it('should_enqueue_daily_cash_close_operation', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildCashClosingEvent());

      expect(strategy.mapCashClosingCompleted).toHaveBeenCalledTimes(1);
      const count = await outbox.count('pending');
      expect(count).toBe(1);
    });
  });

  // ── Group B6: Unhandled Events ──────────────────────────────

  describe('unhandled events', () => {
    it('should_not_enqueue_for_unhandled_event_types', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      // AppointmentCreated is not handled by FinanceSubscriber
      await bus.publish(createEvent({
        eventType: 'AppointmentCreated',
        aggregateId: 'appt-1',
        aggregateType: 'appointment',
        payload: { appointmentId: 'appt-1', staffId: 'staff-1', serviceIds: ['svc-1'], startTime: '2026-07-23T10:00:00Z', price: 100, hasComanda: false },
        metadata: defaultMetadata(),
      }));

      const count = await outbox.count('pending');
      expect(count).toBe(0);
    });

    it('should_not_enqueue_when_strategy_returns_empty', async () => {
      const strategy = buildMockStrategy({ checkout: [] });
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildCheckoutEvent());

      const count = await outbox.count('pending');
      expect(count).toBe(0);
    });
  });

  // ── Group B7: Error Handling ─────────────────────────────────

  describe('error handling', () => {
    it('should_not_propagate_outbox_enqueue_error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingOutbox = {
        enqueue: vi.fn().mockRejectedValue(new Error('DB connection lost')),
      } as unknown as OutboxRepository;
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(failingOutbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await expect(bus.publish(buildCheckoutEvent())).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should_continue_enqueuing_after_one_operation_fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let callCount = 0;
      const flakyOutbox = {
        enqueue: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) throw new Error('First enqueue fails');
          return { id: `outbox_${callCount}` };
        }),
      } as unknown as OutboxRepository;
      const strategy = buildMockStrategy({
        checkout: [
          { type: 'create_transaction', data: { amount: 100 } },
          { type: 'create_commission_record', data: { staffId: 'staff-1' } },
        ],
      });
      const sub = createFinanceSubscriber(flakyOutbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildCheckoutEvent());

      // First enqueue failed, but second should have been attempted
      expect(flakyOutbox.enqueue).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });
  });

  // ── Group B8: Outbox Integration ────────────────────────────

  describe('outbox integration', () => {
    it('should_create_outbox_items_with_correct_status', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildCheckoutEvent());

      const items = await outbox.find({ status: 'pending' });
      expect(items.length).toBe(1);
      expect(items[0].status).toBe('pending');
    });

    it('should_set_dispatch_target', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildCheckoutEvent());

      const items = await outbox.find({ status: 'pending' });
      expect(items[0].targets).toEqual([{ provider: 'finance', config: {} }]);
    });

    it('should_set_causation_id_to_source_event', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      const event = buildCheckoutEvent();
      await bus.publish(event);

      const items = await outbox.find({ status: 'pending' });
      expect(items[0].metadata.causationId).toBe(event.eventId);
    });
  });

  // ── Group B9: Billing Event Isolation (regressão R2) ─────────

  describe('billing event isolation (R2 — não confundir com ChefClub)', () => {
    it('should_ignore_tenant_subscription_cancelled', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildTenantSubscriptionCancelledEvent());

      expect(strategy.mapSubscriptionCancelled).not.toHaveBeenCalled();
      const count = await outbox.count('pending');
      expect(count).toBe(0);
    });

    it('should_ignore_tenant_trial_started', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildTenantTrialStartedEvent());

      const count = await outbox.count('pending');
      expect(count).toBe(0);
    });

    it('should_ignore_invoice_paid', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildInvoicePaidEvent());

      const count = await outbox.count('pending');
      expect(count).toBe(0);
    });

    it('should_ignore_payment_succeeded', async () => {
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildPaymentSucceededEvent());

      const count = await outbox.count('pending');
      expect(count).toBe(0);
    });

    it('should_handle_chef_club_subscription_cancelled_without_confusion', async () => {
      // Controle: o evento ChefClub continua funcionando normalmente
      const strategy = buildMockStrategy();
      const sub = createFinanceSubscriber(outbox, strategy);
      const registry = new SubscriberRegistry(bus);
      registry.register(sub);
      registry.initialize();

      await bus.publish(buildSubscriptionCancelledEvent());

      expect(strategy.mapSubscriptionCancelled).toHaveBeenCalledTimes(1);
      const count = await outbox.count('pending');
      expect(count).toBe(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// GRUPO C: Integration with SubscriberRegistry
// ═══════════════════════════════════════════════════════════════════

describe('Financial Subscribers Integration', () => {
  let bus: InMemoryEventBus;

  beforeEach(() => {
    bus = new InMemoryEventBus();
  });

  it('should_register_both_subscribers_in_registry', () => {
    const calculator = buildMockCalculator();
    const strategy = buildMockStrategy();
    const outbox = new InMemoryOutbox();

    const commissionSub = createCommissionSubscriber(bus, calculator);
    const financeSub = createFinanceSubscriber(outbox, strategy);

    const registry = new SubscriberRegistry(bus);
    registry.register(commissionSub);
    registry.register(financeSub);

    expect(registry.count()).toBe(2);
    expect(registry.has('CommissionSubscriber')).toBe(true);
    expect(registry.has('FinanceSubscriber')).toBe(true);
  });

  it('should_handle_checkout_event_through_both_subscribers', async () => {
    const calculator = buildMockCalculator();
    const strategy = buildMockStrategy();
    const outbox = new InMemoryOutbox();

    const commissionSub = createCommissionSubscriber(bus, calculator);
    const financeSub = createFinanceSubscriber(outbox, strategy);

    const registry = new SubscriberRegistry(bus);
    registry.register(commissionSub);
    registry.register(financeSub);
    registry.initialize();

    const commissionHandler = vi.fn();
    bus.subscribe('CommissionCalculated', commissionHandler);

    await bus.publish(buildCheckoutEvent());

    // CommissionSubscriber calculated
    expect(commissionHandler).toHaveBeenCalledTimes(1);

    // FinanceSubscriber enqueued
    const outboxCount = await outbox.count('pending');
    expect(outboxCount).toBe(1);
  });

  it('should_handle_subscription_cancelled_only_by_finance', async () => {
    const calculator = buildMockCalculator();
    const strategy = buildMockStrategy();
    const outbox = new InMemoryOutbox();

    const commissionSub = createCommissionSubscriber(bus, calculator);
    const financeSub = createFinanceSubscriber(outbox, strategy);

    const registry = new SubscriberRegistry(bus);
    registry.register(commissionSub);
    registry.register(financeSub);
    registry.initialize();

    await bus.publish(buildSubscriptionCancelledEvent());

    // CommissionSubscriber doesn't handle SubscriptionCancelled
    expect(calculator.calculate).not.toHaveBeenCalled();

    // FinanceSubscriber enqueued
    const outboxCount = await outbox.count('pending');
    expect(outboxCount).toBe(1);
  });
});
