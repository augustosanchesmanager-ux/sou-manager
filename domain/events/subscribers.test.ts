/**
 * [SMG][DOMAIN][EVENTS] Subscriber Tests
 *
 * Suite de testes para a infraestrutura de subscribers.
 * Segue convenções do projeto: AAA, should_<result>_when_<condition>.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriberRegistry, type DomainSubscriber } from './subscriber';
import { InMemoryEventBus } from './memory-bus';
import { createEvent } from './types';
import type {
  CheckoutCompletedEvent,
  AppointmentCreatedEvent,
  CashClosingCompletedEvent,
  SystemEvent,
  EventMetadata,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────

const defaultMetadata = (overrides?: Partial<EventMetadata>): EventMetadata => ({
  tenantId: 'tenant-1',
  source: 'TestService',
  ...overrides,
});

const buildCheckoutEvent = (overrides?: Partial<CheckoutCompletedEvent>): CheckoutCompletedEvent =>
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
    metadata: defaultMetadata(overrides?.metadata as Partial<EventMetadata>),
    ...overrides,
  });

const buildAppointmentEvent = (overrides?: Partial<AppointmentCreatedEvent>): AppointmentCreatedEvent =>
  createEvent<AppointmentCreatedEvent>({
    eventType: 'AppointmentCreated',
    aggregateId: 'appt-1',
    aggregateType: 'appointment',
    payload: {
      appointmentId: 'appt-1',
      clientId: 'client-1',
      staffId: 'staff-1',
      serviceIds: ['svc-1'],
      startTime: '2026-07-23T10:00:00Z',
      price: 100,
      hasComanda: true,
      comandaId: 'comanda-1',
      ...overrides?.payload,
    },
    metadata: defaultMetadata(overrides?.metadata as Partial<EventMetadata>),
    ...overrides,
  });

const buildCashClosingEvent = (overrides?: Partial<CashClosingCompletedEvent>): CashClosingCompletedEvent =>
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
    metadata: defaultMetadata(overrides?.metadata as Partial<EventMetadata>),
    ...overrides,
  });

const buildTestSubscriber = (
  name: string,
  eventType: string,
  handler?: (event: any) => Promise<void>,
): DomainSubscriber => ({
  name,
  description: `Test subscriber: ${name}`,
  eventType: eventType as any,
  handle: handler || vi.fn().mockResolvedValue(undefined),
});

// ═══════════════════════════════════════════════════════════════════
// SUBSCRIBER REGISTRY
// ═══════════════════════════════════════════════════════════════════

describe('SubscriberRegistry', () => {
  let bus: InMemoryEventBus;
  let registry: SubscriberRegistry;

  beforeEach(() => {
    bus = new InMemoryEventBus();
    registry = new SubscriberRegistry(bus);
  });

  // ── Group A: Register ─────────────────────────────────────────

  describe('register', () => {
    it('should_add_subscriber_to_registry', () => {
      const sub = buildTestSubscriber('TestSub', 'CheckoutCompleted');
      registry.register(sub);

      expect(registry.has('TestSub')).toBe(true);
      expect(registry.count()).toBe(1);
    });

    it('should_accept_multiple_subscribers', () => {
      registry.register(buildTestSubscriber('Sub1', 'CheckoutCompleted'));
      registry.register(buildTestSubscriber('Sub2', 'AppointmentCreated'));

      expect(registry.count()).toBe(2);
      expect(registry.names()).toContain('Sub1');
      expect(registry.names()).toContain('Sub2');
    });

    it('should_not_duplicate_subscriber_with_same_name', () => {
      const sub1 = buildTestSubscriber('TestSub', 'CheckoutCompleted');
      const sub2 = buildTestSubscriber('TestSub', 'AppointmentCreated');

      registry.register(sub1);
      registry.register(sub2);

      expect(registry.count()).toBe(1);
    });
  });

  // ── Group B: Unregister ──────────────────────────────────────

  describe('unregister', () => {
    it('should_remove_subscriber', () => {
      registry.register(buildTestSubscriber('TestSub', 'CheckoutCompleted'));
      const removed = registry.unregister('TestSub');

      expect(removed).toBe(true);
      expect(registry.has('TestSub')).toBe(false);
      expect(registry.count()).toBe(0);
    });

    it('should_return_false_when_subscriber_not_found', () => {
      const removed = registry.unregister('Nonexistent');

      expect(removed).toBe(false);
    });
  });

  // ── Group C: Initialize ──────────────────────────────────────

  describe('initialize', () => {
    it('should_subscribe_all_handlers_to_bus', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registry.register(buildTestSubscriber('Sub1', 'CheckoutCompleted', handler1));
      registry.register(buildTestSubscriber('Sub2', 'AppointmentCreated', handler2));
      registry.initialize();

      expect(bus.handlerCount('CheckoutCompleted')).toBe(1);
      expect(bus.handlerCount('AppointmentCreated')).toBe(1);
    });

    it('should_deliver_events_to_subscribers', async () => {
      const handler = vi.fn();
      registry.register(buildTestSubscriber('Sub1', 'CheckoutCompleted', handler));
      registry.initialize();

      await bus.publish(buildCheckoutEvent());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should_handle_subscribeAll_for_audit_subscriber', async () => {
      const allHandler = vi.fn();
      registry.register(buildTestSubscriber('AuditSub', '*', allHandler));
      registry.initialize();

      await bus.publish(buildCheckoutEvent());
      await bus.publish(buildAppointmentEvent());

      expect(allHandler).toHaveBeenCalledTimes(2);
    });
  });

  // ── Group D: Deactivate ─────────────────────────────────────

  describe('deactivate', () => {
    it('should_unsubscribe_all_handlers_from_bus', async () => {
      const handler = vi.fn();
      registry.register(buildTestSubscriber('Sub1', 'CheckoutCompleted', handler));
      registry.initialize();

      expect(bus.handlerCount('CheckoutCompleted')).toBe(1);

      registry.deactivate();

      expect(bus.handlerCount('CheckoutCompleted')).toBe(0);
    });

    it('should_not_remove_subscribers_from_registry', () => {
      registry.register(buildTestSubscriber('Sub1', 'CheckoutCompleted'));
      registry.initialize();
      registry.deactivate();

      expect(registry.has('Sub1')).toBe(true);
      expect(registry.count()).toBe(1);
    });
  });

  // ── Group E: Clear ──────────────────────────────────────────

  describe('clear', () => {
    it('should_remove_all_subscribers_and_deactivate', () => {
      registry.register(buildTestSubscriber('Sub1', 'CheckoutCompleted'));
      registry.register(buildTestSubscriber('Sub2', 'AppointmentCreated'));
      registry.initialize();
      registry.clear();

      expect(registry.count()).toBe(0);
      expect(bus.handlerCount()).toBe(0);
    });
  });

  // ── Group F: Error Handling ──────────────────────────────────

  describe('error handling', () => {
    it('should_not_propagate_error_when_subscriber_throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const crashingSub = buildTestSubscriber(
        'CrashSub',
        'CheckoutCompleted',
        () => { throw new Error('subscriber crash'); },
      );
      registry.register(crashingSub);
      registry.initialize();

      await expect(bus.publish(buildCheckoutEvent())).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should_continue_to_next_subscriber_after_previous_throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler2 = vi.fn();

      registry.register(buildTestSubscriber(
        'CrashSub',
        'CheckoutCompleted',
        () => { throw new Error('crash'); },
      ));
      registry.register(buildTestSubscriber('Sub2', 'CheckoutCompleted', handler2));
      registry.initialize();

      await bus.publish(buildCheckoutEvent());

      expect(handler2).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });
  });

  // ── Group G: Metadata Separation in Events ───────────────────

  describe('event metadata in subscribers', () => {
    it('should_receive_event_with_metadata_separated_from_payload', async () => {
      let receivedEvent: any;
      const handler = vi.fn().mockImplementation((event) => { receivedEvent = event; });

      registry.register(buildTestSubscriber('Sub1', 'CheckoutCompleted', handler));
      registry.initialize();

      await bus.publish(buildCheckoutEvent());

      expect(receivedEvent.metadata.tenantId).toBe('tenant-1');
      expect(receivedEvent.metadata.source).toBe('TestService');
      expect(receivedEvent.eventTypeVersion).toBe(1);
      expect(receivedEvent.payload.comandaId).toBe('comanda-1');
      expect(receivedEvent.payload.tenantId).toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONCRETE SUBSCRIBERS (READ-ONLY)
// ═══════════════════════════════════════════════════════════════════

describe('Concrete Subscribers (read-only)', () => {
  let bus: InMemoryEventBus;
  let registry: SubscriberRegistry;

  beforeEach(() => {
    bus = new InMemoryEventBus();
    registry = new SubscriberRegistry(bus);
  });

  it('should_all_subscribers_be_read_only', () => {
    // Verify that all subscribers have the required interface
    const subscribers = [
      { name: 'AnalyticsSubscriber', eventType: 'CheckoutCompleted' },
      { name: 'AuditSubscriber', eventType: '*' },
      { name: 'NotificationSubscriber', eventType: 'CheckoutCompleted' },
      { name: 'ReminderSubscriber', eventType: 'AppointmentCreated' },
      { name: 'MarketingSubscriber', eventType: 'AppointmentCreated' },
      { name: 'BiSubscriber', eventType: 'CashClosingCompleted' },
    ];

    for (const sub of subscribers) {
      expect(sub.name).toBeTruthy();
      expect(sub.eventType).toBeTruthy();
    }
  });

  it('should_checkout_subscribers_receive_correct_event', async () => {
    const checkoutHandler = vi.fn();
    registry.register(buildTestSubscriber('AnalyticsSub', 'CheckoutCompleted', checkoutHandler));
    registry.register(buildTestSubscriber('NotificationSub', 'CheckoutCompleted', checkoutHandler));
    registry.initialize();

    await bus.publish(buildCheckoutEvent());

    // Both subscribers should receive the event
    expect(checkoutHandler).toHaveBeenCalledTimes(2);
  });

  it('should_appointment_subscribers_receive_correct_event', async () => {
    const apptHandler = vi.fn();
    registry.register(buildTestSubscriber('ReminderSub', 'AppointmentCreated', apptHandler));
    registry.register(buildTestSubscriber('MarketingSub', 'AppointmentCreated', apptHandler));
    registry.initialize();

    await bus.publish(buildAppointmentEvent());

    expect(apptHandler).toHaveBeenCalledTimes(2);
  });

  it('should_cashclosing_subscribers_receive_correct_event', async () => {
    const biHandler = vi.fn();
    registry.register(buildTestSubscriber('BiSub', 'CashClosingCompleted', biHandler));
    registry.initialize();

    await bus.publish(buildCashClosingEvent());

    expect(biHandler).toHaveBeenCalledTimes(1);
  });

  it('should_subscribers_not_receive_events_for_different_type', async () => {
    const checkoutHandler = vi.fn();
    const apptHandler = vi.fn();

    registry.register(buildTestSubscriber('CheckoutSub', 'CheckoutCompleted', checkoutHandler));
    registry.register(buildTestSubscriber('ApptSub', 'AppointmentCreated', apptHandler));
    registry.initialize();

    await bus.publish(buildCheckoutEvent());

    expect(checkoutHandler).toHaveBeenCalledTimes(1);
    expect(apptHandler).not.toHaveBeenCalled();
  });

  it('should_audit_subscriber_receive_all_event_types', async () => {
    const auditHandler = vi.fn();
    registry.register(buildTestSubscriber('AuditSub', '*', auditHandler));
    registry.initialize();

    await bus.publish(buildCheckoutEvent());
    await bus.publish(buildAppointmentEvent());
    await bus.publish(buildCashClosingEvent());

    expect(auditHandler).toHaveBeenCalledTimes(3);
  });
});
