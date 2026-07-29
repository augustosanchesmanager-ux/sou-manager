/**
 * [SMG][DOMAIN][EVENTS] ReplayEngine
 *
 * Replays events from the EventStore through the EventBus.
 * Used for recovering state, re-triggering subscribers, and debugging.
 *
 * ARCHITECTURE:
 *   EventStore → ReplayEngine → EventBus → Subscribers
 *                                          → FinanceProvider (idempotent)
 *
 * KEY DESIGN:
 *   - Dry-run mode: simulates replay without publishing to EventBus
 *   - Batch processing: handles thousands of events without memory spikes
 *   - Progress callbacks: real-time feedback during long replays
 *   - Error isolation: one failing event doesn't stop the replay
 *   - Idempotency: financial operations are deduplicated by PersistentIdempotencyStore
 *
 * FLOW:
 *   1. Load events from EventStore (filtered by options)
 *   2. Sort by occurredAt ASC (chronological order)
 *   3. For each event in batches:
 *      a. If dry-run: log what would happen
 *      b. If real: publish to EventBus (subscribers react)
 *      c. Track success/failure
 *   4. Generate ReplayReport
 *
 * USAGE:
 *   const engine = createReplayEngine({ eventStore, eventBus });
 *   const result = await engine.replay({
 *     eventType: 'CheckoutCompleted',
 *     tenantId: 'tenant-1',
 *     from: '2026-07-01',
 *     to: '2026-07-31',
 *   });
 *   console.log(result.report);
 */

import type { EventStoreRepository, StoredEvent, EventQueryOptions } from './eventStore';
import type { EventBus } from './bus';
import type { DomainEvent } from './types';
import type { EventEnvelope } from './envelope';
import type { UpcasterRegistry } from './upcaster';
import { wrapEvent, unwrapEnvelope } from './envelope';

// ─── Replay Options ──────────────────────────────────────────

export interface ReplayOptions {
  /** Filter by event type */
  eventType?: string;

  /** Filter by aggregate type */
  aggregateType?: string;

  /** Filter by aggregate ID */
  aggregateId?: string;

  /** Filter by correlation ID */
  correlationId?: string;

  /** Filter by tenant ID */
  tenantId?: string;

  /** Start of time range (ISO date) */
  from?: string;

  /** End of time range (ISO date) */
  to?: string;

  /** Simulate replay without publishing events */
  dryRun?: boolean;

  /** Events per batch (default: 100) */
  batchSize?: number;

  /** Continue processing after an error (default: true) */
  continueOnError?: boolean;

  /** Progress callback for long replays */
  onProgress?: (progress: ReplayProgress) => void;

  /** Apply upcasting before replay (default: true) */
  upcast?: boolean;

  /** Upcast to specific version (default: latest) */
  targetVersion?: number;
}

export interface ReplayProgress {
  /** Total events to process */
  total: number;

  /** Events processed so far */
  processed: number;

  /** Current batch number */
  batch: number;

  /** Total batches */
  totalBatches: number;

  /** Percentage complete (0-100) */
  percentComplete: number;
}

// ─── Replay Report ───────────────────────────────────────────

export interface ReplayReport {
  /** Total events found matching filters */
  total: number;

  /** Events successfully replayed */
  replayed: number;

  /** Events skipped (dry-run or filtered out) */
  skipped: number;

  /** Events that failed during replay */
  failed: number;

  /** Total replay duration in milliseconds */
  durationMs: number;

  /** Events per second throughput */
  throughput: number;

  /** Error details for failed events */
  errors: ReplayError[];
}

export interface ReplayError {
  eventId: string;
  eventType: string;
  occurredAt: string;
  error: string;
  batch: number;
}

// ─── Replay Result ───────────────────────────────────────────

export interface ReplayResult {
  /** Overall status */
  status: 'completed' | 'partial' | 'dry_run' | 'no_events';

  /** The replay report */
  report: ReplayReport;

  /** Events that were replayed (empty in dry-run mode) */
  events: StoredEvent[];
}

// ─── Replay Engine Factory ───────────────────────────────────

export interface ReplayEngineConfig {
  eventStore: EventStoreRepository;
  eventBus: EventBus;
  upcasterRegistry?: UpcasterRegistry;
}

/**
 * Creates a ReplayEngine that replays events from the store through the bus.
 *
 * Usage:
 *   const engine = createReplayEngine({ eventStore, eventBus });
 *   const result = await engine.replay({ eventType: 'CheckoutCompleted', dryRun: true });
 */
export const createReplayEngine = (config: ReplayEngineConfig) => {
  const { eventStore, eventBus, upcasterRegistry } = config;

  return {
    /**
     * Replay events matching the given options.
     */
    async replay(options: ReplayOptions = {}): Promise<ReplayResult> {
      const startTime = Date.now();
      const batchSize = options.batchSize ?? 100;
      const continueOnError = options.continueOnError ?? true;
      const shouldUpcast = options.upcast !== false && upcasterRegistry;

      // 1. Build query from options
      const query: EventQueryOptions = {
        from: options.from,
        to: options.to,
        limit: options.dryRun ? 1000 : undefined, // Cap dry-run for safety
      };

      // 2. Load events from store
      let events = await loadEvents(eventStore, options, query);

      // 3. Apply client-side filters that EventStore doesn't support natively
      if (options.eventType) {
        events = events.filter((e) => e.event.eventType === options.eventType);
      }
      if (options.aggregateType) {
        events = events.filter((e) => e.event.aggregateType === options.aggregateType);
      }
      if (options.aggregateId) {
        events = events.filter((e) => e.event.aggregateId === options.aggregateId);
      }
      if (options.correlationId) {
        events = events.filter((e) => e.event.metadata.correlationId === options.correlationId);
      }
      if (options.tenantId) {
        events = events.filter((e) => e.event.metadata.tenantId === options.tenantId);
      }

      // 4. Sort by occurredAt ASC
      events.sort((a, b) => a.event.occurredAt.localeCompare(b.event.occurredAt));

      // 5. No events found
      if (events.length === 0) {
        return {
          status: 'no_events',
          report: buildReport(0, 0, 0, 0, startTime, []),
          events: [],
        };
      }

      // 6. Process events in batches
      const totalBatches = Math.ceil(events.length / batchSize);
      const errors: ReplayError[] = [];
      let replayed = 0;
      let skipped = 0;
      let failed = 0;
      let upcasted = 0;

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, events.length);
        const batch = events.slice(batchStart, batchEnd);

        for (const stored of batch) {
          try {
            // Apply upcasting if enabled
            let eventToPublish: DomainEvent = stored.event;

            if (shouldUpcast && upcasterRegistry) {
              const envelope = wrapEvent(stored.event, stored.eventTypeVersion);
              const upcastedEnvelope = options.targetVersion
                ? upcasterRegistry.upcastToVersion(envelope, options.targetVersion)
                : upcasterRegistry.upcastToLatest(envelope);

              if (upcastedEnvelope.eventTypeVersion !== envelope.eventTypeVersion) {
                upcasted++;
              }
              eventToPublish = unwrapEnvelope(upcastedEnvelope);
            }

            if (options.dryRun) {
              // Dry-run: log what would happen
              skipped++;
              console.log(
                `[REPLAY_DRY_RUN] Would publish ${eventToPublish.eventType} (${eventToPublish.eventId})`,
              );
            } else {
              // Real replay: publish to EventBus
              await eventBus.publish(eventToPublish as any);
              replayed++;
            }
          } catch (error) {
            failed++;
            const errorMsg = error instanceof Error ? error.message : String(error);
            errors.push({
              eventId: stored.event.eventId,
              eventType: stored.event.eventType,
              occurredAt: stored.event.occurredAt,
              error: errorMsg,
              batch: batchIndex + 1,
            });

            console.error(
              `[REPLAY] Failed to replay ${stored.event.eventType} (${stored.event.eventId}):`,
              errorMsg,
            );

            if (!continueOnError) {
              break;
            }
          }
        }

        // Progress callback
        if (options.onProgress) {
          const processed = batchEnd;
          options.onProgress({
            total: events.length,
            processed,
            batch: batchIndex + 1,
            totalBatches,
            percentComplete: Math.round((processed / events.length) * 100),
          });
        }

        if (!continueOnError && failed > 0) {
          break;
        }
      }

      // 7. Build report
      const report = buildReport(events.length, replayed, skipped, failed, startTime, errors);

      const status = options.dryRun
        ? 'dry_run'
        : failed > 0
          ? 'partial'
          : 'completed';

      return {
        status,
        report,
        events: options.dryRun ? [] : events,
      };
    },
  };
};

// ─── Helpers ──────────────────────────────────────────────────

async function loadEvents(
  store: EventStoreRepository,
  options: ReplayOptions,
  query: EventQueryOptions,
): Promise<StoredEvent[]> {
  // Use the most specific query method available
  if (options.eventType) {
    return store.findByType(options.eventType as any, query);
  }
  if (options.aggregateType && options.aggregateId) {
    return store.findByAggregate(options.aggregateType, options.aggregateId, query);
  }
  if (options.correlationId) {
    return store.findByCorrelation(options.correlationId, query);
  }
  if (options.tenantId) {
    return store.findByTenant(options.tenantId, query);
  }

  // Fallback: load all events by iterating known types
  // EventStoreRepository has no findAll(), so we iterate by type
  const count = await store.count(query);
  if (count === 0) return [];

  const allQuery = { ...query, limit: count };
  const result: StoredEvent[] = [];
  const types = [
    'CheckoutCompleted', 'CheckoutReverted',
    'AppointmentCreated', 'AppointmentCancelled', 'AppointmentCompleted',
    'CashClosingCompleted',
    'SubscriptionCreated', 'SubscriptionCancelled', 'CreditsDeducted',
    'TransactionCreated', 'CommissionCalculated',
  ];

  for (const type of types) {
    const events = await store.findByType(type as any, allQuery);
    result.push(...events);
  }

  result.sort((a, b) => a.event.occurredAt.localeCompare(b.event.occurredAt));
  return allQuery.limit ? result.slice(0, allQuery.limit) : result;
}

function buildReport(
  total: number,
  replayed: number,
  skipped: number,
  failed: number,
  startTime: number,
  errors: ReplayError[],
): ReplayReport {
  const durationMs = Date.now() - startTime;
  const throughput = durationMs > 0 ? Math.round((replayed / durationMs) * 1000) : 0;

  return {
    total,
    replayed,
    skipped,
    failed,
    durationMs,
    throughput,
    errors,
  };
}
