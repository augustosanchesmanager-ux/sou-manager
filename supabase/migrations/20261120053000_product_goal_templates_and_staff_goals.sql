-- Migration: Product Goal Templates and Staff Product Goals (ADR-052)
-- Supports flexible multi-tier product sales goals for receptionists and barbers
-- with role-based templates and per-staff overrides.

CREATE TABLE IF NOT EXISTS public.product_goal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_role TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('receptionist', 'barber', 'all')),
  period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'biweekly', 'weekly')),
  base_goal_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (base_goal_amount >= 0),
  tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_goal_templates_tenant_idx
  ON public.product_goal_templates (tenant_id);

CREATE TABLE IF NOT EXISTS public.staff_product_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.product_goal_templates(id) ON DELETE SET NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'biweekly', 'weekly')),
  base_goal_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (base_goal_amount >= 0),
  custom_tiers JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_product_goals_tenant_staff_unique UNIQUE (tenant_id, staff_id)
);

CREATE INDEX IF NOT EXISTS staff_product_goals_tenant_idx
  ON public.staff_product_goals (tenant_id);

CREATE INDEX IF NOT EXISTS staff_product_goals_staff_idx
  ON public.staff_product_goals (staff_id);

-- Reuse handle_updated_at() trigger helper
DROP TRIGGER IF EXISTS set_updated_at ON public.product_goal_templates;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.product_goal_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.staff_product_goals;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.staff_product_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.product_goal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_product_goals ENABLE ROW LEVEL SECURITY;

-- Policies for product_goal_templates
DROP POLICY IF EXISTS product_goal_templates_select ON public.product_goal_templates;
CREATE POLICY product_goal_templates_select ON public.product_goal_templates
  FOR SELECT
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS product_goal_templates_manage ON public.product_goal_templates;
CREATE POLICY product_goal_templates_manage ON public.product_goal_templates
  FOR ALL
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.tenant_id = product_goal_templates.tenant_id
          AND lower(p.role) IN ('owner', 'admin', 'manager', 'gerente')
      )
    )
  )
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.tenant_id = product_goal_templates.tenant_id
          AND lower(p.role) IN ('owner', 'admin', 'manager', 'gerente')
      )
    )
  );

-- Policies for staff_product_goals
DROP POLICY IF EXISTS staff_product_goals_select ON public.staff_product_goals;
CREATE POLICY staff_product_goals_select ON public.staff_product_goals
  FOR SELECT
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS staff_product_goals_manage ON public.staff_product_goals;
CREATE POLICY staff_product_goals_manage ON public.staff_product_goals
  FOR ALL
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.tenant_id = staff_product_goals.tenant_id
          AND lower(p.role) IN ('owner', 'admin', 'manager', 'gerente')
      )
    )
  )
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.tenant_id = staff_product_goals.tenant_id
          AND lower(p.role) IN ('owner', 'admin', 'manager', 'gerente')
      )
    )
  );
