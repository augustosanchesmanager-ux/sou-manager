# ADR-002: Repository Pattern

**Status:** Accepted  
**Date:** 2026-07-24  
**Deciders:** SMG Engineering

## Context

Application Services need to persist and retrieve data. Direct Supabase calls in Application Services created tight coupling to the infrastructure layer.

## Decision

All persistence goes through Repository interfaces defined in the domain layer.

### Structure

```text
domain/
  {domain}/
    repository.ts    — Interface + Implementation
    types.ts         — Domain types
    index.ts         — Barrel exports
```

### Interface Hierarchy

```typescript
interface IRepository<T> {
  list(...): Promise<T[]>;
  get(id: string): Promise<T | null>;
  exists(id: string): Promise<boolean>;
}

interface ICreatableRepository<T> extends IRepository<T> {
  create(data: ...): Promise<T>;
}

interface IUpdatableRepository<T> extends IRepository<T> {
  update(id: string, data: ...): Promise<T>;
}

interface IDeletableRepository<T> extends IRepository<T> {
  delete(id: string): Promise<void>;
}

interface ICrudRepository<T> extends ICreatableRepository<T>, IUpdatableRepository<T>, IDeletableRepository<T> {}
```

### Naming Convention

- Class: `XxxRepositoryImpl`
- Singleton: `export const xxxRepository = new XxxRepositoryImpl()`
- Interface: `IXxxRepository`

### Return Types

- `get()` → `T | null`
- `list()` → `T[]`
- `exists()` → `boolean`
- Errors: throw `RepositoryError`, never return `{ data, error }`

## Consequences

- **Positive:** Application Services are infrastructure-agnostic
- **Positive:** Repositories are independently testable
- **Positive:** Swapping Supabase for another backend requires changing only Repository implementations
- **Negative:** One extra abstraction layer per domain

## Compliance

Enforced by `scripts/architecture/guard-repository.mjs` (no `.from()` outside domain).
