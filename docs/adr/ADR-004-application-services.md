# ADR-004: Application Services

**Status:** Accepted  
**Date:** 2026-07-24  
**Deciders:** SMG Engineering

## Context

Business logic was scattered across React components, making it untestable and reusable.

## Decision

Application Services encapsulate business logic in pure TypeScript functions.

### Structure

```text
application/
  {domain}/
    {domain}ApplicationService.ts  — Main service
    operations.ts                  — Mutation operations
    loaders.ts                     — Data loading
    types.ts                       — Application types
    index.ts                       — Public API
    *.test.ts                      — Tests
```

### Principles

1. **No React dependency** — Services are pure TypeScript
2. **No Supabase import** — Services use Repository interfaces
3. **Dependency injection** — Repositories passed via constructor or function params
4. **Idempotency** — Critical operations use idempotency keys
5. **Error handling** — Throw typed errors, never swallow

### Example

```typescript
class CheckoutApplicationService {
  constructor(
    private comandaRepo: IComandaRepository,
    private itemRepo: IComandaItemRepository,
    private txRepo: ITransactionRepository,
  ) {}

  async finish(request: FinishRequest): Promise<FinishResponse> {
    // Business logic here
    // Persistence through repositories only
  }
}
```

## Consequences

- **Positive:** Business logic is testable without React or Supabase
- **Positive:** Logic can be reused across different UIs (web, kiosk, portal)
- **Positive:** Clear separation between UI and business concerns
- **Negative:** More files and indirection for simple operations
