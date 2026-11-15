-- =====================================================
-- Reestruturação do Ciclo de Faturamento e Cancelamento
-- do Club dos Chefes
-- 1) Saneamento retroativo de recebíveis abertos de assinaturas canceladas
-- 2) ensure_club_receivable_for_cycle: bloqueia geração para canceladas e preserva imutabilidade
-- 3) pay_club_receivable: remove pré-geração prematura de 30 dias (janela de 5 dias) e respeita assinaturas canceladas
-- 4) generate_club_receivables / refresh_club_receivable_statuses: janela de 5 dias e exclusão de assinaturas canceladas
-- 5) cancel_single_club_receivable: cancelamento avulso com auditoria e encerramento opcional da assinatura
-- =====================================================

BEGIN;

-- 1. Saneamento retroativo de faturas abertas vinculadas a assinaturas já canceladas
DO $$
DECLARE
  v_row RECORD;
  v_actor_id UUID := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
BEGIN
  FOR v_row IN
    SELECT
      csr.id,
      csr.subscription_id,
      csr.tenant_id,
      csr.amount,
      csr.status
    FROM public.customer_subscription_receivables csr
    INNER JOIN public.customer_subscriptions cs
      ON cs.id = csr.subscription_id
     AND cs.tenant_id = csr.tenant_id
    WHERE csr.status IN ('pending', 'overdue')
      AND cs.status = 'canceled'
    FOR UPDATE OF csr
  LOOP
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
      v_row.id,
      v_row.subscription_id,
      v_row.tenant_id,
      v_row.amount,
      v_row.status,
      'cancelled',
      'client_request',
      'Saneamento sistêmico de assinaturas canceladas',
      v_actor_id,
      now()
    );

    UPDATE public.customer_subscription_receivables
    SET
      status = 'cancelled',
      previous_status = v_row.status,
      cancel_reason = 'client_request',
      cancel_observation = 'Saneamento sistêmico de assinaturas canceladas',
      cancelled_by = v_actor_id,
      cancelled_at = now(),
      updated_at = now()
    WHERE id = v_row.id;
  END LOOP;
END;
$$;

-- 2. ensure_club_receivable_for_cycle
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
  v_existing public.customer_subscription_receivables%ROWTYPE;
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

  -- Nunca gerar recebível para assinatura cancelada
  IF v_subscription.status = 'canceled' THEN
    RETURN NULL;
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

  SELECT *
  INTO v_existing
  FROM public.customer_subscription_receivables
  WHERE subscription_id = v_subscription.id
    AND billing_cycle_start = v_cycle_start
    AND billing_cycle_end = v_cycle_end;

  IF FOUND AND v_existing.status IN ('paid', 'cancelled', 'refunded') THEN
    RETURN v_existing.id;
  END IF;

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
  WHERE public.customer_subscription_receivables.status NOT IN ('paid', 'cancelled', 'refunded')
  RETURNING id INTO v_receivable_id;

  IF v_receivable_id IS NULL THEN
    SELECT id
    INTO v_receivable_id
    FROM public.customer_subscription_receivables
    WHERE subscription_id = v_subscription.id
      AND billing_cycle_start = v_cycle_start
      AND billing_cycle_end = v_cycle_end;
  END IF;

  RETURN v_receivable_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_club_receivable_for_cycle(UUID, TIMESTAMPTZ, TIMESTAMPTZ, DATE) FROM PUBLIC, anon, authenticated;

-- 3. pay_club_receivable (preserva status cancelado e gera próximo ciclo apenas na janela de 5 dias)
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

  -- [GUARD 6.0.5.3] Feature Flag `receivables` (D-6.0.5.3-4)
  IF NOT COALESCE(v_is_super_admin, false)
     AND NOT public.tenant_has_feature(v_receivable.tenant_id, 'receivables') THEN
    RAISE EXCEPTION 'Modulo Contas a Receber nao disponivel no plano atual. Faca upgrade para continuar.';
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
    status = CASE WHEN status = 'canceled' THEN 'canceled' ELSE 'active' END,
    cycle_start = CASE WHEN status = 'canceled' THEN cycle_start ELSE v_receivable.billing_cycle_start END,
    cycle_end = CASE WHEN status = 'canceled' THEN cycle_end ELSE v_receivable.billing_cycle_end END,
    next_billing_date = CASE WHEN status = 'canceled' THEN next_billing_date ELSE v_receivable.billing_cycle_end::DATE END,
    updated_at = now()
  WHERE id = v_receivable.subscription_id;

  v_next_cycle_start := v_receivable.billing_cycle_end;
  v_next_cycle_end := v_receivable.billing_cycle_end + interval '1 month';

  -- Gera renovação apenas se a assinatura não estiver cancelada e o próximo vencimento estiver dentro da janela de 5 dias
  IF v_subscription.status <> 'canceled'
     AND v_next_cycle_start::DATE <= (current_date + 5) THEN
    PERFORM public.ensure_club_receivable_for_cycle(
      v_receivable.subscription_id,
      v_next_cycle_start,
      v_next_cycle_end,
      v_next_cycle_start::DATE
    );
  END IF;

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

-- 4. generate_club_receivables (janela de 5 dias para renovação e ignora canceladas)
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

  -- [GUARD 6.0.5.3] Feature Flag `receivables` (D-6.0.5.3-4)
  IF NOT COALESCE(v_is_super_admin, false)
     AND NOT public.tenant_has_feature(v_target_tenant_id, 'receivables') THEN
    RAISE EXCEPTION 'Modulo Contas a Receber nao disponivel no plano atual. Faca upgrade para continuar.';
  END IF;

  FOR v_subscription IN
    SELECT cs.id, cs.status, cs.cycle_start, cs.cycle_end
    FROM public.customer_subscriptions cs
    WHERE cs.tenant_id = v_target_tenant_id
      AND cs.status IN ('active', 'past_due')
  LOOP
    PERFORM public.ensure_club_receivable_for_cycle(v_subscription.id);
    v_count := v_count + 1;

    -- Gera a fatura de renovação apenas a partir de 5 dias antes da virada do ciclo
    IF v_subscription.status = 'active'
       AND v_subscription.cycle_end IS NOT NULL
       AND v_subscription.cycle_end::DATE <= (current_date + 5)
       AND EXISTS (
         SELECT 1
         FROM public.customer_subscription_receivables csr
         WHERE csr.subscription_id = v_subscription.id
           AND csr.billing_cycle_start = v_subscription.cycle_start
           AND csr.billing_cycle_end = v_subscription.cycle_end
           AND csr.status = 'paid'
       ) THEN
      PERFORM public.ensure_club_receivable_for_cycle(
        v_subscription.id,
        v_subscription.cycle_end,
        v_subscription.cycle_end + interval '1 month',
        v_subscription.cycle_end::DATE
      );
    END IF;
  END LOOP;

  UPDATE public.customer_subscription_receivables csr
  SET status = 'overdue', updated_at = now()
  FROM public.customer_subscriptions cs
  WHERE csr.subscription_id = cs.id
    AND csr.tenant_id = v_target_tenant_id
    AND csr.status = 'pending'
    AND csr.due_date < current_date
    AND cs.status <> 'canceled';

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_club_receivables(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_club_receivables(UUID) TO authenticated;

-- 4b. refresh_club_receivable_statuses (ignora assinaturas canceladas)
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

  -- [GUARD 6.0.5.3] Feature Flag `receivables` (D-6.0.5.3-4)
  IF NOT COALESCE(v_is_super_admin, false)
     AND NOT public.tenant_has_feature(v_target_tenant_id, 'receivables') THEN
    RAISE EXCEPTION 'Modulo Contas a Receber nao disponivel no plano atual. Faca upgrade para continuar.';
  END IF;

  UPDATE public.customer_subscription_receivables csr
  SET status = 'overdue', updated_at = now()
  FROM public.customer_subscriptions cs
  WHERE csr.subscription_id = cs.id
    AND csr.tenant_id = v_target_tenant_id
    AND csr.status = 'pending'
    AND csr.due_date < current_date
    AND cs.status <> 'canceled';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_club_receivable_statuses(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_club_receivable_statuses(UUID) TO authenticated;

-- 5. cancel_single_club_receivable (cancelamento avulso com auditoria e encerramento opcional da assinatura)
CREATE OR REPLACE FUNCTION public.cancel_single_club_receivable(
  p_receivable_id UUID,
  p_tenant_id UUID,
  p_cancel_reason TEXT,
  p_cancel_observation TEXT DEFAULT NULL,
  p_cancel_subscription BOOLEAN DEFAULT FALSE
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
  v_sub_status TEXT;
  v_subscription_cancelled BOOLEAN := FALSE;
  v_extra_cancelled INTEGER := 0;
  v_clean_observation TEXT;
BEGIN
  IF p_receivable_id IS NULL THEN
    RAISE EXCEPTION 'Recebimento obrigatório';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant obrigatório';
  END IF;

  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  IF NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_cancel_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motivo do cancelamento é obrigatório';
  END IF;

  SELECT *
  INTO v_receivable
  FROM public.customer_subscription_receivables
  WHERE id = p_receivable_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento não encontrado';
  END IF;

  IF v_receivable.status NOT IN ('pending', 'overdue') THEN
    RAISE EXCEPTION 'Somente recebimentos pendentes ou atrasados podem ser cancelados';
  END IF;

  v_clean_observation := NULLIF(BTRIM(COALESCE(p_cancel_observation, '')), '');

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
    v_clean_observation,
    v_auth_uid,
    now()
  );

  UPDATE public.customer_subscription_receivables
  SET
    status = 'cancelled',
    previous_status = v_receivable.status,
    cancel_reason = p_cancel_reason,
    cancel_observation = v_clean_observation,
    cancelled_by = v_auth_uid,
    cancelled_at = now(),
    updated_at = now()
  WHERE id = v_receivable.id;

  IF p_cancel_subscription THEN
    SELECT status
    INTO v_sub_status
    FROM public.customer_subscriptions
    WHERE id = v_receivable.subscription_id
      AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF FOUND AND v_sub_status IS DISTINCT FROM 'canceled' THEN
      UPDATE public.customer_subscriptions
      SET
        status = 'canceled',
        canceled_at = now(),
        updated_at = now()
      WHERE id = v_receivable.subscription_id
        AND tenant_id = p_tenant_id;

      v_subscription_cancelled := TRUE;
    END IF;

    SELECT public.cancel_club_receivables(
      v_receivable.subscription_id,
      p_tenant_id,
      p_cancel_reason,
      v_clean_observation
    ) INTO v_extra_cancelled;
  END IF;

  RETURN jsonb_build_object(
    'receivable_cancelled', TRUE,
    'subscription_cancelled', v_subscription_cancelled,
    'subscription_id', v_receivable.subscription_id,
    'receivables_cancelled', 1 + COALESCE(v_extra_cancelled, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_single_club_receivable(UUID, UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_single_club_receivable(UUID, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.cancel_single_club_receivable(UUID, UUID, TEXT, TEXT, BOOLEAN) IS 'Cancela recebível avulso do Club dos Chefes com auditoria e encerramento opcional da assinatura';

NOTIFY pgrst, 'reload schema';

COMMIT;
