BEGIN;

-- ============================================================
-- Clube do Chefe: recebimentos mensais e baixa transacional
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customer_subscription_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.customer_plans(id) ON DELETE RESTRICT,
  billing_cycle_start TIMESTAMPTZ NOT NULL,
  billing_cycle_end TIMESTAMPTZ NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (billing_cycle_end > billing_cycle_start),
  CHECK (
    (status = 'paid' AND paid_at IS NOT NULL)
    OR (status <> 'paid')
  ),
  UNIQUE (subscription_id, billing_cycle_start, billing_cycle_end)
);

CREATE INDEX IF NOT EXISTS idx_club_receivables_tenant_status_due
  ON public.customer_subscription_receivables(tenant_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_club_receivables_customer
  ON public.customer_subscription_receivables(tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_club_receivables_subscription
  ON public.customer_subscription_receivables(subscription_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_receivables_transaction_id
  ON public.customer_subscription_receivables(transaction_id)
  WHERE transaction_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_customer_subscription_receivables_updated_at ON public.customer_subscription_receivables;
CREATE TRIGGER trg_customer_subscription_receivables_updated_at
BEFORE UPDATE ON public.customer_subscription_receivables
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.customer_subscription_receivables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_subscription_receivables_tenant_isolation ON public.customer_subscription_receivables;
CREATE POLICY customer_subscription_receivables_tenant_isolation
ON public.customer_subscription_receivables
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

CREATE OR REPLACE FUNCTION public.build_chef_club_service_balance_map(p_plan_id UUID)
RETURNS TABLE (
  service_balance_map JSONB,
  total_credits INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.customer_plans%ROWTYPE;
BEGIN
  SELECT *
  INTO v_plan
  FROM public.customer_plans
  WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'service_id', service_id,
          'service_name', service_name,
          'available', credits,
          'used', 0
        )
        ORDER BY ordinality
      ),
      '[]'::jsonb
    ) AS service_balance_map,
    COALESCE(SUM(credits), 0)::INTEGER AS total_credits
  FROM (
    SELECT
      NULLIF(BTRIM(entry.value ->> 'service_id'), '') AS service_id,
      NULLIF(BTRIM(entry.value ->> 'service_name'), '') AS service_name,
      GREATEST(0, COALESCE((entry.value ->> 'credits')::INTEGER, 0)) AS credits,
      entry.ordinality
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(COALESCE(v_plan.service_credit_map, '[]'::jsonb)) = 'array'
          THEN COALESCE(v_plan.service_credit_map, '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS entry(value, ordinality)
  ) normalized
  WHERE service_id IS NOT NULL
    AND service_name IS NOT NULL
    AND credits > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_club_receivable_for_cycle(
  p_subscription_id UUID,
  p_billing_cycle_start TIMESTAMPTZ DEFAULT NULL,
  p_billing_cycle_end TIMESTAMPTZ DEFAULT NULL,
  p_due_date DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_plan public.customer_plans%ROWTYPE;
  v_cycle_start TIMESTAMPTZ;
  v_cycle_end TIMESTAMPTZ;
  v_due_date DATE;
  v_receivable_id UUID;
BEGIN
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT *
  INTO v_subscription
  FROM public.customer_subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_subscription.tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  SELECT *
  INTO v_plan
  FROM public.customer_plans
  WHERE id = v_subscription.plan_id
    AND tenant_id = v_subscription.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano da assinatura não encontrado';
  END IF;

  v_cycle_start := COALESCE(p_billing_cycle_start, v_subscription.cycle_start);
  v_cycle_end := COALESCE(
    p_billing_cycle_end,
    CASE
      WHEN v_subscription.cycle_end > v_cycle_start THEN v_subscription.cycle_end
      ELSE v_cycle_start + interval '1 month'
    END
  );
  v_due_date := COALESCE(p_due_date, v_cycle_start::DATE);

  INSERT INTO public.customer_subscription_receivables (
    tenant_id,
    customer_id,
    subscription_id,
    plan_id,
    billing_cycle_start,
    billing_cycle_end,
    due_date,
    amount,
    status
  )
  VALUES (
    v_subscription.tenant_id,
    v_subscription.client_id,
    v_subscription.id,
    v_subscription.plan_id,
    v_cycle_start,
    v_cycle_end,
    v_due_date,
    COALESCE(v_plan.monthly_price, 0),
    CASE WHEN v_due_date < current_date THEN 'overdue' ELSE 'pending' END
  )
  ON CONFLICT (subscription_id, billing_cycle_start, billing_cycle_end) DO UPDATE
  SET
    plan_id = EXCLUDED.plan_id,
    amount = EXCLUDED.amount,
    due_date = EXCLUDED.due_date,
    status = CASE
      WHEN public.customer_subscription_receivables.status = 'pending'
        AND EXCLUDED.due_date < current_date THEN 'overdue'
      ELSE public.customer_subscription_receivables.status
    END,
    updated_at = now()
  RETURNING id INTO v_receivable_id;

  RETURN v_receivable_id;
END;
$$;

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

REVOKE ALL ON TABLE public.customer_subscription_receivables FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.customer_subscription_receivables TO authenticated;
REVOKE ALL ON FUNCTION public.build_chef_club_service_balance_map(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_club_receivable_for_cycle(UUID, TIMESTAMPTZ, TIMESTAMPTZ, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_club_receivables(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_club_receivables(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.refresh_club_receivable_statuses(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_club_receivable_statuses(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.pay_club_receivable(UUID, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_club_receivable(UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

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
    AND cs.status = 'active'
  ORDER BY cs.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF NOT p_replace_existing THEN
      RAISE EXCEPTION 'Cliente já possui assinatura ativa';
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

WITH existing_active_subscriptions AS (
  SELECT id
  FROM public.customer_subscriptions
  WHERE status IN ('active', 'past_due')
)
SELECT public.ensure_club_receivable_for_cycle(id)
FROM existing_active_subscriptions;

NOTIFY pgrst, 'reload schema';

COMMIT;
