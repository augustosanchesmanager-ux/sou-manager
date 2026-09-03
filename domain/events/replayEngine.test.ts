/**
 * [SMG][DOMAIN][EVENTS] ReplayEngine Tests
 *
 * Suite de testes para o Replay Engine.
 * Segue convenções do projeto: AAA, should_<result>_when_<condition>.
 *
 * Comportamentos testados:
 *   - Group A: Basic Replay (load → filter → publish → report)
 *   - Group B: Dry-Run Mode (simulate without side effects)
 *   - Group C: Filtering (eventType, aggregate, correlation, tenant, time range)
 *   - Group D: Batch Processing (batches, progress callback)
 *   - Group E: Error Handling (publish function injection for error simulation)
 *   - Group F: Edge Cases (empty store, no events, sorting)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReplayEngine, type ReplayEngineConfig, type ReplayOptions } from './replayEngine';
import { InMemoryEventBus } from './memory-bus';
import { InMemoryEventStore } from './inMemoryEventStore';
import { createEvent } from './types';
import type {
  CheckoutCompletedEvent,
  AppointmentCreatedEvent,
  CashClosingCompletedEvent,
  EventMetadata,
} from './types';
import type { EventBus } from './bus';
import type { SystemEvent } from './types';

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

/** Creates a bus that throws on publish for specific event IDs */
const buildFailingBus = (failIds: string[]): EventBus => {
  const bus = new InMemoryEventBus();
  const originalPublish = bus.publish.bind(bus);
  bus.publish = async (event: SystemEvent) => {
    if (failIds.includes(event.eventId)) {
      throw new Error(`Simulated failure for ${event.eventId}`);
    }
    return originalPublish(event);
  };
  return bus;
};

// ═══════════════════════════════════════════════════════════════════
// REPLAY ENGINE
// ═══════════════════════════════════════════════════════════════════

describe('ReplayEngine', () => {
  let store: InMemoryEventStore;
  let bus: InMemoryEventBus;
  let engine: ReturnType<typeof createReplayEngine>;

  beforeEach(() => {
    store = new InMemoryEventStore();
    bus = new InMemoryEventBus();
    engine = createReplayEngine({ eventStore: store, eventBus: bus });
  });

  // ── Group A: Basic Replay ─────────────────────────────────────

  describe('basic replay', () => {
    it('should_replay_all_events_when_no_filters', async () => {
      await store.appendBatch([buildCheckoutEvent(), buildAppointmentEvent(), buildCashClosingEvent()]);

      const result = await engine.replay();

      expect(result.status).toBe('completed');
      expect(result.report.total).toBe(3);
      expect(result.report.replayed).toBe(3);
      expect(result.report.failed).toBe(0);
      expect(result.events).toHaveLength(3);
    });

    it('should_publish_events_through_bus_during_replay', async () => {
      const handler = vi.fn();
      bus.subscribe('CheckoutCompleted', handler);

      await store.append(buildCheckoutEvent());
      await engine.replay();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should_return_report_with_throughput', async () => {
      await store.appendBatch([buildCheckoutEvent(), buildAppointmentEvent()]);

      const result = await engine.replay();

      expect(result.report.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.report.throughput).toBeGreaterThanOrEqual(0);
      expect(result.report.errors).toHaveLength(0);
    });

    it('should_sort_events_by_occurredAt_asc', async () => {
      // Events are stored in order; since each createEvent gets a new occurredAt,
      // the store order IS chronological. The engine sorts again to be safe.
      const e1 = buildCheckoutEvent();
      const e2 = buildAppointmentEvent();
      const e3 = buildCashClosingEvent();

      // Append in a specific order
      await store.append(e2);
      await store.append(e1);
      await store.append(e3);

      const result = await engine.replay();

      // e1 occurredAt < e2 occurredAt < e3 occurredAt because createEvent
      // generates unique timestamps. After sort, they should be in occurredAt order.
      expect(result.events).toHaveLength(3);
      for (let i = 1; i < result.events.length; i++) {
        expect(result.events[i].event.occurredAt >= result.events[i - 1].event.occurredAt).toBe(true);
      }
    });
  });

  // ── Group B: Dry-Run Mode ────────────────────────────────────

  describe('dry-run mode', () => {
    it('should_return_dry_run_status_when_dryRun_true', async () => {
      await store.appendBatch([buildCheckoutEvent(), buildAppointmentEvent()]);

      const result = await engine.replay({ dryRun: true });

      expect(result.status).toBe('dry_run');
    });

    it('should_not_publish_events_when_dryRun_true', async () => {
      const handler = vi.fn();
      bus.subscribe('CheckoutCompleted', handler);

      await store.append(buildCheckoutEvent());
      await engine.replay({ dryRun: true });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should_return_empty_events_when_dryRun_true', async () => {
      await store.append(buildCheckoutEvent());

      const result = await engine.replay({ dryRun: true });

      expect(result.events).toHaveLength(0);
    });

    it('should_count_events_as_skipped_when_dryRun_true', async () => {
      await store.appendBatch([buildCheckoutEvent(), buildAppointmentEvent()]);

      const result = await engine.replay({ dryRun: true });

      expect(result.report.skipped).toBe(2);
      expect(result.report.replayed).toBe(0);
    });

    it('should_log_dry_run_messages', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await store.append(buildCheckoutEvent());

      await engine.replay({ dryRun: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[REPLAY_DRY_RUN]'),
      );
      consoleSpy.mockRestore();
    });
  });

  // ── Group C: Filtering ────────────────────────────────────────

  describe('filtering', () => {
    it('should_filter_by_eventType', async () => {
      await store.appendBatch([buildCheckoutEvent(), buildAppointmentEvent(), buildCashClosingEvent()]);

      const result = await engine.replay({ eventType: 'CheckoutCompleted' });

      expect(result.report.total).toBe(1);
      expect(result.events[0].event.eventType).toBe('CheckoutCompleted');
    });

    it('should_filter_by_aggregateType', async () => {
      await store.appendBatch([buildCheckoutEvent(), buildAppointmentEvent(), buildCashClosingEvent()]);

      const result = await engine.replay({ aggregateType: 'appointment' });

      expect(result.report.total).toBe(1);
      expect(result.events[0].event.aggregateType).toBe('appointment');
    });

    it('should_filter_by_aggregateId', async () => {
      await store.appendBatch([
        buildCheckoutEvent({ aggregateId: 'comanda-1' }),
        buildCheckoutEvent({ aggregateId: 'comanda-2' }),
      ]);

      const result = await engine.replay({ aggregateId: 'comanda-1' });

      expect(result.report.total).toBe(1);
      expect(result.events[0].event.aggregateId).toBe('comanda-1');
    });

    it('should_filter_by_correlationId', async () => {
      const corrId = 'corr-123';
      await store.appendBatch([
        buildCheckoutEvent({ metadata: { tenantId: 't-1', correlationId: corrId } } as any),
        buildCheckoutEvent({ metadata: { tenantId: 't-1', correlationId: 'other' } } as any),
      ]);

      const result = await engine.replay({ correlationId: corrId });

      expect(result.report.total).toBe(1);
      expect(result.events[0].event.metadata.correlationId).toBe(corrId);
    });

    it('should_filter_by_tenantId', async () => {
      await store.appendBatch([
        buildCheckoutEvent({ metadata: { tenantId: 't-1' } } as any),
        buildAppointmentEvent({ metadata: { tenantId: 't-2' } } as any),
        buildCashClosingEvent({ metadata: { tenantId: 't-1' } } as any),
      ]);

      const result = await engine.replay({ tenantId: 't-1' });

      expect(result.report.total).toBe(2);
    });

    it('should_filter_by_time_range', async () => {
      // Construct events manually to control occurredAt (createEvent always overwrites it)
      const e1 = {
        eventId: 'evt_old',
        eventType: 'CheckoutCompleted' as const,
        eventTypeVersion: 1,
        aggregateId: 'comanda-1',
        aggregateType: 'comanda',
        occurredAt: '2026-07-01T10:00:00Z',
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
        },
        metadata: { tenantId: 'tenant-1', source: 'TestService', version: 1 as const },
      };

      const e2 = {
        eventId: 'evt_middle',
        eventType: 'AppointmentCreated' as const,
        eventTypeVersion: 1,
        aggregateId: 'appt-1',
        aggregateType: 'appointment',
        occurredAt: '2026-07-15T10:00:00Z',
        payload: {
          appointmentId: 'appt-1',
          clientId: 'client-1',
          staffId: 'staff-1',
          serviceIds: ['svc-1'],
          startTime: '2026-07-15T10:00:00Z',
          price: 100,
          hasComanda: true,
          comandaId: 'comanda-1',
        },
        metadata: { tenantId: 'tenant-1', source: 'TestService', version: 1 as const },
      };

      const e3 = {
        eventId: 'evt_recent',
        eventType: 'CashClosingCompleted' as const,
        eventTypeVersion: 1,
        aggregateId: 'closing-1',
        aggregateType: 'cash_closing',
        occurredAt: '2026-08-01T10:00:00Z',
        payload: {
          closingId: 'closing-1',
          businessDate: '2026-08-01',
          closedBy: 'user-1',
          expectedBalance: 1000,
          countedBalance: 995,
          difference: -5,
          extrasCount: 2,
          hasDiscrepancy: true,
        },
        metadata: { tenantId: 'tenant-1', source: 'TestService', version: 1 as const },
      };

      await store.appendBatch([e1, e2, e3]);

      // Filter: only events between July 5 and July 20
      const result = await engine.replay({
        from: '2026-07-05',
        to: '2026-07-20',
      });

      expect(result.report.total).toBe(1);
      expect(result.events[0].event.eventType).toBe('AppointmentCreated');
    });

    it('should_combine_multiple_filters', async () => {
      await store.appendBatch([
        buildCheckoutEvent({ metadata: { tenantId: 't-1' } } as any),
        buildCheckoutEvent({ aggregateId: 'comanda-2', metadata: { tenantId: 't-2' } } as any),
        buildAppointmentEvent({ metadata: { tenantId: 't-1' } } as any),
      ]);

      const result = await engine.replay({
        eventType: 'CheckoutCompleted',
        tenantId: 't-1',
      });

      expect(result.report.total).toBe(1);
      expect(result.events[0].event.aggregateId).toBe('comanda-1');
    });

    it('should_return_no_events_when_no_match', async () => {
      await store.append(buildCheckoutEvent());

      const result = await engine.replay({ eventType: 'NonexistentEvent' });

      expect(result.status).toBe('no_events');
      expect(result.report.total).toBe(0);
    });
  });

  // ── Group D: Batch Processing ────────────────────────────────

  describe('batch processing', () => {
    it('should_process_events_in_batches', async () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        buildCheckoutEvent({ aggregateId: `comanda-${i}` }),
      );
      await store.appendBatch(events);

      const result = await engine.replay({ batchSize: 2 });

      expect(result.report.replayed).toBe(5);
    });

    it('should_call_onProgress_with_correct_counts', async () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        buildCheckoutEvent({ aggregateId: `comanda-${i}` }),
      );
      await store.appendBatch(events);

      const progressCalls: any[] = [];
      await engine.replay({
        batchSize: 2,
        onProgress: (p) => progressCalls.push({ ...p }),
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[progressCalls.length - 1].processed).toBe(5);
      expect(progressCalls[progressCalls.length - 1].percentComplete).toBe(100);
    });

    it('should_calculate_total_batches_correctly', async () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        buildCheckoutEvent({ aggregateId: `comanda-${i}` }),
      );
      await store.appendBatch(events);

      const progressCalls: any[] = [];
      await engine.replay({
        batchSize: 2,
        onProgress: (p) => progressCalls.push({ ...p }),
      });

      // 5 events / batchSize 2 = 3 batches
      expect(progressCalls[0].totalBatches).toBe(3);
    });

    it('should_default_batchSize_to_100', async () => {
      const events = Array.from({ length: 120 }, (_, i) =>
        buildCheckoutEvent({ aggregateId: `comanda-${i}` }),
      );
      await store.appendBatch(events);

      const progressCalls: any[] = [];
      const result = await engine.replay({
        onProgress: (p) => progressCalls.push({ ...p }),
      });

      expect(result.report.replayed).toBe(120);
      // 120 / 100 = 2 batches
      expect(progressCalls[0].totalBatches).toBe(2);
    });
  });

  // ── Group E: Error Handling ──────────────────────────────────

  describe('error handling', () => {
    it('should_continue_after_error_when_continueOnError_true', async () => {
      const e1 = buildCheckoutEvent();
      const e2 = buildCheckoutEvent({ aggregateId: 'comanda-2' });
      const e3 = buildCheckoutEvent({ aggregateId: 'comanda-3' });

      await store.appendBatch([e1, e2, e3]);

      // Use a bus that fails on the first event
      const failingBus = buildFailingBus([e1.eventId]);
      const failEngine = createReplayEngine({ eventStore: store, eventBus: failingBus });

      const result = await failEngine.replay({ continueOnError: true });

      expect(result.report.replayed).toBe(2);
      expect(result.report.failed).toBe(1);
      expect(result.report.errors).toHaveLength(1);
      expect(result.report.errors[0].error).toContain('Simulated failure');
    });

    it('should_stop_after_error_when_continueOnError_false', async () => {
      const e1 = buildCheckoutEvent();
      const e2 = buildCheckoutEvent({ aggregateId: 'comanda-2' });
      const e3 = buildCheckoutEvent({ aggregateId: 'comanda-3' });

      await store.appendBatch([e1, e2, e3]);

      const failingBus = buildFailingBus([e1.eventId]);
      const failEngine = createReplayEngine({ eventStore: store, eventBus: failingBus });

      const result = await failEngine.replay({ continueOnError: false });

      expect(result.report.failed).toBe(1);
      expect(result.status).toBe('partial');
    });

    it('should_include_error_details_in_report', async () => {
      const e1 = buildCheckoutEvent();
      await store.append(e1);

      const failingBus = buildFailingBus([e1.eventId]);
      const failEngine = createReplayEngine({ eventStore: store, eventBus: failingBus });

      const result = await failEngine.replay();

      expect(result.report.errors[0]).toEqual({
        eventId: expect.any(String),
        eventType: 'CheckoutCompleted',
        occurredAt: expect.any(String),
        error: expect.stringContaining('Simulated failure'),
        batch: 1,
      });
    });

    it('should_log_errors_to_console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const e1 = buildCheckoutEvent();
      await store.append(e1);

      const failingBus = buildFailingBus([e1.eventId]);
      const failEngine = createReplayEngine({ eventStore: store, eventBus: failingBus });

      await failEngine.replay();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[REPLAY]'),
        expect.stringContaining('Simulated failure'),
      );
      consoleSpy.mockRestore();
    });

    it('should_return_partial_status_when_some_fail', async () => {
      const e1 = buildCheckoutEvent();
      const e2 = buildAppointmentEvent();

      await store.appendBatch([e1, e2]);

      const failingBus = buildFailingBus([e1.eventId]);
      const failEngine = createReplayEngine({ eventStore: store, eventBus: failingBus });

      const result = await failEngine.replay();

      expect(result.status).toBe('partial');
      expect(result.report.replayed).toBe(1);
      expect(result.report.failed).toBe(1);
    });
  });

  // ── Group F: Edge Cases ──────────────────────────────────────

  describe('edge cases', () => {
    it('should_return_no_events_when_store_empty', async () => {
      const result = await engine.replay();

      expect(result.status).toBe('no_events');
      expect(result.report.total).toBe(0);
      expect(result.events).toHaveLength(0);
    });

    it('should_not_mutate_store_events', async () => {
      const event = buildCheckoutEvent();
      await store.append(event);

      const originalPayload = { ...event.payload };
      await engine.replay();

      expect(event.payload).toEqual(originalPayload);
    });

    it('should_handle_single_event', async () => {
      await store.append(buildCheckoutEvent());

      const result = await engine.replay();

      expect(result.status).toBe('completed');
      expect(result.report.total).toBe(1);
      expect(result.report.replayed).toBe(1);
    });

    it('should_handle_all_error_events_gracefully', async () => {
      const e1 = buildCheckoutEvent();
      const e2 = buildAppointmentEvent();
      await store.appendBatch([e1, e2]);

      // Both events fail
      const failingBus = buildFailingBus([e1.eventId, e2.eventId]);
      const failEngine = createReplayEngine({ eventStore: store, eventBus: failingBus });

      const result = await failEngine.replay();

      expect(result.report.failed).toBe(2);
      expect(result.report.replayed).toBe(0);
      expect(result.status).toBe('partial');
    });

    it('should_return_zero_duration_when_no_events', async () => {
      const result = await engine.replay();

      expect(result.report.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.report.throughput).toBe(0);
    });
  });
});
