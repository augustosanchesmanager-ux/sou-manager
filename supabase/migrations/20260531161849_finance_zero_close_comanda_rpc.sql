BEGIN;

CREATE OR REPLACE FUNCTION public.finance_zero_close_comanda(
  p_tenant_id UUID,
  p_comanda_id UUID,
  p_origin TEXT,
  p_reason TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'checkout',
  p_idempotency_key TEXT DEFAULT NULL,
  p_authorized_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN := false;

  v_access_role TEXT;
  v_membership_role TEXT;
  v_has_any_membership BOOLEAN := false;
  v_has_authorized_membership BOOLEAN := false;
  v_has_tenant_access BOOLEAN := false;
  v_has_management_permission BOOLEAN := false;

  v_comanda public.comandas%ROWTYPE;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_credit_record public.customer_credits%ROWTYPE;

  v_origin TEXT := NULLIF(BTRIM(COALESCE(p_origin, '')), '');
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
  v_source TEXT := COALESCE(NULLIF(BTRIM(COALESCE(p_source, '')), ''), 'checkout');
  v_idempotency_key TEXT := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  v_authorized_by UUID;
  v_now TIMESTAMPTZ := now();
  v_reference_at TIMESTAMPTZ;

  v_payment_method TEXT;
  v_closure_mode TEXT;
  v_audit JSONB;
  v_existing_audit JSONB;
  v_credits_consumed JSONB := jsonb_build_object('total', 0, 'by_service', '[]'::jsonb);
  v_credits_by_service JSONB := '[]'::jsonb;

  v_total_required INTEGER := 0;
  v_service RECORD;
  v_service_balance_map JSONB;
  v_balance JSONB;
  v_balance_index INTEGER;
  v_available INTEGER;
  v_used INTEGER;
  v_rows INTEGER := 0;
BEGIN
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório';
  END IF;

  v_authorized_by := v_auth_uid;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obrigatório';
  END IF;

  IF p_comanda_id IS NULL THEN
    RAISE EXCEPTION 'comanda_id obrigatório';
  END IF;

  IF v_origin NOT IN ('club_credit', 'house_courtesy', 'administrative_adjustment') THEN
    RAISE EXCEPTION 'Origem de fechamento zero inválida';
  END IF;

  IF v_source NOT IN ('checkout', 'financial_admin') THEN
    RAISE EXCEPTION 'Fonte de fechamento zero inválida';
  END IF;

  IF v_origin IN ('house_courtesy', 'administrative_adjustment') AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Motivo obrigatório para cortesia ou baixa administrativa';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT LOWER(BTRIM(COALESCE(p.role, '')))
  INTO v_access_role
  FROM public.profiles p
  WHERE p.id = v_auth_uid
  LIMIT 1;

  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, '')))
    INTO v_access_role
    FROM public.staff s
    WHERE s.id = v_auth_uid
    LIMIT 1;
  END IF;

  SELECT LOWER(BTRIM(COALESCE(ut.role, '')))
  INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid
    AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC
  LIMIT 1;

  v_has_any_membership := v_membership_role IS NOT NULL;

  v_has_authorized_membership :=
    COALESCE(v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin'), false);

  v_has_tenant_access :=
    COALESCE(v_is_super_admin, false)
    OR v_auth_tenant_id IS NOT DISTINCT FROM p_tenant_id
    OR v_has_any_membership;

  v_has_management_permission :=
    COALESCE(v_is_super_admin, false)
    OR COALESCE(v_access_role, '') IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
    OR v_has_authorized_membership;

  IF NOT v_has_tenant_access THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  IF v_origin IN ('house_courtesy', 'administrative_adjustment') AND NOT v_has_management_permission THEN
    RAISE EXCEPTION 'Usuário sem permissão para cortesia ou baixa administrativa';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('finance_zero_close_comanda:' || p_tenant_id::text || ':' || p_comanda_id::text));

  SELECT *
  INTO v_comanda
  FROM public.comandas c
  WHERE c.id = p_comanda_id
    AND c.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda não encontrada para este tenant';
  END IF;

  IF v_comanda.closure_note IS NOT NULL THEN
    BEGIN
      v_existing_audit := v_comanda.closure_note::jsonb;
    EXCEPTION WHEN others THEN
      v_existing_audit := NULL;
    END;
  END IF;

  IF v_comanda.status = 'paid' THEN
    IF v_idempotency_key IS NOT NULL
       AND v_existing_audit IS NOT NULL
       AND v_existing_audit ->> 'idempotency_key' = v_idempotency_key THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'comanda_id', p_comanda_id,
        'origin', COALESCE(v_existing_audit ->> 'zero_close_origin', v_origin),
        'credits_consumed', COALESCE(v_existing_audit -> 'credits_consumed', v_credits_consumed),
        'status', 'paid',
        'message', 'Fechamento zero já processado anteriormente com a mesma chave.'
      );
    END IF;

    RAISE EXCEPTION 'Comanda já está fechada';
  END IF;

  IF v_comanda.status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Comanda não pode ser fechada no status atual: %', v_comanda.status;
  END IF;

  IF v_comanda.appointment_id IS NOT NULL THEN
    SELECT a.start_time
    INTO v_reference_at
    FROM public.appointments a
    WHERE a.id = v_comanda.appointment_id
      AND a.tenant_id = p_tenant_id
    LIMIT 1;
  END IF;

  v_reference_at := COALESCE(v_reference_at, v_comanda.created_at, v_now);

  IF v_origin = 'club_credit' THEN
    IF v_comanda.client_id IS NULL THEN
      RAISE EXCEPTION 'Comanda sem cliente vinculado para consumo de crédito do Clube';
    END IF;

    SELECT *
    INTO v_subscription
    FROM public.customer_subscriptions cs
    WHERE cs.tenant_id = p_tenant_id
      AND cs.client_id = v_comanda.client_id
      AND cs.status = 'active'
      AND v_reference_at >= cs.cycle_start
      AND v_reference_at <= cs.cycle_end
      AND EXISTS (
        SELECT 1
        FROM public.customer_subscription_receivables csr
        WHERE csr.subscription_id = cs.id
          AND csr.tenant_id = cs.tenant_id
          AND csr.status = 'paid'
          AND csr.transaction_id IS NOT NULL
          AND v_reference_at >= csr.billing_cycle_start
          AND v_reference_at <= csr.billing_cycle_end
      )
    ORDER BY cs.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cliente sem assinatura ativa ou ciclo pago vigente na data de referência';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.comanda_items ci
      WHERE ci.comanda_id = p_comanda_id
        AND ci.service_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Crédito do Clube só pode fechar itens vinculados a serviços';
    END IF;

    SELECT COALESCE(SUM(GREATEST(1, COALESCE(ci.quantity, 1)))::INTEGER, 0)
    INTO v_total_required
    FROM public.comanda_items ci
    WHERE ci.comanda_id = p_comanda_id
      AND ci.service_id IS NOT NULL;

    IF v_total_required <= 0 THEN
      RAISE EXCEPTION 'Comanda sem serviços para consumo de crédito do Clube';
    END IF;

    SELECT *
    INTO v_credit_record
    FROM public.customer_credits cc
    WHERE cc.tenant_id = p_tenant_id
      AND cc.subscription_id = v_subscription.id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Assinatura sem créditos lançados';
    END IF;

    IF COALESCE(v_credit_record.available_credits, 0) < v_total_required THEN
      RAISE EXCEPTION 'Crédito total do Clube insuficiente';
    END IF;

    v_service_balance_map := COALESCE(v_credit_record.service_balance_map, '[]'::jsonb);

    FOR v_service IN
      SELECT
        ci.service_id,
        SUM(GREATEST(1, COALESCE(ci.quantity, 1)))::INTEGER AS amount
      FROM public.comanda_items ci
      WHERE ci.comanda_id = p_comanda_id
        AND ci.service_id IS NOT NULL
      GROUP BY ci.service_id
    LOOP
      SELECT ordinality - 1, value
      INTO v_balance_index, v_balance
      FROM jsonb_array_elements(v_service_balance_map) WITH ORDINALITY AS entries(value, ordinality)
      WHERE value ->> 'service_id' = v_service.service_id::TEXT
      LIMIT 1;

      IF v_balance IS NULL THEN
        RAISE EXCEPTION 'Serviço sem crédito configurado no Clube: %', v_service.service_id;
      END IF;

      v_available := COALESCE((v_balance ->> 'available')::INTEGER, 0);
      v_used := COALESCE((v_balance ->> 'used')::INTEGER, 0);

      IF v_available < v_service.amount THEN
        RAISE EXCEPTION 'Crédito insuficiente para o serviço %', v_service.service_id;
      END IF;

      v_balance := jsonb_set(v_balance, '{available}', to_jsonb(v_available - v_service.amount));
      v_balance := jsonb_set(v_balance, '{used}', to_jsonb(v_used + v_service.amount));

      v_service_balance_map := jsonb_set(
        v_service_balance_map,
        ARRAY[v_balance_index::TEXT],
        v_balance,
        false
      );

      v_credits_by_service := v_credits_by_service || jsonb_build_array(
        jsonb_build_object(
          'service_id', v_service.service_id,
          'amount', v_service.amount
        )
      );
    END LOOP;

    UPDATE public.customer_credits
    SET
      available_credits = v_credit_record.available_credits - v_total_required,
      used_credits = v_credit_record.used_credits + v_total_required,
      service_balance_map = v_service_balance_map,
      updated_at = v_now
    WHERE id = v_credit_record.id
      AND tenant_id = p_tenant_id;

    v_credits_consumed := jsonb_build_object(
      'total', v_total_required,
      'by_service', v_credits_by_service
    );
  END IF;

  v_payment_method := CASE v_origin
    WHEN 'club_credit' THEN 'Clube do Chefe'
    WHEN 'house_courtesy' THEN 'Cortesia'
    WHEN 'administrative_adjustment' THEN 'Baixa administrativa'
  END;

  v_closure_mode := CASE
    WHEN v_origin = 'club_credit' THEN 'standard'
    ELSE 'legacy_membership'
  END;

  v_audit := jsonb_build_object(
    'zero_close_origin', v_origin,
    'zero_close_reason', COALESCE(v_reason, v_payment_method),
    'authorized_by', v_authorized_by,
    'requested_authorized_by', p_authorized_by,
    'reason', v_reason,
    'user_id', v_auth_uid,
    'created_at', v_now,
    'source', v_source,
    'idempotency_key', v_idempotency_key,
    'reference_at', v_reference_at,
    'operational_total', COALESCE(v_comanda.total, 0),
    'credits_consumed', v_credits_consumed,
    'financial_effect', false,
    'membership_credit_effect', v_origin = 'club_credit'
  );

  UPDATE public.comandas
  SET
    status = 'paid',
    financial_effect = false,
    membership_credit_effect = (v_origin = 'club_credit'),
    closure_note = v_audit::TEXT,
    closure_mode = v_closure_mode,
    payment_method = v_payment_method,
    payment_date_real = NULL,
    settled_at = v_now,
    settled_by_user_id = v_auth_uid,
    closed_at = v_now
  WHERE id = p_comanda_id
    AND tenant_id = p_tenant_id
    AND status = 'open';

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Comanda já foi alterada por outra operação';
  END IF;

  IF v_comanda.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
    SET status = 'completed'
    WHERE id = v_comanda.appointment_id
      AND tenant_id = p_tenant_id
      AND status IN ('pending', 'in_progress');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'comanda_id', p_comanda_id,
    'origin', v_origin,
    'credits_consumed', v_credits_consumed,
    'status', 'paid',
    'message', 'Comanda fechada sem recebimento financeiro novo, com auditoria.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finance_zero_close_comanda(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finance_zero_close_comanda(UUID, UUID, TEXT, TEXT, TEXT, TEXT, UUID)
TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
