# ADR-007: Outbox Pattern

**Status:** Accepted  
**Date:** 2026-07-24  
**Deciders:** SMG Engineering

## Context

Events published to the in-memory bus are lost if the subscriber fails or the page reloads. Critical financial operations need reliable delivery.

## Decision

Use the Outbox Pattern for reliable event delivery.

### Structure

```text
domain/events/outbox/
  types.ts               — OutboxItem, status, retry policy
  outboxRepository.ts    — OutboxRepository interface
  dispatcher.ts          — Dispatcher interface
  inMemoryOutbox.ts      — In-memory implementation
  inMemoryDispatcher.ts  — In-memory dispatcher
  providers/             — Dispatch targets (webhook, console, finance)
```

### Status Lifecycle

```text
pending → processing → published
                      → pending (retry)
                        → dead_letter (after maxAttempts)
```

### Retry Policy

Exponential backoff: `baseDelayMs × 2^(attempts-1)`

### Usage

```typescript
// Enqueue
await outbox.enqueue({
  eventId: event.id,
  eventType: event.eventType,
  tenantId: event.metadata.tenantId,
  targets: [{ provider: 'webhook', config: { url: '...' } }],
  payload: event.payload,
  metadata: event.metadata,
});

// Dispatch
await dispatcher.dispatch();
```

## Consequences

- **Positive:** Events survive page reloads and subscriber failures
- **Positive:** Retry mechanism with exponential backoff
- **Positive:** Dead letter queue for failed events
- **Negative:** Additional complexity for event publishing
- **Negative:** In-memory outbox doesn't survive server restarts (acceptable for SPA)
