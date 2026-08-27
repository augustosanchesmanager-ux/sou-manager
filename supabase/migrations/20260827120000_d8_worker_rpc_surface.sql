-- ============================================================
-- 20260827120000_d8_worker_rpc_surface.sql
-- D8: Server-side Dispatcher — Execution Boundary (gate A: DB/RPC surface).
--
-- ADR-016 Amendment-01 (Execution Boundary) + Amendment-02 (Data Contract).
-- PO-approved contract:
--   - Worker uses dedicated role `worker_dispatcher` (minimum privilege).
--   - Worker accesses tables ONLY via narrow RPCs (never directly).
--   - Each RPC validates tenant_id explicitly (isolation at the RPC layer,
--     NOT RLS — worker is headless and has no session tenant).
--   - RPCs ONLY mount context / read / write; they NEVER calculate commission
--     (calculation stays exclusively in the runtime-neutral Financial Domain
--     Core TS — single source of the rule).
--   - No SELECT *, no generic table access, no service_role on the path.
--
-- Reuses/preserves Trilha C (outbox_items) + D7 + commission_records intact.
-- ============================================================

BEGIN;

-- ── 1. Dedicated worker role (minimum privilege) ─────────────
-- NOLOGIN: authenticated via a JWT scoped to this role, minted by the
-- Edge Function from SUPABASE_JWT_SECRET (see worker). Has NO table
-- privileges and NO BYPASSRLS. It can only EXECUTE the RPCs granted below.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_dispatcher') THEN
    CREATE ROLE worker_dispatcher NOLOGIN;
  END IF;
END $$;

-- ── 2. claim_next_outbox_item ────────────────────────────────
-- Atomic claim: FOR UPDATE SKIP LOCKED. Two workers can NEVER claim the
-- same row. Optional p_tenant_id filter for per-tenant / legacy targeting.
-- SECURITY DEFINER: runs as owner (can touch outbox_items) although
-- worker_dispatcher itself has no table grants.
CREATE OR REPLACE FUNCTION public.claim_next_outbox_item(
  p_tenant_id UUID DEFAULT NULL,
  p_claimed_by TEXT DEFAULT 'worker_dispatcher'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.outbox_items%ROWTYPE;
BEGIN
  -- Claim the oldest pending item (optionally tenant-scoped).
  SELECT * INTO v_item
  FROM public.outbox_items
  WHERE status = 'pending'
    AND retry_next_retry_at IS NULL
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id::text)
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL; -- queue empty (or all rows locked by another worker)
  END IF;

  -- Transition to processing (same lock held until COMMIT).
  UPDATE public.outbox_items
  SET status = 'processing',
      processing_started_at = now(),
      claimed_by = p_claimed_by,
      updated_at = now()
  WHERE id = v_item.id;

  RETURN jsonb_build_object(
    'id', v_item.id,
    'event_id', v_item.event_id,
    'event_type', v_item.event_type,
    'tenant_id', v_item.tenant_id,
    'status', 'processing', -- row updated above to processing
    'targets', v_item.targets,
    'payload', v_item.payload,
    'metadata', v_item.metadata,
    'retry_attempts', v_item.retry_attempts,
    'claimed_by', p_claimed_by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_outbox_item(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_outbox_item(UUID, TEXT) TO worker_dispatcher;

-- ── 3. get_financial_operation_context ───────────────────────
-- Data contract (Amendment-02 §2/§3): resolves the MINIMAL context needed
-- to calculate commission. Validates item tenant_id + event + status.
-- Returns ONLY the fields in the matrix. NEVER calculates commission.
CREATE OR REPLACE FUNCTION public.get_financial_operation_context(
  p_item_id   UUID,
  p_tenant_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item        public.outbox_items%ROWTYPE;
  v_payload     JSONB;
  v_op_type     TEXT;
  v_odata       JSONB;
  v_comanda_id  UUID;
  v_received    NUMERIC;
  v_comanda     JSONB;
  v_items       JSONB;
  v_participants JSONB;
  v_staff       JSONB;
  v_item_ids    UUID[] := ARRAY[]::UUID[];
  v_row         record;
BEGIN
  SELECT * INTO v_item FROM public.outbox_items WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'outbox item % not found', p_item_id;
  END IF;

  -- ISOLATION: item must belong to requesting tenant.
  IF v_item.tenant_id <> p_tenant_id::text THEN
    RAISE EXCEPTION 'tenant mismatch: item belongs to tenant %, requested %',
      v_item.tenant_id, p_tenant_id;
  END IF;

  IF v_item.status <> 'processing' THEN
    RAISE EXCEPTION 'item % not in processing state (current %)', p_item_id, v_item.status;
  END IF;

  v_payload := v_item.payload;
  v_op_type := v_payload->>'operationType';
  v_odata   := COALESCE(v_payload->'operationData', '{}'::jsonb);

  IF v_op_type IS NULL THEN
    RAISE EXCEPTION 'item % payload missing operationType', p_item_id;
  END IF;

  -- Only commission operations are authorized on this surface today.
  IF v_op_type NOT IN ('create_commission_record', 'reverse_commission') THEN
    RAISE EXCEPTION 'operationType % not authorized on worker surface', v_op_type;
  END IF;

  v_comanda_id := (v_odata->>'comandaId')::UUID;
  v_received := COALESCE((v_odata->>'receivedValue')::NUMERIC, 0);

  -- ── create_commission_record: resolve minimal financial context ──
  IF v_op_type = 'create_commission_record' THEN
    -- comanda (C1-C6) — only REAL columns.
    -- NOTE (verified against live schema 2026-08-27): comandas has NO
    -- paid_amount / amount_paid. The handler falls through to comanda.total.
    -- Omitting those keys keeps the JSON naturally absent, faithfully
    -- reproducing the handler's field-presence logic in the Core TS.
    SELECT jsonb_build_object(
      'id', c.id,
      'staff_id', c.staff_id,
      'total', c.total,
      'discount', c.discount
    ) INTO v_comanda
    FROM public.comandas c
    WHERE c.id = v_comanda_id AND c.tenant_id = p_tenant_id;

    IF v_comanda IS NULL THEN
      RAISE EXCEPTION 'comanda % not found for tenant %', v_comanda_id, p_tenant_id;
    END IF;

    -- comanda_items (I1-I8) — only REAL columns.
    -- comanda_items has NO price / amount / discount; unit_price is the base
    -- and item-level discount defaults to 0 (handled in Core).
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', ci.id,
      'service_id', ci.service_id,
      'staff_id', ci.staff_id,
      'unit_price', ci.unit_price,
      'quantity', ci.quantity
    )), '[]'::jsonb) INTO v_items
    FROM public.comanda_items ci
    WHERE ci.comanda_id = v_comanda_id AND ci.tenant_id = p_tenant_id;

    SELECT ARRAY_AGG(ci.id) INTO v_item_ids
    FROM public.comanda_items ci
    WHERE ci.comanda_id = v_comanda_id AND ci.tenant_id = p_tenant_id;

    -- service_execution_participants (P1-P5) — only REAL columns.
    -- No professional_id column; staff_id is the source (matches handler).
    IF cardinality(v_item_ids) > 0 THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'comanda_item_id', p.comanda_item_id,
        'staff_id', p.staff_id,
        'payout_type', p.payout_type,
        'payout_value', p.payout_value,
        'affects_commission', p.affects_commission
      )), '[]'::jsonb) INTO v_participants
      FROM public.service_execution_participants p
      WHERE p.comanda_item_id = ANY(v_item_ids) AND p.tenant_id = p_tenant_id;
    ELSE
      v_participants := '[]'::jsonb;
    END IF;

    -- staff for commission (S1-S3): only the tenant's staff.
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'role', s.role,
      'commission_rate', s.commission_rate
    )), '[]'::jsonb) INTO v_staff
    FROM public.staff s
    WHERE s.tenant_id = p_tenant_id;

    RETURN jsonb_build_object(
      'event_id', v_item.event_id,
      'tenant_id', p_tenant_id,
      'operation_type', v_op_type,
      'idempotency_key', v_payload->>'idempotencyKey',
      'source_event', v_payload->>'sourceEvent',
      'receivedValue', v_received,
      'comandaId', v_comanda_id,
      'comanda', v_comanda,
      'comanda_items', COALESCE(v_items, '[]'::jsonb),
      'participants', COALESCE(v_participants, '[]'::jsonb),
      'staff', COALESCE(v_staff, '[]'::jsonb)
    );
  END IF;

  -- ── reverse_commission: only needs original record + reversal amount ──
  -- Original record lookup is done via the write RPC using p_original_record_id;
  -- here we only surface the operation-level metadata.
  RETURN jsonb_build_object(
    'event_id', v_item.event_id,
    'tenant_id', p_tenant_id,
    'operation_type', v_op_type,
    'idempotency_key', v_payload->>'idempotencyKey',
    'source_event', v_payload->>'sourceEvent',
    'comandaId', v_comanda_id,
    'receivedValue', v_received
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_financial_operation_context(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_operation_context(UUID, UUID) TO worker_dispatcher;

-- ── 4. exists_commission_record (idempotency) ────────────────
-- Mirrors commissionRecordRepository.existsByStaffComanda.
CREATE OR REPLACE FUNCTION public.exists_commission_record(
  p_staff_id  UUID,
  p_comanda_id UUID,
  p_tenant_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n BIGINT;
BEGIN
  SELECT count(*) INTO v_n
  FROM public.commission_records
  WHERE tenant_id = p_tenant_id
    AND staff_id = p_staff_id
    AND comanda_id = p_comanda_id
    AND record_type = 'commission';
  RETURN v_n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.exists_commission_record(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exists_commission_record(UUID, UUID, UUID) TO worker_dispatcher;

-- ── 5. insert_commission_record ──────────────────────────────
-- Mirrors commissionRecordRepository.create (all mapped columns).
-- Idempotent ON CONFLICT? No: relies on exists_commission_record check +
-- partial unique index as final guard (unique violation -> treated as
-- already-created by the worker's error handling).
CREATE OR REPLACE FUNCTION public.insert_commission_record(
  p_tenant_id          UUID,
  p_comanda_id         UUID,
  p_comanda_item_id    UUID,
  p_staff_id           UUID,
  p_gross_value        NUMERIC,
  p_discount           NUMERIC,
  p_net_value          NUMERIC,
  p_received_value     NUMERIC,
  p_commission_rate    NUMERIC,
  p_commission_value   NUMERIC,
  p_participant_share  NUMERIC,
  p_payout_type        TEXT,
  p_affects_commission BOOLEAN,
  p_idempotency_key    TEXT,
  p_event_id           TEXT,
  p_event_type         TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Final idempotency guard: primary unique index (partial, commission only).
  INSERT INTO public.commission_records (
    tenant_id, record_type, comanda_id, comanda_item_id, staff_id,
    gross_value, discount, net_value, received_value, commission_rate,
    commission_value, participant_share, payout_type, affects_commission,
    idempotency_key, event_id, event_type, status
  ) VALUES (
    p_tenant_id, 'commission', p_comanda_id, p_comanda_item_id, p_staff_id,
    p_gross_value, p_discount, p_net_value, p_received_value, p_commission_rate,
    p_commission_value, p_participant_share, p_payout_type, p_affects_commission,
    p_idempotency_key, p_event_id, p_event_type, 'active'
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'idempotent', false);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'skipped', true);
END;
$$;

REVOKE ALL ON FUNCTION public.insert_commission_record(
  UUID, UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, TEXT, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_commission_record(
  UUID, UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO worker_dispatcher;

-- ── 6. mark_outbox_item_processed ────────────────────────────
-- Status transition: published | failed | dead_letter (by worker).
CREATE OR REPLACE FUNCTION public.mark_outbox_item_processed(
  p_item_id        UUID,
  p_tenant_id      UUID,
  p_status         TEXT,
  p_error          TEXT DEFAULT NULL,
  p_attempts       INT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('published','failed','dead_letter') THEN
    RAISE EXCEPTION 'invalid status %', p_status;
  END IF;

  -- Isolation + idempotency: only transition if currently 'processing'.
  UPDATE public.outbox_items
  SET status          = p_status,
      retry_last_error = COALESCE(p_error, retry_last_error),
      retry_attempts   = COALESCE(p_attempts, retry_attempts),
      dispatched_at    = CASE WHEN p_status = 'published' THEN COALESCE(dispatched_at, now()) ELSE dispatched_at END,
      completed_at     = CASE WHEN p_status IN ('published','dead_letter') THEN COALESCE(completed_at, now()) ELSE completed_at END,
      updated_at       = now()
  WHERE id = p_item_id
    AND tenant_id = p_tenant_id::text
    AND status = 'processing';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_outbox_item_processed(UUID, UUID, TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_outbox_item_processed(UUID, UUID, TEXT, TEXT, INT) TO worker_dispatcher;

-- ── 7. worker heartbeat / health ─────────────────────────────
-- Declarative server-side health (ADR-016 Amendment-01 §6).
-- worker_heartbeat table: consultable independent of any session.
CREATE TABLE IF NOT EXISTS public.worker_heartbeat (
  worker_id            TEXT PRIMARY KEY,
  last_scheduled_at    TIMESTAMPTZ,
  last_cycle_at        TIMESTAMPTZ,
  last_success_at      TIMESTAMPTZ,
  last_error_at        TIMESTAMPTZ,
  last_error           TEXT,
  queue_healthy        BOOLEAN NOT NULL DEFAULT FALSE,
  processed_total      BIGINT NOT NULL DEFAULT 0,
  failed_total         BIGINT NOT NULL DEFAULT 0,
  dead_letter_total    BIGINT NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for heartbeat: only worker_dispatcher (via SECURITY DEFINER RPC) and
-- superadmin read/write; authenticated users read via scoped RPC.
ALTER TABLE public.worker_heartbeat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS worker_heartbeat_superadmin_all ON public.worker_heartbeat;
CREATE POLICY worker_heartbeat_superadmin_all
  ON public.worker_heartbeat
  FOR ALL
  USING (current_is_super_admin_from_auth_uid())
  WITH CHECK (current_is_super_admin_from_auth_uid());

-- Upsert heartbeat (worker reports liveness + counters).
CREATE OR REPLACE FUNCTION public.upsert_worker_heartbeat(
  p_worker_id       TEXT,
  p_last_scheduled_at TIMESTAMPTZ,
  p_cycle_ok        BOOLEAN,
  p_last_error      TEXT DEFAULT NULL,
  p_delta_processed BIGINT DEFAULT 0,
  p_delta_failed    BIGINT DEFAULT 0,
  p_delta_dead      BIGINT DEFAULT 0
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.worker_heartbeat (
    worker_id, last_scheduled_at, last_cycle_at,
    last_success_at, last_error_at, last_error, queue_healthy,
    processed_total, failed_total, dead_letter_total, updated_at
  ) VALUES (
    p_worker_id, p_last_scheduled_at, now(),
    CASE WHEN p_cycle_ok THEN now() ELSE NULL END,
    CASE WHEN NOT p_cycle_ok THEN now() ELSE NULL END,
    CASE WHEN NOT p_cycle_ok THEN p_last_error ELSE NULL END,
    p_cycle_ok,
    p_delta_processed, p_delta_failed, p_delta_dead, now()
  )
  ON CONFLICT (worker_id) DO UPDATE SET
    last_scheduled_at = EXCLUDED.last_scheduled_at,
    last_cycle_at     = EXCLUDED.last_cycle_at,
    last_success_at   = CASE WHEN EXCLUDED.last_success_at IS NOT NULL THEN EXCLUDED.last_success_at ELSE worker_heartbeat.last_success_at END,
    last_error_at     = CASE WHEN EXCLUDED.last_error_at IS NOT NULL THEN EXCLUDED.last_error_at ELSE worker_heartbeat.last_error_at END,
    last_error        = COALESCE(EXCLUDED.last_error, worker_heartbeat.last_error),
    queue_healthy     = EXCLUDED.queue_healthy,
    processed_total   = worker_heartbeat.processed_total + EXCLUDED.processed_total,
    failed_total      = worker_heartbeat.failed_total + EXCLUDED.failed_total,
    dead_letter_total = worker_heartbeat.dead_letter_total + EXCLUDED.dead_letter_total,
    updated_at        = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_worker_heartbeat(
  TEXT, TIMESTAMPTZ, BOOLEAN, TEXT, BIGINT, BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_worker_heartbeat(
  TEXT, TIMESTAMPTZ, BOOLEAN, TEXT, BIGINT, BIGINT, BIGINT) TO worker_dispatcher;

-- Read heartbeat (authorized users / observability, not worker_dispatcher).
CREATE OR REPLACE FUNCTION public.get_worker_heartbeat(p_worker_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_worker_id IS NOT NULL THEN
    RETURN (SELECT to_jsonb(w) FROM public.worker_heartbeat w WHERE w.worker_id = p_worker_id);
  END IF;
  RETURN (SELECT COALESCE(jsonb_agg(to_jsonb(w)), '[]'::jsonb) FROM public.worker_heartbeat w);
END;
$$;

REVOKE ALL ON FUNCTION public.get_worker_heartbeat(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_worker_heartbeat(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_worker_heartbeat(TEXT) TO worker_dispatcher;

-- ── 8. Outbox queue health stats (observability) ─────────────
CREATE OR REPLACE FUNCTION public.get_outbox_queue_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending BIGINT;
  v_processing BIGINT;
  v_published BIGINT;
  v_failed BIGINT;
  v_dead BIGINT;
  v_stale BIGINT;
BEGIN
  SELECT count(*) INTO v_pending    FROM public.outbox_items WHERE status = 'pending';
  SELECT count(*) INTO v_processing FROM public.outbox_items WHERE status = 'processing';
  SELECT count(*) INTO v_published  FROM public.outbox_items WHERE status = 'published';
  SELECT count(*) INTO v_failed     FROM public.outbox_items WHERE status = 'failed';
  SELECT count(*) INTO v_dead       FROM public.outbox_items WHERE status = 'dead_letter';
  SELECT count(*) INTO v_stale      FROM public.outbox_items
    WHERE status = 'processing' AND processing_started_at < now() - interval '5 minutes';

  RETURN jsonb_build_object(
    'pending', v_pending,
    'processing', v_processing,
    'published', v_published,
    'failed', v_failed,
    'dead_letter', v_dead,
    'stale_processing', v_stale
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_outbox_queue_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_outbox_queue_health() TO authenticated;

-- ── 9. worker_dispatcher is created NOLOGIN without BYPASSRLS ──
-- by default, so it holds no role attribute that could bypass RLS.
-- (Defensive REVOKE removed: REVOKE BYPASSRLS is invalid when the role
--  never held it, and aborting the transactional migration would be worse.)

COMMENT ON FUNCTION public.claim_next_outbox_item(UUID, TEXT) IS
  'D8: Atomic outbox claim (FOR UPDATE SKIP LOCKED). Grants the item to exactly one worker.';
COMMENT ON FUNCTION public.get_financial_operation_context(UUID, UUID) IS
  'D8: Mounts the MINIMAL financial context for a claimed item. Validates tenant_id. NEVER calculates commission.';
COMMENT ON FUNCTION public.insert_commission_record(
  UUID, UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, TEXT, BOOLEAN, TEXT, TEXT, TEXT) IS
  'D8: Persists an already-CALCULATED commission record (idempotent). Calculation happens in Core TS, never here.';

NOTIFY pgrst, 'reload schema';

COMMIT;
