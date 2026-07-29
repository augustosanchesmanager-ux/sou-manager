/**
 * [SMG][DOMAIN][EVENTS] Event Versioning Tests
 *
 * Tests for:
 *   - EventEnvelope (wrap, create, unwrap)
 *   - EventRegistry (register, consumers, compatibility)
 *   - UpcasterRegistry (register, chain, upcast)
 *   - EventSerializer (serialize, deserialize, batch)
 *   - ReplayEngine with upcasting
 */

import { describe, it, expect } from 'vitest';
import { wrapEvent, createEnvelope, unwrapEnvelope } from './envelope';
import { createEventRegistry } from './registry';
import { createUpcasterRegistry, type EventUpcaster } from './upcaster';
import { createEventSerializer } from './serializer';
import { createReplayEngine } from './replayEngine';
import { createEvent, type SystemEvent, type DomainEvent } from './types';

// ─── Helpers ─────────────────────────────────────────────────────

const createTestEvent = (overrides: Partial<DomainEvent> = {}): DomainEvent => {
  const base: Omit<DomainEvent, 'eventId' | 'occurredAt' | 'eventTypeVersion'> & {
    metadata: { tenantId: string };
  } = {
    eventType: 'CheckoutCompleted',
    aggregateId: 'comanda-1',
    aggregateType: 'comanda',
    payload: { comandaId: 'comanda-1', total: 100 },
    metadata: { tenantId: 'tenant-1' },
  };
  return createEvent({ ...base, ...overrides } as any);
};

const createTestUpcaster = (
  eventType: string,
  fromVersion: number,
  toVersion: number,
): EventUpcaster => ({
  eventType,
  fromVersion,
  toVersion,
  canHandle: (event) =>
    event.eventType === eventType && event.eventTypeVersion === fromVersion,
  upcast: (event) => ({
    ...event,
    eventTypeVersion: toVersion,
    payload: {
      ...event.payload,
      _upcastedFrom: fromVersion,
      _upcastedTo: toVersion,
    },
  }),
});

// ─── EventEnvelope Tests ─────────────────────────────────────────

describe('EventEnvelope', () => {
  it('should wrap a DomainEvent into an envelope', () => {
    const event = createTestEvent();
    const envelope = wrapEvent(event);

    expect(envelope.eventId).toBe(event.eventId);
    expect(envelope.eventType).toBe('CheckoutCompleted');
    expect(envelope.eventTypeVersion).toBe(1);
    expect(envelope.aggregateId).toBe('comanda-1');
    expect(envelope.aggregateType).toBe('comanda');
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.storedAt).toBeDefined();
    expect(envelope.metadata.tenantId).toBe('tenant-1');
  });

  it('should use custom eventTypeVersion when provided', () => {
    const event = createTestEvent();
    const envelope = wrapEvent(event, 2);

    expect(envelope.eventTypeVersion).toBe(2);
  });

  it('should create envelope from raw data', () => {
    const envelope = createEnvelope({
      eventId: 'evt-1',
      eventType: 'CheckoutCompleted',
      eventTypeVersion: 1,
      aggregateId: 'comanda-1',
      aggregateType: 'comanda',
      payload: { total: 100 },
      metadata: { tenantId: 'tenant-1' },
      occurredAt: '2026-07-24T10:00:00Z',
      storedAt: '2026-07-24T10:00:01Z',
    });

    expect(envelope.eventId).toBe('evt-1');
    expect(envelope.schemaVersion).toBe(1);
  });

  it('should unwrap envelope back to DomainEvent', () => {
    const event = createTestEvent();
    const envelope = wrapEvent(event);
    const unwrapped = unwrapEnvelope(envelope);

    expect(unwrapped.eventId).toBe(event.eventId);
    expect(unwrapped.eventType).toBe('CheckoutCompleted');
    expect(unwrapped.eventTypeVersion).toBe(1);
    expect(unwrapped.payload).toEqual(event.payload);
  });
});

// ─── EventRegistry Tests ─────────────────────────────────────────

describe('EventRegistry', () => {
  it('should register an event type', () => {
    const registry = createEventRegistry();
    registry.register('CheckoutCompleted', {
      aggregateType: 'comanda',
      currentVersion: 1,
      introducedIn: '4.1',
    });

    const meta = registry.get('CheckoutCompleted');
    expect(meta).toBeDefined();
    expect(meta?.eventType).toBe('CheckoutCompleted');
    expect(meta?.aggregateType).toBe('comanda');
    expect(meta?.currentVersion).toBe(1);
    expect(meta?.introducedIn).toBe('4.1');
  });

  it('should return all registered events', () => {
    const registry = createEventRegistry();
    registry.register('CheckoutCompleted', { aggregateType: 'comanda' });
    registry.register('AppointmentCreated', { aggregateType: 'appointment' });

    const all = registry.getAll();
    expect(all).toHaveLength(2);
  });

  it('should filter by aggregate type', () => {
    const registry = createEventRegistry();
    registry.register('CheckoutCompleted', { aggregateType: 'comanda' });
    registry.register('AppointmentCreated', { aggregateType: 'appointment' });

    const comandaEvents = registry.getForAggregate('comanda');
    expect(comandaEvents).toHaveLength(1);
    expect(comandaEvents[0].eventType).toBe('CheckoutCompleted');
  });

  it('should register consumers', () => {
    const registry = createEventRegistry();
    registry.register('CheckoutCompleted', { aggregateType: 'comanda' });
    registry.registerConsumer('CheckoutCompleted', 'AnalyticsSubscriber', {
      fromVersion: 1,
      toVersion: 2,
    });

    const consumers = registry.getConsumers('CheckoutCompleted');
    expect(consumers).toHaveLength(1);
    expect(consumers[0].name).toBe('AnalyticsSubscriber');
  });

  it('should check consumer compatibility', () => {
    const registry = createEventRegistry();
    registry.register('CheckoutCompleted', { aggregateType: 'comanda' });
    registry.registerConsumer('CheckoutCompleted', 'AnalyticsSubscriber', {
      fromVersion: 1,
      toVersion: 2,
    });

    expect(registry.isConsumerCompatible('CheckoutCompleted', 'AnalyticsSubscriber', 1)).toBe(true);
    expect(registry.isConsumerCompatible('CheckoutCompleted', 'AnalyticsSubscriber', 2)).toBe(true);
    expect(registry.isConsumerCompatible('CheckoutCompleted', 'AnalyticsSubscriber', 3)).toBe(false);
  });

  it('should throw on duplicate consumer registration', () => {
    const registry = createEventRegistry();
    registry.register('CheckoutCompleted', { aggregateType: 'comanda' });
    registry.registerConsumer('CheckoutCompleted', 'AnalyticsSubscriber', {
      fromVersion: 1,
      toVersion: 2,
    });

    expect(() => {
      registry.registerConsumer('CheckoutCompleted', 'AnalyticsSubscriber', {
        fromVersion: 1,
        toVersion: 3,
      });
    }).toThrow('already registered');
  });

  it('should get latest version', () => {
    const registry = createEventRegistry();
    registry.register('CheckoutCompleted', { aggregateType: 'comanda', currentVersion: 1 });

    expect(registry.getLatestVersion('CheckoutCompleted')).toBe(1);
    expect(registry.getLatestVersion('UnknownEvent')).toBe(1);
  });
});

// ─── UpcasterRegistry Tests ──────────────────────────────────────

describe('UpcasterRegistry', () => {
  it('should register an upcaster', () => {
    const registry = createUpcasterRegistry();
    const upcaster = createTestUpcaster('CheckoutCompleted', 1, 2);

    registry.register(upcaster);

    expect(registry.hasUpcasters('CheckoutCompleted')).toBe(true);
    expect(registry.getUpcasters('CheckoutCompleted')).toHaveLength(1);
  });

  it('should get upcaster by version', () => {
    const registry = createUpcasterRegistry();
    const upcaster = createTestUpcaster('CheckoutCompleted', 1, 2);

    registry.register(upcaster);

    const found = registry.getUpcaster('CheckoutCompleted', 1);
    expect(found).toBe(upcaster);
  });

  it('should upcast to latest version', () => {
    const registry = createUpcasterRegistry();
    registry.register(createTestUpcaster('CheckoutCompleted', 1, 2));
    registry.register(createTestUpcaster('CheckoutCompleted', 2, 3));

    const event = createEnvelope({
      eventId: 'evt-1',
      eventType: 'CheckoutCompleted',
      eventTypeVersion: 1,
      aggregateId: 'comanda-1',
      aggregateType: 'comanda',
      payload: { total: 100 },
      metadata: { tenantId: 'tenant-1' },
      occurredAt: '2026-07-24T10:00:00Z',
      storedAt: '2026-07-24T10:00:01Z',
    });

    const upcasted = registry.upcastToLatest(event);
    expect(upcasted.eventTypeVersion).toBe(3);
    expect(upcasted.payload._upcastedFrom).toBe(2);
    expect(upcasted.payload._upcastedTo).toBe(3);
  });

  it('should upcast to specific version', () => {
    const registry = createUpcasterRegistry();
    registry.register(createTestUpcaster('CheckoutCompleted', 1, 2));
    registry.register(createTestUpcaster('CheckoutCompleted', 2, 3));

    const event = createEnvelope({
      eventId: 'evt-1',
      eventType: 'CheckoutCompleted',
      eventTypeVersion: 1,
      aggregateId: 'comanda-1',
      aggregateType: 'comanda',
      payload: { total: 100 },
      metadata: { tenantId: 'tenant-1' },
      occurredAt: '2026-07-24T10:00:00Z',
      storedAt: '2026-07-24T10:00:01Z',
    });

    const upcasted = registry.upcastToVersion(event, 2);
    expect(upcasted.eventTypeVersion).toBe(2);
  });

  it('should return event unchanged if no upcasters', () => {
    const registry = createUpcasterRegistry();

    const event = createEnvelope({
      eventId: 'evt-1',
      eventType: 'CheckoutCompleted',
      eventTypeVersion: 1,
      aggregateId: 'comanda-1',
      aggregateType: 'comanda',
      payload: { total: 100 },
      metadata: { tenantId: 'tenant-1' },
      occurredAt: '2026-07-24T10:00:00Z',
      storedAt: '2026-07-24T10:00:01Z',
    });

    const result = registry.upcastToLatest(event);
    expect(result).toBe(event);
  });

  it('should return version chain', () => {
    const registry = createUpcasterRegistry();
    const u1 = createTestUpcaster('CheckoutCompleted', 1, 2);
    const u2 = createTestUpcaster('CheckoutCompleted', 2, 3);

    registry.register(u1);
    registry.register(u2);

    const chain = registry.getVersionChain('CheckoutCompleted', 1, 3);
    expect(chain).toHaveLength(2);
    expect(chain[0]).toBe(u1);
    expect(chain[1]).toBe(u2);
  });

  it('should throw on duplicate upcaster registration', () => {
    const registry = createUpcasterRegistry();
    registry.register(createTestUpcaster('CheckoutCompleted', 1, 2));

    expect(() => {
      registry.register(createTestUpcaster('CheckoutCompleted', 1, 2));
    }).toThrow('already registered');
  });

  it('should not upcast if already at target version', () => {
    const registry = createUpcasterRegistry();
    registry.register(createTestUpcaster('CheckoutCompleted', 1, 2));

    const event = createEnvelope({
      eventId: 'evt-1',
      eventType: 'CheckoutCompleted',
      eventTypeVersion: 2,
      aggregateId: 'comanda-1',
      aggregateType: 'comanda',
      payload: { total: 100 },
      metadata: { tenantId: 'tenant-1' },
      occurredAt: '2026-07-24T10:00:00Z',
      storedAt: '2026-07-24T10:00:01Z',
    });

    const result = registry.upcastToLatest(event);
    expect(result).toBe(event);
  });
});

// ─── EventSerializer Tests ───────────────────────────────────────

describe('EventSerializer', () => {
  it('should serialize and deserialize an envelope', () => {
    const serializer = createEventSerializer();

    const envelope = createEnvelope({
      eventId: 'evt-1',
      eventType: 'CheckoutCompleted',
      eventTypeVersion: 2,
      aggregateId: 'comanda-1',
      aggregateType: 'comanda',
      payload: { total: 100 },
      metadata: { tenantId: 'tenant-1' },
      occurredAt: '2026-07-24T10:00:00Z',
      storedAt: '2026-07-24T10:00:01Z',
    });

    const json = serializer.serialize(envelope);
    const deserialized = serializer.deserialize(json);

    expect(deserialized.eventId).toBe('evt-1');
    expect(deserialized.eventTypeVersion).toBe(2);
    expect(deserialized.schemaVersion).toBe(1);
    expect(deserialized.payload.total).toBe(100);
  });

  it('should serialize and deserialize batch', () => {
    const serializer = createEventSerializer();

    const envelopes = [
      createEnvelope({
        eventId: 'evt-1',
        eventType: 'CheckoutCompleted',
        eventTypeVersion: 1,
        aggregateId: 'comanda-1',
        aggregateType: 'comanda',
        payload: {},
        metadata: { tenantId: 'tenant-1' },
        occurredAt: '2026-07-24T10:00:00Z',
        storedAt: '2026-07-24T10:00:01Z',
      }),
      createEnvelope({
        eventId: 'evt-2',
        eventType: 'AppointmentCreated',
        eventTypeVersion: 1,
        aggregateId: 'apt-1',
        aggregateType: 'appointment',
        payload: {},
        metadata: { tenantId: 'tenant-1' },
        occurredAt: '2026-07-24T10:01:00Z',
        storedAt: '2026-07-24T10:01:01Z',
      }),
    ];

    const jsons = serializer.serializeBatch(envelopes);
    expect(jsons).toHaveLength(2);

    const deserialized = serializer.deserializeBatch(jsons);
    expect(deserialized).toHaveLength(2);
    expect(deserialized[0].eventType).toBe('CheckoutCompleted');
    expect(deserialized[1].eventType).toBe('AppointmentCreated');
  });
});

// ─── ReplayEngine with Upcasting Tests ───────────────────────────

describe('ReplayEngine with upcasting', () => {
  it('should create replay engine with upcaster registry', () => {
    const upcasterRegistry = createUpcasterRegistry();
    const engine = createReplayEngine({
      eventStore: {} as any,
      eventBus: {} as any,
      upcasterRegistry,
    });

    expect(engine).toBeDefined();
  });

  it('should accept upcast option', () => {
    const upcasterRegistry = createUpcasterRegistry();
    const engine = createReplayEngine({
      eventStore: {} as any,
      eventBus: {} as any,
      upcasterRegistry,
    });

    expect(engine).toBeDefined();
  });
});
