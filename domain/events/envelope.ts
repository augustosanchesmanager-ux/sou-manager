/**
 * [SMG][DOMAIN][EVENTS] EventEnvelope
 *
 * Envelope wrapper for versioned event storage.
 * Carries versioning metadata separate from the event payload.
 *
 * DESIGN DECISIONS:
 *   - eventTypeVersion: per-event-type schema version (independent of other events)
 *   - schemaVersion: envelope structure version (currently 1)
 *   - storedAt: when the event was persisted to the Event Store
 *   - Backward compatible: existing DomainEvent can be wrapped in an envelope
 *
 * USAGE:
 *   const envelope = wrapEvent(event, 1);          // wrap existing event
 *   const envelope = createEnvelope({ ... });       // create from scratch
 */

import type { DomainEvent, EventMetadata } from './types';

// ─── Envelope Interface ─────────────────────────────────────────

export interface EventEnvelope {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventTypeVersion: number;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: EventMetadata;
  readonly occurredAt: string;
  readonly storedAt: string;
  readonly schemaVersion: number;
}

// ─── Envelope Factory ───────────────────────────────────────────

/**
 * Wraps an existing DomainEvent into an EventEnvelope.
 * Uses the event's eventTypeVersion.
 * Sets schemaVersion to 1 and storedAt to now.
 */
export const wrapEvent = (event: DomainEvent, eventTypeVersion?: number): EventEnvelope => ({
  eventId: event.eventId,
  eventType: event.eventType,
  eventTypeVersion: eventTypeVersion ?? event.eventTypeVersion ?? 1,
  aggregateId: event.aggregateId,
  aggregateType: event.aggregateType,
  payload: event.payload,
  metadata: event.metadata,
  occurredAt: event.occurredAt,
  storedAt: new Date().toISOString(),
  schemaVersion: 1,
});

/**
 * Creates an EventEnvelope from raw data.
 * Used when reconstructing events from storage.
 */
export const createEnvelope = (data: Omit<EventEnvelope, 'schemaVersion'>): EventEnvelope => ({
  ...data,
  schemaVersion: 1,
});

/**
 * Extracts a DomainEvent from an EventEnvelope.
 * Used when publishing to the EventBus (backward compatible).
 */
export const unwrapEnvelope = (envelope: EventEnvelope): DomainEvent => ({
  eventId: envelope.eventId,
  eventType: envelope.eventType,
  eventTypeVersion: envelope.eventTypeVersion,
  aggregateId: envelope.aggregateId,
  aggregateType: envelope.aggregateType,
  payload: envelope.payload,
  metadata: envelope.metadata,
  occurredAt: envelope.occurredAt,
});
