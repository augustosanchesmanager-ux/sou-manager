# Service Test Matrix

> Fase 3.2 — Application Services Tests. Focus: scenario-based testing (checkout flows, rollback, idempotency, errors).

## Coverage Target

| Layer | Target |
|-------|-------:|
| Application Services | 90–95% |

## Testing Strategy

Application service tests focus on **scenarios and workflows**, not individual function unit tests (those belong in domain tests). Each service requires:

1. **Happy-path scenario** — end-to-end flow through the service
2. **Error/edge cases** — identified from `AGENTS.md` forensic checklist and code review
3. **Rollback behavior** — multi-step operations with partial failure
4. **Idempotency** — where applicable (checkout, subscriptions)

Services are tested via **mocked repositories** (not Supabase). Domain logic is NOT re-tested here (covered by domain tests).

---

## P0 — Checkout (`application/checkout.ts`)

**Risk**: Financial settlement, comanda lifecycle, idempotency
**Strategy**: Mock `comandaRepository`, `settleCheckoutComanda`, `supabase.from()`

### `computeCheckoutFlags` (pure — no mocks needed)

| Scenario | Priority | Status |
|----------|----------|--------|
| pdv paid, normal checkout | P0 | ✅ |
| open_comanda paid, normal | P0 | ✅ |
| edit_comanda paid, normal | P0 | ✅ |
| zero-amount + club_credit | P0 | ✅ |
| zero-amount + house_courtesy | P0 | ✅ |
| zero-amount + administrative_adjustment | P0 | ✅ |
| legacy_membership + manager permission | P0 | ✅ |
| legacy_membership + no permission → blocked | P0 | ✅ |
| isZeroAuditSettlement = true (non-legacy zero) | P0 | ✅ |
| shouldApplyFinancialEffects = false (legacy) | P0 | ✅ |
| showPaymentMethod = false (zero-paid) | P0 | ✅ |

### `validateFinishRequest` (pure)

| Scenario | Priority | Status |
|----------|----------|--------|
| valid pdv request | P0 | ✅ |
| missing comandaId on edit → error | P0 | ✅ |
| legacy without permission → error | P0 | ✅ |
| legacy without referenceMonth → error | P0 | ✅ |
| club_credit without chefClubInfo → error | P0 | ✅ |
| house_courtesy without reason → error | P0 | ✅ |

### `finish` (orchestrator — mock all dependencies)

| Scenario | Priority | Status |
|----------|----------|--------|
| pdv: create comanda → items → settle → done | P0 | ✅ |
| open_comanda: update → items → participants → settle | P0 | ✅ |
| edit_comanda: update existing → sync items → settle | P0 | ✅ |
| concurrency: comanda no longer open → CheckoutError | P0 | ✅ |
| item sync failure → rollback restores backup | P0 | ✅ |
| rollback failure → fatal error thrown | P0 | ✅ |
| idempotency: 23505 → finds existing comanda | P0 | ✅ |
| zero-amount paid → closeZeroAmount path | P0 | ✅ |
| legacy_membership → zero close + audit note | P0 | ✅ |
| participant insert failure → warning logged, checkout succeeds | P1 | ✅ |

---

## P0 — CashClosing (`application/cashClosing/`)

**Risk**: Financial close, discrepancy detection, barber-level settlement

### `operations.ts` — mutation operations

| Scenario | Priority | Status |
|----------|----------|--------|
| openCashRegister: new → creates draft | P0 | ✅ |
| openCashRegister: existing → upserts, preserves data | P0 | ✅ |
| closeCashRegister: persists extras → confirms | P0 | ✅ |
| closeCashRegister: extra persist fails → aborts | P0 | ✅ |
| closeBarberCash: exact match → status=closed | P0 | ✅ |
| closeBarberCash: discrepancy > 0.01 → status=discrepancy | P0 | ✅ |
| closeBarberCash: recomputes closings_complete | P1 | ✅ |
| saveDraftConference: upserts draft data | P1 | ✅ |
| recordEvent: fire-and-forget, never throws | P1 | ✅ |

### `loaders.ts` — data loading

| Scenario | Priority | Status |
|----------|----------|--------|
| loadDailySnapshot: parallel queries → aggregated maps | P0 | ✅ |
| loadDailySnapshot: reversals query fails → returns [] | P1 | ✅ |
| getDayRange: pure, correct ISO boundaries | P1 | ✅ |

### `summary.ts` (pure — extends existing 8 tests)

| Scenario | Priority | Status |
|----------|----------|--------|
| computeDaySummary: full day with all data | P0 | ✅ |
| computeDaySummary: empty day → defaults | P1 | ✅ |
| computeDaySummary: mixed payment methods | P1 | ✅ |
| computeDaySummary: timeline with reversals | P1 | ✅ |

---

## P0 — Commission (`application/commission.ts`)

**Risk**: Commission calculation accuracy, 4-phase pipeline, CSV export

### `loadCommissionLines` (4-phase pipeline)

| Scenario | Priority | Status |
|----------|----------|--------|
| happy path: staff + comandas + items + participants → lines | P0 | ✅ |
| date range filtering excludes out-of-range | P0 | ✅ |
| invalid production date (NaN) → excluded silently | P0 | ✅ |
| no participants → solo fallback created | P0 | ✅ |
| non-commissionable staff → excluded from lines | P0 | ✅ |
| mixed payout types (percentage + fixed) in same comanda | P0 | ✅ |
| hidden comandas → excluded | P1 | ✅ |

### `groupByProfessional`

| Scenario | Priority | Status |
|----------|----------|--------|
| groups by professional ID | P0 | ✅ |
| confirmed vs pending vs cancelled buckets | P0 | ✅ |
| sorted by totalCommission descending | P0 | ✅ |
| empty input → empty array | P1 | ✅ |

### `summarize`

| Scenario | Priority | Status |
|----------|----------|--------|
| aggregates from grouped rows | P0 | ✅ |
| total commission, confirmed, pending | P0 | ✅ |

### `exportToCsv`

| Scenario | Priority | Status |
|----------|----------|--------|
| produces BOM + semicolons | P0 | ✅ |
| 22 columns per row | P1 | ✅ |
| handles missing staff gracefully | P1 | ✅ |

---

## P0 — Appointment (`application/appointment/`)

**Risk**: Scheduling correctness, conflict detection, cascade effects

### `lifecycle.ts`

| Scenario | Priority | Status |
|----------|----------|--------|
| create: single service → RPC create_appointment_with_comanda | P0 | ✅ |
| create: multi service → RPC create_appointment_with_services | P0 | ✅ |
| create: RPC failure → RPC_ERROR | P0 | ✅ |
| create: returns correct shape from RPC result | P0 | ✅ |
| create: defaults when RPC result missing fields | P1 | ✅ |
| create: includes isOverbooked for single service | P1 | ✅ |
| update: syncs staff_id to open comandas | P0 | ✅ |
| update: comanda sync failure → caught, no throw | P1 | ✅ |
| update: skips comanda sync when no staff_id | P1 | ✅ |
| cancel: sets status to no_show when no_show type | P0 | ✅ |
| cancel: sets status to cancelled for other types | P0 | ✅ |
| cancel: sets hidden_from_schedule for registration_error/test | P0 | ✅ |
| cancel: cancels open comandas | P0 | ✅ |
| cancel: comanda cancel failure → caught, no throw | P1 | ✅ |
| cancel: includes cancellation_reason in payload | P1 | ✅ |
| resolveFinalPrice: no promotion → returns DB price | P0 | ✅ |
| resolveFinalPrice: no DB price → returns basePrice | P1 | ✅ |
| resolveFinalPrice: fixed discount → subtracts, floors at 0 | P0 | ✅ |
| resolveFinalPrice: percentage discount → calculates correctly | P0 | ✅ |
| resolveFinalPrice: target_type service matches only target_id | P0 | ✅ |
| resolveFinalPrice: target_type all always matches | P0 | ✅ |
| resolveFinalPrice: first matching promotion wins | P1 | ✅ |

### `movement.ts`

| Scenario | Priority | Status |
|----------|----------|--------|
| changeStatus: valid transition → success | P0 | ✅ |
| changeStatus: from cancelled → blocked | P0 | ✅ |
| changeStatus: from no_show → blocked | P0 | ✅ |
| changeStatus: appointment not found → NOT_FOUND | P0 | ✅ |
| reschedule: updates appointment + comandas | P0 | ✅ |
| reschedule: comanda sync failure → caught, no throw | P1 | ✅ |
| checkTimeConflict: overlapping → true | P0 | ✅ |
| checkTimeConflict: no overlap → false | P0 | ✅ |
| checkTimeConflict: excludes given appointment | P0 | ✅ |
| checkTimeConflict: excludes cancelled/no_show | P0 | ✅ |

---

## P0 — ChefClub (`application/chefClub/`)

**Risk**: Credit deduction, subscription lifecycle, receivable management

### `credits.ts`

| Scenario | Priority | Status |
|----------|----------|--------|
| resolveSubscription: active sub + valid cycle + paid receivable → OK | P0 | ✅ |
| resolveSubscription: no subscription → null | P0 | ✅ |
| resolveSubscription: expired cycle → null | P0 | ✅ |
| resolveSubscription: no paid receivable → null | P0 | ✅ |
| getAvailableCredits: exact service match | P0 | ✅ |
| getAvailableCredits: fallback to generic | P0 | ✅ |
| hasAvailableCredits: some remaining → true | P0 | ✅ |
| hasAvailableCredits: all zero → false | P0 | ✅ |
| deductCredits: RPC success | P0 | ✅ |
| deductCreditsBatch: all succeed → {success: N, failed: 0} | P0 | ✅ |
| deductCreditsBatch: partial failure → {success, failed} | P0 | ✅ |

### `subscriptions.ts`

| Scenario | Priority | Status |
|----------|----------|--------|
| createSubscription: RPC call | P0 | ✅ |
| updateStatus: valid transition → updates | P0 | ✅ |
| updateStatus: invalid transition → throws | P0 | ✅ |
| changePlan: updates plan_id | P0 | ✅ |
| updateBillingDate: sets date + cycle_end (+30) | P0 | ✅ |
| updateCreditMap: recalculates totals | P0 | ✅ |
| updateCreditMap: empty array → zeros | P1 | ✅ |

### `receivables.ts`

| Scenario | Priority | Status |
|----------|----------|--------|
| loadReceivablePage: generate + load + reference data | P0 | ✅ |
| canPayReceivable: pending → true | P0 | ✅ |
| canPayReceivable: paid → false | P0 | ✅ |
| getDisplayStatus: overdue detection | P0 | ✅ |
| filterReceivables: text search across client/plan | P1 | ✅ |
| computeReceivableTotals: aggregates by status | P0 | ✅ |

### `operations.ts`

| Scenario | Priority | Status |
|----------|----------|--------|
| activatePlan: create sub + generate receivables | P0 | ✅ |
| activatePlan: generate fails → sub exists, no receivables | P0 | ✅ |
| settleReceivable: pay + regenerate | P0 | ✅ |
| pauseSubscription → paused | P0 | ✅ |
| resumeSubscription → active | P0 | ✅ |
| cancelSubscription → canceled | P0 | ✅ |

### `loaders.ts`

| Scenario | Priority | Status |
|----------|----------|--------|
| resolveMembershipContext: 6-step full flow | P0 | ✅ |
| resolveMembershipContext: expired cycle → error | P0 | ✅ |
| computePlanSummary: aggregates active plans | P1 | ✅ |

---

## P1 — ScheduleBlock (`application/scheduleBlock.ts`)

**Risk**: Schedule conflict detection, cascade cancel

| Scenario | Priority | Status |
|----------|----------|--------|
| validateBlock: valid full_day → passes | P1 | ⬜ |
| validateBlock: time_range without times → error | P1 | ⬜ |
| validateBlock: weekly without single day → error | P1 | ⬜ |
| checkConflicts: overlapping block → conflict | P1 | ⬜ |
| checkConflicts: no overlap → clear | P1 | ⬜ |
| saveBlock: create → persisted | P1 | ⬜ |
| saveBlock: cascade cancel → appointments cancelled | P1 | ⬜ |
| saveBlock: partial cascade cancel → some succeed, some warn | P2 | ⬜ |
| findImpactedAppointments: filters by professional | P1 | ⬜ |
| deleteBlock: removes block | P1 | ⬜ |

---

## Test Infrastructure

- Framework: **Vitest** (configured)
- Run: `npm run test`
- Service tests: `application/**/*.test.ts`
- Mocking strategy: `vi.mock()` for repository modules, `vi.fn()` for Supabase client
- Domain tests (168) remain untouched by service tests
- Service tests: Checkout (45) + CashClosing (38) + Appointment (51) + Commission (30) + ChefClub (54) = **218 total**
- **Grand total: 386 tests across 13 files, all passing**
