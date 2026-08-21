/**
 * [SMG][PLATFORM][EVENTS][BOOTSTRAP] eventInfrastructure
 *
 * TD-001 B1+B2+B3.3: Event infrastructure bootstrap.
 *
 * B1: SubscriberRegistry with 6 read-only subscribers.
 * B2: InMemoryOutbox + InMemoryDispatcher with dispatch loop.
 * B3.3: FinanceSubscriber wired with DefaultFinanceStrategy.
 *
 * No FinanceProvider (B3.4). No EventStore, no ReplayEngine.
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
import { createDefaultFinanceStrategy } from '../../domain/events/subscribers/defaultFinanceStrategy';
import { createOutbox } from '../../domain/events/outbox/inMemoryOutbox';
import { createDispatcher } from '../../domain/events/outbox/inMemoryDispatcher';
import { consoleProvider } from '../../domain/events/outbox/providers/consoleProvider';
import type { InMemoryOutbox } from '../../domain/events/outbox/inMemoryOutbox';
import type { InMemoryDispatcher } from '../../domain/events/outbox/inMemoryDispatcher';

const GLOBAL_KEY = '__soumanager_event_infrastructure__';
const DISPATCH_INTERVAL_MS = 5_000;

export interface EventInfrastructure {
  registry: SubscriberRegistry;
  outbox: InMemoryOutbox;
  dispatcher: InMemoryDispatcher;
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
  const outbox = createOutbox();
  const dispatcher = createDispatcher(outbox);

  // B3.3: FinanceSubscriber — enqueues financial operations to Outbox
  const financeStrategy = createDefaultFinanceStrategy();
  const financeSub = createFinanceSubscriber(outbox, financeStrategy);
  registry.register(financeSub);

  registry.initialize();

  dispatcher.registerProvider(consoleProvider);

  // B2: Dispatch loop
  let dispatching = false;
  const dispatchLoop = setInterval(async () => {
    if (dispatching) return;
    dispatching = true;
    try {
      await dispatcher.dispatchAll();
    } finally {
      dispatching = false;
    }
  }, DISPATCH_INTERVAL_MS);

  const infra: EventInfrastructure = {
    registry,
    outbox,
    dispatcher,
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
