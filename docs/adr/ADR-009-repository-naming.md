# ADR-009: Repository Naming Conventions

**Status:** Accepted  
**Date:** 2026-07-24  
**Deciders:** SMG Engineering

## Context

Multiple repositories were created with inconsistent naming, making the codebase harder to navigate.

## Decision

Standardized naming conventions for all repositories.

### File Naming

```text
domain/{domain}/repository.ts       — Single repository file
domain/{domain}/types.ts            — Domain types
domain/{domain}/index.ts            — Barrel exports (if needed)
```

### Class Naming

```text
XxxRepositoryImpl     — Implementation class
xxxRepository         — Singleton export
```

### Interface Naming

```text
IXxxRepository        — Repository interface
```

### Method Naming

| Method | Return Type | Description |
|--------|-------------|-------------|
| `list(...)` | `T[]` | List with filters |
| `get(id)` | `T \| null` | Get by ID |
| `exists(id)` | `boolean` | Check existence |
| `count(...)` | `number` | Count records |
| `create(data)` | `T` | Create record |
| `update(id, data)` | `T` | Update record |
| `delete(id)` | `void` | Delete record |

### Domain-Specific Methods

```text
getByBusinessDate(date)     — Cash closing
listByTransactionIds(ids)   — Financial reversals
listForCommission(params)   — Commission calculation
```

### Barrel Exports

Barrel `index.ts` files are allowed but must be consumed. Dead barrels are removed.

## Consequences

- **Positive:** Consistent, predictable naming across all repositories
- **Positive:** Easy to find and understand any repository
- **Positive:** IDE autocompletion works reliably
- **Negative:** Renaming existing repositories requires updating all consumers
