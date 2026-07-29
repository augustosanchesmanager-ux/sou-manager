# ADR-006: Event Bus

**Status:** Accepted  
**Date:** 2026-07-24  
**Deciders:** SMG Engineering

## Context

Domain events (checkout completed, appointment created, etc.) need to trigger side effects (analytics, notifications, audit) without coupling the core business logic to those side effects.

## Decision

Implement an in-memory event bus with publish/subscribe pattern.

### Structure

```text
domain/events/
  types.ts          — Event definitions
  bus.ts            — EventBus interface
  memory-bus.ts     — InMemoryEventBus implementation
  app-bus.ts        — Singleton instance
  subscribers/      — Event handlers
```

### Event Structure

```typescript
interface SystemEvent {
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, unknown>;
  metadata: {
    tenantId: string;
    correlationId?: string;
    source: string;
    version: number;
  };
}
```

### Rules

1. Events are published via `appEventBus.publish(event)`
2. Subscribers are registered via `SubscriberRegistry`
3. Subscriber errors are isolated — they don't crash the publisher
4. Events are domain-only — no React or Supabase dependencies

## Consequences

- **Positive:** Loose coupling between core logic and side effects
- **Positive:** Easy to add new subscribers without modifying existing code
- **Positive:** Events can be stored and replayed (Event Store)
- **Negative:** Debugging event flows is harder than direct function calls
- **Negative:** In-memory bus doesn't survive server restarts (acceptable for SPA)
