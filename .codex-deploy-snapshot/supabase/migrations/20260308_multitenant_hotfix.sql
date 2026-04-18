BEGIN;

CREATE OR REPLACE FUNCTION public.current_is_super_admin_from_auth_uid()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.role, '')) IN ('super admin', 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id_from_auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    (SELECT s.tenant_id FROM public.staff s WHERE s.id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_access_context()
RETURNS TABLE (
  tenant_id uuid,
  access_role text,
  profile_status text,
  is_super_admin boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_row RECORD;
  staff_row RECORD;
  normalized_role text;
BEGIN
  SELECT p.tenant_id, p.role, p.status
  INTO profile_row
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  SELECT s.tenant_id, s.role, s.status
  INTO staff_row
  FROM public.staff s
  WHERE s.id = auth.uid()
  LIMIT 1;

  tenant_id := COALESCE(profile_row.tenant_id, staff_row.tenant_id);
  normalized_role := lower(coalesce(profile_row.role, staff_row.role, ''));
  is_super_admin := normalized_role IN ('super admin', 'superadmin');

  IF is_super_admin THEN
    access_role := 'superadmin';
  ELSIF normalized_role IN ('manager', 'gerente', 'owner', 'admin') THEN
    access_role := 'manager';
  ELSIF normalized_role = 'receptionist' THEN
    access_role := 'receptionist';
  ELSIF normalized_role = 'barber' THEN
    access_role := 'barber';
  ELSE
    access_role := 'unknown';
  END IF;

  profile_status := COALESCE(profile_row.status, staff_row.status);
  IF profile_status IS NULL AND is_super_admin THEN
    profile_status := 'active';
  END IF;
  IF profile_status IS NULL AND access_role IN ('manager', 'barber', 'receptionist') THEN
    profile_status := 'active';
  END IF;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_is_super_admin_from_auth_uid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id_from_auth_uid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_access_context() TO authenticated;

DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['clients', 'appointments', 'staff']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    FOR policy_name IN
      SELECT pol.policyname
      FROM pg_policies pol
      WHERE pol.schemaname = 'public'
        AND pol.tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
    END LOOP;
  END LOOP;
END;
$$;

CREATE POLICY tenant_isolation_clients
ON public.clients
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

CREATE POLICY tenant_isolation_appointments
ON public.appointments
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

CREATE POLICY tenant_isolation_staff
ON public.staff
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

DROP POLICY IF EXISTS public_select_tenant_addons ON public.tenant_addons;
DROP POLICY IF EXISTS "Public can view active addons to access public routes" ON public.tenant_addons;
DROP POLICY IF EXISTS public_view_enabled_tenant_addons ON public.tenant_addons;
CREATE POLICY public_view_enabled_tenant_addons
ON public.tenant_addons
FOR SELECT
TO anon, authenticated
USING (status = 'enabled');

COMMIT;
