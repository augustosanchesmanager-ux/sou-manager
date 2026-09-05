# P0.4-A8 — Recurring Bill Creation Lacks Idempotency Protection

**Status:** IDENTIFIED → BLOCKED (awaiting PO authorization)
**Severity:** Alta — domínio financeiro, duplicação de obrigação recorrente
**Discovered:** 2026-09-05, during A7.1 test stabilization

## Description

Recurring bill creation (`createRecurringBill`) performs a plain `INSERT` into `recurring_bills` with no idempotency key, no `isSubmitting` UI guard, and no backend RPC with race-condition handling.

Under double-submit (rapid double-click), **two identical records are created**.

## Evidence

E2E test `should_prevent_duplicate_recurring_bill_on_double_submit` uses Playwright route interception to fire two concurrent POST requests to `recurring_bills`. Result:

```
expected: ≤ 1 record
actual:   2 records
→ TEST FAIL (intentional detector)
```

The test previously failed with a flaky DOM error ("element detached"), masking the real behavior. After stabilization (route interception), the test is deterministic and exposes the actual gap.

## Gap Analysis

| Layer | A7 (one-time AP) | Recurring Bill |
|-------|-------------------|----------------|
| UI guard | `isSubmitting` disables button | None |
| Idempotency key | UUID, mandatory, UNIQUE constraint | None |
| Backend | RPC with key lookup + race handler | Plain `INSERT` |
| E2E verification | Double-click + RPC concurrency + DB count | Route interception + DB count (FAILS) |

## Proposed Fix (future A8)

1. UI: `isSubmitting` guard on recurring bill handler
2. Backend: idempotency key per creation intent
3. RPC: idempotent insert with race-condition handler
4. E2E: concurrent test verifying exactly 1 record persisted

## Blocker

Requires PO authorization. Not an automatic extension of A7.
