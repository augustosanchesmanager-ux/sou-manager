BEGIN;

-- ============================================================
-- Clube dos Chefes: preview seguro de crédito por serviço
-- Corrige função existente com tipo de retorno incompatível.
-- ============================================================

DROP FUNCTION IF EXISTS public.preview_plan_credit_for_service(UUID, UUID, UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.preview_plan_credit_for_service(
  p_tenant_id UUID,
  p_client_id UUID,
  p_service_id UUID,
  p_start_time TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  eligible BOOLEAN,
  reason TEXT,
  available_credits INTEGER,
  subscription_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_credit_record public.customer_credits%ROWTYPE;
  v_balance JSONB;
  v_available INTEGER := 0;
BEGIN
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  IF p_tenant_id IS NULL THEN
    RETURN QUERY SELECT false, 'Tenant obrigatório', 0, NULL::UUID;
    RETURN;
  END IF;

  IF NOT COALESCE(v_is_super_admin, false) AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN QUERY SELECT false, 'Tenant não autorizado', 0, NULL::UUID;
    RETURN;
  END IF;

  IF p_client_id IS NULL THEN
    RETURN QUERY SELECT false, 'Cliente obrigatório', 0, NULL::UUID;
    RETURN;
  END IF;

  IF p_service_id IS NULL THEN
    RETURN QUERY SELECT false, 'Serviço obrigatório', 0, NULL::UUID;
    RETURN;
  END IF;

  SELECT *
  INTO v_subscription
  FROM public.customer_subscriptions cs
  WHERE cs.tenant_id = p_tenant_id
    AND cs.client_id = p_client_id
    AND cs.status = 'active'
    AND (
      p_start_time IS NULL
      OR (
        p_start_time >= cs.cycle_start
        AND p_start_time <= cs.cycle_end
      )
    )
  ORDER BY cs.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Cliente sem assinatura ativa no ciclo', 0, NULL::UUID;
    RETURN;
  END IF;

  SELECT *
  INTO v_credit_record
  FROM public.customer_credits cc
  WHERE cc.tenant_id = p_tenant_id
    AND cc.subscription_id = v_subscription.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Assinatura sem créditos lançados', 0, v_subscription.id;
    RETURN;
  END IF;

  SELECT entry.value
  INTO v_balance
  FROM jsonb_array_elements(COALESCE(v_credit_record.service_balance_map, '[]'::jsonb)) AS entry(value)
  WHERE entry.value ->> 'service_id' = p_service_id::TEXT
  LIMIT 1;

  IF v_balance IS NOT NULL THEN
    v_available := GREATEST(0, COALESCE((v_balance ->> 'available')::INTEGER, 0));
  ELSE
    v_available := 0;
  END IF;

  IF v_available > 0 THEN
    RETURN QUERY SELECT true, 'Crédito disponível para o serviço', v_available, v_subscription.id;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 'Sem créditos disponíveis para este serviço', 0, v_subscription.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_plan_credit_for_service(UUID, UUID, UUID, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
