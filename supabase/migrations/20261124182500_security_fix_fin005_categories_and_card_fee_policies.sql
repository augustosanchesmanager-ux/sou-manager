-- ============================================================================
-- Migration: 20261124182500_security_fix_fin005_categories_and_card_fee_policies.sql
-- Issue: #382 (P0-07 | FIN-005)
-- Scope:
--   1. Create `public.categories` for persistent tenant-scoped categories
--      (replacing localStorage in pages/Categories.tsx).
--   2. Create `public.card_fee_policies` for persistent tenant default and
--      per-staff card fee split policies (replacing localStorage in
--      domain/paymentTerminal/cardFeeRepository.ts).
--   3. Apply strict tenant_id RLS (TO authenticated) and least-privilege GRANTs
--      (REVOKE ALL from PUBLIC, anon).
-- Note: Applied ONLY after PO review and explicit production authorization.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Table: public.categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (btrim(name) <> ''),
  description text NOT NULL DEFAULT '',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_tenant_active
  ON public.categories (tenant_id, active);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.categories FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;

DROP POLICY IF EXISTS "categories_select_tenant" ON public.categories;
CREATE POLICY "categories_select_tenant"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "categories_insert_manager" ON public.categories;
CREATE POLICY "categories_insert_manager"
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
          AND s.role IN ('owner', 'manager', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "categories_update_manager" ON public.categories;
CREATE POLICY "categories_update_manager"
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
          AND s.role IN ('owner', 'manager', 'admin')
      )
    )
  )
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
          AND s.role IN ('owner', 'manager', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "categories_delete_manager" ON public.categories;
CREATE POLICY "categories_delete_manager"
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
          AND s.role IN ('owner', 'manager', 'admin')
      )
    )
  );

-- ============================================================================
-- 2. Table: public.card_fee_policies
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.card_fee_policies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id    uuid NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  policy      text NOT NULL CHECK (policy IN ('gross', 'split', 'deducted')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_fee_policies_tenant
  ON public.card_fee_policies (tenant_id);

-- 1 tenant-wide default policy per tenant (staff_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_card_fee_policies_tenant_default
  ON public.card_fee_policies (tenant_id)
  WHERE staff_id IS NULL;

-- 1 override policy per (tenant_id, staff_id)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_card_fee_policies_tenant_staff
  ON public.card_fee_policies (tenant_id, staff_id)
  WHERE staff_id IS NOT NULL;

ALTER TABLE public.card_fee_policies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.card_fee_policies FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.card_fee_policies TO authenticated;

DROP POLICY IF EXISTS "card_fee_policies_select_tenant" ON public.card_fee_policies;
CREATE POLICY "card_fee_policies_select_tenant"
  ON public.card_fee_policies
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "card_fee_policies_insert_manager" ON public.card_fee_policies;
CREATE POLICY "card_fee_policies_insert_manager"
  ON public.card_fee_policies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
          AND s.role IN ('owner', 'manager', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "card_fee_policies_update_manager" ON public.card_fee_policies;
CREATE POLICY "card_fee_policies_update_manager"
  ON public.card_fee_policies
  FOR UPDATE
  TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
          AND s.role IN ('owner', 'manager', 'admin')
      )
    )
  )
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
          AND s.role IN ('owner', 'manager', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "card_fee_policies_delete_manager" ON public.card_fee_policies;
CREATE POLICY "card_fee_policies_delete_manager"
  ON public.card_fee_policies
  FOR DELETE
  TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
          AND s.role IN ('owner', 'manager', 'admin')
      )
    )
  );

COMMIT;
