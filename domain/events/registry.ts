/**
 * [SMG][DOMAIN][EVENTS] EventRegistry
 *
 * Central registry for event type metadata.
 * Tracks version, aggregate type, and consumer compatibility for each event type.
 *
 * DESIGN DECISIONS:
 *   - Each event type has its own version number (independent)
 *   - Version starts at 1, increments on breaking changes
 *   - Consumers declare which versions they can handle
 *   - Registry is the single source of truth for event metadata
 *
 * USAGE:
 *   const registry = createEventRegistry();
 *   registry.register('CheckoutCompleted', { aggregateType: 'comanda', currentVersion: 1 });
 *   registry.registerConsumer('CheckoutCompleted', 'AnalyticsSubscriber', { fromVersion: 1, toVersion: 2 });
 *   const meta = registry.get('CheckoutCompleted');
 */

// ─── Types ───────────────────────────────────────────────────────

export interface EventTypeMetadata {
  readonly eventType: string;
  readonly aggregateType: string;
  readonly currentVersion: number;
  readonly introducedIn: string;
  readonly deprecatedIn: string | null;
  readonly snapshotsEnabled: boolean;
  readonly replaySupported: boolean;
  readonly publishers: string[];
  readonly consumers: ConsumerRegistration[];
}

export interface ConsumerRegistration {
  readonly name: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly registeredAt: string;
}

export interface EventTypeRegistration {
  readonly aggregateType: string;
  readonly currentVersion?: number;
  readonly introducedIn?: string;
  readonly deprecatedIn?: string | null;
  readonly snapshotsEnabled?: boolean;
  readonly replaySupported?: boolean;
  readonly publishers?: string[];
}

// ─── Registry Interface ─────────────────────────────────────────

export interface EventRegistry {
  register(eventType: string, registration: EventTypeRegistration): void;
  get(eventType: string): EventTypeMetadata | undefined;
  getAll(): EventTypeMetadata[];
  getForAggregate(aggregateType: string): EventTypeMetadata[];
  registerConsumer(eventType: string, consumerName: string, canHandle: { fromVersion: number; toVersion: number }): void;
  isConsumerCompatible(eventType: string, consumerName: string, version: number): boolean;
  getConsumers(eventType: string): ConsumerRegistration[];
  getLatestVersion(eventType: string): number;
}

// ─── Factory ─────────────────────────────────────────────────────

export const createEventRegistry = (): EventRegistry => {
  const registrations = new Map<string, EventTypeMetadata>();

  return {
    register(eventType: string, registration: EventTypeRegistration): void {
      const existing = registrations.get(eventType);
      registrations.set(eventType, {
        eventType,
        aggregateType: registration.aggregateType,
        currentVersion: registration.currentVersion ?? existing?.currentVersion ?? 1,
        introducedIn: registration.introducedIn ?? existing?.introducedIn ?? 'unknown',
        deprecatedIn: registration.deprecatedIn ?? existing?.deprecatedIn ?? null,
        snapshotsEnabled: registration.snapshotsEnabled ?? existing?.snapshotsEnabled ?? false,
        replaySupported: registration.replaySupported ?? existing?.replaySupported ?? true,
        publishers: registration.publishers ?? existing?.publishers ?? [],
        consumers: existing?.consumers ?? [],
      });
    },

    get(eventType: string): EventTypeMetadata | undefined {
      return registrations.get(eventType);
    },

    getAll(): EventTypeMetadata[] {
      return Array.from(registrations.values());
    },

    getForAggregate(aggregateType: string): EventTypeMetadata[] {
      return Array.from(registrations.values()).filter(r => r.aggregateType === aggregateType);
    },

    registerConsumer(eventType: string, consumerName: string, canHandle: { fromVersion: number; toVersion: number }): void {
      const existing = registrations.get(eventType);
      if (!existing) {
        throw new Error(`Event type '${eventType}' not registered. Register it first.`);
      }
      const alreadyRegistered = existing.consumers.some(c => c.name === consumerName);
      if (alreadyRegistered) {
        throw new Error(`Consumer '${consumerName}' already registered for '${eventType}'.`);
      }
      registrations.set(eventType, {
        ...existing,
        consumers: [
          ...existing.consumers,
          {
            name: consumerName,
            fromVersion: canHandle.fromVersion,
            toVersion: canHandle.toVersion,
            registeredAt: new Date().toISOString(),
          },
        ],
      });
    },

    isConsumerCompatible(eventType: string, consumerName: string, version: number): boolean {
      const meta = registrations.get(eventType);
      if (!meta) return false;
      const consumer = meta.consumers.find(c => c.name === consumerName);
      if (!consumer) return false;
      return version >= consumer.fromVersion && version <= consumer.toVersion;
    },

    getConsumers(eventType: string): ConsumerRegistration[] {
      return registrations.get(eventType)?.consumers ?? [];
    },

    getLatestVersion(eventType: string): number {
      return registrations.get(eventType)?.currentVersion ?? 1;
    },
  };
};
