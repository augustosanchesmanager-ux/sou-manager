BEGIN;

-- Schema drift fix:
-- public.user_tenants exists in remote Supabase, but was missing from local migrations.
-- This migration recreates the expected table locally without affecting existing remote data.

CREATE TABLE IF NOT EXISTS public.user_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tenants_user_tenant
ON public.user_tenants(user_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id
ON public.user_tenants(user_id);

CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id
ON public.user_tenants(tenant_id);

CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_role
ON public.user_tenants(tenant_id, role);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tenants_one_primary_per_user
ON public.user_tenants(user_id)
WHERE is_primary = true;

ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_tenants_select_own_or_tenant_or_superadmin"
ON public.user_tenants;

CREATE POLICY "user_tenants_select_own_or_tenant_or_superadmin"
ON public.user_tenants
FOR SELECT
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR user_id = auth.uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

REVOKE ALL ON TABLE public.user_tenants FROM anon;
REVOKE ALL ON TABLE public.user_tenants FROM authenticated;

GRANT SELECT ON TABLE public.user_tenants TO authenticated;

COMMENT ON TABLE public.user_tenants IS
  'Links authenticated users to tenants with tenant-scoped roles. Added to align local migrations with remote schema.';

NOTIFY pgrst, 'reload schema';

COMMIT;
