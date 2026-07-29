/**
 * [SMG][DOMAIN][EVENTS] Event Bus + Event Store Tests
 *
 * Suite de testes para a infraestrutura de eventos de domínio.
 * Segue convenções do projeto: AAA, should_<result>_when_<condition>.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryEventBus, createEventBus } from './memory-bus';
import { InMemoryEventStore, createEventStore } from './inMemoryEventStore';
import { createEvent } from './types';
import type {
  CheckoutCompletedEvent,
  AppointmentCreatedEvent,
  CashClosingCompletedEvent,
  SubscriptionCreatedEvent,
  SubscriptionCancelledEvent,
  CreditsDeductedEvent,
  SystemEvent,
  EventMetadata,
} from './types';
import type { StoredEvent } from './eventStore';

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

const buildSubscriptionCreatedEvent = (overrides?: Partial<SubscriptionCreatedEvent>): SubscriptionCreatedEvent =>
  createEvent<SubscriptionCreatedEvent>({
    eventType: 'SubscriptionCreated',
    aggregateId: 'sub-1',
    aggregateType: 'subscription',
    payload: {
      subscriptionId: 'sub-1',
      clientId: 'client-1',
      planId: 'plan-1',
      billingDay: 15,
      ...overrides?.payload,
    },
    metadata: defaultMetadata(overrides?.metadata as Partial<EventMetadata>),
    ...overrides,
  });

const buildSubscriptionCancelledEvent = (overrides?: Partial<SubscriptionCancelledEvent>): SubscriptionCancelledEvent =>
  createEvent<SubscriptionCancelledEvent>({
    eventType: 'SubscriptionCancelled',
    aggregateId: 'sub-1',
    aggregateType: 'subscription',
    payload: {
      subscriptionId: 'sub-1',
      reason: 'user_cancelled',
      ...overrides?.payload,
    },
    metadata: defaultMetadata(overrides?.metadata as Partial<EventMetadata>),
    ...overrides,
  });

const buildCreditsDeductedEvent = (overrides?: Partial<CreditsDeductedEvent>): CreditsDeductedEvent =>
  createEvent<CreditsDeductedEvent>({
    eventType: 'CreditsDeducted',
    aggregateId: 'sub-1',
    aggregateType: 'subscription',
    payload: {
      subscriptionId: 'sub-1',
      serviceId: 'svc-1',
      amount: 1,
      reference: 'checkout:comanda-1',
      ...overrides?.payload,
    },
    metadata: defaultMetadata(overrides?.metadata as Partial<EventMetadata>),
    ...overrides,
  });

// ═══════════════════════════════════════════════════════════════════
// IN MEMORY EVENT BUS
// ═══════════════════════════════════════════════════════════════════

describe('InMemoryEventBus', () => {
  let bus: InMemoryEventBus;

  beforeEach(() => {
    bus = new InMemoryEventBus();
  });

  // ── Group A: Publish & Subscribe ──────────────────────────────

  describe('publish & subscribe', () => {
    it('should_deliver_event_when_handler_subscribed_to_type', async () => {
      const handler = vi.fn();
      bus.subscribe('CheckoutCompleted', handler);

      const event = buildCheckoutEvent();
      await bus.publish(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should_not_deliver_event_when_handler_subscribed_to_different_type', async () => {
      const handler = vi.fn();
      bus.subscribe('AppointmentCreated', handler);

      await bus.publish(buildCheckoutEvent());

      expect(handler).not.toHaveBeenCalled();
    });

    it('should_deliver_to_multiple_handlers_for_same_event_type', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.subscribe('CheckoutCompleted', handler1);
      bus.subscribe('CheckoutCompleted', handler2);

      await bus.publish(buildCheckoutEvent());

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should_deliver_event_to_all_handlers_when_subscribeAll_used', async () => {
      const allHandler = vi.fn();
      const checkoutHandler = vi.fn();
      bus.subscribeAll(allHandler);
      bus.subscribe('CheckoutCompleted', checkoutHandler);

      await bus.publish(buildCheckoutEvent());

      expect(allHandler).toHaveBeenCalledTimes(1);
      expect(checkoutHandler).toHaveBeenCalledTimes(1);
    });

    it('should_deliver_to_all_handler_even_for_unregistered_type', async () => {
      const allHandler = vi.fn();
      bus.subscribeAll(allHandler);

      const event = buildAppointmentEvent();
      await bus.publish(event);

      expect(allHandler).toHaveBeenCalledTimes(1);
      expect(allHandler).toHaveBeenCalledWith(event);
    });
  });

  // ── Group B: Unsubscribe ─────────────────────────────────────

  describe('unsubscribe', () => {
    it('should_stop_delivering_after_unsubscribe', async () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribe('CheckoutCompleted', handler);

      await bus.publish(buildCheckoutEvent());
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      await bus.publish(buildCheckoutEvent());
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should_not_affect_other_handlers_when_one_unsubscribes', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const unsub1 = bus.subscribe('CheckoutCompleted', handler1);
      bus.subscribe('CheckoutCompleted', handler2);

      unsub1();
      await bus.publish(buildCheckoutEvent());

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  // ── Group C: Error Handling ──────────────────────────────────

  describe('error handling', () => {
    it('should_not_propagate_error_when_handler_throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      bus.subscribe('CheckoutCompleted', () => {
        throw new Error('handler crash');
      });

      await expect(bus.publish(buildCheckoutEvent())).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should_continue_to_next_handler_after_previous_throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const handler2 = vi.fn();
      bus.subscribe('CheckoutCompleted', () => {
        throw new Error('crash');
      });
      bus.subscribe('CheckoutCompleted', handler2);

      await bus.publish(buildCheckoutEvent());

      expect(handler2).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });
  });

  // ── Group D: Event Log ───────────────────────────────────────

  describe('event log', () => {
    it('should_store_published_events_in_log', async () => {
      const event = buildCheckoutEvent();
      await bus.publish(event);

      expect(bus.getEventLog()).toHaveLength(1);
      expect(bus.getEventLog()[0]).toEqual(event);
    });

    it('should_limit_log_size_to_maxLogSize', async () => {
      const smallBus = new InMemoryEventBus({ maxLogSize: 3 });

      for (let i = 0; i < 5; i++) {
        await smallBus.publish(buildCheckoutEvent());
      }

      expect(smallBus.getEventLog()).toHaveLength(3);
    });

    it('should_clear_log_when_clearLog_called', async () => {
      await bus.publish(buildCheckoutEvent());
      bus.clearLog();

      expect(bus.getEventLog()).toHaveLength(0);
    });
  });

  // ── Group E: Handler Count & Clear ───────────────────────────

  describe('handler count & clear', () => {
    it('should_return_correct_handler_count', () => {
      bus.subscribe('CheckoutCompleted', vi.fn());
      bus.subscribe('CheckoutCompleted', vi.fn());
      bus.subscribe('AppointmentCreated', vi.fn());

      expect(bus.handlerCount()).toBe(3);
      expect(bus.handlerCount('CheckoutCompleted')).toBe(2);
      expect(bus.handlerCount('AppointmentCreated')).toBe(1);
      expect(bus.handlerCount('CashClosingCompleted')).toBe(0);
    });

    it('should_remove_all_handlers_when_clear_called', () => {
      bus.subscribe('CheckoutCompleted', vi.fn());
      bus.subscribe('AppointmentCreated', vi.fn());
      bus.clear();

      expect(bus.handlerCount()).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// CREATE EVENT FACTORY
// ═══════════════════════════════════════════════════════════════════

describe('createEvent', () => {
  it('should_generate_eventId_and_occurredAt', () => {
    const event = createEvent<CheckoutCompletedEvent>({
      eventType: 'CheckoutCompleted',
      aggregateId: 'comanda-1',
      aggregateType: 'comanda',
      payload: {
        comandaId: 'comanda-1',
        total: 100,
        paymentStatus: 'paid',
        closureMode: 'standard',
        itemCount: 1,
        hasClubCredit: false,
        financialEffect: true,
      },
      metadata: { tenantId: 'tenant-1', source: 'TestService' },
    });

    expect(event.eventId).toMatch(/^evt_/);
    expect(event.occurredAt).toBeTruthy();
    expect(new Date(event.occurredAt).getTime()).toBeGreaterThan(0);
  });

  it('should_set_version_to_1_by_default', () => {
    const event = createEvent<CheckoutCompletedEvent>({
      eventType: 'CheckoutCompleted',
      aggregateId: 'comanda-1',
      aggregateType: 'comanda',
      payload: {
        comandaId: 'comanda-1',
        total: 100,
        paymentStatus: 'paid',
        closureMode: 'standard',
        itemCount: 1,
        hasClubCredit: false,
        financialEffect: true,
      },
      metadata: { tenantId: 'tenant-1' },
    });

    expect(event.eventTypeVersion).toBe(1);
  });

  it('should_generate_unique_eventIds_for_sequential_calls', () => {
    const events = Array.from({ length: 10 }, () =>
      createEvent<SystemEvent>({
        eventType: 'CheckoutCompleted',
        aggregateId: 'comanda-1',
        aggregateType: 'comanda',
        payload: {
          comandaId: 'comanda-1',
          total: 100,
          paymentStatus: 'paid',
          closureMode: 'full',
          itemCount: 1,
          hasClubCredit: false,
          financialEffect: true,
        },
        metadata: { tenantId: 'tenant-1' },
      }),
    );

    const ids = new Set(events.map((e) => e.eventId));
    expect(ids.size).toBe(10);
  });

  it('should_separate_payload_from_metadata', () => {
    const event = createEvent<CheckoutCompletedEvent>({
      eventType: 'CheckoutCompleted',
      aggregateId: 'comanda-1',
      aggregateType: 'comanda',
      payload: {
        comandaId: 'comanda-1',
        total: 100,
        paymentStatus: 'paid',
        closureMode: 'standard',
        itemCount: 1,
        hasClubCredit: false,
        financialEffect: true,
      },
      metadata: {
        tenantId: 'tenant-1',
        correlationId: 'corr-1',
        causationId: 'cause-1',
        source: 'CheckoutApplicationService',
      },
    });

    expect(event.metadata.tenantId).toBe('tenant-1');
    expect(event.metadata.correlationId).toBe('corr-1');
    expect(event.metadata.causationId).toBe('cause-1');
    expect(event.metadata.source).toBe('CheckoutApplicationService');
    expect(event.eventTypeVersion).toBe(1);
    expect((event.payload as any).tenantId).toBeUndefined();
    expect((event.payload as any).correlationId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// CREATE EVENT BUS FACTORY
// ═══════════════════════════════════════════════════════════════════

describe('createEventBus', () => {
  it('should_return_InMemoryEventBus_instance', () => {
    const bus = createEventBus();
    expect(bus).toBeInstanceOf(InMemoryEventBus);
  });

  it('should_accept_maxLogSize_option', () => {
    const bus = createEventBus({ maxLogSize: 5 }) as InMemoryEventBus;
    expect(bus.handlerCount()).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// IN MEMORY EVENT STORE
// ═══════════════════════════════════════════════════════════════════

describe('InMemoryEventStore', () => {
  let store: InMemoryEventStore;

  beforeEach(() => {
    store = createEventStore();
  });

  // ── Group A: Append ─────────────────────────────────────────

  describe('append', () => {
    it('should_store_event_and_return_storedEvent', async () => {
      const event = buildCheckoutEvent();
      const stored = await store.append(event);

      expect(stored.id).toMatch(/^stored_/);
      expect(stored.event).toBe(event);
      expect(stored.storedAt).toBeTruthy();
      expect(new Date(stored.storedAt).getTime()).toBeGreaterThan(0);
    });

    it('should_throw_when_duplicate_eventId_appended', async () => {
      const event = buildCheckoutEvent();
      await store.append(event);

      await expect(store.append(event)).rejects.toThrow('already exists in store');
    });

    it('should_increment_stored_id_sequentially', async () => {
      const e1 = await store.append(buildCheckoutEvent());
      const e2 = await store.append(buildAppointmentEvent());

      expect(e1.id).toBe('stored_1');
      expect(e2.id).toBe('stored_2');
    });
  });

  // ── Group B: Append Batch ────────────────────────────────────

  describe('appendBatch', () => {
    it('should_store_multiple_events', async () => {
      const events = [buildCheckoutEvent(), buildAppointmentEvent(), buildCashClosingEvent()];
      const stored = await store.appendBatch(events);

      expect(stored).toHaveLength(3);
      expect(stored[0].event.eventType).toBe('CheckoutCompleted');
      expect(stored[1].event.eventType).toBe('AppointmentCreated');
      expect(stored[2].event.eventType).toBe('CashClosingCompleted');
    });
  });

  // ── Group C: Find By Aggregate ──────────────────────────────

  describe('findByAggregate', () => {
    it('should_return_events_for_specific_aggregate', async () => {
      const checkout = buildCheckoutEvent({ aggregateId: 'comanda-1' });
      const appointment = buildAppointmentEvent({ aggregateId: 'appt-1' });
      const checkout2 = buildCheckoutEvent({ aggregateId: 'comanda-2' });

      await store.appendBatch([checkout, appointment, checkout2]);

      const results = await store.findByAggregate('comanda', 'comanda-1');

      expect(results).toHaveLength(1);
      expect(results[0].event.aggregateId).toBe('comanda-1');
    });

    it('should_return_empty_when_no_match', async () => {
      await store.append(buildCheckoutEvent());

      const results = await store.findByAggregate('comanda', 'nonexistent');

      expect(results).toHaveLength(0);
    });
  });

  // ── Group D: Find By Correlation ─────────────────────────────

  describe('findByCorrelation', () => {
    it('should_return_all_events_in_correlation_chain', async () => {
      const corrId = 'corr-123';
      const checkout = buildCheckoutEvent({ metadata: { tenantId: 't-1', correlationId: corrId } } as any);
      const commission = createEvent<SystemEvent>({
        eventType: 'CommissionCalculated',
        aggregateId: 'comm-1',
        aggregateType: 'commission',
        payload: { staffId: 's-1', period: '2026-07', totalSales: 100, totalCommission: 20, lineCount: 1 },
        metadata: { tenantId: 't-1', correlationId: corrId },
      });

      await store.appendBatch([checkout, commission]);

      const results = await store.findByCorrelation(corrId);

      expect(results).toHaveLength(2);
    });
  });

  // ── Group E: Find By Type ────────────────────────────────────

  describe('findByType', () => {
    it('should_return_only_events_of_specified_type', async () => {
      await store.appendBatch([
        buildCheckoutEvent(),
        buildAppointmentEvent(),
        buildCheckoutEvent({ aggregateId: 'comanda-2' }),
      ]);

      const results = await store.findByType('CheckoutCompleted');

      expect(results).toHaveLength(2);
    });
  });

  // ── Group F: Find By Tenant ──────────────────────────────────

  describe('findByTenant', () => {
    it('should_return_events_for_tenant_only', async () => {
      await store.append(buildCheckoutEvent({ metadata: { tenantId: 't-1' } } as any));
      await store.append(buildAppointmentEvent({ metadata: { tenantId: 't-2' } } as any));
      await store.append(buildCashClosingEvent({ metadata: { tenantId: 't-1' } } as any));

      const results = await store.findByTenant('t-1');

      expect(results).toHaveLength(2);
    });
  });

  // ── Group G: Find By ID ──────────────────────────────────────

  describe('findById', () => {
    it('should_return_event_by_eventId', async () => {
      const event = buildCheckoutEvent();
      await store.append(event);

      const found = await store.findById(event.eventId);

      expect(found).not.toBeNull();
      expect(found!.event.eventId).toBe(event.eventId);
    });

    it('should_return_null_when_not_found', async () => {
      const found = await store.findById('nonexistent');

      expect(found).toBeNull();
    });
  });

  // ── Group H: Count ───────────────────────────────────────────

  describe('count', () => {
    it('should_return_total_event_count', async () => {
      await store.appendBatch([buildCheckoutEvent(), buildAppointmentEvent()]);

      expect(await store.count()).toBe(2);
    });

    it('should_return_zero_for_empty_store', async () => {
      expect(await store.count()).toBe(0);
    });
  });

  // ── Group I: Time Range Queries ──────────────────────────────

  describe('time range queries', () => {
    it('should_filter_by_from_date', async () => {
      const old = buildCheckoutEvent({ metadata: { tenantId: 't-1' } } as any);
      await store.append(old);

      const results = await store.findByTenant('t-1', {
        from: new Date(Date.now() + 10000).toISOString(),
      });

      expect(results).toHaveLength(0);
    });

    it('should_filter_by_limit', async () => {
      await store.appendBatch([
        buildCheckoutEvent(),
        buildAppointmentEvent(),
        buildCashClosingEvent(),
      ]);

      const results = await store.findByTenant('tenant-1', { limit: 2 });

      expect(results).toHaveLength(2);
    });
  });

  // ── Group J: Replay ──────────────────────────────────────────

  describe('replay', () => {
    it('should_throw_not_implemented', async () => {
      await expect(
        store.replay({}, vi.fn()),
      ).rejects.toThrow('not yet implemented');
    });
  });

  // ── Group K: createEventStore factory ─────────────────────────

  describe('createEventStore', () => {
    it('should_return_InMemoryEventStore_instance', () => {
      const s = createEventStore();
      expect(s).toBeInstanceOf(InMemoryEventStore);
    });
  });

  // ── Group L: Metadata separation in stored events ─────────────

  describe('metadata separation', () => {
    it('should_store_tenantId_in_metadata_not_in_payload', async () => {
      const event = buildCheckoutEvent({
        metadata: { tenantId: 't-42', source: 'CheckoutApplicationService' },
      } as any);
      const stored = await store.append(event);

      expect(stored.event.metadata.tenantId).toBe('t-42');
      expect(stored.event.metadata.source).toBe('CheckoutApplicationService');
      expect(stored.event.eventTypeVersion).toBe(1);
      expect((stored.event.payload as any).tenantId).toBeUndefined();
    });

    it('should_store_correlationId_in_metadata', async () => {
      const event = buildCheckoutEvent({
        metadata: { tenantId: 't-1', correlationId: 'corr-99' },
      } as any);
      const stored = await store.append(event);

      expect(stored.event.metadata.correlationId).toBe('corr-99');
    });
  });
});
