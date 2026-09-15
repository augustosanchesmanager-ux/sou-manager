-- =============================================================================
-- F1 harness — stub schema (postgres 15 puro, NÃO é o schema de produção)
-- Réplica mínima e FIEL dos objetos que a migration F1 e os fluxos legítimos
-- tocam. Colunas/constraints espelhadas das migrations reais:
--   - auth.uid() ................ semântica exata do Supabase
--   - auth.users ............... 20260219183612 (id/email/raw_user_meta_data)
--   - tenants .................. 20260220145436 (id/name/slug/active)
--   - profiles ................. 20260220145436 + CHECK R6 (6.0.3)
--   - staff .................... 20260219183612 + CHECK R6 (6.0.3)
--   - handle_new_manager_profile 20260806000000 (verbatim, incl. trigger)
--   - current_is_super_admin_from_auth_uid 20260308 (verbatim)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- auth (Supabase fornece em produção; aqui simulamos com GUC de transação)
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;

-- auth.uid() real do Supabase: lê request.jwt.claim.sub (GUC que o PostgREST
-- injeta por request). Nos testes, f1_set_auth()/f1_set_system() controlam.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb
);

-- -----------------------------------------------------------------------------
-- public (colunas mínimas fiéis às migrations de produção)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- NOTA: tenant_id é NULLABLE em produção (20260220145436 l.14) — crucial para
-- o carve-out F1-d do re-provision (provision_new_tenant ON CONFLICT UPDATE).
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'barber'
    CHECK (role IN ('owner', 'manager', 'barber', 'receptionist', 'admin', 'superadmin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'barber'
    CHECK (role IN ('owner', 'manager', 'barber', 'receptionist', 'admin')),
  avatar TEXT DEFAULT '',
  commission_rate INTEGER NOT NULL DEFAULT 40,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- current_is_super_admin_from_auth_uid — verbatim do hotfix 20260308 (l.3-16)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- handle_new_manager_profile — verbatim 6.0.3 (l.85-148) + trigger AFTER INSERT.
-- Incluído para exercitar a CADEIA REAL: provision de perfil manager/owner/admin
-- deve criar staff via trigger e o trigger F1-b deve permitir por EMAIL do
-- chamador (não por id, pois o id do staff é gen_random_uuid()).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_manager_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_full_name TEXT;
  v_email TEXT;
  v_staff_role TEXT;
BEGIN
  IF NEW.role NOT IN ('manager', 'owner', 'admin', 'superadmin') THEN
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_staff_role := CASE NEW.role WHEN 'superadmin' THEN 'owner' ELSE NEW.role END;

  SELECT
    COALESCE(
      NULLIF(TRIM(
        COALESCE(raw_user_meta_data->>'first_name', '') || ' ' ||
        COALESCE(raw_user_meta_data->>'last_name', '')
      ), ''),
      raw_user_meta_data->>'full_name',
      NEW.full_name,
      split_part(email, '@', 1)
    ),
    email
  INTO v_full_name, v_email
  FROM auth.users
  WHERE id = NEW.id;

  INSERT INTO public.staff (
    name,
    email,
    phone,
    role,
    avatar,
    commission_rate,
    status,
    tenant_id
  )
  SELECT
    COALESCE(v_full_name, 'Gestor'),
    COALESCE(v_email, ''),
    '',
    v_staff_role,
    'https://ui-avatars.com/api/?name=' || REPLACE(COALESCE(v_full_name, 'Gestor'), ' ', '+') || '&background=0066ff&color=fff',
    0,
    'active',
    NEW.tenant_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.staff
    WHERE tenant_id = NEW.tenant_id
      AND email = COALESCE(v_email, '')
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_insert_manager_to_staff ON public.profiles;
CREATE TRIGGER trg_auto_insert_manager_to_staff
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_manager_profile();

-- -----------------------------------------------------------------------------
-- Helpers de autenticação simulada (por transação, como o PostgREST faz)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f1_set_auth(p_uid TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.f1_set_system()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', NULL, true);
END;
$$;