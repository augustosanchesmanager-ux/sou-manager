-- =============================================================================
-- Migration: Security fix — provision_new_tenant unauthenticated bypass
--
-- PROBLEMA (Fase 6.0.1 / auditoria de segurança):
--   provision_new_tenant é SECURITY DEFINER e checava apenas:
--       IF p_user_id <> auth.uid() THEN RAISE EXCEPTION ...
--   Quando o chamador NÃO está autenticado, auth.uid() retorna NULL e a
--   comparação `p_user_id <> NULL` é UNKNOWN → o RAISE NUNCA dispara.
--   Ou seja, um anônimo podia provisionar um tenant para QUALQUER user_id.
--
-- CORREÇÃO:
--   1. IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Acesso negado' — rejeita
--      chamadas sem sessão ANTES de qualquer trabalho.
--   2. IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE ... — comparação
--      NULL-safe (redundante após o check 1, mantida por defesa em profundidade).
--
-- NOTA: com confirmação de e-mail ATIVADA no Supabase, o signUp NÃO retorna
-- sessão; o provisionamento passa a ser executado no PRIMEIRO LOGIN após a
-- confirmação do e-mail (fluxo frontend adaptado — ver pages/onboarding/
-- Provision.tsx). O RPC continua exigindo auth.uid() = p_user_id.
-- =============================================================================

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
  -- Security: caller must be authenticated AND be the user being provisioned.
  -- auth.uid() is NULL for anonymous calls — reject BEFORE the user check
  -- (avoids the `<> NULL = UNKNOWN` bypass).
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: autenticação obrigatória';
  END IF;

  IF p_user_id IS DISTINCT FROM auth.uid() THEN
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
