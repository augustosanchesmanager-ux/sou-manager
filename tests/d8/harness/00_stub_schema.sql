-- D8 validation harness — stub schema (minimal columns the D8 RPCs touch)
-- Plain postgres 15. NOT the production schema; only enough to exercise RPCs.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- RLS helper stubs (supabase normally provides these)
CREATE OR REPLACE FUNCTION public.current_is_super_admin_from_auth_uid()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$ SELECT false; $$;

-- Minimal tables
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT,
  commission_rate NUMERIC(5,4)
);

CREATE TABLE IF NOT EXISTS public.comandas (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id UUID,
  staff_id UUID,
  status TEXT DEFAULT 'open',
  total NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comanda_items (
  id UUID PRIMARY KEY,
  comanda_id UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  service_id UUID,
  staff_id UUID,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS public.service_execution_participants (
  id UUID PRIMARY KEY,
  comanda_item_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  staff_id UUID,
  role TEXT,
  payout_type TEXT,
  payout_value NUMERIC,
  affects_commission BOOLEAN
);

CREATE TABLE IF NOT EXISTS public.outbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  targets JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','published','failed','dead_letter')),
  retry_attempts INTEGER NOT NULL DEFAULT 0,
  retry_max_attempts INTEGER NOT NULL DEFAULT 5,
  retry_next_retry_at TIMESTAMPTZ,
  retry_last_error TEXT,
  retry_base_delay_ms INTEGER NOT NULL DEFAULT 1000,
  processing_started_at TIMESTAMPTZ,
  claimed_by TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- workers schema auth
CREATE SCHEMA IF NOT EXISTS auth;

-- Minimal role for migration ordering: the migration creates worker_dispatcher.
-- We also need ENABLE RLS on outbox_items etc. The D8 migration only creates
-- worker_heartbeat with RLS; other tables rely on production migrations.
ALTER TABLE public.outbox_items ENABLE ROW LEVEL SECURITY;
