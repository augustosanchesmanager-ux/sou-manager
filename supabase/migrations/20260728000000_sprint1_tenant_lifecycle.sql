-- =============================================================================
-- Migration: Sprint 1 — Tenant Lifecycle & Onboarding
-- Fase 6.0.1 + 6.0.2
--
-- 1. Create tenant_status ENUM type
-- 2. Replace tenants.active (BOOLEAN) → tenants.status (tenant_status)
-- 3. Add tenants.app_slug column
-- 4. Create tenant_settings table (operational data)
-- 5. Create generate_unique_slug() helper function
-- 6. Create provision_new_tenant() RPC (transactional only)
-- 7. Create complete_onboarding() RPC
-- 8. RLS policies for tenant_settings
--
-- DESIGN: RPCs do transactional work only. Orchestration (events, defaults,
-- business rules) lives in Application Services.
-- =============================================================================

-- 1. ENUM type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_status') THEN
    CREATE TYPE public.tenant_status AS ENUM (
      'draft', 'trial', 'active', 'past_due', 'suspended', 'cancelled', 'archived'
    );
  END IF;
END
$$;

-- 2. Replace active → status
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS status public.tenant_status DEFAULT 'draft';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'active') THEN
    UPDATE public.tenants
      SET status = CASE WHEN active = true THEN 'active'::public.tenant_status ELSE 'cancelled'::public.tenant_status END
      WHERE status = 'draft' AND active IS NOT NULL;
  END IF;
END;
$$;

ALTER TABLE public.tenants
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.tenants
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.tenants
  DROP COLUMN IF EXISTS active;

CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);

-- 3. app_slug column
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS app_slug TEXT NOT NULL DEFAULT 'barber';

-- 4. tenant_settings table
CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  chair_count INTEGER,
  business_hours JSONB,
  phone TEXT,
  cnpj TEXT,
  address_street TEXT,
  address_number TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- 4a. RLS: tenant isolation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'tenant_settings'
          AND policyname = 'tenant_settings_isolation'
    ) THEN
        CREATE POLICY "tenant_settings_isolation" ON public.tenant_settings
            USING (tenant_id = public.current_tenant_id_from_auth_uid());
    END IF;
END
$$;

-- 4b. RLS: superadmin bypass
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'tenant_settings'
          AND policyname = 'tenant_settings_superadmin_bypass'
    ) THEN
        CREATE POLICY "tenant_settings_superadmin_bypass" ON public.tenant_settings
            USING (public.current_is_super_admin_from_auth_uid());
    END IF;
END
$$;

-- 5. Slug generation helper
CREATE OR REPLACE FUNCTION public.generate_unique_slug(p_base_slug TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate TEXT;
  v_counter INTEGER := 2;
BEGIN
  v_candidate := lower(regexp_replace(p_base_slug, '[^a-z0-9]+', '-', 'g'));
  v_candidate := regexp_replace(v_candidate, '^-|-$', '', 'g');

  IF v_candidate = '' THEN
    v_candidate := 'tenant';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_candidate) THEN
    RETURN v_candidate;
  END IF;

  WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_candidate || '-' || v_counter) LOOP
    v_counter := v_counter + 1;
  END LOOP;

  RETURN v_candidate || '-' || v_counter;
END;
$$;

-- 6. Tenant provisioning (transactional only — orchestration in Application Service)
CREATE OR REPLACE FUNCTION public.provision_new_tenant(
  p_user_id UUID,
  p_tenant_name TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_app_slug TEXT DEFAULT 'barber'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_slug TEXT;
  v_profile_exists BOOLEAN;
BEGIN
  -- Security: caller must be the user being provisioned
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado: user_id não corresponde ao chamador';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_user_id) INTO v_profile_exists;

  IF v_profile_exists THEN
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = p_user_id;
    IF v_tenant_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'slug', (SELECT slug FROM public.tenants WHERE id = v_tenant_id),
        'already_exists', true
      );
    END IF;
  END IF;

  v_slug := public.generate_unique_slug(p_tenant_name);

  INSERT INTO public.tenants (name, slug, status, plan, app_slug)
  VALUES (p_tenant_name, v_slug, 'draft', 'free', p_app_slug)
  RETURNING id INTO v_tenant_id;

  INSERT INTO public.profiles (id, tenant_id, full_name, role, status)
  VALUES (
    p_user_id,
    v_tenant_id,
    TRIM(CONCAT(COALESCE(p_first_name, ''), ' ', COALESCE(p_last_name, ''))),
    'manager',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = now();

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'slug', v_slug,
    'already_exists', false
  );
END;
$$;

-- 7. Complete onboarding
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_tenant_id UUID,
  p_chair_count INTEGER DEFAULT NULL,
  p_business_hours JSONB DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_cnpj TEXT DEFAULT NULL,
  p_address_street TEXT DEFAULT NULL,
  p_address_number TEXT DEFAULT NULL,
  p_address_city TEXT DEFAULT NULL,
  p_address_state TEXT DEFAULT NULL,
  p_address_zip TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security: caller must be a manager of the tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND tenant_id = p_tenant_id AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas managers do tenant podem completar onboarding';
  END IF;

  INSERT INTO public.tenant_settings (
    tenant_id, chair_count, business_hours, phone, cnpj,
    address_street, address_number, address_city, address_state, address_zip
  ) VALUES (
    p_tenant_id, p_chair_count, p_business_hours, p_phone, p_cnpj,
    p_address_street, p_address_number, p_address_city, p_address_state, p_address_zip
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    chair_count = EXCLUDED.chair_count,
    business_hours = EXCLUDED.business_hours,
    phone = EXCLUDED.phone,
    cnpj = EXCLUDED.cnpj,
    address_street = EXCLUDED.address_street,
    address_number = EXCLUDED.address_number,
    address_city = EXCLUDED.address_city,
    address_state = EXCLUDED.address_state,
    address_zip = EXCLUDED.address_zip,
    updated_at = now();

  UPDATE public.tenants SET status = 'active' WHERE id = p_tenant_id;

  UPDATE public.profiles SET onboarding_completed = true WHERE tenant_id = p_tenant_id;
END;
$$;
