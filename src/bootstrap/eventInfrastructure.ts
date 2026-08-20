/**
 * [SMG][PLATFORM][EVENTS][BOOTSTRAP] eventInfrastructure
 *
 * TD-001 B1: Read-only event infrastructure bootstrap.
 *
 * Initializes SubscriberRegistry with 6 read-only subscribers.
 * No financial operations, no Outbox, no Dispatcher.
 *
 * LIFECYCLE:
 *   initializeEventInfrastructure()  → creates and registers
 *   getEventInfrastructure()         → returns current instance
 *   disposeEventInfrastructure()     → deactivates and clears
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

const GLOBAL_KEY = '__soumanager_event_infrastructure__';

export interface EventInfrastructure {
  registry: SubscriberRegistry;
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

  const registry = new SubscriberRegistry(appEventBus);

  registry.register(analyticsSubscriber);
  registry.register(auditSubscriber);
  registry.register(notificationSubscriber);
  registry.register(reminderSubscriber);
  registry.register(marketingSubscriber);
  registry.register(biSubscriber);

  registry.initialize();

  const infra: EventInfrastructure = {
    registry,
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
 * Dispose infrastructure: deactivate subscribers and clear singleton.
 * After dispose, next initializeEventInfrastructure() creates a fresh instance.
 */
export function disposeEventInfrastructure(): void {
  const existing = (globalThis as Record<string, unknown>)[GLOBAL_KEY];
  if (existing && typeof existing === 'object') {
    const infra = existing as EventInfrastructure;
    infra.registry.deactivate();
    infra.isInitialized = false;
    delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
  }
}
