/**
 * [SMG][DOMAIN][EVENTS] InMemoryEventStore
 *
 * In-memory implementation of EventStoreRepository.
 * Used for testing, demo mode, and development.
 *
 * GARANTIAS:
 *   - Append-only: no mutations after store
 *   - Sorted by occurredAt ASC (stable within same millisecond via insertion order)
 *   - eventId uniqueness enforced
 *   - Full query support (aggregate, correlation, type, tenant, time range)
 *   - replay() throws 'Not Implemented' — prepared for future
 */

import type {
  EventStoreRepository,
  StoredEvent,
  EventQueryOptions,
} from './eventStore';
import type { DomainEvent, EventType } from './types';

export class InMemoryEventStore implements EventStoreRepository {
  private events: StoredEvent[] = [];
  private idIndex = new Map<string, StoredEvent>();
  private counter = 0;

  // ── Append ──────────────────────────────────────────────────────

  async append(event: DomainEvent): Promise<StoredEvent> {
    if (this.idIndex.has(event.eventId)) {
      throw new Error(`Event ${event.eventId} already exists in store`);
    }

    this.counter += 1;
    const stored: StoredEvent = {
      id: `stored_${this.counter}`,
      event,
      storedAt: new Date().toISOString(),
      eventTypeVersion: event.eventTypeVersion,
      schemaVersion: 1,
    };

    this.events.push(stored);
    this.idIndex.set(event.eventId, stored);
    return stored;
  }

  async appendBatch(events: DomainEvent[]): Promise<StoredEvent[]> {
    const results: StoredEvent[] = [];
    for (const event of events) {
      results.push(await this.append(event));
    }
    return results;
  }

  // ── Query ───────────────────────────────────────────────────────

  async findByAggregate(
    aggregateType: string,
    aggregateId: string,
    options?: EventQueryOptions,
  ): Promise<StoredEvent[]> {
    return this.query((e) =>
      e.event.aggregateType === aggregateType &&
      e.event.aggregateId === aggregateId,
      options,
    );
  }

  async findByCorrelation(
    correlationId: string,
    options?: EventQueryOptions,
  ): Promise<StoredEvent[]> {
    return this.query((e) =>
      e.event.metadata.correlationId === correlationId,
      options,
    );
  }

  async findByType(
    eventType: EventType,
    options?: EventQueryOptions,
  ): Promise<StoredEvent[]> {
    return this.query((e) => e.event.eventType === eventType, options);
  }

  async findByTenant(
    tenantId: string,
    options?: EventQueryOptions,
  ): Promise<StoredEvent[]> {
    return this.query((e) => e.event.metadata.tenantId === tenantId, options);
  }

  async findById(eventId: string): Promise<StoredEvent | null> {
    return this.idIndex.get(eventId) ?? null;
  }

  async count(options?: EventQueryOptions): Promise<number> {
    if (!options?.from && !options?.to) {
      return this.events.length;
    }
    const filtered = this.applyTimeFilter(this.events, options);
    return filtered.length;
  }

  // ── Replay (Not Implemented) ───────────────────────────────────

  async replay(
    _query: EventQueryOptions,
    _handler: (event: StoredEvent) => Promise<void>,
  ): Promise<{ replayed: number; errors: number }> {
    throw new Error('EventStore.replay() is not yet implemented');
  }

  // ── Internals ───────────────────────────────────────────────────

  private query(
    predicate: (e: StoredEvent) => boolean,
    options?: EventQueryOptions,
  ): StoredEvent[] {
    let results = this.events.filter(predicate);

    results = this.applyTimeFilter(results, options);

    if (options?.offset) {
      results = results.slice(options.offset);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  private applyTimeFilter(
    events: StoredEvent[],
    options?: EventQueryOptions,
  ): StoredEvent[] {
    if (!options?.from && !options?.to) return events;

    return events.filter((e) => {
      const t = e.event.occurredAt;
      if (options.from && t < options.from) return false;
      if (options.to && t > options.to) return false;
      return true;
    });
  }
}

/**
 * Factory for creating an InMemoryEventStore.
 * Matches the pattern used by createEventBus().
 */
export const createEventStore = (): InMemoryEventStore => new InMemoryEventStore();
