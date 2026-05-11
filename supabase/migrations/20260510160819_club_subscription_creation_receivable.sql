BEGIN;

-- ============================================================
-- Clube do Chefe: assinatura cria recebível pendente
-- ============================================================

-- Atualiza criação de assinatura para também gerar o recebimento pendente do ciclo.
CREATE OR REPLACE FUNCTION public.create_chef_club_subscription(
  p_tenant_id UUID,
  p_client_id UUID,
  p_plan_id UUID,
  p_next_billing_date DATE,
  p_replace_existing BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_plan public.customer_plans%ROWTYPE;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_existing_subscription public.customer_subscriptions%ROWTYPE;
  v_cycle_start TIMESTAMPTZ := now();
  v_cycle_end TIMESTAMPTZ;
  v_service_balance_map JSONB;
  v_total_credits INTEGER;
  v_receivable_id UUID;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant obrigatório';
  END IF;

  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Cliente obrigatório';
  END IF;

  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plano obrigatório';
  END IF;

  IF p_next_billing_date IS NULL THEN
    RAISE EXCEPTION 'Próxima cobrança obrigatória';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = p_client_id
      AND c.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Cliente não encontrado para este tenant';
  END IF;

  SELECT *
  INTO v_plan
  FROM public.customer_plans cp
  WHERE cp.id = p_plan_id
    AND cp.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado para este tenant';
  END IF;

  IF NOT COALESCE(v_plan.active, false) THEN
    RAISE EXCEPTION 'Plano inativo';
  END IF;

  SELECT service_balance_map, total_credits
  INTO v_service_balance_map, v_total_credits
  FROM public.build_chef_club_service_balance_map(p_plan_id);

  IF v_total_credits <= 0 OR jsonb_array_length(COALESCE(v_service_balance_map, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Plano sem créditos por serviço configurados';
  END IF;

  SELECT COALESCE(
    jsonb_agg(jsonb_set(entry.value, '{available}', to_jsonb(0)) ORDER BY entry.ordinality),
    '[]'::jsonb
  )
  INTO v_service_balance_map
  FROM jsonb_array_elements(COALESCE(v_service_balance_map, '[]'::jsonb)) WITH ORDINALITY AS entry(value, ordinality);

  v_cycle_end := (p_next_billing_date::TIMESTAMP + time '12:00')::TIMESTAMPTZ;

  SELECT *
  INTO v_existing_subscription
  FROM public.customer_subscriptions cs
  WHERE cs.tenant_id = p_tenant_id
    AND cs.client_id = p_client_id
    AND cs.status IN ('active', 'past_due', 'paused')
  ORDER BY
    CASE cs.status
      WHEN 'active' THEN 0
      WHEN 'past_due' THEN 1
      WHEN 'paused' THEN 2
      ELSE 3
    END,
    cs.updated_at DESC,
    cs.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF NOT p_replace_existing THEN
      RAISE EXCEPTION 'Cliente já possui assinatura aberta';
    END IF;

    UPDATE public.customer_subscriptions
    SET
      plan_id = p_plan_id,
      status = 'active',
      cycle_start = v_cycle_start,
      cycle_end = v_cycle_end,
      next_billing_date = p_next_billing_date,
      canceled_at = NULL,
      updated_at = now()
    WHERE id = v_existing_subscription.id
    RETURNING * INTO v_subscription;
  ELSE
    INSERT INTO public.customer_subscriptions (
      tenant_id,
      client_id,
      plan_id,
      status,
      started_at,
      cycle_start,
      cycle_end,
      next_billing_date
    )
    VALUES (
      p_tenant_id,
      p_client_id,
      p_plan_id,
      'active',
      v_cycle_start,
      v_cycle_start,
      v_cycle_end,
      p_next_billing_date
    )
    RETURNING * INTO v_subscription;
  END IF;

  INSERT INTO public.customer_credits (
    tenant_id,
    client_id,
    subscription_id,
    available_credits,
    used_credits,
    service_balance_map,
    period_start,
    period_end
  )
  VALUES (
    p_tenant_id,
    p_client_id,
    v_subscription.id,
    0,
    0,
    v_service_balance_map,
    v_subscription.cycle_start,
    v_subscription.cycle_end
  )
  ON CONFLICT (subscription_id) DO UPDATE
  SET
    tenant_id = EXCLUDED.tenant_id,
    client_id = EXCLUDED.client_id,
    available_credits = 0,
    used_credits = 0,
    service_balance_map = EXCLUDED.service_balance_map,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    updated_at = now();

  v_receivable_id := public.ensure_club_receivable_for_cycle(
    v_subscription.id,
    v_subscription.cycle_start,
    v_subscription.cycle_end,
    v_subscription.cycle_start::DATE
  );

  RETURN jsonb_build_object(
    'subscription', to_jsonb(v_subscription),
    'receivable_id', v_receivable_id,
    'credits', (
      SELECT to_jsonb(cc)
      FROM public.customer_credits cc
      WHERE cc.subscription_id = v_subscription.id
      LIMIT 1
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_chef_club_subscription(UUID, UUID, UUID, DATE, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_chef_club_subscription(UUID, UUID, UUID, DATE, BOOLEAN) TO authenticated;

COMMIT;
