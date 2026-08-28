-- ============================================================
-- 20260828000000_d8_worker_retry_dead_letter.sql
-- D8: Server-side Dispatcher — Retry / Requeue / Dead-Letter (Amendment-04).
--
-- ADR-016 Amendment-04 (PO-approved, commit 097c687).
-- Closes the lifecycle gap: an item marked 'failed' had NO server-side
-- recovery path. Target (mirrors certified SupabaseOutbox.markFailed):
--
--   processing
--      ├── success → published
--      └── failure → handle_processing_failure
--                        ├── retry (backoff) → pending → re-claimable
--                        └── dead_letter (after retry_max_attempts, default 5)
--   processing órfão (>5min) → recover_stale_processing → pending
--
-- Guarantees preserved (STOP conditions of D8):
--   - tenant_id EXPLÍCITO + RAISE on mismatch (isolation at RPC layer).
--   - SECURITY DEFINER, search_path=public, narrow RPCs (no SELECT *, no
--     direct worker table access, no service_role).
--   - Idempotência financeira intacta (cálculo D7/comissão INTOCADO).
--   - Retry limitado (retry_max_attempts=5), backoff base*2^(attempts-1).
--   - Dead-letter determinístico (completed_at setada, never back to pending).
--   - Concorrência segura (UPDATE condicionado a status='processing').
--   - Observabilidade: retry_last_error / retry_attempts / retry_next_retry_at;
--     get_outbox_queue_health() já expõe failed/dead_letter/stale_processing.
--
-- Schema defaults real (outbox_items): retry_max_attempts=5,
-- retry_base_delay_ms=1000. Backoff = base * 2^(attempts-1) ms.
-- 63742efa NÃO é tocado aqui (reservado como evidência real pós-deploy).
-- ============================================================

BEGIN;

-- ── 1. AMEND claim_next_outbox_item (predicate) ──────────────
-- Old: status='pending' AND retry_next_retry_at IS NULL
-- New: status='pending' AND (retry_next_retry_at IS NULL OR retry_next_retry_at <= now())
-- This HONORS the backoff window: a retried item is re-claimable only after
-- its scheduled retry time elapses. Assinatura, retorno e grants preservados.
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
  SELECT * INTO v_item
  FROM public.outbox_items
  WHERE status = 'pending'
    AND (retry_next_retry_at IS NULL OR retry_next_retry_at <= now())
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id::text)
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.outbox_items
  SET status = 'processing',
      processing_started_at = now(),
      claimed_by = p_claimed_by,
      retry_next_retry_at = NULL, -- clear once claimed
      updated_at = now()
  WHERE id = v_item.id;

  RETURN jsonb_build_object(
    'id', v_item.id,
    'event_id', v_item.event_id,
    'event_type', v_item.event_type,
    'tenant_id', v_item.tenant_id,
    'status', 'processing',
    'targets', v_item.targets,
    'payload', v_item.payload,
    'metadata', v_item.metadata,
    'retry_attempts', v_item.retry_attempts,
    'claimed_by', p_claimed_by
  );
END;
$$;

-- Grant is preserved by CREATE OR REPLACE (function signature unchanged).
REVOKE ALL ON FUNCTION public.claim_next_outbox_item(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_outbox_item(UUID, TEXT) TO worker_dispatcher;

-- ── 2. handle_processing_failure ─────────────────────────────
-- NEW. Atomic transition processing → pending(backoff) | dead_letter.
-- Mirrors certified SupabaseOutbox.markFailed exactly (1 source of behavior):
--   attempts = retry_attempts + 1
--   if attempts >= retry_max_attempts  → dead_letter (completed_at=now)
--   else → pending, attempts, retry_last_error, retry_next_retry_at =
--          now + base_delay_ms*2^(attempts-1); processing_started_at=null;
--          claimed_by=null
-- Concurrency: only the worker holding the item (status='processing') can
-- transition it; UPDATE conditioned on status='processing' prevents two
-- workers from failing the same item concurrently.
CREATE OR REPLACE FUNCTION public.handle_processing_failure(
  p_item_id   UUID,
  p_tenant_id UUID,
  p_error     TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row       public.outbox_items%ROWTYPE;
  v_attempts  INT;
  v_max       INT;
  v_base      INT;
  v_delay     NUMERIC;
  v_new_status TEXT;
  v_now       TIMESTAMPTZ := now();
BEGIN
  IF p_error IS NULL OR p_error = '' THEN
    RAISE EXCEPTION 'p_error must be non-empty';
  END IF;

  SELECT * INTO v_row FROM public.outbox_items
  WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'outbox item % not found', p_item_id;
  END IF;

  -- ISOLATION: item must belong to requesting tenant.
  IF v_row.tenant_id <> p_tenant_id::text THEN
    RAISE EXCEPTION 'tenant mismatch: item belongs to tenant %, requested %',
      v_row.tenant_id, p_tenant_id;
  END IF;

  -- Only the worker holding the item in 'processing' may fail it.
  IF v_row.status <> 'processing' THEN
    RAISE EXCEPTION 'item % not in processing state (current %)', p_item_id, v_row.status;
  END IF;

  v_attempts := COALESCE(v_row.retry_attempts, 0) + 1;
  v_max      := COALESCE(v_row.retry_max_attempts, 5);
  v_base     := COALESCE(v_row.retry_base_delay_ms, 1000);

  IF v_attempts >= v_max THEN
    -- Max retries exceeded → dead letter (deterministic, never back to pending).
    v_new_status := 'dead_letter';
    UPDATE public.outbox_items
    SET status            = 'dead_letter',
        retry_attempts    = v_attempts,
        retry_last_error  = p_error,
        completed_at      = v_now,
        updated_at        = v_now
    WHERE id = p_item_id AND status = 'processing';
  ELSE
    -- Backoff exponential: base * 2^(attempts-1) ms.
    v_new_status := 'pending';
    v_delay      := v_base * power(2, v_attempts - 1);
    UPDATE public.outbox_items
    SET status               = 'pending',
        retry_attempts       = v_attempts,
        retry_last_error     = p_error,
        retry_next_retry_at  = v_now + (v_delay / 1000.0) * interval '1 second',
        processing_started_at = NULL,
        claimed_by           = NULL,
        updated_at           = v_now
    WHERE id = p_item_id AND status = 'processing';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item % lost the processing state (concurrent transition)', p_item_id;
  END IF;

  RETURN jsonb_build_object(
    'item_id', p_item_id,
    'status', v_new_status,
    'attempts', v_attempts,
    'max_attempts', v_max,
    'dead_letter', v_new_status = 'dead_letter',
    'retry_attempts', v_attempts,
    'retry_next_retry_at', CASE WHEN v_new_status = 'pending'
      THEN v_now + (v_delay / 1000.0) * interval '1 second'
      ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.handle_processing_failure(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_processing_failure(UUID, UUID, TEXT) TO worker_dispatcher;

-- ── 3. recover_stale_processing ──────────────────────────────
-- NEW. Mirrors SupabaseOutbox.recoverStaleProcessing: items stuck in
-- 'processing' for >5min return to 'pending' with NO attempt increment
-- (a stolen/orphaned claim, not a business failure). Optional tenant scope.
CREATE OR REPLACE FUNCTION public.recover_stale_processing(
  p_tenant_id UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold TIMESTAMPTZ := now() - interval '5 minutes';
  v_count INT;
BEGIN
  UPDATE public.outbox_items
  SET status                = 'pending',
      processing_started_at = NULL,
      claimed_by            = NULL,
      retry_next_retry_at   = NULL,
      updated_at            = now()
  WHERE status = 'processing'
    AND processing_started_at < v_threshold
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id::text);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.recover_stale_processing(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recover_stale_processing(UUID) TO worker_dispatcher;

-- ── 4. Documentation ─────────────────────────────────────────
COMMENT ON FUNCTION public.handle_processing_failure(UUID, UUID, TEXT) IS
  'D8 Amd-04: atomic processing→pending(backoff)|dead_letter. Mirrors SupabaseOutbox.markFailed. Tenant-validated, concurrency-safe (UPDATE conditioned on processing).';
COMMENT ON FUNCTION public.recover_stale_processing(UUID) IS
  'D8 Amd-04: resets stale (>5min) processing items to pending (no attempt increment). Mirrors recoverStaleProcessing.';
COMMENT ON FUNCTION public.claim_next_outbox_item(UUID, TEXT) IS
  'D8 Amd-04: atomic outbox claim. Predicate now honors retry_next_retry_at backoff (IS NULL OR <= now()).';

NOTIFY pgrst, 'reload schema';

COMMIT;
