BEGIN;

-- ============================================================
-- Clube do Chefe: baixa transacional de recebível
-- ============================================================

CREATE OR REPLACE FUNCTION public.pay_club_receivable(
  p_receivable_id UUID,
  p_payment_method TEXT,
  p_paid_at TIMESTAMPTZ,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_receivable public.customer_subscription_receivables%ROWTYPE;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_customer public.clients%ROWTYPE;
  v_plan public.customer_plans%ROWTYPE;
  v_transaction public.transactions%ROWTYPE;
  v_service_balance_map JSONB;
  v_total_credits INTEGER;
  v_next_cycle_start TIMESTAMPTZ;
  v_next_cycle_end TIMESTAMPTZ;
BEGIN
  IF p_receivable_id IS NULL THEN
    RAISE EXCEPTION 'Recebimento obrigatório';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_payment_method, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Forma de pagamento obrigatória';
  END IF;

  IF p_paid_at IS NULL THEN
    RAISE EXCEPTION 'Data de pagamento obrigatória';
  END IF;

  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT *
  INTO v_receivable
  FROM public.customer_subscription_receivables
  WHERE id = p_receivable_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento não encontrado';
  END IF;

  IF NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_receivable.tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  IF v_receivable.status NOT IN ('pending', 'overdue') THEN
    RAISE EXCEPTION 'Recebimento não está pendente ou atrasado';
  END IF;

  IF v_receivable.transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Recebimento já possui lançamento financeiro';
  END IF;

  SELECT *
  INTO v_subscription
  FROM public.customer_subscriptions
  WHERE id = v_receivable.subscription_id
    AND tenant_id = v_receivable.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada para o recebimento';
  END IF;

  IF v_subscription.client_id IS DISTINCT FROM v_receivable.customer_id THEN
    RAISE EXCEPTION 'Cliente do recebimento não confere com a assinatura';
  END IF;

  IF v_subscription.plan_id IS DISTINCT FROM v_receivable.plan_id THEN
    RAISE EXCEPTION 'Plano do recebimento não confere com a assinatura';
  END IF;

  SELECT *
  INTO v_customer
  FROM public.clients
  WHERE id = v_receivable.customer_id
    AND tenant_id = v_receivable.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado para o recebimento';
  END IF;

  SELECT *
  INTO v_plan
  FROM public.customer_plans
  WHERE id = v_receivable.plan_id
    AND tenant_id = v_receivable.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado para o recebimento';
  END IF;

  SELECT service_balance_map, total_credits
  INTO v_service_balance_map, v_total_credits
  FROM public.build_chef_club_service_balance_map(v_receivable.plan_id);

  IF v_total_credits <= 0 OR jsonb_array_length(COALESCE(v_service_balance_map, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Plano sem créditos por serviço configurados';
  END IF;

  INSERT INTO public.transactions (
    tenant_id,
    user_id,
    type,
    category,
    description,
    amount,
    payment_method,
    date,
    status,
    notes
  )
  VALUES (
    v_receivable.tenant_id,
    v_auth_uid,
    'income',
    'Receita recorrente Clube do Chefe',
    'Mensalidade Clube do Chefe - ' || COALESCE(v_plan.name, 'Plano') || ' - Cliente: ' || COALESCE(v_customer.name, 'Cliente'),
    v_receivable.amount,
    p_payment_method,
    p_paid_at,
    'paid',
    p_notes
  )
  RETURNING * INTO v_transaction;

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
    v_receivable.tenant_id,
    v_receivable.customer_id,
    v_receivable.subscription_id,
    v_total_credits,
    0,
    v_service_balance_map,
    v_receivable.billing_cycle_start,
    v_receivable.billing_cycle_end
  )
  ON CONFLICT (subscription_id) DO UPDATE
  SET
    tenant_id = EXCLUDED.tenant_id,
    client_id = EXCLUDED.client_id,
    available_credits = EXCLUDED.available_credits,
    used_credits = EXCLUDED.used_credits,
    service_balance_map = EXCLUDED.service_balance_map,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    updated_at = now();

  UPDATE public.customer_subscription_receivables
  SET
    status = 'paid',
    payment_method = p_payment_method,
    paid_at = p_paid_at,
    paid_by = v_auth_uid,
    transaction_id = v_transaction.id,
    notes = NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    updated_at = now()
  WHERE id = v_receivable.id
    AND transaction_id IS NULL
    AND status IN ('pending', 'overdue')
  RETURNING * INTO v_receivable;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento já foi baixado por outra operação';
  END IF;

  UPDATE public.customer_subscriptions
  SET
    status = 'active',
    cycle_start = v_receivable.billing_cycle_start,
    cycle_end = v_receivable.billing_cycle_end,
    next_billing_date = v_receivable.billing_cycle_end::DATE,
    updated_at = now()
  WHERE id = v_receivable.subscription_id;

  v_next_cycle_start := v_receivable.billing_cycle_end;
  v_next_cycle_end := v_receivable.billing_cycle_end + interval '1 month';

  PERFORM public.ensure_club_receivable_for_cycle(
    v_receivable.subscription_id,
    v_next_cycle_start,
    v_next_cycle_end,
    v_next_cycle_start::DATE
  );

  RETURN jsonb_build_object(
    'receivable', to_jsonb(v_receivable),
    'transaction', to_jsonb(v_transaction),
    'credits', (
      SELECT to_jsonb(cc)
      FROM public.customer_credits cc
      WHERE cc.subscription_id = v_receivable.subscription_id
      LIMIT 1
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_club_receivable(UUID, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_club_receivable(UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

COMMIT;
