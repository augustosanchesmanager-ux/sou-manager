-- ============================================================
-- 20260723100000_event_store.sql
-- Event Store: Append-only table for domain event persistence.
--
-- Design:
--   - Append-only: no UPDATE or DELETE
--   - Separates payload (business data) from metadata (context)
--   - Supports versioning for payload evolution
--   - Indexed for aggregate, correlation, type, tenant, time queries
--   - JSONB for flexible payload/metadata without schema changes
-- ============================================================

CREATE TABLE IF NOT EXISTS event_store (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id      TEXT NOT NULL UNIQUE,
  event_type    TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id  TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  metadata      JSONB NOT NULL DEFAULT '{}',
  version       INTEGER NOT NULL DEFAULT 1,
  occurred_at   TIMESTAMPTZ NOT NULL,
  stored_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id     TEXT NOT NULL,
  correlation_id TEXT,
  causation_id  TEXT,
  source        TEXT
);

-- ── Indexes ──────────────────────────────────────────────────────

-- P0: Aggregate lookup (event sourcing replay)
CREATE INDEX IF NOT EXISTS idx_event_store_aggregate
  ON event_store (aggregate_type, aggregate_id, occurred_at);

-- P0: Correlation chain (distributed tracing)
CREATE INDEX IF NOT EXISTS idx_event_store_correlation
  ON event_store (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- P0: Tenant isolation (all queries are tenant-scoped)
CREATE INDEX IF NOT EXISTS idx_event_store_tenant
  ON event_store (tenant_id, occurred_at);

-- P1: Event type queries (analytics, monitoring)
CREATE INDEX IF NOT EXISTS idx_event_store_type
  ON event_store (event_type, occurred_at);

-- P1: Time range queries (audit, replay windows)
CREATE INDEX IF NOT EXISTS idx_event_store_occurred_at
  ON event_store (occurred_at);

-- P2: Source tracking (debugging which service published)
CREATE INDEX IF NOT EXISTS idx_event_store_source
  ON event_store (source)
  WHERE source IS NOT NULL;

-- ── Security ─────────────────────────────────────────────────────

ALTER TABLE event_store ENABLE ROW LEVEL SECURITY;

-- Superadmin bypass
CREATE POLICY event_store_superadmin_all
  ON event_store
  FOR ALL
  USING (current_is_super_admin_from_auth_uid())
  WITH CHECK (current_is_super_admin_from_auth_uid());

-- Tenant isolation for SELECT
CREATE POLICY event_store_tenant_select
  ON event_store
  FOR SELECT
  USING (tenant_id = current_tenant_id_from_auth_uid()::text);

-- Insert: allow authenticated users (events are created by Application Services)
CREATE POLICY event_store_tenant_insert
  ON event_store
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- No UPDATE or DELETE policies — append-only by design

-- ── Comments ─────────────────────────────────────────────────────

COMMENT ON TABLE event_store IS 'Append-only domain event store for audit, replay, and integration';
COMMENT ON COLUMN event_store.event_id IS 'Unique business event identifier (evt_...)';
COMMENT ON COLUMN event_store.payload IS 'Business event data (domain-specific)';
COMMENT ON COLUMN event_store.metadata IS 'Cross-cutting context: tenant, user, correlation, version';
COMMENT ON COLUMN event_store.version IS 'Payload schema version (starts at 1)';
COMMENT ON COLUMN event_store.correlation_id IS 'Groups events from same business operation';
COMMENT ON COLUMN event_store.causation_id IS 'Links cause→effect between events';
