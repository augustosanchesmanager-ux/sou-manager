# ADR-001: Layered Architecture

**Status:** Accepted  
**Date:** 2026-07-24  
**Deciders:** SMG Engineering

## Context

The SMG codebase grew organically, with components directly accessing Supabase, hooks performing persistence, and application logic scattered across UI files. This made the system fragile, hard to test, and difficult to extend.

## Decision

Adopt a strict layered architecture:

```text
Pages (UI)
  ↓
Hooks (state orchestration)
  ↓
Application Services (business logic)
  ↓
Repositories (persistence abstraction)
  ↓
Infrastructure (Supabase, external APIs)
  ↓
Database
```

### Rules

1. Each layer only imports from the layer directly below it
2. No skipping layers (e.g., Pages must not import Repositories)
3. No reverse dependencies (Infrastructure must not import Application)
4. Cross-cutting concerns (logging, auth) flow through dependency injection

### Exceptions

- RPC calls may bypass Repositories when no dedicated Repository exists (temporary — to be migrated)
- `src/lib/` is shared infrastructure, accessible by all layers

## Consequences

- **Positive:** Clear boundaries, testable units, predictable dependency flow
- **Positive:** Architecture can be enforced by automated guards
- **Negative:** Initial migration cost for legacy code
- **Negative:** Some indirection for simple CRUD operations

## Compliance

Enforced by `scripts/architecture/guard-imports.mjs` and `architecture-baseline.json`.
