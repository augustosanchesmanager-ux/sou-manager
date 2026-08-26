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
  const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  const outbox: OutboxRepository = hasSupabase ? createSupabaseOutbox() : createOutbox();
  const dispatcher = createDispatcher(outbox);

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
  });

  dispatcher.registerProvider(financeProvider);

  // B2: Dispatch loop — processes pending items every 5 seconds.
  // If outbox supports stale recovery (SupabaseOutbox), also recovers
  // items stuck in 'processing' for >5 minutes on each cycle.
  let dispatching = false;
  const dispatchLoop = setInterval(async () => {
    if (dispatching) return;
    dispatching = true;
    try {
      // Stale recovery: reset items stuck in 'processing' (>5 min)
      if (outbox instanceof SupabaseOutbox) {
        const recovered = await outbox.recoverStaleProcessing();
        if (recovered > 0) {
          console.log(
            `[EVENT_INFRA] Stale recovery: ${recovered} item(s) reset from processing to pending`,
          );
        }
      }
      await dispatcher.dispatchAll();
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
