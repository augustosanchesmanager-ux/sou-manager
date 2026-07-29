# Architecture Guidelines — SOU MANA.GER

## Layer Rules

```
Pages → Application Services → Repository → Supabase
```

### Pages

- Never call `supabase.from()` directly.
- Never import from `src/lib/supabase/client.ts`.
- Delegate all data operations to Application Services or Repositories.
- Handle UI state, toasts, navigation, loading.

### Application Services

- Orchestrate business logic across multiple repositories.
- Never import React, UI components, or navigation.
- Never call `supabase.from()` directly.
- Use repositories for all data access.
- Throw `RepositoryError` for data layer failures.

### Repositories

- Extend `SupabaseRepository` base class.
- One entity per repository (e.g., `ClientRepository`, `AppointmentRepository`).
- Never import React, UI components, or navigation.
- Always filter by `tenant_id`.
- Never return raw `{ data, error }` — throw `RepositoryError` on failure.
- Never orchestrate business logic — that belongs to Application Services.
- Never update multiple tables in a single operation.

### Domain

- Pure business rules and types.
- Zero dependencies on React, Supabase, or UI.
- Can be imported by any layer.

## Base Class: SupabaseRepository

All repositories extend from `domain/shared/supabase-repository.ts`:

```typescript
abstract class SupabaseRepository {
  protected readonly tableName: string;
  protected readonly appSlug: AppSlug;

  protected get client(): AnyClient;
  protected from(): AnyBuilder;
  protected throwOnError(error: unknown, context: string): never;
  protected extractData<T>(result: { data: T | null; error: unknown }, context: string): T;
  protected requireData<T>(data: T | null, context: string): T;
}
```

## Current Repositories

| Repository | Entity | Table | Page | Extends |
|------------|--------|-------|------|---------|
| `ClientRepository` | Client | `clients` | Clients.tsx | SupabaseRepository |
| `StaffRepository` | StaffMember | `staff` | Team.tsx | SupabaseRepository |
| `AppointmentRepository` | Appointment | `appointments` | Schedule.tsx | SupabaseRepository |
| `ComandaRepository` | Comanda | `comandas` | (pending) | SupabaseRepository |

## Error Handling

All repositories throw `RepositoryError` from `domain/shared/errors.ts`.

```typescript
class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly table?: string,
    public readonly cause?: unknown,
  );
}
```

## Migration Rules

1. One repository at a time.
2. Migrate one page per repository.
3. Never break existing behavior.
4. Each migration must pass `npm run build` and `npx tsc --noEmit`.
5. Cascade delete orchestration stays in Application Service, not Repository.
