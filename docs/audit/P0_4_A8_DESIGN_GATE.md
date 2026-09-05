# P0.4-A8 — Recurring Bill Idempotency Design Gate

**Status:** DESIGN GATE — awaiting PO approval before implementation
**Parent:** P0.4-A8 Finding (`docs/audit/P0_4_A8_FINDING.md`)
**Predecessor:** A7 (one-time AP idempotency) — COMPLETE
**Date:** 2026-09-05

---

## 1. Problem Statement

Recurring bill creation performs a plain `INSERT` into `recurring_bills` with no idempotency protection. Under double-submit (rapid double-click), two identical records are created for a single user intention.

**Evidence:** E2E test `should_prevent_duplicate_recurring_bill_on_double_submit` (A7.1) uses route interception to fire two concurrent POST requests. Result: `count=2` vs `expected≤1`. Test intentionally FAILS as detector.

## 2. Scope

### In Scope
- UI guard (`isSubmitting`) on recurring bill creation
- Backend idempotency via RPC with key
- E2E concurrent tests verifying exactly 1 record

### Out of Scope (Explicit)
- Existing duplicate records in production (STOP — PO decision required)
- Recurring bill editing/deletion idempotency
- One-time AP (already handled by A7)
- TS pre-existing errors in `EventVersioningAdmin.tsx`
- H2-8 homologation test failures

## 3. Design

### 3.1 UI Layer

| Element | Behavior |
|---------|----------|
| `isSubmitting` state | Boolean, prevents double-submit |
| Submit button | Disabled while `isSubmitting=true` |
| Key lifecycle | Generated on modal open → reused on retry → discarded on success/cancel |
| Error handling | `extractError()` for PostgrestError messages |

**Pattern:** Same as A7 one-time AP widget (`components/AccountsPayableWidget.tsx`).

### 3.2 Backend Layer

#### Migration

```sql
-- 1. Add column (DEFAULT for backfill)
ALTER TABLE public.recurring_bills
  ADD COLUMN idempotency_key UUID DEFAULT gen_random_uuid();

-- 2. Make NOT NULL (backfill complete via DEFAULT)
ALTER TABLE public.recurring_bills
  ALTER COLUMN idempotency_key SET NOT NULL;

-- 3. Remove DEFAULT (future inserts require key)
ALTER TABLE public.recurring_bills
  ALTER COLUMN idempotency_key DROP DEFAULT;

-- 4. UNIQUE constraint
CREATE UNIQUE INDEX idx_recurring_bills_idempotency_key
  ON public.recurring_bills (tenant_id, idempotency_key);
```

#### RPC: `create_recurring_bill`

```sql
CREATE OR REPLACE FUNCTION public.create_recurring_bill(
  p_name TEXT,
  p_amount NUMERIC,
  p_due_day INTEGER,
  p_idempotency_key UUID,
  p_category TEXT DEFAULT 'Outros',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_existing RECORD;
  v_result RECORD;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key e obrigatorio';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant nao identificado';
  END IF;

  -- Lookup existing
  SELECT * INTO v_existing
  FROM public.recurring_bills
  WHERE tenant_id = v_tenant_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    -- Conflict check
    IF v_existing.name != p_name
       OR v_existing.amount != p_amount
       OR v_existing.due_day != p_due_day
       OR v_existing.category != p_category THEN
      RAISE EXCEPTION 'CONFLICT: idempotency_key ja existe com payload diferente';
    END IF;

    -- Same key + same payload → idempotent
    RETURN jsonb_build_object(
      'success', true,
      'id', v_existing.id,
      'created', false,
      'message', 'Recorrência já existe para esta chave de idempotência'
    );
  END IF;

  -- Insert (UNIQUE constraint catches race condition)
  BEGIN
    INSERT INTO public.recurring_bills (
      tenant_id, name, amount, due_day, category, notes,
      active, idempotency_key
    ) VALUES (
      v_tenant_id, p_name, p_amount, p_due_day, p_category, p_notes,
      true, p_idempotency_key
    )
    RETURNING * INTO v_result;

    RETURN jsonb_build_object(
      'success', true,
      'id', v_result.id,
      'created', true
    );
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_existing
      FROM public.recurring_bills
      WHERE tenant_id = v_tenant_id
        AND idempotency_key = p_idempotency_key;

      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing.id,
        'created', false,
        'message', 'Recorrência já existe (concorrência)'
      );
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_recurring_bill(
  TEXT, NUMERIC, INTEGER, UUID, TEXT, TEXT
) TO authenticated;
```

### 3.3 E2E Layer

| Test | Method | Assertion |
|------|--------|-----------|
| Double-click | Route interception (hold first POST) | Exactly 1 record in DB |
| RPC concurrency | `Promise.all` with same key via `fetch()` | One `created=true`, one `created=false`, same ID |
| DB persistence | Direct query after concurrent calls | `COUNT(*) = 1` |
| Retry after failure | Simulate timeout, retry with same key | Returns existing record |

**Cleanup:** Via service-role (Node side), not browser-side delete.

### 3.4 Repository/Service/Hook Changes

| File | Change |
|------|--------|
| `domain/accountsPayable/repository.ts` | Add `createRecurringBill` RPC call with `idempotency_key` |
| `domain/accountsPayable/service.ts` | Pass `idempotency_key` through creation flow |
| `hooks/useAccountsPayable.ts` | Accept `idempotency_key` param in `createRecurringBill` |
| `components/AccountsPayableWidget.tsx` | Add `isSubmitting` + `idempotencyKey` state to recurring bill handler |

## 4. Governance

| Rule | Status |
|------|--------|
| No production migration during design | ✅ |
| No manual writes | ✅ |
| No handling existing duplicates | ✅ |
| Implementation only after PO Approval | ⏳ BLOCKED |

## 5. Verification Criteria

| Criterion | How Verified |
|-----------|-------------|
| UI guard | Button disabled during submission |
| Idempotency key mandatory | `NOT NULL`, no DEFAULT after backfill |
| Same key + same payload | Returns existing record (`created=false`) |
| Same key + different payload | `CONFLICT` exception |
| Concurrency | Exactly 1 DB record after `Promise.all` |
| Race condition | UNIQUE constraint catches simultaneous inserts |
| E2E double-click | Deterministic test with route interception |
| E2E RPC concurrency | `Promise.all` + DB count = 1 |
| Production migration | Applied + verified (5/5 checks) |

## 6. Open Questions for PO

1. Should the RPC return `created=false` with the existing record (silent idempotent), or should it throw a user-facing error on duplicate?
2. Should the UNIQUE constraint be on `(tenant_id, idempotency_key)` or `(tenant_id, name, due_day)` (natural key)?
3. Is there a maximum retry count for the idempotency key lifecycle?

---

**Awaiting PO approval to proceed to implementation.**
