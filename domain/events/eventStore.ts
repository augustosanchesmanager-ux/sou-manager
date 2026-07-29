/**
 * [SMG][DOMAIN][EVENTS] EventStoreRepository
 *
 * Repository interface for persistent event storage.
 * Provides append-only event log with query capabilities.
 *
 * RESPONSABILIDADE:
 *   - Persistir eventos de domínio de forma append-only
 *   - Permitir query por aggregate, correlation, tipo e tempo
 *   - Suportar replay de eventos
 *   - Base para future Outbox Pattern
 *
 * GARANTIAS:
 *   - Sem dependência de React, Supabase, ou qualquer infraestrutura
 *   - Append-only: eventos nunca são atualizados ou deletados
 *   - Cada append retorna o evento com id e occurredAt gerados
 *   - Query retornam eventos ordenados por occurredAt ASC
 *
 * FUTURE:
 *   - subscribeToEvents() para live updates
 *   - Outbox integration
 *   - Event versioning migration
 */

import type { DomainEvent, EventType, EventMetadata } from './types';

// ─── Stored Event ────────────────────────────────────────────────

/**
 * Event as stored in the event store.
 * Extends DomainEvent with storage-specific fields.
 * Includes version fields for event versioning.
 */
export interface StoredEvent {
  readonly id: string;                    // DB surrogate key
  readonly event: DomainEvent;            // Full event (eventId, eventType, payload, metadata, occurredAt)
  readonly storedAt: string;              // When it was persisted
  readonly eventTypeVersion: number;      // Version of this event type at time of storage
  readonly schemaVersion: number;         // Envelope schema version (currently 1)
}

// ─── Query Options ───────────────────────────────────────────────

export interface EventQueryOptions {
  readonly from?: string;                  // ISO date - start range
  readonly to?: string;                    // ISO date - end range
  readonly limit?: number;                 // Max events to return
  readonly offset?: number;               // Skip N events (pagination)
}

// ─── Repository Interface ────────────────────────────────────────

export interface EventStoreRepository {
  /**
   * Append a single event to the store.
   * Returns the stored event with generated id.
   * Throws if eventId already exists (idempotency check).
   */
  append(event: DomainEvent): Promise<StoredEvent>;

  /**
   * Append multiple events atomically.
   * Used for batch operations or event publishing with subscribers.
   * Returns all stored events.
   */
  appendBatch(events: DomainEvent[]): Promise<StoredEvent[]>;

  /**
   * Find all events for a specific aggregate.
   * Useful for event sourcing / rebuilding aggregate state.
   */
  findByAggregate(
    aggregateType: string,
    aggregateId: string,
    options?: EventQueryOptions,
  ): Promise<StoredEvent[]>;

  /**
   * Find all events in a correlation chain.
   * Useful for debugging distributed operations.
   */
  findByCorrelation(
    correlationId: string,
    options?: EventQueryOptions,
  ): Promise<StoredEvent[]>;

  /**
   * Find events by type.
   * Useful for analytics and monitoring.
   */
  findByType(
    eventType: EventType,
    options?: EventQueryOptions,
  ): Promise<StoredEvent[]>;

  /**
   * Find events by tenant.
   * Useful for tenant-specific audit and replay.
   */
  findByTenant(
    tenantId: string,
    options?: EventQueryOptions,
  ): Promise<StoredEvent[]>;

  /**
   * Get a single event by its eventId.
   */
  findById(eventId: string): Promise<StoredEvent | null>;

  /**
   * Get total event count (for monitoring/metrics).
   */
  count(options?: EventQueryOptions): Promise<number>;

  /**
   * Replay events through a handler.
   * Initially throws 'Not Implemented' — prepared for future use.
   * When implemented, will fetch events and invoke handler for each.
   */
  replay(
    query: EventQueryOptions,
    handler: (event: StoredEvent) => Promise<void>,
  ): Promise<{ replayed: number; errors: number }>;
}
