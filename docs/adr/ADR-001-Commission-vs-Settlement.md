# ADR-001 — Commission vs Settlement

**Status:** Accepted
**Date:** 2026-07-23
**Author:** SMG Engineering

---

## Context

The system calculates financial values for professionals in two distinct contexts:

1. **Commission Dashboard** — shows how much each professional earned in commission based on service execution.
2. **Cash Closing (Fechamento de Caixa)** — calculates the effective financial payout during the daily cash closing.

These two calculations use different data sources, different rules, and answer different business questions.

## Problem

In many systems, these two concepts are conflated — leading to bugs where one calculation is mistakenly replaced by the other. The team identified that:

- `domain/commission/` calculates theoretical commission using `service_execution_participants`, participant splits, `affects_commission`, `commission_rate`, and `resolveCommissionBase()`.
- `application/cashClosing/summary.ts` calculates effective settlement using `totalReceived`, discounts, advances, reversals, and cash closing operational rules.

These are **intentionally different algorithms**. They produce different numbers for the same professional on the same day — and both are correct.

## Decision

**Commission and Settlement are intentionally separate domains.**

### Commission Domain (`domain/commission/`)

- Calculates **theoretical commission** generated from service execution.
- Uses: `service_execution_participants`, participant splits, `affects_commission`, `commission_rate`, `resolveCommissionBase()`.
- Answers: *"How much commission did this professional generate by executing services?"*

### Cash Closing / Settlement (`application/cashClosing/`)

- Calculates **effective financial payout** during the daily cash closing.
- Uses: total received, discounts, advances, reversals, payment methods, operational cash rules.
- Answers: *"How much will be paid to this professional in the financial closing?"*

### Example

| Scenario | Commission | Settlement |
|---|---|---|
| Service: R$100, Split: A=70%, B=30% | A=R$28, B=R$12 | A=R$24, B=R$10 |

Both are correct. They answer different questions.

The settlement may differ due to: discounts, reversals, defaults, courtesy, deferred payments, advances, rounding.

## Alternatives Considered

### Alternative 1: Unify into single calculation

Replace CashClosing commission logic with domain commission logic.

**Rejected** because:
- CashClosing operates on cash events (entries, exits, advances, reversals), not on service execution.
- Commission rules (splits, rates) don't account for financial adjustments.
- Unifying would lose important financial context (discounts, reversals) from the settlement.
- Would break existing cash closing reports that operators rely on.

### Alternative 2: Keep separate with shared helpers

Use domain commission functions where possible, keep CashClosing-specific logic where needed.

**Partially adopted** — shared utilities (`formatCurrency`, `normalizePercentage`) are reused, but the core algorithms remain separate.

## Consequences

- **Positive:** Each domain evolves independently. Commission rules change without affecting cash closing. Cash closing adjustments don't corrupt commission data.
- **Positive:** Clear separation of concerns makes the system easier to reason about and maintain.
- **Positive:** Prevents accidental "unification" refactors that would break financial reports.
- **Negative:** Two different commission numbers exist in the system. Operators must understand which number answers which question.
- **Mitigation:** This ADR, inline code comments, and clear UI labeling distinguish "Comissão" from "Repasse".

## References

- `domain/commission/calculate.ts` — Theoretical commission formulas
- `domain/commission/participants.ts` — Participant resolution logic
- `application/cashClosing/summary.ts` — Settlement calculations
- `components/financial/cashCloseUtils.ts` — Cash closing utilities
