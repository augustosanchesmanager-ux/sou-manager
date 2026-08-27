-- ============================================================
-- 20260827000000_transactional_outbox_composite_rpc.sql
-- D7: Transactional Outbox — Composite RPC (A1).
--
-- Creates finance_settle_comanda_and_enqueue() which wraps:
--   1. finance_settle_comanda()  — existing settlement (UNTOUCHED)
--   2. INSERT outbox_items       — durable financial event
-- Both execute in the SAME PostgreSQL transaction (atomic).
--
-- If settlement fails → both rollback.
-- If settlement succeeds but outbox INSERT fails → both rollback.
-- If both succeed → COMMIT persists both atomically.
-- If settlement is idempotent → outbox INSERT is skipped.
--
-- Trilha C baseline (cf451be) preserved: outbox_items table,
-- RLS policies, and indexes are NOT modified.
--
-- finance_settle_comanda (migration 20260602031543) is NOT modified.
-- ============================================================

BEGIN;

-- ── Composite RPC ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.finance_settle_comanda_and_enqueue(
  -- Settlement params (identical to finance_settle_comanda)
  p_tenant_id          UUID,
  p_comanda_id         UUID,
  p_payment_method     TEXT,
  p_paid_amount        NUMERIC,
  p_payment_date_real  TIMESTAMPTZ DEFAULT now(),
  p_source             TEXT DEFAULT 'checkout',
  p_notes              TEXT DEFAULT NULL,
  p_idempotency_key    TEXT DEFAULT NULL,
  -- Outbox params (new)
  -- DEFAULT NULL required: PostgreSQL mandates all params after a DEFAULT also have defaults
  p_outbox_event_id    TEXT DEFAULT NULL,
  p_outbox_event_type  TEXT DEFAULT NULL,
  p_outbox_payload     JSONB DEFAULT NULL,
  p_outbox_metadata    JSONB DEFAULT NULL,
  p_outbox_targets     JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settlement JSONB;
  v_targets    JSONB;
BEGIN
  -- ── Step 1: Execute original settlement ──
  -- finance_settle_comanda is INTACT. Same transaction.
  -- If this fails, EXCEPTION propagates → ROLLBACK (nothing persisted).
  SELECT public.finance_settle_comanda(
    p_tenant_id,
    p_comanda_id,
    p_payment_method,
    p_paid_amount,
    p_payment_date_real,
    p_source,
    p_notes,
    p_idempotency_key
  ) INTO v_settlement;

  -- ── Step 2: Verify settlement succeeded ──
  IF v_settlement IS NULL THEN
    RAISE EXCEPTION 'finance_settle_comanda returned NULL';
  END IF;

  IF NOT (v_settlement->>'success')::boolean THEN
    -- Settlement failed — propagate error, outbox NOT written
    RETURN v_settlement;
  END IF;

  -- ── Step 3: Idempotent replay → skip outbox ──
  -- If settlement was idempotent, the outbox item already exists
  -- from the original call. No duplicate needed.
  IF (v_settlement->>'idempotent')::boolean THEN
    RETURN v_settlement;
  END IF;

  -- ── Step 4: Enqueue to outbox (same transaction) ──
  -- ON CONFLICT (event_id) DO NOTHING: if event_id already exists,
  -- silently skip. This is safe because:
  --   - Same event_id → same event → already enqueued
  --   - Different settlement with same event_id shouldn't happen
  --     (generateEventId is unique per call)
  v_targets := COALESCE(
    p_outbox_targets,
    '[{"provider":"finance","config":{}}]'::jsonb
  );

  INSERT INTO public.outbox_items (
    event_id,
    event_type,
    tenant_id,
    targets,
    status,
    payload,
    metadata,
    retry_attempts,
    retry_max_attempts,
    retry_base_delay_ms,
    created_at,
    updated_at
  ) VALUES (
    p_outbox_event_id,
    p_outbox_event_type,
    p_tenant_id::text,
    v_targets,
    'pending',
    p_outbox_payload,
    p_outbox_metadata,
    0,
    5,
    1000,
    now(),
    now()
  )
  ON CONFLICT (event_id) DO NOTHING;

  -- ── Step 5: Return settlement result ──
  -- Outbox was enqueued atomically with settlement.
  -- The Dispatcher (5s interval) will process the outbox item
  -- and create commission_records via FinanceProvider.
  RETURN v_settlement;
END;
$$;

-- ── Access Control ────────────────────────────────────────────
-- Same pattern as finance_settle_comanda:
--   REVOKE ALL FROM PUBLIC → GRANT EXECUTE TO authenticated

REVOKE ALL ON FUNCTION public.finance_settle_comanda_and_enqueue(
  UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT,
  TEXT, TEXT, JSONB, JSONB, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.finance_settle_comanda_and_enqueue(
  UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT,
  TEXT, TEXT, JSONB, JSONB, JSONB
) TO authenticated;

-- ── Comments ─────────────────────────────────────────────────

COMMENT ON FUNCTION public.finance_settle_comanda_and_enqueue(
  UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT,
  TEXT, TEXT, JSONB, JSONB, JSONB
) IS 'D7: Transactional Outbox composite RPC. Wraps finance_settle_comanda + outbox_items INSERT in same transaction. Atomic: both succeed or both rollback.';

NOTIFY pgrst, 'reload schema';

COMMIT;
