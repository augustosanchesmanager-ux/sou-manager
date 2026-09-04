-- =====================================================
-- P0.3-C: Cancelar Cobrança ≠ Dar Baixa
-- Migration 4: Criar RPC cancel_subscription_with_receivables
-- =====================================================

BEGIN;

-- Criar função atômica para cancelar assinatura e opcionalmente recebíveis
CREATE OR REPLACE FUNCTION public.cancel_subscription_with_receivables(
  p_subscription_id UUID,
  p_tenant_id UUID,
  p_cancel_receivables BOOLEAN DEFAULT FALSE,
  p_cancel_reason TEXT DEFAULT NULL,
  p_cancel_observation TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_auth_uid UUID;
  v_receivables_cancelled INTEGER := 0;
BEGIN
  -- Validação
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  v_auth_uid := auth.uid();

  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório';
  END IF;

  IF v_auth_uid IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  -- 1. Cancelar assinatura
  UPDATE public.customer_subscriptions
  SET status = 'canceled', canceled_at = now(), updated_at = now()
  WHERE id = p_subscription_id
    AND tenant_id = p_tenant_id
    AND status NOT IN ('canceled');

  -- 2. Se solicitado, cancelar recebíveis abertos
  IF p_cancel_receivables THEN
    IF NULLIF(BTRIM(COALESCE(p_cancel_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Motivo do cancelamento é obrigatório quando cancelar recebíveis';
    END IF;

    SELECT public.cancel_club_receivables(
      p_subscription_id,
      p_tenant_id,
      p_cancel_reason,
      p_cancel_observation
    ) INTO v_receivables_cancelled;
  END IF;

  -- 3. Retornar resultado
  RETURN jsonb_build_object(
    'subscription_cancelled', TRUE,
    'receivables_cancelled', v_receivables_cancelled
  );
END;
$$;

-- Grants
REVOKE ALL ON FUNCTION public.cancel_subscription_with_receivables(UUID, UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription_with_receivables(UUID, UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

-- Comentário
COMMENT ON FUNCTION public.cancel_subscription_with_receivables(UUID, UUID, BOOLEAN, TEXT, TEXT) IS 'Cancela assinatura e opcionalmente recebíveis abertos do Club dos Chefes';

COMMIT;
