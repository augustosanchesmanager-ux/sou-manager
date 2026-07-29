# ADR-010: Architecture Guards

**Status:** Accepted  
**Date:** 2026-07-24  
**Deciders:** SMG Engineering

## Context

Architecture rules documented in ADRs can be forgotten or violated accidentally as the codebase grows.

## Decision

Automated architecture guards prevent regressions.

### Guards

| Guard | Purpose | Command |
|-------|---------|---------|
| Repository Guard | No `.from('table')` in UI layers | `guard-repository.mjs` |
| Forbidden Imports | No Component→Supabase, Domain→UI | `guard-imports.mjs` |
| Circular Imports | No circular dependencies | `guard-circular.mjs` |

### Baseline Mode

```bash
npm run architecture:baseline    # Compare against baseline
npm run architecture:strict      # Fail on any violation
npm run architecture:ci          # CI mode with baseline
```

### Baseline File

```json
{
  "repositoryViolations": 233,
  "forbiddenImports": 0,
  "circularImports": 0
}
```

Violations must not increase. Improvements decrease the baseline.

### CI Integration

```yaml
# In CI pipeline
- run: npm run architecture:ci
```

## Consequences

- **Positive:** Architecture rules are enforced automatically
- **Positive:** Baseline tracks technical debt over time
- **Positive:** New code cannot introduce new violations
- **Negative:** Guards add CI execution time (~2s)
- **Negative:** False positives possible for edge cases (e.g., `Array.from()`)
