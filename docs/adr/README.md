# Architecture Decision Records (ADRs)

This directory contains architectural decisions for the SOU MANA.GER project.

## Index

| ADR | Status | Theme |
|---|---|---|
| [ADR-001](./ADR-001-Commission-vs-Settlement.md) | Accepted | Commission vs Settlement |
| [ADR-011](./ADR-011-phase-6.0.3-scope-team-onboarding.md) | Accepted | Phase 6.0.3 scope — Team Onboarding & Invitations |
| [ADR-012](./ADR-012-rpc-execute-grants.md) | Accepted | RPC EXECUTE grants — least-privilege by default |
| [ADR-013](./ADR-013-billing-tenant-featureflags.md) | Accepted | Billing × Tenant Lifecycle × Feature Flags — three decoupled contexts (6.0.5) |
| [ADR-014](./ADR-014-transactional-outbox.md) | Accepted | Transactional Outbox (D7) — atomicidade RPC + enqueue |
| [ADR-015](./ADR-015-pipeline-observability.md) | PRODUCTION CERTIFIED | Pipeline Financeiro — Observabilidade Crítica (PROD certified 2026-08-28) |
| [ADR-016](./ADR-016-dispatcher-server-side.md) | PRODUCTION CERTIFIED | Dispatcher Server-side — Autoridade de Processamento Assíncrono Multi-tenant (D8) (PROD certified 2026-08-28) |
| [ADR-017](./ADR-017-financial-vs-operational-cycle.md) | Accepted | Ciclo Operacional × Ciclo Financeiro — Pagamento Antecipado e Atendimento Independente (G0 2026-08-29) |
| [ADR-018](./ADR-018-payment-contract.md) | Accepted | Contrato de Pagamento — `payment_type` + Tabela `comanda_payments` (G0 2026-08-29) |
| [ADR-019](./ADR-019-role-authorization.md) | Accepted | Autorização por Papel — Menor Privilégio em Operações Financeiras e Operacionais (G0 2026-08-29) |
| [ADR-020](./ADR-020-attended-at-backfill.md) | Accepted | Estratégia de `attended_at` — Atendimento Realizado e Política de Backfill (G0 2026-08-29) |
| [ADR-021](./ADR-021-rpc-tenant-scoped-authorization.md) | Accepted | Autorização Tenant-Scoped em RPCs — Correção do Finding Crítico FASE 3 (P4/P5/P7) (2026-09-01) |

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
