-- =============================================================================
-- Migration: Phase 6.0.1 — Tenant Provisioning (user_tenants + tenant_settings)
--
-- Alinhamento do provisionamento ao escopo aprovado pelo PO (Fase 6.0.1):
--   1. tenant_settings: adicionar colunas timezone/currency (TENANT_MODEL.md)
--   2. provision_new_tenant passa a criar:
--        - user_tenants   (membership do owner, role='manager', is_primary=true)
--        - tenant_settings (skeleton — valores preenchidos no complete_onboarding)
--   3. mantém: tenants, profiles, staff (via trigger handle_new_manager_profile)
--
-- DESIGN: a RPC faz trabalho transacional. Orquestração/eventos permanecem no
-- TenantProvisioningService (Application Layer).
-- =============================================================================

-- 1. tenant_settings: alinhar colunas com TENANT_MODEL.md (aprovado pelo PO)
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT;

-- 2. RPC provision_new_tenant: criar user_tenants + tenant_settings
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

  -- 2a. Membership do owner em user_tenants (caminho primário de resolução)
  -- Nota: usuário novo não possui outra primary; conflito no índice parcial
  -- one-primary-per-user é caso de futuro multi-tenant (fora do escopo 6.0.1).
  INSERT INTO public.user_tenants (user_id, tenant_id, role, is_primary)
  VALUES (p_user_id, v_tenant_id, 'manager', true)
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET
    role = EXCLUDED.role,
    is_primary = EXCLUDED.is_primary,
    updated_at = now();

  -- 2b. Skeleton de tenant_settings (valores preenchidos no complete_onboarding)
  INSERT INTO public.tenant_settings (tenant_id)
  VALUES (v_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'slug', v_slug,
    'already_exists', false
  );
END;
$$;
