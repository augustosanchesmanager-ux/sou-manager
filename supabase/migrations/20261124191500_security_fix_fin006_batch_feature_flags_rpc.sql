-- ============================================================================
-- Migration: 20261124191500_security_fix_fin006_batch_feature_flags_rpc.sql
-- Issue: #387 (P1-01 | FIN-006)
-- Scope:
--   1. Create read-only SECURITY DEFINER RPC `public.get_tenant_feature_flags`
--      resolving all enabled FeatureKeys for a tenant in 1 single RPC call
--      (replacing 20 parallel `tenant_has_feature` calls at boot).
--   2. Enforce tenant isolation / SuperAdmin bypass and REVOKE EXECUTE from
--      PUBLIC and anon.
-- Note: Applied ONLY after PO review and explicit production authorization.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_tenant_feature_flags(
  p_tenant_id uuid
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_result text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '{}'::text[];
  END IF;

  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR p_tenant_id = public.current_tenant_id_from_auth_uid()
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to query feature flags for tenant %', p_tenant_id;
  END IF;

  SELECT COALESCE(
    array_agg(f.key ORDER BY f.key) FILTER (WHERE public.tenant_has_feature(p_tenant_id, f.key)),
    '{}'::text[]
  )
    INTO v_result
    FROM public.features f;

  RETURN COALESCE(v_result, '{}'::text[]);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_tenant_feature_flags(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_feature_flags(uuid) TO authenticated;

COMMIT;
