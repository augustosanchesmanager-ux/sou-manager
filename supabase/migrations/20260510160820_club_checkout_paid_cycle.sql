BEGIN;

-- ============================================================
-- Clube do Chefe: checkout exige ciclo pago
-- ============================================================

-- Checkout/agendamento só enxergam crédito quando o ciclo da assinatura tem recebimento pago.
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

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
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
    AND EXISTS (
      SELECT 1
      FROM public.customer_subscription_receivables csr
      WHERE csr.subscription_id = cs.id
        AND csr.tenant_id = cs.tenant_id
        AND csr.status = 'paid'
        AND csr.transaction_id IS NOT NULL
        AND COALESCE(p_start_time, now()) >= csr.billing_cycle_start
        AND COALESCE(p_start_time, now()) <= csr.billing_cycle_end
    )
  ORDER BY cs.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Cliente sem ciclo do Clube pago', 0, NULL::UUID;
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
    RETURN QUERY SELECT true, 'Crédito disponível para ciclo pago', v_available, v_subscription.id;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 'Sem créditos disponíveis para este serviço', 0, v_subscription.id;
END;
$$;

REVOKE ALL ON FUNCTION public.preview_plan_credit_for_service(UUID, UUID, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_plan_credit_for_service(UUID, UUID, UUID, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.deduct_chef_club_credits(
  p_subscription_id UUID,
  p_service_id UUID DEFAULT NULL,
  p_amount INTEGER DEFAULT 1,
  p_reference TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_credit_record public.customer_credits%ROWTYPE;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_rows INTEGER;
  v_balance_index INTEGER;
  v_balance JSONB;
  v_available INTEGER;
  v_used INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT *
  INTO v_subscription
  FROM public.customer_subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_subscription.tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_subscriptions cs
    JOIN public.customer_subscription_receivables csr
      ON csr.subscription_id = cs.id
     AND csr.tenant_id = cs.tenant_id
    WHERE cs.id = p_subscription_id
      AND cs.tenant_id = v_subscription.tenant_id
      AND cs.status = 'active'
      AND csr.status = 'paid'
      AND csr.transaction_id IS NOT NULL
      AND now() >= csr.billing_cycle_start
      AND now() <= csr.billing_cycle_end
  ) THEN
    RAISE EXCEPTION 'Clube sem ciclo pago vigente';
  END IF;

  IF p_service_id IS NULL THEN
    UPDATE public.customer_credits
    SET
      available_credits = available_credits - p_amount,
      used_credits = used_credits + p_amount,
      updated_at = now()
    WHERE subscription_id = p_subscription_id
      AND tenant_id = v_subscription.tenant_id
      AND available_credits >= p_amount;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      RAISE EXCEPTION 'Insufficient credits or subscription not found';
    END IF;

    RETURN;
  END IF;

  SELECT *
  INTO v_credit_record
  FROM public.customer_credits
  WHERE subscription_id = p_subscription_id
    AND tenant_id = v_subscription.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription credits not found';
  END IF;

  SELECT ordinality - 1, value
  INTO v_balance_index, v_balance
  FROM jsonb_array_elements(COALESCE(v_credit_record.service_balance_map, '[]'::jsonb)) WITH ORDINALITY AS entries(value, ordinality)
  WHERE value ->> 'service_id' = p_service_id::text
  LIMIT 1;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'No credits configured for this service';
  END IF;

  v_available := COALESCE((v_balance ->> 'available')::INTEGER, 0);
  v_used := COALESCE((v_balance ->> 'used')::INTEGER, 0);

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits for this service';
  END IF;

  v_balance := jsonb_set(v_balance, '{available}', to_jsonb(v_available - p_amount));
  v_balance := jsonb_set(v_balance, '{used}', to_jsonb(v_used + p_amount));

  UPDATE public.customer_credits
  SET
    available_credits = GREATEST(0, available_credits - p_amount),
    used_credits = used_credits + p_amount,
    service_balance_map = jsonb_set(
      COALESCE(service_balance_map, '[]'::jsonb),
      ARRAY[v_balance_index::text],
      v_balance,
      false
    ),
    updated_at = now()
  WHERE id = v_credit_record.id;
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_chef_club_credits(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_chef_club_credits(UUID, UUID, INTEGER, TEXT) TO authenticated;

DO $$
DECLARE
  v_subscription_id UUID;
BEGIN
  FOR v_subscription_id IN
    SELECT id
    FROM public.customer_subscriptions
    WHERE status IN ('active', 'past_due')
  LOOP
    PERFORM public.ensure_club_receivable_for_cycle(v_subscription_id);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
