-- =============================================================================
-- GTM Frente 4: Trial de 7 dias no plano PRO + Enforcement de Expiração
-- =============================================================================
-- Decisão do PO (2026-11-20):
--   1. Todo novo tenant criado via /register inicia em plano 'pro' (maxStaff=5
--      + Clube dos Chefes) em estado 'draft' até completar o onboarding.
--   2. Ao concluir o onboarding (complete_onboarding -> start_trial), o trial
--      tem duração de 7 dias (antes: 14 dias).
--   3. Enforcement server-side quando trial_ends_at <= now():
--      - tenant_has_feature retorna false se trial expirado.
--      - RPC sync_expired_trial_for_current_tenant transiciona trial/trialing
--        expirado para past_due (grace de 5 dias, alinhado ao billingEngine).
-- =============================================================================

-- 1) provision_new_tenant: novos cadastros iniciam no plano 'pro' (draft)
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
  VALUES (p_tenant_name, v_slug, 'draft', 'pro', p_app_slug)
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

  INSERT INTO public.user_tenants (user_id, tenant_id, role, is_primary)
  VALUES (p_user_id, v_tenant_id, 'manager', true)
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET
    role = EXCLUDED.role,
    is_primary = EXCLUDED.is_primary,
    updated_at = now();

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

REVOKE EXECUTE ON FUNCTION public.provision_new_tenant(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.provision_new_tenant(UUID, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.provision_new_tenant(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 2) start_trial: duração de 7 dias a partir do início do trial/provisionamento
CREATE OR REPLACE FUNCTION public.start_trial(p_tenant_id uuid, p_plan text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, tenant_id uuid, plan text, status text, trial_started_at timestamp with time zone, trial_ends_at timestamp with time zone, current_period_start timestamp with time zone, current_period_end timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_status text;
  v_tenant_plan text;
  v_tenant_created timestamptz;
  v_sub_id uuid;
  v_sub_status text;
  v_trial_start timestamptz;
  v_trial_end timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT t.status, t.plan, t.created_at
  INTO v_tenant_status, v_tenant_plan, v_tenant_created
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  IF v_tenant_status IS NULL THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  IF NOT public.current_is_tenant_manager_from_auth_uid(p_tenant_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to start trial';
  END IF;

  SELECT s.id INTO v_sub_id
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
    AND s.status IN ('trialing', 'active', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    RETURN QUERY
    SELECT s.id, s.tenant_id, s.plan, s.status, s.trial_started_at, s.trial_ends_at,
           s.current_period_start, s.current_period_end
    FROM public.subscriptions s
    WHERE s.id = v_sub_id;
    RETURN;
  END IF;

  v_sub_status := CASE
    WHEN v_tenant_status IN ('trial', 'draft') THEN 'trialing'
    WHEN v_tenant_status = 'active' THEN 'active'
    WHEN v_tenant_status = 'past_due' THEN 'past_due'
    ELSE 'trialing'
  END;

  v_trial_start := now();
  v_trial_end := v_trial_start + interval '7 days';

  INSERT INTO public.subscriptions AS sub (
    tenant_id, plan, status, trial_started_at, trial_ends_at,
    current_period_start, current_period_end
  )
  VALUES (
    p_tenant_id,
    COALESCE(NULLIF(p_plan, ''), v_tenant_plan, 'pro'),
    v_sub_status,
    v_trial_start,
    v_trial_end,
    v_trial_start,
    v_trial_end
  )
  RETURNING sub.id INTO v_sub_id;

  IF v_tenant_status = 'draft' THEN
    UPDATE public.tenants AS t
    SET status = 'trial', updated_at = now()
    WHERE t.id = p_tenant_id;
  END IF;

  PERFORM public.record_billing_event(
    p_tenant_id,
    'TenantTrialStarted',
    jsonb_build_object('subscription_id', v_sub_id, 'trial_ends_at', v_trial_end)
  );

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.trial_started_at, s.trial_ends_at,
         s.current_period_start, s.current_period_end
  FROM public.subscriptions s
  WHERE s.id = v_sub_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.start_trial(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_trial(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_trial(uuid, text) TO authenticated;

-- 3) tenant_has_feature: fail-closed quando o trial já expirou
CREATE OR REPLACE FUNCTION public.tenant_has_feature(
  p_tenant_id uuid,
  p_feature text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT
      CASE
        WHEN t.status IN ('suspended', 'archived') THEN false
        WHEN t.status = 'trial' AND EXISTS (
          SELECT 1
          FROM public.subscriptions s
          WHERE s.tenant_id = t.id
            AND s.status = 'trialing'
            AND s.trial_ends_at IS NOT NULL
            AND s.trial_ends_at <= now()
        ) THEN false
        WHEN ff.feature_key IS NOT NULL THEN ff.override
        ELSE EXISTS (
          SELECT 1
          FROM public.plan_features pf
          WHERE pf.plan_slug = t.plan
            AND pf.feature_key = p_feature
        )
      END
    FROM public.tenants t
    LEFT JOIN public.feature_flags ff
      ON ff.tenant_id = t.id
     AND ff.feature_key = p_feature
    WHERE t.id = p_tenant_id
      AND auth.uid() IS NOT NULL
      AND (
        p_tenant_id = public.current_tenant_id_from_auth_uid()
        OR public.current_is_super_admin_from_auth_uid()
      )
  ), false);
$$;

-- 4) sync_expired_trial_for_current_tenant: transiciona trial vencido -> past_due
CREATE OR REPLACE FUNCTION public.sync_expired_trial_for_current_tenant()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_sub record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('expired', false, 'reason', 'unauthenticated');
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('expired', false, 'reason', 'no_tenant');
  END IF;

  SELECT s.id, s.trial_ends_at
  INTO v_sub
  FROM public.subscriptions s
  JOIN public.tenants t ON t.id = s.tenant_id
  WHERE s.tenant_id = v_tenant_id
    AND t.status = 'trial'
    AND s.status = 'trialing'
    AND s.trial_ends_at IS NOT NULL
    AND s.trial_ends_at <= now()
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object('expired', false);
  END IF;

  UPDATE public.subscriptions
  SET status = 'past_due',
      grace_ends_at = v_sub.trial_ends_at + interval '5 days',
      updated_at = now()
  WHERE id = v_sub.id
    AND status = 'trialing';

  UPDATE public.tenants
  SET status = 'past_due',
      updated_at = now()
  WHERE id = v_tenant_id
    AND status = 'trial';

  RETURN jsonb_build_object(
    'expired', true,
    'tenant_id', v_tenant_id,
    'new_status', 'past_due'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_expired_trial_for_current_tenant() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_expired_trial_for_current_tenant() FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_expired_trial_for_current_tenant() TO authenticated;
