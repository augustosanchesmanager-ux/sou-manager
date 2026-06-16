-- Migration: Create tenant_goals table for configurable business goals
-- Phase 4.2.2 - RLS corrected to use confirmed project functions
--
-- Functions confirmed to exist:
--   public.current_is_super_admin_from_auth_uid() -> boolean
--   public.current_tenant_id_from_auth_uid() -> uuid

CREATE TABLE IF NOT EXISTS public.tenant_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'yearly')),
  revenue_goal NUMERIC(12,2) NOT NULL DEFAULT 0,
  appointments_goal INTEGER NOT NULL DEFAULT 0,
  clients_goal INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: only one active goal per tenant per period
CREATE UNIQUE INDEX IF NOT EXISTS tenant_goals_tenant_period_active_idx
  ON public.tenant_goals (tenant_id, period)
  WHERE active = true;

-- Index for fast lookups by tenant
CREATE INDEX IF NOT EXISTS tenant_goals_tenant_id_idx ON public.tenant_goals (tenant_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.tenant_goals;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.tenant_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.tenant_goals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS tenant_goals_select ON public.tenant_goals;
DROP POLICY IF EXISTS tenant_goals_insert ON public.tenant_goals;
DROP POLICY IF EXISTS tenant_goals_update ON public.tenant_goals;
DROP POLICY IF EXISTS tenant_goals_delete ON public.tenant_goals;

-- RLS Policy: SELECT - uses confirmed functions
CREATE POLICY tenant_goals_select ON public.tenant_goals
  FOR SELECT
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

-- RLS Policy: INSERT - uses confirmed functions with WITH CHECK
CREATE POLICY tenant_goals_insert ON public.tenant_goals
  FOR INSERT
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

-- RLS Policy: UPDATE - uses confirmed functions for both USING and WITH CHECK
CREATE POLICY tenant_goals_update ON public.tenant_goals
  FOR UPDATE
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  )
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

-- RLS Policy: DELETE - uses confirmed functions
CREATE POLICY tenant_goals_delete ON public.tenant_goals
  FOR DELETE
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

COMMENT ON TABLE public.tenant_goals IS 'Configurable business goals per tenant for dashboard KPIs';
COMMENT ON COLUMN public.tenant_goals.period IS 'Goal period: weekly, monthly, or yearly';
COMMENT ON COLUMN public.tenant_goals.revenue_goal IS 'Revenue target for the period';
COMMENT ON COLUMN public.tenant_goals.appointments_goal IS 'Number of appointments target for the period';
COMMENT ON COLUMN public.tenant_goals.clients_goal IS 'New clients target for the period';