/**
 * [SMG][PLATFORM][EVENTS][BOOTSTRAP] eventInfrastructure
 *
 * TD-001 B1+B2+B3.3+B3.4-D+B3.4-G: Event infrastructure bootstrap.
 *
 * B1: SubscriberRegistry with 6 read-only subscribers.
 * B2: InMemoryOutbox + InMemoryDispatcher with dispatch loop.
 * B3.3: FinanceSubscriber wired with CommissionOnlyFinanceStrategy (B3.4-G gate).
 * B3.4-D: FinanceProvider with real commission handlers.
 * B3.4-G: FinanceProvider REGISTERED with dispatcher; subscriber targets
 *         'finance'; persistent idempotency store (processed_operations).
 *
 * ACTIVATION MATRIX (PO-approved): only create_commission_record and
 * reverse_commission are executed. All other finance operations remain
 * out of scope until a future PO gate.
 *
 * LIFECYCLE:
 *   initializeEventInfrastructure()  → creates and registers
 *   getEventInfrastructure()         → returns current instance
 *   disposeEventInfrastructure()     → deactivates, stops loop, clears
 *
 * HMR PROTECTION:
 *   Global singleton prevents duplicate initialization.
 *   dispose() + initialize() creates a fresh instance.
 */

import { SubscriberRegistry } from '../../domain/events/subscriber';
import { appEventBus } from '../../domain/events/app-bus';
import { analyticsSubscriber } from '../../domain/events/subscribers/analyticsSubscriber';
import { auditSubscriber } from '../../domain/events/subscribers/auditSubscriber';
import { notificationSubscriber } from '../../domain/events/subscribers/notificationSubscriber';
import { reminderSubscriber } from '../../domain/events/subscribers/reminderSubscriber';
import { marketingSubscriber } from '../../domain/events/subscribers/marketingSubscriber';
import { biSubscriber } from '../../domain/events/subscribers/biSubscriber';
import { createFinanceSubscriber } from '../../domain/events/subscribers/financeSubscriber';
import { createCommissionOnlyFinanceStrategy } from '../../domain/events/subscribers/commissionOnlyFinanceStrategy';
import { createOutbox } from '../../domain/events/outbox/inMemoryOutbox';
import { createSupabaseOutbox, SupabaseOutbox } from '../../domain/events/outbox/supabaseOutbox';
import { createDispatcher } from '../../domain/events/outbox/inMemoryDispatcher';
import { consoleProvider } from '../../domain/events/outbox/providers/consoleProvider';
import { createFinanceProvider } from '../../domain/events/outbox/providers/financeProvider';
import type { IdempotencyStore } from '../../domain/events/outbox/providers/financeProvider';
import { createPersistentIdempotencyStore } from '../../domain/events/outbox/providers/persistentIdempotencyStore';
import { createCommissionRecordHandler } from '../../domain/events/outbox/providers/createCommissionRecordHandler';
import { createReverseCommissionHandler } from '../../domain/events/outbox/providers/reverseCommissionHandler';
import { getSharedClient } from '../../services/supabaseClient';
import { commissionRecordRepository } from '../../domain/commission/commissionRecordRepository';
import { comandaItemRepository } from '../../domain/comanda/item-repository';
import { serviceExecutionParticipantRepository } from '../../domain/comanda/participant-repository';
import { staffRepository } from '../../domain/staff/repository';
import { comandaRepository } from '../../domain/comanda/repository';
import { metrics } from '../lib/observability/metrics';
import { logger } from '../lib/observability/logger';
import { alerts } from '../lib/observability/alerts';
import type { InMemoryOutbox } from '../../domain/events/outbox/inMemoryOutbox';
import type { InMemoryDispatcher } from '../../domain/events/outbox/inMemoryDispatcher';
import type { DispatcherProvider } from '../../domain/events/outbox/dispatcher';
import type { OutboxRepository } from '../../domain/events/outbox/outboxRepository';

const GLOBAL_KEY = '__soumanager_event_infrastructure__';
const DISPATCH_INTERVAL_MS = 5_000;

/**
 * Lazy persistent idempotency store.
 * Defers getSharedClient() until first has()/set() call so that
 * demo-mode/test bootstrap never instantiates a Supabase client eagerly.
 */
const createLazyPersistentIdempotencyStore = (): IdempotencyStore => {
  let inner: IdempotencyStore | null = null;
  const resolve = (): IdempotencyStore => {
    if (!inner) {
      // Structural cast: full supabase client satisfies the store's
      // minimal chainable interface used by processed_operations.
      inner = createPersistentIdempotencyStore({
        db: getSharedClient() as unknown as Parameters<typeof createPersistentIdempotencyStore>[0]['db'],
      });
    }
    return inner;
  };
  return {
    async has(key, tenantId) {
      return resolve().has(key, tenantId);
    },
    async set(key, tenantId) {
      await resolve().set(key, tenantId);
    },
  };
};

export interface EventInfrastructure {
  registry: SubscriberRegistry;
  outbox: OutboxRepository;
  dispatcher: InMemoryDispatcher;
  financeProvider: DispatcherProvider;
  stopDispatchLoop: () => void;
  isInitialized: boolean;
}

/**
 * Initialize event infrastructure (singleton).
 * Returns same instance on repeated calls.
 * Call disposeEventInfrastructure() first to get a fresh instance.
 */
export function initializeEventInfrastructure(): EventInfrastructure {
  const existing = (globalThis as Record<string, unknown>)[GLOBAL_KEY];
  if (existing && typeof existing === 'object' && (existing as EventInfrastructure).isInitialized) {
    return existing as EventInfrastructure;
  }

  // B1: SubscriberRegistry + 6 read-only subscribers
  const registry = new SubscriberRegistry(appEventBus);

  registry.register(analyticsSubscriber);
  registry.register(auditSubscriber);
  registry.register(notificationSubscriber);
  registry.register(reminderSubscriber);
  registry.register(marketingSubscriber);
  registry.register(biSubscriber);

  // B2: Outbox + Dispatcher
  // Use SupabaseOutbox when Supabase is configured (production),
  // InMemoryOutbox for demo mode / tests.
  // ADR-015: Dispatcher hooks inject observability without coupling domain to infrastructure.
  const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  const outbox: OutboxRepository = hasSupabase
    ? createSupabaseOutbox({
        onEnqueue: (eventId, tenantId) => {
          metrics.increment('outbox_enqueue_count', 1, { tenantId });
          logger.business('outbox_enqueued', { eventId, tenantId });
        },
        onEnqueueDuplicate: (eventId) => {
          metrics.increment('outbox_enqueue_duplicate');
          logger.business('outbox_enqueue_duplicate', { eventId });
        },
        onClaim: (itemId, tenantId) => {
          metrics.increment('outbox_claim_count', 1, { tenantId });
        },
        onClaimFailed: (itemId) => {
          metrics.increment('outbox_claim_race');
        },
        onPublished: (itemId) => {
          metrics.increment('outbox_publish_count');
        },
        onFailed: (itemId, error) => {
          metrics.increment('outbox_fail_count');
          logger.error('outbox_item_failed', new Error(error), { itemId });
        },
        onDeadLetter: (itemId, error) => {
          metrics.increment('outbox_dead_letter_count');
          logger.error('outbox_dead_letter', new Error(error), { itemId });
        },
        onStaleRecovery: (itemId) => {
          metrics.increment('outbox_stale_recovery_count');
          logger.business('outbox_stale_recovered', { itemId });
        },
      })
    : createOutbox();
  const dispatcher = createDispatcher(outbox, {
    onItemDelivered: (item, provider) => {
      metrics.increment('dispatch_item_success', 1, { provider });
      logger.business('dispatch_item_delivered', { itemId: item.id, provider, eventId: item.eventId, tenantId: item.tenantId });
    },
    onItemError: (item, provider, error) => {
      metrics.increment('dispatch_item_error', 1, { provider });
      logger.error('dispatch_item_failed', new Error(error), { itemId: item.id, provider, eventId: item.eventId, tenantId: item.tenantId });
    },
    onProviderMissing: (item, provider) => {
      metrics.increment('dispatch_item_error', 1, { provider });
      logger.error('dispatch_provider_missing', new Error(`Provider "${provider}" not found`), { itemId: item.id, provider, eventId: item.eventId, tenantId: item.tenantId });
    },
  });

  // B3.3: FinanceSubscriber — gated by CommissionOnlyFinanceStrategy (B3.4-G)
  // Only commission operations are enqueued; target routes to FinanceProvider.
  const financeStrategy = createCommissionOnlyFinanceStrategy();
  const financeSub = createFinanceSubscriber(outbox, financeStrategy, {
    provider: 'finance',
    config: {},
  });
  registry.register(financeSub);

  registry.initialize();

  dispatcher.registerProvider(consoleProvider);

  // B3.4-G: FinanceProvider REGISTERED — commission + reversal activation.
  // Persistent idempotency store (processed_operations) is PO-mandatory for
  // the real bootstrap; lazy-wrapped so demo/test boot never touches Supabase.
  const financeProvider = createFinanceProvider({
    handlers: {
      create_commission_record: createCommissionRecordHandler({
        comandaRepository,
        comandaItemRepository,
        participantRepository: serviceExecutionParticipantRepository,
        staffRepository,
        commissionRecordRepository,
      }),
      reverse_commission: createReverseCommissionHandler({
        commissionRecordRepository,
      }),
    },
    idempotencyStore: createLazyPersistentIdempotencyStore(),
    hooks: {
      onDelivered: (itemId, operationType, tenantId) => {
        metrics.increment('finance_deliver_success', 1, { operationType });
        logger.business('finance_operation_delivered', { itemId, operationType, tenantId });
      },
      onError: (itemId, operationType, error) => {
        metrics.increment('finance_deliver_error', 1, { operationType });
        logger.error('finance_operation_error', new Error(error), { itemId, operationType });
      },
      onSkipped: (itemId, operationType, reason) => {
        metrics.increment('finance_deliver_skip', 1, { operationType });
        logger.business('finance_operation_skipped', { itemId, operationType, reason });
      },
      onHandlerMissing: (itemId, operationType) => {
        metrics.increment('finance_handler_missing', 1, { operationType });
        logger.error('finance_handler_missing', new Error(`No handler for ${operationType}`), { itemId, operationType });
      },
    },
  });

  dispatcher.registerProvider(financeProvider);

  // B2: Dispatch loop — processes pending items every 5 seconds.
  // ADR-015: Watchdog wraps entire cycle in try/catch to prevent exceptions
  // from killing the loop permanently. Heartbeat metric + health gauge emitted.
  let dispatching = false;
  let lastSuccessfulCycleAt = 0;
  const dispatchLoop = setInterval(async () => {
    if (dispatching) return;
    dispatching = true;
    try {
      const cycleStart = Date.now();

      // Stale recovery: reset items stuck in 'processing' (>5 min)
      if (outbox instanceof SupabaseOutbox) {
        try {
          const recovered = await outbox.recoverStaleProcessing();
          if (recovered > 0) {
            logger.business('pipeline_stale_recovery', { count: recovered });
            metrics.increment('outbox_stale_recovery_count');
          }
        } catch (recoveryErr) {
          const msg = recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr);
          logger.error('pipeline_stale_recovery_error', recoveryErr instanceof Error ? recoveryErr : new Error(msg));
          metrics.increment('outbox_stale_recovery_error');
        }
      }

      // Dispatch all pending items
      let itemsProcessed = 0;
      try {
        itemsProcessed = await dispatcher.dispatchAll();
      } catch (dispatchErr) {
        const msg = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr);
        logger.error('pipeline_dispatch_error', dispatchErr instanceof Error ? dispatchErr : new Error(msg));
        metrics.increment('dispatch_cycle_error');
      }

      const cycleDuration = Date.now() - cycleStart;

      // Heartbeat: record successful cycle timestamp
      lastSuccessfulCycleAt = Date.now();
      metrics.gauge('dispatch_heartbeat', lastSuccessfulCycleAt);
      metrics.increment('dispatch_cycle_count');
      metrics.gauge('dispatch_items_processed', itemsProcessed);
      metrics.histogram('dispatch_cycle_duration_ms', cycleDuration);

      // ADR-015: Update outbox depth gauges for alert evaluation
      if (outbox instanceof SupabaseOutbox) {
        try {
          const pendingCount = await outbox.count('pending');
          const deadLetterCount = await outbox.count('dead_letter');
          const processingCount = await outbox.count('processing');
          metrics.gauge('outbox_pending_depth', pendingCount);
          metrics.gauge('outbox_dead_letter_count', deadLetterCount);
          metrics.gauge('outbox_processing_count', processingCount);
        } catch {
          // Depth query failure must not break the cycle
        }
      }

      // ADR-015: Evaluate pipeline alerts every cycle
      try {
        alerts.check();
      } catch {
        // Alert evaluation failure must never break the dispatch cycle
      }
    } finally {
      dispatching = false;
    }
  }, DISPATCH_INTERVAL_MS);

  const infra: EventInfrastructure = {
    registry,
    outbox,
    dispatcher,
    financeProvider,
    stopDispatchLoop: () => clearInterval(dispatchLoop),
    isInitialized: true,
  };

  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = infra;
  return infra;
}

/**
 * Get current infrastructure instance (or null if not initialized).
 */
export function getEventInfrastructure(): EventInfrastructure | null {
  const existing = (globalThis as Record<string, unknown>)[GLOBAL_KEY];
  if (existing && typeof existing === 'object' && (existing as EventInfrastructure).isInitialized) {
    return existing as EventInfrastructure;
  }
  return null;
}

/**
 * Dispose infrastructure: deactivate subscribers, stop dispatch loop, clear singleton.
 * After dispose, next initializeEventInfrastructure() creates a fresh instance.
 */
export function disposeEventInfrastructure(): void {
  const existing = (globalThis as Record<string, unknown>)[GLOBAL_KEY];
  if (existing && typeof existing === 'object') {
    const infra = existing as EventInfrastructure;
    infra.registry.deactivate();
    infra.stopDispatchLoop();
    infra.isInitialized = false;
    delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
  }
}
