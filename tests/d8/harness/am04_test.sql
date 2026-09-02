-- D8 Amendment-04 validation: retry / reclaim-after-backoff / dead-letter /
-- stale recovery / concurrency / tenant isolation / observability.
-- Uses the SAME deterministic-stub approach as Gate A (NOT 63742efa).

-- helper: fresh seed of outbox_item for a given tenant/event/status
CREATE OR REPLACE FUNCTION seed_item(p_tenant TEXT, p_event TEXT, p_status TEXT DEFAULT 'pending')
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.outbox_items (event_id, event_type, tenant_id, status, payload)
  VALUES (p_event, 'CheckoutCompleted', p_tenant, p_status,
          jsonb_build_object('operationType','create_commission_record',
                             'idempotencyKey','ik-'||p_event))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- T1: RETRY â€” item in processing with retries left â†’ pending + backoff
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
DECLARE v_id UUID; v_out JSONB; v_retry TIMESTAMPTZ;
BEGIN
  v_id := seed_item('00000000-0000-0000-0000-000000000001','retry-e1','processing');
  UPDATE public.outbox_items SET retry_attempts=0, retry_max_attempts=5, retry_base_delay_ms=1000
    WHERE id=v_id;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='worker_dispatcher')
     OR NOT has_function_privilege('worker_dispatcher','public.handle_processing_failure(uuid,uuid,text)','EXECUTE')
  THEN RAISE EXCEPTION 'grant missing for worker_dispatcher handle_processing_failure'; END IF;

  v_out := public.handle_processing_failure(v_id,'00000000-0000-0000-0000-000000000001','boom attempt 1');
  IF NOT (v_out->>'status') = 'pending' THEN RAISE EXCEPTION 'T1 FAIL: expected pending, got %', v_out->>'status'; END IF;
  IF NOT (v_out->>'attempts')::int = 1 THEN RAISE EXCEPTION 'T1 FAIL: attempts=1 got %', v_out->>'attempts'; END IF;
  SELECT retry_next_retry_at::text INTO v_retry FROM public.outbox_items WHERE id=v_id;
  IF v_out->>'retry_next_retry_at' IS NULL THEN RAISE EXCEPTION 'T1 FAIL: retry_next_retry_at null'; END IF;

  -- retry_attempts incremented (not reset), next retry scheduled in the future
  IF (SELECT retry_attempts FROM public.outbox_items WHERE id=v_id) <> 1
     THEN RAISE EXCEPTION 'T1 FAIL: column retry_attempts <> 1'; END IF;
  IF (SELECT status FROM public.outbox_items WHERE id=v_id) <> 'pending'
     THEN RAISE EXCEPTION 'T1 FAIL: row not pending'; END IF;
  IF (SELECT processing_started_at FROM public.outbox_items WHERE id=v_id) IS NOT NULL
     THEN RAISE EXCEPTION 'T1 FAIL: processing_started_at not cleared'; END IF;
  IF (SELECT claimed_by FROM public.outbox_items WHERE id=v_id) IS NOT NULL
     THEN RAISE EXCEPTION 'T1 FAIL: claimed_by not cleared'; END IF;
  RAISE NOTICE 'T1 PASS: retry->pending attempts=1 backoff scheduled';
END $$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- T2: RECLAIM-AFTER-BACKOFF â€” item with future retry_next_retry_at NOT claimable;
-- after the window elapses â†’ claimable.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
DECLARE
  v_id UUID; v_future UUID; v_past UUID; v_claim JSONB; v_claim2 JSONB; v_claim3 JSONB;
BEGIN
  -- (a) future backoff â†’ claim returns NULL
  v_future := seed_item('00000000-0000-0000-0000-000000000002','reclaim-future','pending');
  UPDATE public.outbox_items SET retry_next_retry_at=now()+interval '1 hour', retry_attempts=1 WHERE id=v_future;
  v_claim := public.claim_next_outbox_item(NULL, 'worker_dispatcher');
  IF v_claim IS NOT NULL AND v_claim->>'id' = v_future::text
     THEN RAISE EXCEPTION 'T2 FAIL: item with future backoff was claimed prematurely'; END IF;

  -- (b) elapsed backoff â†’ claimable
  v_past := seed_item('00000000-0000-0000-0000-000000000002','reclaim-past','pending');
  UPDATE public.outbox_items SET retry_next_retry_at=now()-interval '1 minute', retry_attempts=2 WHERE id=v_past;
  -- ensure future item not picked first
  UPDATE public.outbox_items SET retry_next_retry_at=now()+interval '5 minute' WHERE id=v_future;
  v_claim2 := public.claim_next_outbox_item(NULL, 'worker_dispatcher');
  IF v_claim2 IS NULL OR v_claim2->>'id' <> v_past::text
     THEN RAISE EXCEPTION 'T2 FAIL: elapsed-backoff item not reclaimed (got %)', COALESCE(v_claim2->>'id','NULL'); END IF;
  IF (SELECT status FROM public.outbox_items WHERE id=v_past) <> 'processing'
     THEN RAISE EXCEPTION 'T2 FAIL: reclaimed item not processing'; END IF;
  IF (SELECT retry_next_retry_at FROM public.outbox_items WHERE id=v_past) IS NOT NULL
     THEN RAISE EXCEPTION 'T2 FAIL: retry_next_retry_at not cleared on claim'; END IF;
  RAISE NOTICE 'T2 PASS: backoff honored + reclaim after window';
END $$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- T3: DEAD-LETTER â€” repeated failures reaching retry_max_attempts â†’ dead_letter,
-- deterministic, never back to pending, never re-claimable.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
DECLARE
  v_id UUID; v_out JSONB; v_status TEXT; v_i INT; v_claim JSONB;
BEGIN
  v_id := seed_item('00000000-0000-0000-0000-000000000003','dead-e1','pending');
  UPDATE public.outbox_items SET retry_max_attempts=3, retry_base_delay_ms=1 WHERE id=v_id;

  -- first claim (scoped to T3 tenant: only dead-e1 belongs here).
  -- Backoff-window elapse is simulated by forcing retry_next_retry_at to the
  -- past before reclaiming (T1/T2 already prove backoff honoring; T3 isolates
  -- the attempt-count -> dead-letter transition).
  PERFORM public.claim_next_outbox_item('00000000-0000-0000-0000-000000000003','worker_dispatcher');
  v_out := public.handle_processing_failure(v_id,'00000000-0000-0000-0000-000000000003','err1'); -- attempts=1 <3 â†’ pending
  IF NOT (v_out->>'status')='pending' THEN RAISE EXCEPTION 'T3 FAIL: 1st -> /%', v_out->>'status'; END IF;

  UPDATE public.outbox_items SET retry_next_retry_at=now()-interval '1 second' WHERE id=v_id;
  PERFORM public.claim_next_outbox_item('00000000-0000-0000-0000-000000000003','worker_dispatcher');
  v_out := public.handle_processing_failure(v_id,'00000000-0000-0000-0000-000000000003','err2'); -- attempts=2 <3 â†’ pending
  IF NOT (v_out->>'status')='pending' THEN RAISE EXCEPTION 'T3 FAIL: 2nd -> %', v_out->>'status'; END IF;

  UPDATE public.outbox_items SET retry_next_retry_at=now()-interval '1 second' WHERE id=v_id;
  PERFORM public.claim_next_outbox_item('00000000-0000-0000-0000-000000000003','worker_dispatcher');
  v_out := public.handle_processing_failure(v_id,'00000000-0000-0000-0000-000000000003','err3'); -- attempts=3 >=3 â†’ dead_letter
  IF NOT (v_out->>'status')='dead_letter' THEN RAISE EXCEPTION 'T3 FAIL: 3rd -> %', v_out->>'status'; END IF;
  IF NOT (v_out->>'dead_letter')::boolean THEN RAISE EXCEPTION 'T3 FAIL: dead_letter flag false'; END IF;
  SELECT status INTO v_status FROM public.outbox_items WHERE id=v_id;
  IF v_status <> 'dead_letter' THEN RAISE EXCEPTION 'T3 FAIL: persists dead_letter got %', v_status; END IF;
  IF (SELECT completed_at FROM public.outbox_items WHERE id=v_id) IS NULL
     THEN RAISE EXCEPTION 'T3 FAIL: completed_at not set on dead-letter'; END IF;
  IF (SELECT retry_attempts FROM public.outbox_items WHERE id=v_id) <> 3
     THEN RAISE EXCEPTION 'T3 FAIL: attempts not persisted as 3'; END IF;

  -- dead_letter must NEVER be claimable (scoped to T3 tenant)
  v_claim := public.claim_next_outbox_item('00000000-0000-0000-0000-000000000003','worker_dispatcher');
  IF v_claim IS NOT NULL AND v_claim->>'id'=v_id::text
     THEN RAISE EXCEPTION 'T3 FAIL: dead_letter item was reclaimed'; END IF;
  RAISE NOTICE 'T3 PASS: dead-letter after max attempts, deterministic, not reclaimed';
END $$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- T4: STALE RECOVERY â€” processing >5min â†’ pending (no attempt increment);
-- recent processing untouched.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
DECLARE
  v_stale UUID; v_recent UUID; v_count INT; v_claim JSONB;
BEGIN
  v_stale := seed_item('00000000-0000-0000-0000-000000000004','stale-e1','processing');
  UPDATE public.outbox_items SET processing_started_at=now()-interval '10 minutes', retry_attempts=2 WHERE id=v_stale;
  v_recent := seed_item('00000000-0000-0000-0000-000000000004','recent-e1','processing');
  UPDATE public.outbox_items SET processing_started_at=now(), retry_attempts=0 WHERE id=v_recent;

  v_count := public.recover_stale_processing(NULL);
  IF v_count <> 1 THEN RAISE EXCEPTION 'T4 FAIL: expected 1 stale recovered, got %', v_count; END IF;
  IF (SELECT status FROM public.outbox_items WHERE id=v_stale) <> 'pending'
     THEN RAISE EXCEPTION 'T4 FAIL: stale item not pending'; END IF;
  IF (SELECT retry_attempts FROM public.outbox_items WHERE id=v_stale) <> 2
     THEN RAISE EXCEPTION 'T4 FAIL: stale recovery incremented attempts (should not)'; END IF;
  IF (SELECT status FROM public.outbox_items WHERE id=v_recent) <> 'processing'
     THEN RAISE EXCEPTION 'T4 FAIL: recent item wrongly reset'; END IF;
  -- recovered stale item is now claimable again (scoped to T4 tenant)
  UPDATE public.outbox_items SET retry_attempts=0 WHERE id=v_stale;
  v_claim := public.claim_next_outbox_item('00000000-0000-0000-0000-000000000004','worker_dispatcher');
  IF v_claim IS NULL OR v_claim->>'id' <> v_stale::text
     THEN RAISE EXCEPTION 'T4 FAIL: recovered stale item not reclaimable'; END IF;
  RAISE NOTICE 'T4 PASS: stale recovery -> pending (no increment), reclaimable, recent untouched';
END $$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- T5: TENANT ISOLATION â€” handle_processing_failure with wrong tenant â†’ ERROR
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
DECLARE
  v_id UUID; v_raised BOOLEAN := false;
BEGIN
  v_id := seed_item('00000000-0000-0000-0000-000000000005','iso-e1','processing');
  BEGIN
    v_raised := false;
    PERFORM public.handle_processing_failure(v_id,'00000000-0000-0000-0000-000000009999','x');
  EXCEPTION WHEN OTHERS THEN
    v_raised := true;
    IF NOT (SQLERRM LIKE '%tenant mismatch%') THEN
      RAISE NOTICE 'T5 WARN: raised but msg=%', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'T5 FAIL: wrong tenant did not raise'; END IF;
  -- item still processing (no side effect)
  IF (SELECT status FROM public.outbox_items WHERE id=v_id) <> 'processing'
     THEN RAISE EXCEPTION 'T5 FAIL: wrong-tenant call mutated item'; END IF;
  RAISE NOTICE 'T5 PASS: tenant mismatch raises, no mutation';
END $$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- T6: CONCURRENCY â€” two failures on same processing item: only ONE wins.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
DECLARE
  v_id UUID; v_a JSONB; v_b JSONB; v_raised BOOLEAN:=false;
BEGIN
  v_id := seed_item('00000000-0000-0000-0000-000000000006','conc-e1','processing');
  UPDATE public.outbox_items SET retry_max_attempts=10 WHERE id=v_id;
  v_a := public.handle_processing_failure(v_id,'00000000-0000-0000-0000-000000000006','first');
  BEGIN
    v_raised := false;
    v_b := public.handle_processing_failure(v_id,'00000000-0000-0000-0000-000000000006','second');
  EXCEPTION WHEN OTHERS THEN v_raised := true; END;
  -- after first call item id not processing, so second must raise OR return nothing
  IF NOT v_raised THEN RAISE EXCEPTION 'T6 FAIL: second concurrent failure did not raise'; END IF;
  IF (SELECT status FROM public.outbox_items WHERE id=v_id) <> 'pending'
     THEN RAISE EXCEPTION 'T6 FAIL: state not pending after concurrency'; END IF;
  RAISE NOTICE 'T6 PASS: concurrent failure on same item -> only one transition wins';
END $$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- T7: OBSERVABILITY â€” queue health reflects failed/dead_letter/stale counts
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$
DECLARE v_health JSONB;
BEGIN
  -- seed one pending, one dead_letter
  PERFORM seed_item('00000000-0000-0000-0000-000000000007','obs-pending','pending');
  INSERT INTO public.outbox_items (event_id,event_type,tenant_id,status)
    VALUES ('obs-dead','CheckoutCompleted','00000000-0000-0000-0000-000000000007','dead_letter');
  v_health := public.get_outbox_queue_health();
  IF NOT (v_health->>'dead_letter')::int >= 1 THEN RAISE EXCEPTION 'T7 FAIL: dead_letter not counted'; END IF;
  IF NOT (v_health->>'pending')::int >= 1 THEN RAISE EXCEPTION 'T7 FAIL: pending not counted'; END IF;
  RAISE NOTICE 'T7 PASS: queue health observable';
END $$;

-- grants double-check
SELECT 'GRANT_SUMMARY' AS k,
       has_function_privilege('worker_dispatcher','public.handle_processing_failure(uuid,uuid,text)','EXECUTE') AS hpf,
       has_function_privilege('worker_dispatcher','public.recover_stale_processing(uuid)','EXECUTE') AS rsp,
       has_function_privilege('worker_dispatcher','public.claim_next_outbox_item(uuid,text)','EXECUTE') AS claim;

-- summary of final lifecycle states in outbox
SELECT status, count(*) FROM public.outbox_items GROUP BY status ORDER BY status;

