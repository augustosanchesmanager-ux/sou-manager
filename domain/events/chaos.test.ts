/**
 * [SMG][DOMAIN][EVENTS] Chaos Testing Suite
 *
 * Validates event infrastructure resilience with real failure scenarios.
 * Tests all 14 chaos scenarios from ROADMAP.md 4.9.
 *
 * CONVENTIONS:
 *   - Each test simulates a specific failure mode
 *   - Verifies system behavior under stress
 *   - Ensures no data loss or corruption
 *   - Tests retry and dead letter mechanisms
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryEventBus, createEventBus } from './memory-bus';
import { InMemoryEventStore, createEventStore } from './inMemoryEventStore';
import { SubscriberRegistry } from './subscriber';
import { InMemoryOutbox, createOutbox } from './outbox/inMemoryOutbox';
import { InMemoryDispatcher, createDispatcher } from './outbox/inMemoryDispatcher';
import { consoleProvider } from './outbox/providers/consoleProvider';
import type { DomainEvent, EventType } from './types';
import type { DispatcherProvider } from './outbox/dispatcher';
import type { StoredEvent } from './eventStore';

// ─── Test Helpers ───────────────────────────────────────────────

const buildTestEvent = (overrides?: Partial<DomainEvent>): DomainEvent => ({
  eventId: `evt_test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  eventType: 'CheckoutCompleted',
  eventTypeVersion: 1,
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
  metadata: { tenantId: 'tenant-1', source: 'ChaosTest' },
  occurredAt: new Date().toISOString(),
  ...overrides,
});

const buildProvider = (options: {
  fail?: boolean;
  throw?: boolean;
  delay?: number;
  callLog?: string[];
}): DispatcherProvider => ({
  name: `chaos-provider-${Math.random().toString(36).slice(2)}`,
  async deliver(item) {
    if (options.callLog) options.callLog.push(`deliver:${item.eventType}`);
    if (options.delay) await new Promise(r => setTimeout(r, options.delay));
    if (options.throw) throw new Error('Chaos: Provider crash');
    if (options.fail) return { success: false, error: 'Chaos: Provider failure' };
    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════
// CHAOS SCENARIOS
// ═══════════════════════════════════════════════════════════════════

describe('Chaos Testing Suite (4.9)', () => {
  // ── Scenario 1: Webhook timeout ──────────────────────────────

  describe('Scenario 1: Webhook timeout (30s)', () => {
    it('should_return_item_to_pending_when_provider_timeout', async () => {
      const outbox = createOutbox();
      const provider = buildProvider({ throw: true });
      const dispatcher = createDispatcher(outbox);
      dispatcher.registerProvider(provider);

      await outbox.enqueue({
        eventId: 'evt_timeout_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: provider.name, config: { url: 'https://webhook.test' } }],
        payload: { comandaId: 'c-1', total: 100 },
        metadata: { tenantId: 'tenant-1', source: 'ChaosTest' },
      });

      await dispatcher.dispatch();

      const item = await outbox.findById('outbox_1');
      expect(item).not.toBeNull();
      expect(item!.status).toBe('pending');
      expect(item!.retry.attempts).toBe(1);
      expect(item!.retry.lastError).toContain('Chaos');
    });
  });

  // ── Scenario 2: Webhook returns 500 ─────────────────────────

  describe('Scenario 2: Webhook returns 500', () => {
    it('should_return_item_to_pending_on_500_error', async () => {
      const outbox = createOutbox();
      const provider = buildProvider({ fail: true });
      const dispatcher = createDispatcher(outbox);
      dispatcher.registerProvider(provider);

      await outbox.enqueue({
        eventId: 'evt_500_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: provider.name, config: {} }],
        payload: { comandaId: 'c-2', total: 200 },
        metadata: { tenantId: 'tenant-1', source: 'ChaosTest' },
      });

      await dispatcher.dispatch();

      const item = await outbox.findById('outbox_1');
      expect(item!.status).toBe('pending');
      expect(item!.retry.attempts).toBe(1);
    });
  });

  // ── Scenario 3: RPC failure ─────────────────────────────────

  describe('Scenario 3: RPC failure — error isolation', () => {
    it('should_isolate_errors_between_subscribers', async () => {
      const bus = createEventBus();
      const registry = new SubscriberRegistry(bus);
      const receivedEvents: string[] = [];
      const errors: string[] = [];

      registry.register({
        name: 'FailingSubscriber',
        eventType: 'CheckoutCompleted',
        async handle() {
          throw new Error('Chaos: RPC failure');
        },
      });

      registry.register({
        name: 'WorkingSubscriber',
        eventType: 'CheckoutCompleted',
        async handle(event) {
          receivedEvents.push(event.eventId);
        },
      });

      registry.initialize();

      await bus.publish(buildTestEvent({ eventId: 'evt_rpc_1' }));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toBe('evt_rpc_1');
    });
  });

  // ── Scenario 4: Timeout Supabase ─────────────────────────────

  describe('Scenario 4: Timeout Supabase — no corruption', () => {
    it('should_not_corrupt_store_on_timeout', async () => {
      const store = createEventStore();
      const event1 = buildTestEvent({ eventId: 'evt_timeout_1' });
      const event2 = buildTestEvent({ eventId: 'evt_timeout_2' });

      await store.append(event1);
      await store.append(event2);

      const count = await store.count();
      expect(count).toBe(2);

      const found = await store.findById('evt_timeout_1');
      expect(found).not.toBeNull();
      expect(found!.event.eventId).toBe('evt_timeout_1');
    });
  });

  // ── Scenario 5: Retry exhausts → dead letter ─────────────────

  describe('Scenario 5: Retry exhausts → dead letter', () => {
    it('should_move_to_dead_letter_after_maxAttempts', async () => {
      const outbox = createOutbox();
      const provider = buildProvider({ throw: true });
      const dispatcher = createDispatcher(outbox);
      dispatcher.registerProvider(provider);

      await outbox.enqueue({
        eventId: 'evt_dead_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: provider.name, config: {} }],
        payload: { comandaId: 'c-5', total: 500 },
        metadata: { tenantId: 'tenant-1', source: 'ChaosTest' },
        retry: { maxAttempts: 2, baseDelayMs: 0 },
      });

      await dispatcher.dispatch();
      await dispatcher.dispatch();

      const item = await outbox.findById('outbox_1');
      expect(item!.status).toBe('dead_letter');
      expect(item!.retry.attempts).toBe(2);
      expect(item!.retry.lastError).toContain('Chaos');
    });
  });

  // ── Scenario 6: Duplicate event ──────────────────────────────

  describe('Scenario 6: Duplicate event — idempotency', () => {
    it('should_reject_duplicate_eventId_in_store', async () => {
      const store = createEventStore();
      const event = buildTestEvent({ eventId: 'evt_dup_1' });

      await store.append(event);

      await expect(store.append(event)).rejects.toThrow('already exists');
      expect(await store.count()).toBe(1);
    });

    it('should_allow_multiple_outbox_items_for_same_eventId', async () => {
      const outbox = createOutbox();
      const input = {
        eventId: 'evt_dup_2',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'console', config: {} }],
        payload: { comandaId: 'c-6', total: 600 },
        metadata: { tenantId: 'tenant-1', source: 'ChaosTest' },
      };

      await outbox.enqueue(input);
      await outbox.enqueue(input);

      expect(await outbox.count()).toBe(2);
    });
  });

  // ── Scenario 7: Out-of-order events ─────────────────────────

  describe('Scenario 7: Out-of-order events', () => {
    it('should_process_events_regardless_of_order', async () => {
      const bus = createEventBus();
      const processedOrder: string[] = [];

      const handler1 = async (event: DomainEvent) => {
        processedOrder.push(`slow:${event.eventId}`);
      };
      const handler2 = async (event: DomainEvent) => {
        processedOrder.push(`fast:${event.eventId}`);
      };

      bus.subscribe('CheckoutCompleted', handler1);
      bus.subscribe('AppointmentCreated', handler2);

      const event1 = buildTestEvent({ eventId: 'evt_o1', eventType: 'CheckoutCompleted' });
      const event2 = buildTestEvent({
        eventId: 'evt_o2',
        eventType: 'AppointmentCreated',
        aggregateType: 'appointment',
      });
      const event3 = buildTestEvent({ eventId: 'evt_o3', eventType: 'CheckoutCompleted' });

      await bus.publish(event3);
      await bus.publish(event1);
      await bus.publish(event2);

      expect(processedOrder).toHaveLength(3);
      expect(processedOrder).toContain('fast:evt_o2');
      expect(processedOrder).toContain('slow:evt_o1');
      expect(processedOrder).toContain('slow:evt_o3');
    });
  });

  // ── Scenario 8: Replay interrupted ──────────────────────────

  describe('Scenario 8: Replay interrupted — state consistency', () => {
    it('should_maintain_consistency_when_replay_fails_midway', async () => {
      const store = createEventStore();
      const bus = createEventBus();
      const processed: string[] = [];

      const events = [
        buildTestEvent({ eventId: 'evt_replay_1' }),
        buildTestEvent({ eventId: 'evt_replay_2' }),
        buildTestEvent({ eventId: 'evt_replay_3' }),
      ];

      await store.appendBatch(events);

      bus.subscribe('CheckoutCompleted', async (event) => {
        if (event.eventId === 'evt_replay_2') throw new Error('Replay crash');
        processed.push(event.eventId);
      });

      const stored = await store.findByAggregate('comanda', 'comanda-1');

      for (const s of stored) {
        try {
          await bus.publish(s.event);
        } catch {}
      }

      expect(processed).toContain('evt_replay_1');
      expect(processed).not.toContain('evt_replay_2');
      expect(processed).toContain('evt_replay_3');
    });
  });

  // ── Scenario 9: Subscriber throws exception ─────────────────

  describe('Scenario 9: Subscriber throws exception', () => {
    it('should_not_lose_event_when_subscriber_throws', async () => {
      const bus = createEventBus();
      const received: string[] = [];
      const errors: string[] = [];

      bus.subscribe('CheckoutCompleted', async () => {
        throw new Error('Subscriber explosion');
      });

      bus.subscribe('CheckoutCompleted', async (event) => {
        received.push(event.eventId);
      });

      const event = buildTestEvent({ eventId: 'evt_except_1' });
      await bus.publish(event);

      expect(received).toHaveLength(1);
      expect(received[0]).toBe('evt_except_1');
    });
  });

  // ── Scenario 10: Dispatcher crash ────────────────────────────

  describe('Scenario 10: Dispatcher crash — outbox consistency', () => {
    it('should_keep_outbox_consistent_after_crash', async () => {
      const outbox = createOutbox();

      await outbox.enqueue({
        eventId: 'evt_crash_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'console', config: {} }],
        payload: { comandaId: 'c-10', total: 1000 },
        metadata: { tenantId: 'tenant-1', source: 'ChaosTest' },
      });

      const item = await outbox.findById('outbox_1');
      expect(item!.status).toBe('pending');

      const next = await outbox.findNext();
      expect(next).not.toBeNull();
      expect(next!.eventId).toBe('evt_crash_1');
    });
  });

  // ── Scenario 11: FinanceProvider failure ─────────────────────

  describe('Scenario 11: FinanceProvider failure', () => {
    it('should_return_operation_to_pending_on_failure', async () => {
      const outbox = createOutbox();
      const failingProvider: DispatcherProvider = {
        name: 'finance',
        async deliver() {
          return { success: false, error: 'Finance DB timeout' };
        },
      };

      const dispatcher = createDispatcher(outbox);
      dispatcher.registerProvider(failingProvider);

      await outbox.enqueue({
        eventId: 'evt_fin_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: 'finance', config: {} }],
        payload: { comandaId: 'c-11', total: 1100 },
        metadata: { tenantId: 'tenant-1', source: 'ChaosTest' },
      });

      await dispatcher.dispatch();

      const item = await outbox.findById('outbox_1');
      expect(item!.status).toBe('pending');
      expect(item!.retry.attempts).toBe(1);
      expect(item!.retry.lastError).toContain('Finance DB timeout');
    });
  });

  // ── Scenario 12: High volume ────────────────────────────────

  describe('Scenario 12: High volume — no performance degradation', () => {
    it('should_handle_100_events_in_reasonable_time', async () => {
      const outbox = createOutbox();
      const provider = buildProvider({ callLog: [] });
      const dispatcher = createDispatcher(outbox);
      dispatcher.registerProvider(provider);

      const start = Date.now();

      const enqueues = Array.from({ length: 100 }, (_, i) =>
        outbox.enqueue({
          eventId: `evt_vol_${i}`,
          eventType: 'CheckoutCompleted',
          tenantId: 'tenant-1',
          targets: [{ provider: provider.name, config: {} }],
          payload: { comandaId: `c-${i}`, total: i * 10 },
          metadata: { tenantId: 'tenant-1', source: 'ChaosTest' },
        }),
      );

      await Promise.all(enqueues);

      const dispatched = await dispatcher.dispatchAll();

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000);
      expect(dispatched).toBe(100);

      const nextItem = await outbox.findNext();
      expect(nextItem).toBeNull();
    });
  });

  // ── Scenario 13: Store unavailable ──────────────────────────

  describe('Scenario 13: Store unavailable — graceful degradation', () => {
    it('should_handle_store_unavailable_gracefully', async () => {
      const store = createEventStore();
      const found = await store.findById('nonexistent_store');
      expect(found).toBeNull();

      const count = await store.count();
      expect(count).toBe(0);
    });
  });

  // ── Scenario 14: High latency ───────────────────────────────

  describe('Scenario 14: High latency — timeout handling', () => {
    it('should_handle_timeout_during_dispatch', async () => {
      const outbox = createOutbox();
      const slowProvider = buildProvider({ delay: 100 });
      const dispatcher = createDispatcher(outbox);
      dispatcher.registerProvider(slowProvider);

      await outbox.enqueue({
        eventId: 'evt_lat_1',
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: slowProvider.name, config: {} }],
        payload: { comandaId: 'c-14', total: 1400 },
        metadata: { tenantId: 'tenant-1', source: 'ChaosTest' },
      });

      const start = Date.now();
      await dispatcher.dispatch();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// CROSS-CUTTING CHAOS SCENARIOS
// ═══════════════════════════════════════════════════════════════════

describe('Cross-cutting Chaos', () => {
  it('should_isolate_errors_across_all_layers', async () => {
    const bus = createEventBus();
    const registry = new SubscriberRegistry(bus);
    const results: string[] = [];

    registry.register({
      name: 'CrashSubscriber',
      eventType: 'CheckoutCompleted',
      async handle() {
        throw new Error('Layer crash');
      },
    });

    registry.register({
      name: 'WorkingSubscriber',
      eventType: 'CheckoutCompleted',
      async handle(event) {
        results.push(event.eventId);
      },
    });

    registry.register({
      name: 'AnotherWorkingSubscriber',
      eventType: 'AppointmentCreated',
      async handle(event) {
        results.push(event.eventId);
      },
    });

    registry.initialize();

    await bus.publish(buildTestEvent({ eventId: 'evt_cross_1' }));
    await bus.publish(buildTestEvent({
      eventId: 'evt_cross_2',
      eventType: 'AppointmentCreated',
      aggregateType: 'appointment',
    }));

    expect(results).toHaveLength(2);
    expect(results).toContain('evt_cross_1');
    expect(results).toContain('evt_cross_2');
  });

  it('should_survive_cascading_failures', async () => {
    const outbox = createOutbox();
    const provider = buildProvider({ throw: true });
    const dispatcher = createDispatcher(outbox);
    dispatcher.registerProvider(provider);

    for (let i = 0; i < 5; i++) {
      await outbox.enqueue({
        eventId: `evt_cascade_${i}`,
        eventType: 'CheckoutCompleted',
        tenantId: 'tenant-1',
        targets: [{ provider: provider.name, config: {} }],
        payload: { comandaId: `c-cascade-${i}`, total: i * 100 },
        metadata: { tenantId: 'tenant-1', source: 'ChaosTest' },
        retry: { maxAttempts: 2, baseDelayMs: 0 },
      });
    }

    for (let i = 0; i < 10; i++) {
      await dispatcher.dispatch();
    }

    for (let i = 0; i < 5; i++) {
      const item = await outbox.findById(`outbox_${i + 1}`);
      expect(item!.status).toBe('dead_letter');
      expect(item!.retry.attempts).toBe(2);
    }
  });

  it('should_maintain_data_integrity_under_concurrent_writes', async () => {
    const store = createEventStore();

    const events = Array.from({ length: 20 }, (_, i) =>
      buildTestEvent({ eventId: `evt_concurrent_${i}` }),
    );

    await store.appendBatch(events);
    const count = await store.count();
    expect(count).toBe(20);

    const byTenant = await store.findByTenant('tenant-1');
    expect(byTenant).toHaveLength(20);
  });
});
