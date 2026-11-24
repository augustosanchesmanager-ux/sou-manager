-- ============================================================================
-- Migration: 20261124185500_security_fix_gtm007_superadmin_operational_rpcs.sql
-- Issue: #383 (P0-08 | GTM-007 + SEC-004)
-- Scope:
--   1. Create SuperAdmin-only SECURITY DEFINER RPCs for operational tenant,
--      trial, plan, profile, and support-ticket management with audit_logs:
--        - public.superadmin_update_tenant_status(uuid, text, text)
--        - public.superadmin_extend_tenant_trial(uuid, integer)
--        - public.superadmin_change_tenant_plan(uuid, text)
--        - public.superadmin_decide_profile_status(uuid, text)
--        - public.superadmin_respond_support_ticket(uuid, text, text)
--   2. Enforce strict current_is_super_admin_from_auth_uid() checks and
--      REVOKE EXECUTE from PUBLIC and anon.
-- Note: Applied ONLY after PO review and explicit production authorization.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.superadmin_update_tenant_status(
  p_tenant_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now timestamptz := now();
  v_prev_status text;
  v_sub_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'SuperAdmin privileges required';
  END IF;

  IF p_status NOT IN ('trial', 'active', 'past_due', 'suspended', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid tenant status: %', p_status;
  END IF;

  SELECT t.status INTO v_prev_status
    FROM public.tenants t
   WHERE t.id = p_tenant_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  UPDATE public.tenants
     SET status = p_status,
         updated_at = v_now
   WHERE id = p_tenant_id;

  v_sub_status := CASE p_status
    WHEN 'trial' THEN 'trialing'
    WHEN 'active' THEN 'active'
    WHEN 'past_due' THEN 'past_due'
    WHEN 'suspended' THEN 'past_due'
    WHEN 'cancelled' THEN 'cancelled'
  END;

  UPDATE public.subscriptions
     SET status = v_sub_status,
         canceled_at = CASE WHEN v_sub_status = 'cancelled' THEN COALESCE(canceled_at, v_now) ELSE NULL END,
         updated_at = v_now
   WHERE tenant_id = p_tenant_id
     AND status IN ('trialing', 'active', 'past_due');

  INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, tenant_id)
  VALUES (
    'tenants',
    p_tenant_id::text,
    'SUPERADMIN_STATUS_UPDATE',
    jsonb_build_object('status', v_prev_status),
    jsonb_build_object('status', p_status, 'reason', p_reason),
    auth.uid(),
    p_tenant_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'previous_status', v_prev_status,
    'status', p_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.superadmin_extend_tenant_trial(
  p_tenant_id uuid,
  p_extra_days integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now timestamptz := now();
  v_new_end timestamptz;
  v_sub_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'SuperAdmin privileges required';
  END IF;

  IF p_extra_days IS NULL OR p_extra_days < 1 OR p_extra_days > 90 THEN
    RAISE EXCEPTION 'extra_days must be between 1 and 90';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_tenant_id FOR UPDATE) THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  SELECT s.id, GREATEST(COALESCE(s.trial_ends_at, v_now), v_now) + make_interval(days => p_extra_days)
    INTO v_sub_id, v_new_end
    FROM public.subscriptions s
   WHERE s.tenant_id = p_tenant_id
     AND s.status IN ('trialing', 'active', 'past_due')
   ORDER BY s.created_at DESC
   LIMIT 1
     FOR UPDATE;

  IF v_sub_id IS NOT NULL THEN
    UPDATE public.subscriptions
       SET status = 'trialing',
           trial_ends_at = v_new_end,
           current_period_end = GREATEST(COALESCE(current_period_end, v_new_end), v_new_end),
           updated_at = v_now
     WHERE id = v_sub_id;
  ELSE
    v_new_end := v_now + make_interval(days => p_extra_days);
    INSERT INTO public.subscriptions (
      tenant_id, plan, status, trial_started_at, trial_ends_at, current_period_start, current_period_end
    )
    SELECT t.id, COALESCE(t.plan, 'free'), 'trialing', v_now, v_new_end, v_now, v_new_end
      FROM public.tenants t
     WHERE t.id = p_tenant_id
    RETURNING id INTO v_sub_id;
  END IF;

  UPDATE public.tenants
     SET status = 'trial',
         updated_at = v_now
   WHERE id = p_tenant_id;

  INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by, tenant_id)
  VALUES (
    'subscriptions',
    v_sub_id::text,
    'SUPERADMIN_TRIAL_EXTENDED',
    jsonb_build_object('extra_days', p_extra_days, 'trial_ends_at', v_new_end),
    auth.uid(),
    p_tenant_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'subscription_id', v_sub_id,
    'trial_ends_at', v_new_end
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.superadmin_change_tenant_plan(
  p_tenant_id uuid,
  p_target_plan text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now timestamptz := now();
  v_prev_plan text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'SuperAdmin privileges required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.plans p WHERE p.slug = p_target_plan AND p.status = 'active') THEN
    RAISE EXCEPTION 'Plan "%" is invalid or inactive', p_target_plan;
  END IF;

  SELECT t.plan INTO v_prev_plan
    FROM public.tenants t
   WHERE t.id = p_tenant_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  UPDATE public.tenants
     SET plan = p_target_plan,
         updated_at = v_now
   WHERE id = p_tenant_id;

  UPDATE public.subscriptions
     SET plan = p_target_plan,
         updated_at = v_now
   WHERE tenant_id = p_tenant_id
     AND status IN ('trialing', 'active', 'past_due');

  INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, tenant_id)
  VALUES (
    'tenants',
    p_tenant_id::text,
    'SUPERADMIN_PLAN_CHANGED',
    jsonb_build_object('plan', v_prev_plan),
    jsonb_build_object('plan', p_target_plan),
    auth.uid(),
    p_tenant_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'previous_plan', v_prev_plan,
    'plan', p_target_plan
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.superadmin_decide_profile_status(
  p_profile_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now timestamptz := now();
  v_prev_status text;
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'SuperAdmin privileges required';
  END IF;

  IF p_status NOT IN ('active', 'pending', 'suspended') THEN
    RAISE EXCEPTION 'Invalid profile status: %', p_status;
  END IF;

  SELECT p.status, p.tenant_id INTO v_prev_status, v_tenant_id
    FROM public.profiles p
   WHERE p.id = p_profile_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % not found', p_profile_id;
  END IF;

  UPDATE public.profiles
     SET status = p_status,
         updated_at = v_now
   WHERE id = p_profile_id;

  INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, tenant_id)
  VALUES (
    'profiles',
    p_profile_id::text,
    'SUPERADMIN_PROFILE_STATUS',
    jsonb_build_object('status', v_prev_status),
    jsonb_build_object('status', p_status),
    auth.uid(),
    v_tenant_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', p_profile_id,
    'previous_status', v_prev_status,
    'status', p_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.superadmin_respond_support_ticket(
  p_ticket_id uuid,
  p_response text,
  p_status text DEFAULT 'responded'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now timestamptz := now();
  v_prev_status text;
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'SuperAdmin privileges required';
  END IF;

  IF p_status NOT IN ('open', 'responded', 'closed') THEN
    RAISE EXCEPTION 'Invalid ticket status: %', p_status;
  END IF;

  SELECT st.status, st.tenant_id INTO v_prev_status, v_tenant_id
    FROM public.support_tickets st
   WHERE st.id = p_ticket_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket % not found', p_ticket_id;
  END IF;

  UPDATE public.support_tickets
     SET status = p_status,
         admin_response = COALESCE(NULLIF(btrim(p_response), ''), admin_response),
         updated_at = v_now
   WHERE id = p_ticket_id;

  INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, tenant_id)
  VALUES (
    'support_tickets',
    p_ticket_id::text,
    'SUPERADMIN_TICKET_RESPONDED',
    jsonb_build_object('status', v_prev_status),
    jsonb_build_object('status', p_status),
    auth.uid(),
    v_tenant_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'status', p_status
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.superadmin_update_tenant_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.superadmin_extend_tenant_trial(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.superadmin_change_tenant_plan(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.superadmin_decide_profile_status(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.superadmin_respond_support_ticket(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.superadmin_update_tenant_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_extend_tenant_trial(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_change_tenant_plan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_decide_profile_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_respond_support_ticket(uuid, text, text) TO authenticated;

COMMIT;
