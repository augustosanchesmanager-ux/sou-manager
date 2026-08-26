-- ============================================================
-- 20260826000000_create_outbox_items.sql
-- Trilha C: Durable Outbox — persistent delivery queue.
--
-- Replaces InMemoryOutbox with a Supabase-backed table.
-- Survives page reload, tab close, and browser restart.
--
-- Design:
--   - event_id UNIQUE: one outbox item per domain event
--   - Explicit retry columns (not JSONB) for indexability
--   - processing_started_at + claimed_by for concurrency control
--   - Partial indexes for dispatcher polling and stale recovery
--   - RLS: superadmin bypass + tenant isolation + authenticated insert
--   - FOR UPDATE SKIP LOCKED for atomic claim (Dispatcher)
--
-- Gap not addressed: atomicity between finance_settle_comanda
-- and outbox enqueue (tracked as separate ADR).
-- ============================================================

BEGIN;

-- ── Table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.outbox_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event reference
  event_id              TEXT NOT NULL UNIQUE,
  event_type            TEXT NOT NULL,

  -- Tenant
  tenant_id             TEXT NOT NULL,

  -- Dispatch config
  targets               JSONB NOT NULL DEFAULT '[]',

  -- Status lifecycle: pending → processing → published/failed/dead_letter
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','published','failed','dead_letter')),

  -- Retry policy (explicit columns for indexability)
  retry_attempts        INTEGER NOT NULL DEFAULT 0,
  retry_max_attempts    INTEGER NOT NULL DEFAULT 5,
  retry_next_retry_at   TIMESTAMPTZ,
  retry_last_error      TEXT,
  retry_base_delay_ms   INTEGER NOT NULL DEFAULT 1000,

  -- Concurrency control
  processing_started_at TIMESTAMPTZ,
  claimed_by            TEXT,

  -- Payload (denormalized from event)
  payload               JSONB NOT NULL DEFAULT '{}',
  metadata              JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at         TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ
);

-- ── Indexes ────────────────────────────────────────────────────

-- P0: Dispatcher polling — the most executed query.
-- Finds the oldest pending item for a given tenant.
CREATE INDEX idx_outbox_items_pending
  ON public.outbox_items (tenant_id, created_at)
  WHERE status = 'pending';

-- P0: Stale processing recovery — items stuck in 'processing'.
CREATE INDEX idx_outbox_items_stale
  ON public.outbox_items (processing_started_at)
  WHERE status = 'processing';

-- P1: Dead letter monitoring — items that exceeded max retries.
CREATE INDEX idx_outbox_items_dead_letter
  ON public.outbox_items (tenant_id, created_at)
  WHERE status = 'dead_letter';

-- P2: Tenant-scoped status query — dashboard counts, monitoring.
CREATE INDEX idx_outbox_items_tenant_status
  ON public.outbox_items (tenant_id, status);

-- ── Security ───────────────────────────────────────────────────

ALTER TABLE public.outbox_items ENABLE ROW LEVEL SECURITY;

-- Superadmin bypass
CREATE POLICY outbox_items_superadmin_all
  ON public.outbox_items
  FOR ALL
  USING (current_is_super_admin_from_auth_uid())
  WITH CHECK (current_is_super_admin_from_auth_uid());

-- Tenant isolation: SELECT
CREATE POLICY outbox_items_tenant_select
  ON public.outbox_items
  FOR SELECT
  USING (tenant_id = current_tenant_id_from_auth_uid()::text);

-- INSERT: authenticated users (FinanceSubscriber enqueues)
CREATE POLICY outbox_items_tenant_insert
  ON public.outbox_items
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Dispatcher (status transitions, stale recovery)
CREATE POLICY outbox_items_tenant_update
  ON public.outbox_items
  FOR UPDATE
  USING (tenant_id = current_tenant_id_from_auth_uid()::text)
  WITH CHECK (tenant_id = current_tenant_id_from_auth_uid()::text);

-- ── Comments ───────────────────────────────────────────────────

COMMENT ON TABLE public.outbox_items IS
  'Trilha C: Durable outbox queue. Replaces InMemoryOutbox for persistent delivery.';

COMMENT ON COLUMN public.outbox_items.event_id IS
  'Unique domain event identifier. UNIQUE constraint prevents duplicate outbox items per event.';

COMMENT ON COLUMN public.outbox_items.status IS
  'Lifecycle: pending → processing → published/failed/dead_letter';

COMMENT ON COLUMN public.outbox_items.processing_started_at IS
  'Timestamp when Dispatcher claimed this item. Used for stale recovery (>5 min = stuck).';

COMMENT ON COLUMN public.outbox_items.claimed_by IS
  'Dispatcher identifier that claimed this item. For debugging concurrency issues.';

COMMENT ON COLUMN public.outbox_items.retry_next_retry_at IS
  'Scheduled time for next retry attempt. NULL means eligible for immediate processing.';

NOTIFY pgrst, 'reload schema';

COMMIT;
