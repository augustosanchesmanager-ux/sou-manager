-- =====================================================
-- P0.3-C: Cancelar Cobrança ≠ Dar Baixa
-- Migration 3: Criar RPC cancel_club_receivables
-- =====================================================

BEGIN;

-- Criar função para cancelar recebíveis
CREATE OR REPLACE FUNCTION public.cancel_club_receivables(
  p_subscription_id UUID,
  p_tenant_id UUID,
  p_cancel_reason TEXT,
  p_cancel_observation TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_auth_uid UUID;
  v_count INTEGER := 0;
  v_receivable RECORD;
BEGIN
  -- Validação de tenant
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

  -- Validar motivo
  IF NULLIF(BTRIM(COALESCE(p_cancel_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motivo do cancelamento é obrigatório';
  END IF;

  -- Cancelar recebíveis pending/overdue e inserir auditoria
  FOR v_receivable IN
    SELECT id, subscription_id, amount, status, billing_cycle_start, billing_cycle_end
    FROM public.customer_subscription_receivables
    WHERE subscription_id = p_subscription_id
      AND tenant_id = p_tenant_id
      AND status IN ('pending', 'overdue')
  LOOP
    -- Inserir registro de auditoria ANTES de cancelar
    INSERT INTO public.receivable_cancel_audit (
      receivable_id,
      subscription_id,
      tenant_id,
      amount,
      previous_status,
      new_status,
      cancel_reason,
      cancel_observation,
      cancelled_by,
      cancelled_at
    ) VALUES (
      v_receivable.id,
      v_receivable.subscription_id,
      p_tenant_id,
      v_receivable.amount,
      v_receivable.status,
      'cancelled',
      p_cancel_reason,
      NULLIF(BTRIM(COALESCE(p_cancel_observation, '')), ''),
      v_auth_uid,
      now()
    );

    -- Cancelar o recebível
    UPDATE public.customer_subscription_receivables
    SET
      status = 'cancelled',
      previous_status = v_receivable.status,
      cancel_reason = p_cancel_reason,
      cancel_observation = NULLIF(BTRIM(COALESCE(p_cancel_observation, '')), ''),
      cancelled_by = v_auth_uid,
      cancelled_at = now(),
      updated_at = now()
    WHERE id = v_receivable.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Grants
REVOKE ALL ON FUNCTION public.cancel_club_receivables(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_club_receivables(UUID, UUID, TEXT, TEXT) TO authenticated;

-- Comentário
COMMENT ON FUNCTION public.cancel_club_receivables(UUID, UUID, TEXT, TEXT) IS 'Cancela recebíveis pending/overdue de uma assinatura do Club dos Chefes';

COMMIT;
