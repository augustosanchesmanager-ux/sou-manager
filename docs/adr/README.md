# Architecture Decision Records (ADRs)

This directory contains architectural decisions for the SOU MANA.GER project.

## Index

| ADR | Status | Theme |
|---|---|---|
| [ADR-001](./ADR-001-Commission-vs-Settlement.md) | Accepted | Commission vs Settlement |
| [ADR-011](./ADR-011-phase-6.0.3-scope-team-onboarding.md) | Accepted | Phase 6.0.3 scope — Team Onboarding & Invitations |
| [ADR-012](./ADR-012-rpc-execute-grants.md) | Accepted | RPC EXECUTE grants — least-privilege by default |

---

## About ADRs

An Architecture Decision Record captures a significant architectural decision along with its context and consequences. When a future maintainer wonders *why* something works the way it does, the ADR provides the answer.

### Format

Each ADR follows this structure:

- **Context** — What situation prompted the decision?
- **Problem** — What needed to be resolved?
- **Decision** — What was decided?
- **Alternatives Considered** — What other options were evaluated?
- **Consequences** — What are the trade-offs?
- **Status** — Proposed, Accepted, Deprecated, Superseded

### Adding a new ADR

1. Create a new file: `ADR-NNN-Title.md`
2. Follow the format above
3. Update this README index
4. Reference the ADR in relevant code files
