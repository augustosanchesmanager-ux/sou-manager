BEGIN;

-- ============================================================
-- Clube do Chefe: geração e atualização de recebíveis
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_club_receivables(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_target_tenant_id UUID;
  v_subscription RECORD;
  v_count INTEGER := 0;
BEGIN
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  v_target_tenant_id := COALESCE(p_tenant_id, v_auth_tenant_id);

  IF v_target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant obrigatório';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_target_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  FOR v_subscription IN
    SELECT cs.id
    FROM public.customer_subscriptions cs
    WHERE cs.tenant_id = v_target_tenant_id
      AND cs.status IN ('active', 'past_due')
  LOOP
    PERFORM public.ensure_club_receivable_for_cycle(v_subscription.id);
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.customer_subscription_receivables
  SET status = 'overdue', updated_at = now()
  WHERE tenant_id = v_target_tenant_id
    AND status = 'pending'
    AND due_date < current_date;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_club_receivable_statuses(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_target_tenant_id UUID;
  v_count INTEGER;
BEGIN
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  v_target_tenant_id := COALESCE(p_tenant_id, v_auth_tenant_id);

  IF v_target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant obrigatório';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_target_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  UPDATE public.customer_subscription_receivables
  SET status = 'overdue', updated_at = now()
  WHERE tenant_id = v_target_tenant_id
    AND status = 'pending'
    AND due_date < current_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_club_receivables(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_club_receivables(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.refresh_club_receivable_statuses(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_club_receivable_statuses(UUID) TO authenticated;

COMMIT;
