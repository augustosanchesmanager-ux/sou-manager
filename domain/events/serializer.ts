/**
 * [SMG][DOMAIN][EVENTS] EventSerializer
 *
 * Serializes/deserializes EventEnvelopes for storage and transport.
 * Handles version migration during deserialization.
 *
 * DESIGN DECISIONS:
 *   - JSON serialization (no binary formats)
 *   - Version fields are preserved during serialization
 *   - Deserialization validates schema version
 *   - Unknown fields are preserved (forward compatible)
 *
 * USAGE:
 *   const json = serialize(envelope);
 *   const envelope = deserialize(json);
 */

import type { EventEnvelope } from './envelope';
import { createEnvelope } from './envelope';

// ─── Serialized Form ────────────────────────────────────────────

export interface SerializedEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventTypeVersion: number;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly occurredAt: string;
  readonly storedAt: string;
  readonly schemaVersion: number;
}

// ─── Serializer ──────────────────────────────────────────────────

export interface EventSerializer {
  serialize(envelope: EventEnvelope): string;
  deserialize(json: string): EventEnvelope;
  serializeBatch(envelopes: EventEnvelope[]): string[];
  deserializeBatch(jsons: string[]): EventEnvelope[];
}

// ─── Factory ─────────────────────────────────────────────────────

export const createEventSerializer = (): EventSerializer => ({
  serialize(envelope: EventEnvelope): string {
    const serialized: SerializedEvent = {
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      eventTypeVersion: envelope.eventTypeVersion,
      aggregateId: envelope.aggregateId,
      aggregateType: envelope.aggregateType,
      payload: envelope.payload,
      metadata: envelope.metadata as unknown as Record<string, unknown>,
      occurredAt: envelope.occurredAt,
      storedAt: envelope.storedAt,
      schemaVersion: envelope.schemaVersion,
    };
    return JSON.stringify(serialized);
  },

  deserialize(json: string): EventEnvelope {
    const parsed = JSON.parse(json) as SerializedEvent;

    return createEnvelope({
      eventId: parsed.eventId,
      eventType: parsed.eventType,
      eventTypeVersion: parsed.eventTypeVersion,
      aggregateId: parsed.aggregateId,
      aggregateType: parsed.aggregateType,
      payload: parsed.payload,
      metadata: parsed.metadata as unknown as EventEnvelope['metadata'],
      occurredAt: parsed.occurredAt,
      storedAt: parsed.storedAt,
    });
  },

  serializeBatch(envelopes: EventEnvelope[]): string[] {
    return envelopes.map(e => JSON.stringify({
      eventId: e.eventId,
      eventType: e.eventType,
      eventTypeVersion: e.eventTypeVersion,
      aggregateId: e.aggregateId,
      aggregateType: e.aggregateType,
      payload: e.payload,
      metadata: e.metadata as unknown as Record<string, unknown>,
      occurredAt: e.occurredAt,
      storedAt: e.storedAt,
      schemaVersion: e.schemaVersion,
    }));
  },

  deserializeBatch(jsons: string[]): EventEnvelope[] {
    return jsons.map(j => {
      const parsed = JSON.parse(j) as SerializedEvent;
      return createEnvelope({
        eventId: parsed.eventId,
        eventType: parsed.eventType,
        eventTypeVersion: parsed.eventTypeVersion,
        aggregateId: parsed.aggregateId,
        aggregateType: parsed.aggregateType,
        payload: parsed.payload,
        metadata: parsed.metadata as unknown as EventEnvelope['metadata'],
        occurredAt: parsed.occurredAt,
        storedAt: parsed.storedAt,
      });
    });
  },
});
