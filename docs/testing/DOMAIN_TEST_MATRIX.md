# Domain Test Matrix

> Critérios de sucesso da Fase 3: "Posso alterar qualquer regra financeira sem medo de quebrar o restante do sistema?"

## Coverage Targets

| Layer | Target |
|-------|-------:|
| Domain | 100% |
| Application Services | 90–95% |
| Repositories | 85–90% |
| UI | Apenas fluxos críticos (E2E) |

---

## P0 — Financeiro (100% cobertura)

### domain/commission/calculate.ts

| Function | Cases | Status |
|----------|-------|--------|
| `resolveCommissionBase` | unit_price, price, amount/quantity, amount, none, zero values | ✅ |
| `calculateParticipantPayout` | percentage, fixed, affects_commission=false, quantity>1, rate normalization | ✅ |
| `calculateParticipantBaseValue` | percentage, fixed, rate normalization | ✅ |
| `calculateTotalPayouts` | mixed participants, empty, all non-commissionable | ✅ |
| `calculateCommissionValue` | percentage, fixed, affects_commission=false, rate normalization | ✅ |
| `isCommissionEligible` | barber, seller, manager, null, case insensitive | ✅ |
| `getEffectiveRate` | eligible, non-eligible, rate normalization | ✅ |
| `getDefaultRateForRole` | barber, seller, manager, unknown | ✅ |

### domain/commission/participants.ts

| Function | Cases | Status |
|----------|-------|--------|
| `isSharedExecution` | empty, single 100%, single partial, multiple, non-commissionable | ✅ |
| `buildSoloParticipant` | creates 100% primary | ✅ |
| `hasPartialSavedPayout` | non-commissionable, partial, 100%, 0% | ✅ |
| `buildInferredPrimaryParticipant` | remaining>0, no remaining, no eligible staff | ✅ |
| `normalizeCommissionParticipants` | no raw, no staff, dedup, filter non-eligible, shared detection | ✅ |
| `getPrimaryParticipant` | finds primary, ignores non-commissionable | ✅ |
| `getAssistantParticipants` | assistants+co_executors, excludes non-commissionable | ✅ |

### domain/commission/format.ts

| Function | Cases | Status |
|----------|-------|--------|
| `formatParticipantPayout` | percentage, fixed, 100%, zero, alias | ✅ |
| `formatSavedPayout` | alias for formatParticipantPayout | ✅ |
| `formatPayoutValue` | zero, positive | ✅ |
| `formatRatePercent` | 0%, 50%, 100%, integer over 1 | ✅ |

### Additional Commission Cases (need expansion)

| Case | Priority | Status |
|------|----------|--------|
| Split 33/33/34 rounding | P0 | ⬜ |
| Payout > service value | P0 | ⬜ |
| Negative values rejected | P0 | ⬜ |
| Duplicate participants | P0 | ⬜ |
| Commission 0% | P0 | ⬜ |
| Commission 100% | P0 | ⬜ |

**Commission domain coverage: 62 tests** ✅

---

## P0 — ChefClub

**ChefClub domain coverage: 73 tests** ✅

### domain/chefClub/credits.ts

| Function | Cases | Status |
|----------|-------|--------|
| `normalizePlanServiceCredits` | array, object, legacy scalar, empty, camelCase | ✅ |
| `normalizeCreditBalances` | array, object, legacy scalar, empty | ✅ |
| `normalizeServiceBalanceEntry` | valid, non-record, no service_id, zero both | ✅ |
| `getTotalPlannedCredits` | multiple entries, empty | ✅ |
| `getTotalAvailableCredits` | multiple entries, empty | ✅ |
| `getTotalUsedCredits` | multiple entries, empty | ✅ |
| `getAvailableCreditsForService` | exact match, fallback to generic, no match | ✅ |
| `getPlanCreditsForService` | exact match, fallback to generic | ✅ |
| `buildServiceBalancesFromPlan` | converts, filters 0 credits | ✅ |
| `canApplyCredit` | available, insufficient, no match, zero | ✅ |

### domain/chefClub/cycle.ts

| Function | Cases | Status |
|----------|-------|--------|
| `isCycleDateValid` | future, past, same, null, invalid | ✅ |
| `isFutureOrOpenDate` | future, past, null, undefined, invalid | ✅ |
| `isCycleActive` | active, past end, future start, null start/end | ✅ |
| `daysRemainingInCycle` | future, past, null, invalid | ✅ |

### domain/chefClub/validation.ts

| Function | Cases | Status |
|----------|-------|--------|
| `isTerminalStatus` | canceled, active, paused, past_due | ✅ |
| `isCreditOperableStatus` | active, past_due, paused, canceled | ✅ |
| `isReceivableGenerableStatus` | active, past_due, paused, canceled | ✅ |
| `validateStatusTransition` | same, active→paused, active→canceled, past_due→*, paused→*, canceled→*, invalid | ✅ |

---

## P0 — CashClosing

**CashClosing coverage: 33 tests (25 pure + 8 application) ** ✅

### application/cashClosing/summary.ts

| Function | Cases | Status |
|----------|-------|--------|
| `calculateTotals` | empty, entries only, extras only, combined | ✅ |
| `validate` | exact, tolerance, mismatch positive, mismatch negative | ✅ |

### components/financial/cashCloseUtils.ts (pure functions)

| Function | Cases | Status |
|----------|-------|--------|
| `validateCashClose` | exact, tolerance, outside tolerance, negative | ✅ |
| `buildBarberSummaries` | solo, shared split, open/paid separation, empty | ✅ |
| `buildPaymentMethodRows` | single method, multiple methods, ignores exits, missing method | ✅ |
| `buildAttendancesByBarber` | multiple barbers, stats calculation | ✅ |
| `buildOpenComandasSummary` | filtered, sorted, empty | ✅ |
| `isFrontlineRole` | barber, manager, receptionist, empty, unknown | ✅ |
| `filterEntries` | no filters, operatorId, showOnlyOpenComandas, onlyClubMembers, combined | ✅ |

---

## P1 — Appointment

### domain/appointment/

| Function | Cases | Status |
|----------|-------|--------|
| Repository methods | list, get, update, cancel | ⬜ (mock-based) |

### Key flows to test (via application service or E2E)

| Flow | Priority | Status |
|------|----------|--------|
| Conflict detection | P1 | ⬜ |
| Overbook prevention | P1 | ⬜ |
| Drag & drop reschedule | P1 | ⬜ |
| Cancel cascade | P1 | ⬜ |
| Split services | P1 | ⬜ |

---

## P1 — Checkout Flags

| Flag Combination | Priority | Status |
|------------------|----------|--------|
| paymentStatus (paid, pending, cancelled) | P1 | ⬜ |
| closureMode (legacy_membership, manual, audit) | P1 | ⬜ |
| club credits applied | P1 | ⬜ |
| zero checkout | P1 | ⬜ |
| legacy settlement | P1 | ⬜ |
| audit settlement | P1 | ⬜ |

---

## Test Infrastructure

- Framework: **Vitest** (configured)
- Run: `npm run test`
- Domain tests: `domain/**/*.test.ts` (62 commission + 73 chefClub = 135)
- Application/pure tests: `application/**/*.test.ts` + `components/**/*.test.ts` (8 + 25 = 33)
- **Total domain + pure tests: 168** ✅
- Service tests: `application/**/*.test.ts` (Phase 3.2)
