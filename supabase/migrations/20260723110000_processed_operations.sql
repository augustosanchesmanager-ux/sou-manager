-- ============================================================
-- 20260723110000_processed_operations.sql
-- Persistent Idempotency Store: tracks executed finance operations.
--
-- Design:
--   - Prevents duplicate execution of finance operations
--   - UNIQUE index on (tenant_id, idempotency_key) for O(1) dedup
--   - INSERT → UNIQUE VIOLATION → already processed (no locks)
--   - Retains history for audit and debugging
--   - handler_version supports future handler evolution
-- ============================================================

CREATE TABLE IF NOT EXISTS processed_operations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  event_id        TEXT NOT NULL,
  operation_type  TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  handler_version INTEGER NOT NULL DEFAULT 1,
  metadata        JSONB NOT NULL DEFAULT '{}'
);

-- ── Indexes ──────────────────────────────────────────────────────

-- P0: Idempotency check — O(1) dedup via UNIQUE constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_operations_idempotency
  ON processed_operations (tenant_id, idempotency_key);

-- P1: Audit queries — find all operations for an event
CREATE INDEX IF NOT EXISTS idx_processed_operations_event
  ON processed_operations (event_id);

-- P1: Tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_processed_operations_tenant
  ON processed_operations (tenant_id, processed_at);

-- P2: Operation type filtering
CREATE INDEX IF NOT EXISTS idx_processed_operations_type
  ON processed_operations (operation_type, processed_at);

-- ── Security ─────────────────────────────────────────────────────

ALTER TABLE processed_operations ENABLE ROW LEVEL SECURITY;

-- Superadmin bypass
CREATE POLICY processed_operations_superadmin_all
  ON processed_operations
  FOR ALL
  USING (current_is_super_admin_from_auth_uid())
  WITH CHECK (current_is_super_admin_from_auth_uid());

-- Tenant isolation for SELECT
CREATE POLICY processed_operations_tenant_select
  ON processed_operations
  FOR SELECT
  USING (tenant_id = current_tenant_id_from_auth_uid()::text);

-- Insert: allow authenticated users (operations are created by FinanceProvider)
CREATE POLICY processed_operations_tenant_insert
  ON processed_operations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- No UPDATE or DELETE policies — records are immutable

-- ── Comments ─────────────────────────────────────────────────────

COMMENT ON TABLE processed_operations IS 'Persistent idempotency store for finance operations (FinanceProvider)';
COMMENT ON COLUMN processed_operations.idempotency_key IS 'Dedup key: {eventId}_{operationType}';
COMMENT ON COLUMN processed_operations.handler_version IS 'Handler version that processed this operation (for future migrations)';
COMMENT ON COLUMN processed_operations.metadata IS 'Additional context: source event, tenant context, etc.';
