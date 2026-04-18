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

CREATE OR REPLACE FUNCTION public.set_tenant_id_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id_from_auth_uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_tenant_id ON public.comandas;
CREATE TRIGGER trg_set_tenant_id
BEFORE INSERT ON public.comandas
FOR EACH ROW
EXECUTE FUNCTION public.set_tenant_id_from_profile();

DROP TRIGGER IF EXISTS trg_set_tenant_id ON public.comanda_items;
CREATE TRIGGER trg_set_tenant_id
BEFORE INSERT ON public.comanda_items
FOR EACH ROW
EXECUTE FUNCTION public.set_tenant_id_from_profile();

ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comanda_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_comandas ON public.comandas;
DROP POLICY IF EXISTS tenant_isolation_comandas_insert ON public.comandas;
CREATE POLICY tenant_isolation_comandas
ON public.comandas
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

DROP POLICY IF EXISTS tenant_isolation_comanda_items ON public.comanda_items;
DROP POLICY IF EXISTS tenant_isolation_comanda_items_insert ON public.comanda_items;
CREATE POLICY tenant_isolation_comanda_items
ON public.comanda_items
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

COMMIT;
