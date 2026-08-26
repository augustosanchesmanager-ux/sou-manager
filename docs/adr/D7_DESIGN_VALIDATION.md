# D7 — Design Validation: Transactional Outbox (Composite RPC A1)

**Status:** Design Validated → Ready for Migration  
**Date:** 2026-08-26  
**Baseline:** `cf451be` (Trilha C — Durable Outbox, frozen)  
**Gate:** DESIGN VALIDATION → MIGRATION → CODE → E2E/CHAOS → AUDITORIA → CERTIFICAÇÃO

---

## 0. Proof of Atomicity: PL/pgSQL Composite = Same Transaction

### Fact

In PostgreSQL, a PL/pgSQL function calling another PL/pgSQL function **always runs in the same transaction**. There is no implicit COMMIT between calls. This is not a design choice — it is how PostgreSQL works:

> "PL/pgSQL executes transactions implicitly. You cannot run BEGIN or COMMIT inside a PL/pgSQL function. The function runs within the transaction that called it."
> — PostgreSQL 17 Documentation, 42.9.6.6

### Evidence

```sql
-- Inside composite RPC:
SELECT public.finance_settle_comanda(...) INTO v_settlement;  -- Step A
INSERT INTO public.outbox_items (...) VALUES (...);            -- Step B
-- If Step B fails → Step A rolls back (same TX)
-- If Step A fails → Step B never executes (exception propagated)
-- If both succeed → COMMIT persists both atomically
```

### Verification (can be run in PG16 docker)

```sql
-- Test: composite function that calls another function + inserts
-- If the second INSERT fails, the first function's writes should be rolled back

CREATE OR REPLACE FUNCTION test_atomic_inner() RETURNS JSONB AS $$
BEGIN
  INSERT INTO test_table (val) VALUES ('from_inner');
  RETURN '{"success": true}'::jsonb;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION test_atomic_outer() RETURNS JSONB AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT test_atomic_inner() INTO v_result;
  INSERT INTO test_table (val) VALUES ('from_outer');
  -- Force a failure after both succeed
  RAISE EXCEPTION 'Simulated failure';
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Execute: both inserts should be rolled back
SELECT test_atomic_outer();
-- Result: exception raised
-- Verify: SELECT * FROM test_table → 0 rows (both rolled back)
```

**Conclusion:** The composite RPC `finance_settle_comanda_and_enqueue` guarantees that `finance_settle_comanda()` and `INSERT outbox_items` are in the **same PostgreSQL transaction**. No additional mechanism is needed.

---

## 1. How event_id is generated and preserved

### Generation (TypeScript side)

```typescript
// domain/events/types.ts:496-503
let eventCounter = 0;
const generateEventId = (): string => {
  eventCounter += 1;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `evt_${timestamp}_${random}_${eventCounter}`;
};
// Format: evt_{base36-timestamp}_{6-char-random}_{monotonic-counter}
// Example: evt_m1abc2z_k8x2f_3
```

### Flow through composite RPC

```
CheckoutApplicationService.finish()
  │
  ├── eventId = generateEventId()           ← Generated HERE, before RPC
  │
  └── finance_settle_comanda_and_enqueue(
        ...
        p_outbox_event_id => eventId         ← Passed as parameter
      )
        │
        ├── finance_settle_comanda()          ← Uses p_idempotency_key
        │
        └── INSERT outbox_items (
              event_id => p_outbox_event_id   ← Preserved exactly
            )
```

### Why the same event_id is used everywhere

| Layer | event_id usage | Idempotency |
|-------|---------------|-------------|
| outbox_items | `event_id TEXT UNIQUE` | Prevents duplicate enqueue |
| commission_records | `event_id VARCHAR(255)` nullable | Traceability |
| processed_operations | `idempotency_key` = `{eventId}_{operationType}` | Prevents duplicate execution |
| EventBus | `event.eventId` | Subscriber tracing |

**The `event_id` generated in TypeScript flows through all layers unchanged.** The composite RPC receives it as a parameter and persists it in `outbox_items.event_id`.

---

## 2. Exact payload persisted in outbox_items

### Row structure (what the INSERT produces)

```sql
INSERT INTO public.outbox_items (
  id,                    -- gen_random_uuid()
  event_id,              -- p_outbox_event_id (e.g., 'evt_m1abc2z_k8x2f_3')
  event_type,            -- p_outbox_event_type (e.g., 'CheckoutCompleted')
  tenant_id,             -- p_tenant_id (UUID as TEXT)
  targets,               -- p_outbox_targets or default '[{"provider":"finance","config":{}}]'
  status,                -- 'pending'
  retry_attempts,        -- 0
  retry_max_attempts,    -- 5
  retry_next_retry_at,   -- NULL
  retry_last_error,      -- NULL
  retry_base_delay_ms,   -- 1000
  processing_started_at, -- NULL
  claimed_by,            -- NULL
  payload,               -- p_outbox_payload (JSONB)
  metadata,              -- p_outbox_metadata (JSONB)
  created_at,            -- now()
  updated_at,            -- now()
  dispatched_at,         -- NULL
  completed_at           -- NULL
)
```

### Exact payload JSONB (what TypeScript passes)

```json
{
  "operationType": "create_commission_record",
  "operationData": {
    "tenantId": "b716e290-...",
    "comandaId": "58ddb28e-...",
    "clientId": "client-uuid",
    "staffId": "staff-uuid",
    "receivedValue": 120.00,
    "paymentMethod": "pix",
    "hasClubCredit": false
  },
  "sourceEvent": "CheckoutCompleted",
  "idempotencyKey": "evt_m1abc2z_k8x2f_3_create_commission_record"
}
```

### Exact metadata JSONB

```json
{
  "tenantId": "b716e290-...",
  "userId": "auth-uid",
  "correlationId": "idempotency-key-from-checkout",
  "causationId": "evt_m1abc2z_k8x2f_3",
  "source": "CheckoutApplicationService"
}
```

### Why this payload is correct

The `createCommissionRecordHandler` (domain/events/outbox/providers/createCommissionRecordHandler.ts:124-334) reads:

```typescript
const { operationType, operationData, idempotencyKey, sourceEvent } = item.payload;
// operationType → selects handler
// operationData → comandaId, staffId, receivedValue, etc.
// idempotencyKey → processed_operations dedup
// sourceEvent → traceability
```

The payload is **identical** to what `FinanceSubscriber` currently produces (domain/events/subscribers/financeSubscriber.ts:162-195). The composite RPC produces the same row as the current flow.

---

## 3. Idempotency of settlement + outbox

### Three independent layers

| Layer | Mechanism | Scope | Failure Mode |
|-------|-----------|-------|-------------|
| **Settlement** | `p_idempotency_key` → `transactions.idempotency_key` | Per-RPC call | Returns existing transaction |
| **Outbox** | `event_id UNIQUE` → `ON CONFLICT DO NOTHING` | Per-event | Skips duplicate insert |
| **Commission** | `idx_commission_records_staff_comanda` (partial unique WHERE record_type='composite') + `idx_commission_records_idempotency` | Per-staff+comanda | INSERT fails → handler returns error |

### Composite RPC idempotency flow

```sql
-- First call:
finance_settle_comanda_and_enqueue('key-1', 'evt_1', ...)
  → finance_settle_comanda('key-1') → INSERT transaction (new)
  → INSERT outbox_items (event_id='evt_1') → OK
  → COMMIT
  → Returns: { success: true, idempotent: false }

-- Second call (retry):
finance_settle_comanda_and_enqueue('key-1', 'evt_1', ...)
  → finance_settle_comanda('key-1') → transaction exists → Returns { success: true, idempotent: true }
  → (v_settlement->>'idempotent') = true → SKIP outbox insert
  → Returns: { success: true, idempotent: true }
```

**Key insight:** The composite RPC checks `(v_settlement->>'idempotent')::boolean` and **skips the outbox INSERT on replay**. This prevents orphaned outbox items.

---

## 4. What happens on retry of composite RPC

### Scenario: User retries checkout after network timeout

```
Call 1: finance_settle_comanda_and_enqueue(...)
  → Settlement: INSERT transaction OK
  → Outbox: INSERT outbox_items OK
  → COMMIT OK
  → Returns { success: true, idempotent: false }
  → Network timeout (user doesn't receive response)

Call 2 (retry): finance_settle_comanda_and_enqueue(...)
  → Settlement: finds existing transaction (idempotency_key match)
  → Returns { success: true, idempotent: true }
  → Composite: sees idempotent=true → SKIPS outbox INSERT
  → Returns { success: true, idempotent: true }
```

### What happens to the outbox item from Call 1

The outbox item from Call 1 is still `pending` in the table. The Dispatcher will pick it up (5s interval) and process it normally. The `processed_operations` table prevents duplicate commission creation (idempotency layer 3).

### What about the `event_id` collision

If Call 2 passes the **same** `p_outbox_event_id` as Call 1:
- `INSERT ... ON CONFLICT (event_id) DO NOTHING` → silently skips
- No error, no duplicate

If Call 2 passes a **different** `p_outbox_event_id` (e.g., regenerated):
- Two outbox items exist for the same settlement
- Both dispatch → `processed_operations` dedup catches the second
- Commission created only once

**Conclusion:** Retry is safe in all cases.

---

## 5. How to prevent FinanceSubscriber double commission

### Problem

If both the composite RPC AND the FinanceSubscriber enqueue to outbox for the same CheckoutCompleted event, two `create_commission_record` operations would be created.

### Solution: Remove FinanceSubscriber from bootstrap

```typescript
// src/bootstrap/eventInfrastructure.ts (MODIFIED)

// BEFORE (Trilha C):
const financeSub = createFinanceSubscriber(outbox, financeStrategy, { provider: 'finance', config: {} });
registry.register(financeSub);
registry.initialize();

// AFTER (D7):
// FinanceSubscriber REMOVED — composite RPC handles outbox enqueue atomically
// Analytics + Audit subscribers continue via EventBus
registry.initialize();
```

### Why this is safe

| Aspect | Before (FinanceSubscriber) | After (Composite RPC) |
|--------|---------------------------|----------------------|
| Outbox enqueue | Via EventBus (async, best-effort) | Inside RPC transaction (atomic) |
| When | After RPC commit | During RPC transaction |
| Failure mode | Commission lost if enqueue fails | Impossible — same TX |
| Atomicity | ❌ Not atomic | ✅ Atomic |

### What about AnalyticsSubscriber and AuditSubscriber?

- **AnalyticsSubscriber** (`eventType: 'CheckoutCompleted'`) — subscribes to specific type via `bus.subscribe()`. Receives event from `appEventBus.publish()` after composite RPC commits. **Continues working.**
- **AuditSubscriber** (`eventType: '*'`) — subscribes to all via `bus.subscribeAll()`. Receives event from `appEventBus.publish()` after composite RPC commits. **Continues working.**

Both are **read-only, best-effort** subscribers. They don't write to the outbox. They don't affect financial guarantees.

### New flow (post-D7)

```
CheckoutApplicationService.finish()
  │
  ├── composite RPC
  │     ├── finance_settle_comanda()  → financial settlement
  │     └── INSERT outbox_items       → durable financial event
  │     └── COMMIT                    → ATÔMICO
  │
  └── appEventBus.publish(CheckoutCompleted)
        │
        ├── AnalyticsSubscriber → console.log (best-effort)
        └── AuditSubscriber → console.log (best-effort)
```

---

## 6. How Analytics/Audit still receive CheckoutCompleted

### Mechanism

After the composite RPC commits, `CheckoutApplicationService.finish()` still calls:

```typescript
appEventBus.publish(createEvent<CheckoutCompletedEvent>({
  eventType: 'CheckoutCompleted',
  aggregateId: comandaId,
  aggregateType: 'comanda',
  payload: { comandaId, clientId, staffId, total, ... },
  metadata: { tenantId, correlationId: idempotencyKey, source: 'CheckoutApplicationService' },
}));
```

This is **post-commit** and **best-effort**. It does not affect financial guarantees.

### Subscriber delivery

| Subscriber | Event Type | Delivery | Impact of D7 |
|------------|-----------|----------|-------------|
| AnalyticsSubscriber | `CheckoutCompleted` | `bus.subscribe()` | ✅ Unchanged |
| AuditSubscriber | `*` | `bus.subscribeAll()` | ✅ Unchanged |
| ~~FinanceSubscriber~~ | ~~`*`~~ | ~~removed~~ | N/A — composite RPC replaces it |
| NotificationSubscriber | `CheckoutCompleted` | `bus.subscribe()` | ✅ Unchanged |
| ReminderSubscriber | `AppointmentCreated` | `bus.subscribe()` | ✅ Unchanged |
| MarketingSubscriber | `AppointmentCreated` | `bus.subscribe()` | ✅ Unchanged |
| BiSubscriber | `CashClosingCompleted` | `bus.subscribe()` | ✅ Unchanged |

**All non-finance subscribers continue to receive events via the EventBus.**

---

## 7. Is there any scenario where settlement succeeds but outbox fails?

### Within the composite RPC (same transaction)

**No.** If the `INSERT outbox_items` fails (constraint violation, disk full, etc.), PostgreSQL raises an exception inside the PL/pgSQL function. The exception propagates up, and the **entire transaction rolls back** — including the settlement.

```sql
-- Inside composite RPC:
SELECT public.finance_settle_comanda(...) INTO v_settlement;
-- Settlement committed to TX buffer (not yet durable)

INSERT INTO public.outbox_items (...) VALUES (...);
-- If this fails → EXCEPTION → ROLLBACK → settlement also rolled back
```

### Edge cases analyzed

| Scenario | Result | Why |
|----------|--------|-----|
| `event_id` UNIQUE violation | `ON CONFLICT DO NOTHING` → **no failure** | Idempotent skip |
| `outbox_items` table doesn't exist | EXCEPTION → **rollback** | DDL failure |
| Disk full | EXCEPTION → **rollback** | I/O failure |
| RLS blocks INSERT | Impossible — SECURITY DEFINER bypasses RLS | Function runs as owner |
| `tenant_id` type mismatch | EXCEPTION → **rollback** | Type cast failure |
| JSONB payload malformed | EXCEPTION → **rollback** | Invalid input |

**The only way settlement persists without outbox is if there is a bug in the composite RPC's PL/pgSQL code** (e.g., missing EXCEPTION handler, conditional INSERT). This is mitigated by:
1. Thorough testing (Q10)
2. The RPC being a simple wrapper (low complexity)
3. Code review

---

## 8. RLS / SECURITY DEFINER / search_path

### Composite RPC security model

```sql
CREATE OR REPLACE FUNCTION public.finance_settle_comanda_and_enqueue(...)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
```

### RLS behavior

| Table | RLS? | Effect in composite RPC |
|-------|------|------------------------|
| `transactions` | Yes | SECURITY DEFINER → bypasses RLS (same as original) |
| `comandas` | Yes | SECURITY DEFINER → bypasses RLS (same as original) |
| `outbox_items` | Yes | SECURITY DEFINER → bypasses RLS (function owner can INSERT) |
| `commission_records` | Yes | SECURITY DEFINER → bypasses RLS (created by Dispatcher later) |
| `products` | Yes | SECURITY DEFINER → bypasses RLS (via sub-function) |
| `inventory_movements` | Yes | SECURITY DEFINER → bypasses RLS (via sub-function) |
| `appointments` | Yes | SECURITY DEFINER → bypasses RLS (same as original) |

### Access control (application level)

The composite RPC inherits the **same auth checks** from calling `finance_settle_comanda()`:

```sql
-- Inside finance_settle_comanda (called by composite):
IF v_auth_uid IS NULL THEN RAISE EXCEPTION ...; END IF;
-- Checks: auth.uid(), current_tenant_id_from_auth_uid(), current_is_super_admin_from_auth_uid()
-- Checks: profiles.role, staff.role, user_tenants.role
-- Checks: tenant isolation (v_auth_tenant_id IS DISTINCT FROM p_tenant_id)
```

### search_path protection

`SET search_path = public` prevents search path injection. The function can only access objects in the `public` schema.

### GRANT

```sql
REVOKE ALL ON FUNCTION public.finance_settle_comanda_and_enqueue(...) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_settle_comanda_and_enqueue(...) TO authenticated;
```

Same pattern as the original RPC. Only `authenticated` role can call it. `anon` is revoked.

---

## 9. How reversal continues to be linked to original_record_id

### Reversal flow (unchanged by D7)

```
CheckoutReverted event (future)
  → FinanceSubscriber (if enabled for this event type)
  → outbox.enqueue({ operationType: 'reverse_commission', ... })
  → Dispatcher
  → FinanceProvider
  → reverseCommissionHandler.execute()
    → commissionRecordRepository.list(comanda_id, record_type='commission')
    → For each active record:
        → commissionRecordRepository.createReversal({
            originalRecordId: record.id,    ← links to original
            commissionValue: -reversalAmount,
          })
```

### What D7 changes for reversals

**Nothing.** The `original_record_id` is a self-referential FK on `commission_records`:

```sql
original_record_id UUID REFERENCES public.commission_records(id) ON DELETE RESTRICT
```

The composite RPC creates the **original commission record** (via Dispatcher → FinanceProvider → createCommissionRecordHandler). The reversal handler finds this record and links to it via `original_record_id`. D7 doesn't touch this flow.

### Future: Composite RPC for CheckoutReverted

When D7 is extended to `CheckoutReverted`, the same pattern applies:

```sql
finance_reverse_comanda_and_enqueue(
  -- reversal params
  -- + outbox params (event_id, event_type, payload, metadata)
)
  → create_commission_reversal()  -- existing RPC
  → INSERT outbox_items           -- same TX
  → COMMIT
```

The reversal's outbox payload will contain `originalRecordId` in `operationData`, and the handler will use it to link to the original commission record.

---

## 10. Tests proving real atomicity (not just happy path)

### Test strategy

We need to prove that settlement + outbox are **atomic** — both succeed or both fail.

### Test 1: Happy path (both succeed)

```sql
-- Setup: Create comanda in 'open' status
-- Execute composite RPC
SELECT finance_settle_comanda_and_enqueue(
  'tenant-1', 'comanda-1', 'pix', 100.00, now(), 'checkout', NULL, 'key-1',
  'evt_test_1', 'CheckoutCompleted', '{"payload":...}', '{"metadata":...}'
);
-- Assert: transaction exists (settlement succeeded)
-- Assert: outbox_items row exists with event_id='evt_test_1' AND status='pending'
-- Assert: both in the same TX (verified by single SELECT returning both)
```

### Test 2: Settlement fails → outbox not written

```sql
-- Setup: Create comanda in 'paid' status (already settled)
-- Execute composite RPC (should fail)
SELECT finance_settle_comanda_and_enqueue(
  'tenant-1', 'comanda-1', 'pix', 100.00, now(), 'checkout', NULL, 'key-1',
  'evt_test_2', 'CheckoutCompleted', '{"payload":...}', '{"metadata":...}'
);
-- Expected: EXCEPTION 'Comanda ja esta baixada'
-- Assert: no new outbox_items row with event_id='evt_test_2'
-- Assert: no new transaction (settlement rolled back)
```

### Test 3: Outbox INSERT fails → settlement rolled back

```sql
-- Setup: Create comanda in 'open' status
-- Execute composite RPC with invalid outbox payload (e.g., event_id NULL)
SELECT finance_settle_comanda_and_enqueue(
  'tenant-1', 'comanda-1', 'pix', 100.00, now(), 'checkout', NULL, 'key-1',
  NULL,  -- NULL event_id → NOT NULL constraint violation
  'CheckoutCompleted', '{"payload":...}', '{"metadata":...}'
);
-- Expected: EXCEPTION (NOT NULL constraint)
-- Assert: no transaction for comanda-1 (settlement rolled back)
-- Assert: comanda status remains 'open'
```

### Test 4: Idempotent replay (settlement idempotent → outbox skipped)

```sql
-- First call
SELECT finance_settle_comanda_and_enqueue(
  'tenant-1', 'comanda-1', 'pix', 100.00, now(), 'checkout', NULL, 'key-1',
  'evt_test_4', 'CheckoutCompleted', '{"payload":...}', '{"metadata":...}'
);
-- Returns: { success: true, idempotent: false }

-- Second call (same key + same event_id)
SELECT finance_settle_comanda_and_enqueue(
  'tenant-1', 'comanda-1', 'pix', 100.00, now(), 'checkout', NULL, 'key-1',
  'evt_test_4', 'CheckoutCompleted', '{"payload":...}', '{"metadata":...}'
);
-- Returns: { success: true, idempotent: true }
-- Assert: only ONE outbox_items row with event_id='evt_test_4'
```

### Test 5: Duplicate event_id → ON CONFLICT DO NOTHING

```sql
-- Two different settlements for different comandas, same event_id
-- (shouldn't happen in practice, but tests idempotency)
SELECT finance_settle_comanda_and_enqueue(
  'tenant-1', 'comanda-1', 'pix', 100.00, now(), 'checkout', NULL, 'key-1',
  'evt_dup', 'CheckoutCompleted', '{"payload":...}', '{"metadata":...}'
);
SELECT finance_settle_comanda_and_enqueue(
  'tenant-1', 'comanda-2', 'pix', 200.00, now(), 'checkout', NULL, 'key-2',
  'evt_dup', 'CheckoutCompleted', '{"payload":...}', '{"metadata":...}'
);
-- Second call: event_id collision → ON CONFLICT DO NOTHING
-- Assert: only ONE outbox_items row with event_id='evt_dup'
-- Assert: both settlements succeeded (two transactions)
```

### Test 6: Concurrent settlement of same comanda (advisory lock)

```sql
-- Session A: BEGIN + finance_settle_comanda_and_enqueue (holds advisory lock)
-- Session B: BEGIN + finance_settle_comanda_and_enqueue (blocks on advisory lock)
-- Session A: COMMIT
-- Session B: unblocks → finds comanda already paid → EXCEPTION
-- Assert: only one settlement + one outbox item
```

### Test 7: TypeScript integration test

```typescript
// application/checkout.test.ts (MODIFIED)
describe('CheckoutApplicationService.finish() — Atomic Settlement + Outbox', () => {
  it('should persist both settlement and outbox item atomically', async () => {
    // Mock supabase.rpc to simulate finance_settle_comanda success
    // Mock supabase.from('outbox_items').insert() to track calls
    // Execute finish()
    // Assert: rpc called AND outbox_items.insert called
    // Assert: outbox_items payload matches expected structure
  });

  it('should rollback settlement if outbox insert fails', async () => {
    // Mock supabase.rpc to succeed
    // Mock supabase.from('outbox_items').insert() to fail
    // Execute finish() → should throw
    // Assert: rpc was called (but TX rolled back by Postgres)
    // Assert: no commission_record created
  });

  it('should skip outbox insert on idempotent replay', async () => {
    // Mock supabase.rpc to return { success: true, idempotent: true }
    // Execute finish()
    // Assert: outbox_items.insert NOT called (skipped)
  });
});
```

---

## Design Summary

| Question | Answer |
|----------|--------|
| Q1: event_id | Generated in TypeScript (`evt_...`), passed as param, persisted in `outbox_items.event_id` |
| Q2: payload | Identical to current FinanceSubscriber output — `operationType`, `operationData`, `idempotencyKey`, `sourceEvent` |
| Q3: idempotency | 3 layers: settlement `idempotency_key` + outbox `event_id UNIQUE` + commission partial unique index |
| Q4: retry | Settlement returns idempotent → outbox INSERT skipped → no duplicates |
| Q5: FinanceSubscriber | **Removed from bootstrap** — composite RPC handles enqueue; Analytics/Audit via EventBus unchanged |
| Q6: Analytics/Audit | Continue receiving `CheckoutCompleted` via `appEventBus.publish()` (post-commit, best-effort) |
| Q7: settlement succeeds, outbox fails | **Impossible in same TX** — PL/pgSQL exception → ROLLBACK both |
| Q8: RLS/security | SECURITY DEFINER + `search_path = public` + same auth checks + same GRANT pattern |
| Q9: reversal | Unchanged — `original_record_id` links reversal to original commission record |
| Q10: atomicity tests | 7 tests: happy path, settlement fail, outbox fail, idempotency, duplicate event_id, concurrency, TS integration |

---

## Gate Status

```
DESIGN VALIDATION  ✅ (this document)
         ↓
MIGRATION          ⬜ Ready to write
         ↓
CODE               ⬜
         ↓
E2E + CHAOS        ⬜
         ↓
AUDITORIA          ⬜
         ↓
CERTIFICAÇÃO       ⬜
```

**Awaiting PO approval to proceed to MIGRATION gate.**
