BEGIN;

CREATE SCHEMA IF NOT EXISTS barber;
CREATE SCHEMA IF NOT EXISTS auto;
CREATE SCHEMA IF NOT EXISTS club;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS app_slug text NOT NULL DEFAULT 'barber';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_app_slug_check'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_app_slug_check
      CHECK (app_slug IN ('barber', 'auto', 'club'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tenants_app_slug
  ON public.tenants (app_slug);

CREATE TABLE IF NOT EXISTS public.user_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'manager',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id
  ON public.user_tenants (user_id);

CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id
  ON public.user_tenants (tenant_id);

ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_tenants_select_own ON public.user_tenants;
CREATE POLICY user_tenants_select_own
ON public.user_tenants
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.current_is_super_admin_from_auth_uid()
);

DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;
CREATE POLICY "Users can view their tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  id = public.current_tenant_id_from_auth_uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_tenants ut
    WHERE ut.user_id = auth.uid()
      AND ut.tenant_id = public.tenants.id
  )
  OR public.current_is_super_admin_from_auth_uid()
);

CREATE OR REPLACE FUNCTION public.touch_user_tenants_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_user_tenants_updated_at ON public.user_tenants;
CREATE TRIGGER trg_touch_user_tenants_updated_at
BEFORE UPDATE ON public.user_tenants
FOR EACH ROW
EXECUTE FUNCTION public.touch_user_tenants_updated_at();

CREATE OR REPLACE FUNCTION public.sync_profile_to_user_tenants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_tenants (user_id, tenant_id, role, is_primary)
  VALUES (
    NEW.id,
    NEW.tenant_id,
    lower(coalesce(NEW.role, 'manager')),
    true
  )
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    is_primary = true,
    updated_at = now();

  UPDATE public.tenants
  SET app_slug = coalesce(app_slug, 'barber')
  WHERE id = NEW.tenant_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_user_tenants ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_user_tenants
AFTER INSERT OR UPDATE OF tenant_id, role
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_user_tenants();

INSERT INTO public.user_tenants (user_id, tenant_id, role, is_primary)
SELECT
  p.id,
  p.tenant_id,
  lower(coalesce(p.role, 'manager')),
  true
FROM public.profiles p
WHERE p.tenant_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO UPDATE
SET
  role = EXCLUDED.role,
  is_primary = public.user_tenants.is_primary OR EXCLUDED.is_primary,
  updated_at = now();

UPDATE public.tenants
SET app_slug = 'barber'
WHERE app_slug IS NULL;

COMMIT;
