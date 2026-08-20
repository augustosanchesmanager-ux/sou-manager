/**
 * [SMG][DOMAIN][EVENTS] Subscriber
 *
 * Infrastructure for read-only event subscribers.
 * Subscribers react to domain events without modifying business state.
 *
 * DESIGN DECISIONS:
 *   - DomainSubscriber wraps the EventBus subscribe pattern with metadata
 *   - SubscriberRegistry manages registration/unregistration with the bus
 *   - All subscribers are read-only (analytics, audit, notifications)
 *   - Financial subscribers (Commission, Finance) are explicitly excluded
 *     until infrastructure is validated with safe subscribers first
 *
 * FUTURE:
 *   - Financial subscribers after validation
 *   - Outbox pattern integration
 *   - External webhook subscribers
 */

import type { SystemEvent, EventType } from './types';
import type { EventBus, EventHandler } from './bus';

// ─── Domain Subscriber Interface ────────────────────────────────

/**
 * A read-only subscriber that reacts to a specific domain event.
 * Must NOT modify business state — only read and process.
 *
 * Implementation pattern:
 *   - analytics: aggregate metrics, update dashboards
 *   - audit: log event details for compliance
 *   - notifications: send emails, push, WhatsApp
 *   - reminder: schedule appointment reminders
 *   - marketing: trigger marketing campaigns
 *   - bi: update business intelligence data
 */
export interface DomainSubscriber<T extends SystemEvent = SystemEvent> {
  /** Human-readable name for debugging/logging */
  readonly name: string;

  /** Description of what this subscriber does */
  readonly description: string;

  /** The event type this subscriber listens to (or '*' for all events) */
  readonly eventType: T['eventType'] | '*';

  /**
   * Handle the event. Must be read-only — no side effects on business state.
   * Errors are caught by the EventBus and logged, never propagated.
   */
  handle(event: T): Promise<void>;
}

// ─── Subscriber Registry ────────────────────────────────────────

/**
 * Registry that manages subscriber lifecycle with the EventBus.
 * Provides register/unregister operations and centralized initialization.
 *
 * Usage:
 *   const registry = new SubscriberRegistry(appEventBus);
 *   registry.register(analyticsSubscriber);
 *   registry.register(auditSubscriber);
 *   registry.initialize(); // subscribes all registered subscribers
 *
 *   // Later:
 *   registry.unregister('AnalyticsSubscriber');
 */
export class SubscriberRegistry {
  private subscribers = new Map<string, DomainSubscriber>();
  private unsubscribers = new Map<string, () => void>();
  private bus: EventBus;

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  /**
   * Register a subscriber. Does not activate it yet.
   * Call initialize() after all subscribers are registered.
   */
  register(subscriber: DomainSubscriber): void {
    if (this.subscribers.has(subscriber.name)) {
      console.warn(`[SUBSCRIBER_REGISTRY] "${subscriber.name}" already registered, skipping`);
      return;
    }
    this.subscribers.set(subscriber.name, subscriber);
  }

  /**
   * Unregister a subscriber and deactivate it if it was initialized.
   */
  unregister(name: string): boolean {
    const unsub = this.unsubscribers.get(name);
    if (unsub) {
      unsub();
      this.unsubscribers.delete(name);
    }
    return this.subscribers.delete(name);
  }

  /**
   * Subscribe all registered subscribers to the EventBus.
   * Must be called after all register() calls.
   * Subscribers with eventType='*' use subscribeAll instead.
   */
  initialize(): void {
    for (const subscriber of this.subscribers.values()) {
      const eventKey = subscriber.eventType as string;

      // Special case: '*' means subscribe to ALL events
      if (eventKey === '*') {
        const unsub = this.bus.subscribeAll(async (event) => {
          try {
            await subscriber.handle(event as any);
          } catch (error) {
            console.error(
              `[SUBSCRIBER] ${subscriber.name} failed on ${event.eventType}:`,
              error,
            );
          }
        });
        this.unsubscribers.set(subscriber.name, unsub);
        continue;
      }

      const unsub = this.bus.subscribe(subscriber.eventType as SystemEvent['eventType'], async (event) => {
        try {
          await subscriber.handle(event as any);
        } catch (error) {
          console.error(
            `[SUBSCRIBER] ${subscriber.name} failed on ${subscriber.eventType}:`,
            error,
          );
        }
      });
      this.unsubscribers.set(subscriber.name, unsub);
    }
  }

  /**
   * Deactivate all subscribers without removing them.
   */
  deactivate(): void {
    for (const unsub of this.unsubscribers.values()) {
      unsub();
    }
    this.unsubscribers.clear();
  }

  /**
   * Remove all subscribers and deactivate them.
   */
  clear(): void {
    this.deactivate();
    this.subscribers.clear();
  }

  /**
   * Get registered subscriber count.
   */
  count(): number {
    return this.subscribers.size;
  }

  /**
   * Get list of registered subscriber names.
   */
  names(): string[] {
    return Array.from(this.subscribers.keys());
  }

  /**
   * Check if a subscriber is registered.
   */
  has(name: string): boolean {
    return this.subscribers.has(name);
  }
}
