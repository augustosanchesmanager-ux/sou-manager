BEGIN;

ALTER TABLE public.customer_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_vouchers_tenant_isolation ON public.customer_vouchers;
CREATE POLICY customer_vouchers_tenant_isolation
ON public.customer_vouchers
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

REVOKE ALL ON TABLE public.customer_vouchers FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_vouchers TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
