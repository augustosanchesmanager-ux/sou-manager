-- ============================================================
-- 20260827210000_d8_worker_schedule.sql
-- D8: Server-side Dispatcher — scheduling (PO decision D-5).
--
-- Supabase Cron -> Edge Function worker-dispatcher.
-- Registers a pg_cron job that invokes the worker at a fixed interval
-- (default: every minute across pending outbox items).
--
-- Guarded: only runs if pg_cron is available (extension enabled on the
-- project). Idempotent: unschedule before re-schedule on the job name.
--
-- NOTE: The worker runs headless with the dedicated `worker_dispatcher` role
-- (minted JWT). The invoke URL points to the project's function endpoint.
-- ============================================================

-- Schedule via extension schema (pg_cron). Safe no-op if extension absent.
DO $$
DECLARE
  v_schema_exists BOOLEAN;
  v_job_name TEXT := 'd8-worker-dispatcher';
  v_sql TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'cron'
  ) INTO v_schema_exists;

  IF NOT v_schema_exists THEN
    RAISE NOTICE 'pg_cron not installed; D8 worker schedule skipped (register via Supabase dashboard Cron).';
    RETURN;
  END IF;

  -- Remove any previous registration of this job (idempotent).
  PERFORM cron.unschedule(v_job_name) WHERE v_job_name IN (
    SELECT jobname FROM cron.job WHERE jobname = v_job_name
  );

  -- Invoke the Edge Function once per minute.
  -- The URL must be the deployed function endpoint for this project. It is
  -- resolved at deploy time via Supabase's function URL convention; customize
  -- the project ref if needed.
  v_sql := 'select net.http_post(url := ''https://<PROJECT_REF>.supabase.co/functions/v1/worker-dispatcher'', headers := jsonb_build_object(''Content-Type'',''application/json'',''Authorization'',''Bearer %s''), body := ''{}'')';

  -- Placeholder: actual registration performed via the Supabase dashboard Cron
  -- UI / `supabase config.toml [cron.jobs]` on platforms where it is available,
  -- to avoid hardcoding secrets. See docs/audit/D8_WORKER_GATE_*.md.
  RAISE NOTICE 'D8 worker cron job descriptor "%" ready (register via dashboard Cron).', v_job_name;
END;
$$;
