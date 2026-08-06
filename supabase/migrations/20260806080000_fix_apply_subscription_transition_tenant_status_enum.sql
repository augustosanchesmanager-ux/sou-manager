-- =====================================================
-- FIX — apply_subscription_transition: type mismatch (text -> tenant_status)
-- Data: 2026-08-06
-- Motivo:
--   public.tenants.status é do tipo enum tenant_status. A RPC declarava
--   v_tenant_status como text e fazia "SET status = v_tenant_status",
--   resultando em: column "status" is of type tenant_status but expression
--   is of type text. Correção: declarar a variável com o tipo enum
--   (os literais do CASE, sendo untyped, coagem para o enum).
-- Escopo: somente apply_subscription_transition.
-- =====================================================
CREATE OR REPLACE FUNCTION public.apply_subscription_transition(
  p_subscription_id uuid,
  p_status text,
  p_current_period_start timestamptz DEFAULT NULL,
  p_current_period_end timestamptz DEFAULT NULL,
  p_canceled_at timestamptz DEFAULT NULL,
  p_clear_cancel_request boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end timestamptz,
  canceled_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_tenant_status public.tenant_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT s.tenant_id INTO v_tenant_id
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = auth.uid()
        AND s.tenant_id = v_tenant_id
        AND s.status = 'active'
        AND s.role IN ('owner', 'manager', 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to apply subscription transition';
  END IF;

  UPDATE public.subscriptions AS s
  SET status = p_status,
      current_period_start = COALESCE(p_current_period_start, s.current_period_start),
      current_period_end = COALESCE(p_current_period_end, s.current_period_end),
      canceled_at = COALESCE(p_canceled_at, s.canceled_at),
      cancel_at_period_end = CASE WHEN p_clear_cancel_request THEN NULL ELSE s.cancel_at_period_end END,
      updated_at = now()
  WHERE s.id = p_subscription_id;

  -- Espelha o status do tenant (mapeamento 1:1 com o ciclo)
  v_tenant_status := CASE p_status
    WHEN 'trialing' THEN 'trial'
    WHEN 'active' THEN 'active'
    WHEN 'past_due' THEN 'past_due'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE 'active'
  END;

  UPDATE public.tenants AS t
  SET status = v_tenant_status, updated_at = now()
  WHERE t.id = v_tenant_id;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.current_period_start, s.current_period_end,
         s.cancel_at_period_end, s.canceled_at
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id;
END;
$function$;

-- GRANTs (ADR-012) — CREATE OR REPLACE preserva, mas reafirma por clareza
REVOKE EXECUTE ON FUNCTION public.apply_subscription_transition(uuid, text, timestamptz, timestamptz, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_subscription_transition(uuid, text, timestamptz, timestamptz, timestamptz, boolean) TO authenticated;
