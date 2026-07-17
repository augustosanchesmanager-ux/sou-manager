-- =====================================================
-- ROLE PERMISSIONS SYSTEM
-- Granular access control for Barber and Receptionist
-- =====================================================

-- 1) Main permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Barber', 'Receptionist')),
  permission_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(tenant_id, role, permission_key)
);

-- 2) Audit log for permission changes
CREATE TABLE IF NOT EXISTS public.role_permissions_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Barber', 'Receptionist')),
  permission_key TEXT NOT NULL,
  old_enabled BOOLEAN,
  new_enabled BOOLEAN NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions_audit ENABLE ROW LEVEL SECURITY;

-- 4) RLS Policies for role_permissions
-- Managers and SuperAdmins can view permissions for their tenant
CREATE POLICY "Managers can view role_permissions"
  ON public.role_permissions FOR SELECT
  USING (
    tenant_id = public.get_current_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

-- Managers can insert/update/delete permissions for their tenant
CREATE POLICY "Managers can manage role_permissions"
  ON public.role_permissions FOR ALL
  USING (
    (
      tenant_id = public.get_current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.role IN ('Manager', 'AdminManager')
          AND s.tenant_id = public.get_current_tenant_id()
          AND s.status = 'active'
      )
    )
    OR public.current_is_super_admin_from_auth_uid()
  );

-- 5) RLS Policies for role_permissions_audit
-- Only SuperAdmins can read audit logs; managers write via SECURITY DEFINER function
CREATE POLICY "SuperAdmins can view role_permissions_audit"
  ON public.role_permissions_audit FOR SELECT
  USING (public.current_is_super_admin_from_auth_uid());

CREATE POLICY "System can insert role_permissions_audit"
  ON public.role_permissions_audit FOR INSERT
  WITH CHECK (true);

-- 6) Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_role_permissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_role_permissions_updated_at();

-- 7) Audit trigger
CREATE OR REPLACE FUNCTION public.audit_role_permissions_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.enabled = true THEN
    INSERT INTO public.role_permissions_audit (tenant_id, role, permission_key, old_enabled, new_enabled, changed_by)
    VALUES (NEW.tenant_id, NEW.role, NEW.permission_key, false, NEW.enabled, NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND OLD.enabled != NEW.enabled THEN
    INSERT INTO public.role_permissions_audit (tenant_id, role, permission_key, old_enabled, new_enabled, changed_by)
    VALUES (NEW.tenant_id, NEW.role, NEW.permission_key, OLD.enabled, NEW.enabled, COALESCE(NEW.created_by, auth.uid()));
  ELSIF TG_OP = 'DELETE' AND OLD.enabled = true THEN
    INSERT INTO public.role_permissions_audit (tenant_id, role, permission_key, old_enabled, new_enabled, changed_by)
    VALUES (OLD.tenant_id, OLD.role, OLD.permission_key, OLD.enabled, false, auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_audit_role_permissions_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_role_permissions_changes();

-- 8) RPC: Get all permissions for a role in a tenant
CREATE OR REPLACE FUNCTION public.get_role_permissions(
  p_tenant_id UUID,
  p_role TEXT
)
RETURNS TABLE (
  permission_key TEXT,
  enabled BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT rp.permission_key, rp.enabled
  FROM public.role_permissions rp
  WHERE rp.tenant_id = p_tenant_id
    AND rp.role = p_role;
END;
$$;

-- 9) RPC: Upsert batch of permissions for a role
CREATE OR REPLACE FUNCTION public.upsert_role_permissions(
  p_tenant_id UUID,
  p_role TEXT,
  p_permissions JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  v_permission_key TEXT;
  v_enabled BOOLEAN;
  v_created_by UUID;
BEGIN
  -- Verify caller is a manager or superadmin for this tenant
  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = auth.uid()
        AND s.role IN ('Manager', 'AdminManager')
        AND s.tenant_id = p_tenant_id
        AND s.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to modify role_permissions';
  END IF;

  v_created_by := auth.uid();

  FOR item IN SELECT * FROM jsonb_array_elements(p_permissions)
  LOOP
    v_permission_key := item->>'permission_key';
    v_enabled := (item->>'enabled')::boolean;

    INSERT INTO public.role_permissions (tenant_id, role, permission_key, enabled, created_by)
    VALUES (p_tenant_id, p_role, v_permission_key, v_enabled, v_created_by)
    ON CONFLICT (tenant_id, role, permission_key)
    DO UPDATE SET
      enabled = EXCLUDED.enabled,
      updated_at = now(),
      created_by = EXCLUDED.created_by;
  END LOOP;
END;
$$;

-- 10) RPC: Reset permissions to defaults for a role
CREATE OR REPLACE FUNCTION public.reset_role_permissions_to_default(
  p_tenant_id UUID,
  p_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_by UUID;
BEGIN
  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = auth.uid()
        AND s.role IN ('Manager', 'AdminManager')
        AND s.tenant_id = p_tenant_id
        AND s.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to reset role_permissions';
  END IF;

  v_created_by := auth.uid();

  -- Delete existing permissions for this role/tenant
  DELETE FROM public.role_permissions
  WHERE tenant_id = p_tenant_id AND role = p_role;

  -- Insert default permissions based on role
  IF p_role = 'Barber' THEN
    INSERT INTO public.role_permissions (tenant_id, role, permission_key, enabled, created_by)
    VALUES
      (p_tenant_id, 'Barber', 'schedule.view_own_schedule', true, v_created_by),
      (p_tenant_id, 'Barber', 'schedule.confirm_arrival', true, v_created_by),
      (p_tenant_id, 'Barber', 'schedule.view_available_times', true, v_created_by),
      (p_tenant_id, 'Barber', 'services.view_catalog', true, v_created_by),
      (p_tenant_id, 'Barber', 'services.view_prices', true, v_created_by),
      (p_tenant_id, 'Barber', 'services.register_services', true, v_created_by),
      (p_tenant_id, 'Barber', 'clients.view_basic', true, v_created_by),
      (p_tenant_id, 'Barber', 'clients.view_own_history', true, v_created_by),
      (p_tenant_id, 'Barber', 'clients.add_notes', true, v_created_by),
      (p_tenant_id, 'Barber', 'clients.view_preferences', true, v_created_by),
      (p_tenant_id, 'Barber', 'team.view_own_schedule', true, v_created_by),
      (p_tenant_id, 'Barber', 'team.edit_own_profile', true, v_created_by),
      (p_tenant_id, 'Barber', 'team.change_own_password', true, v_created_by),
      (p_tenant_id, 'Barber', 'team.view_own_commission', true, v_created_by),
      (p_tenant_id, 'Barber', 'team.view_own_goals', true, v_created_by),
      (p_tenant_id, 'Barber', 'reports.view_daily_attendance', true, v_created_by),
      (p_tenant_id, 'Barber', 'reports.view_schedule_overview', true, v_created_by),
      (p_tenant_id, 'Barber', 'reports.view_personal_productivity', true, v_created_by),
      (p_tenant_id, 'Barber', 'communication.view_notifications', true, v_created_by);
  ELSIF p_role = 'Receptionist' THEN
    INSERT INTO public.role_permissions (tenant_id, role, permission_key, enabled, created_by)
    VALUES
      (p_tenant_id, 'Receptionist', 'schedule.view_general_schedule', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'schedule.create_appointments', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'schedule.edit_appointments', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'schedule.cancel_appointments', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'schedule.view_available_times', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'schedule.manage_waitlist', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'schedule.confirm_arrival', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.create', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.view_basic', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.view_full_history', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.edit', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.add_notes', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.view_preferences', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.view_documents', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.view_payment_history', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.view_catalog', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.view_prices', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.sell_services', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.view_stock', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.sell_products', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.apply_discounts', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.register_additions', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'financial.open_close_cash', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'financial.register_payments', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'financial.register_basic_expenses', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'financial.issue_receipts', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'financial.view_daily_movement', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'team.view_own_schedule', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'team.request_time_off', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'team.view_team_schedules', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'team.internal_communication', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'team.edit_own_profile', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'team.change_own_password', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'reports.view_daily_attendance', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'reports.view_schedule_overview', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'reports.view_busy_free_times', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'reports.view_service_revenue', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'communication.send_reminders', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'communication.view_notifications', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'communication.respond_to_messages', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'communication.view_communication_history', true, v_created_by);
  END IF;
END;
$$;

-- 11) Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_role_permissions(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_role_permissions(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_role_permissions_to_default(UUID, TEXT) TO authenticated;

-- 12) Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant_role ON public.role_permissions (tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_key ON public.role_permissions (tenant_id, role, permission_key);
CREATE INDEX IF NOT EXISTS idx_role_permissions_audit_tenant ON public.role_permissions_audit (tenant_id, changed_at DESC);
