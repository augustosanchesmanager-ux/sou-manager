# ADR-005: RPC Strategy

**Status:** Accepted  
**Date:** 2026-07-24  
**Deciders:** SMG Engineering

## Context

Some operations require Supabase RPCs (PostgreSQL functions) for complex queries or transactions that cannot be expressed through the Repository pattern.

## Decision

RPCs are called through a factory pattern, not through Repositories.

### Pattern

```typescript
// RPC Factory (domain layer)
export function createSupabaseClient(): DatabaseClient {
  return createClient(/* config */);
}

// Application Service
const client = createSupabaseClient();
const result = await client.rpc('get_auth_access_context', { p_user_id: userId });
```

### Rules

1. RPC factories live in `domain/shared/supabase-client-factory.ts`
2. Application Services may call RPCs directly via the factory
3. RPCs are NOT routed through Repositories (they bypass the ORM-like abstraction)
4. Each RPC call should have a corresponding test

### When to Use RPCs

- Complex queries that span multiple tables
- Database-level transactions
- Performance-critical operations
- Security-definer functions

### When NOT to Use RPCs

- Simple CRUD → Use Repository
- Single-table queries → Use Repository
- Read-only queries that can be expressed with Supabase query builder → Use Repository

## Consequences

- **Positive:** RPCs are explicitly declared and testable
- **Positive:** Application Services can use RPCs without importing raw Supabase
- **Negative:** Two patterns for data access (Repository + RPC) adds cognitive load
- **Negative:** RPCs are harder to mock in tests
