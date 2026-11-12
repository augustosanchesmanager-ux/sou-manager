-- ==============================================================================
-- 20261112165500_fix_zero_close_club_credit_and_audit_pin.sql
--
-- OBJETIVO:
--   1. Permitir o fechamento de comandas zeradas (total = 0) cobertas 100% por
--      créditos do Club dos Chefes na RPC `bulk_close_comandas_with_credits`.
--      Quando `v_comanda_total = 0` e `p_apply_credits = true`, a comanda é
--      liquidada sem gerar `transactions` de valor zero (respeita constraint
--      `p_paid_amount > 0` de `finance_settle_comanda`), consumindo o crédito
--      do Clube, atualizando `comandas` (`status = 'paid'`, `financial_effect = false`,
--      `membership_credit_effect = true`) e marcando o `appointment` vinculado
--      como `completed`.
--   2. Exigir PIN de gerência (`p_audit_pin`, 6 a 8 dígitos numéricos) para
--      qualquer fechamento de comanda zerada que NÃO seja Club dos Chefes
--      (cortesia da casa / baixa administrativa em `bulk_close_comandas_admin`).
--      Valida tanto o PIN do próprio usuário quanto o PIN de qualquer gestor
--      ativo do tenant (`owner`, `admin`, `manager`, `gerente`, `adminmanager`),
--      permitindo que a recepção finalize cortesia mediante senha do gerente.
-- ==============================================================================

BEGIN;

-- ── 1. Helper interno: verifica PIN do próprio chamador OU de um gestor do tenant
CREATE OR REPLACE FUNCTION public.verify_tenant_manager_pin(
  p_caller_uid UUID,
  p_tenant_id  UUID,
  p_pin        TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_clean_pin TEXT := NULLIF(BTRIM(COALESCE(p_pin, '')), '');
  v_matched_user_id UUID;
BEGIN
  IF p_tenant_id IS NULL OR v_clean_pin IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_clean_pin !~ '^[0-9]{6,8}$' THEN
    RETURN NULL;
  END IF;

  -- 1) Tenta primeiro o PIN do próprio usuário autenticado no tenant
  IF p_caller_uid IS NOT NULL THEN
    SELECT mp.user_id
    INTO v_matched_user_id
    FROM public.manager_pins mp
    WHERE mp.user_id = p_caller_uid
      AND mp.tenant_id = p_tenant_id
      AND mp.pin_hash IS NOT NULL
      AND BTRIM(mp.pin_hash) <> ''
      AND mp.pin_hash = crypt(v_clean_pin, mp.pin_hash)
    LIMIT 1;

    IF v_matched_user_id IS NOT NULL THEN
      RETURN v_matched_user_id;
    END IF;
  END IF;

  -- 2) Fallback: verifica se o PIN pertence a algum gestor autorizado do tenant
  SELECT mp.user_id
  INTO v_matched_user_id
  FROM public.manager_pins mp
  WHERE mp.tenant_id = p_tenant_id
    AND mp.pin_hash IS NOT NULL
    AND BTRIM(mp.pin_hash) <> ''
    AND mp.pin_hash = crypt(v_clean_pin, mp.pin_hash)
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = mp.user_id
          AND LOWER(BTRIM(COALESCE(p.role, ''))) IN ('owner', 'admin', 'adminmanager', 'gerente administrativo', 'manager', 'gerente', 'superadmin', 'super admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.user_tenants ut
        WHERE ut.user_id = mp.user_id
          AND ut.tenant_id = p_tenant_id
          AND LOWER(BTRIM(COALESCE(ut.role, ''))) IN ('owner', 'admin', 'adminmanager', 'gerente administrativo', 'manager', 'gerente', 'superadmin', 'super admin')
      )
    )
  ORDER BY mp.updated_at DESC
  LIMIT 1;

  RETURN v_matched_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_tenant_manager_pin(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.verify_tenant_manager_pin(UUID, UUID, TEXT) IS
  'Helper interno SECURITY DEFINER: valida PIN gerencial (6 a 8 dígitos) do próprio usuário ou de gestor ativo do tenant e retorna o user_id autorizador.';

-- ── 2. RPC bulk_close_comandas_admin (com p_audit_pin obrigatório para baixa zero/cortesia)
DROP FUNCTION IF EXISTS public.bulk_close_comandas_admin(UUID[], UUID, TEXT, DATE);

CREATE OR REPLACE FUNCTION public.bulk_close_comandas_admin(
  p_comanda_ids UUID[],
  p_tenant_id UUID DEFAULT NULL,
  p_closure_note TEXT DEFAULT NULL,
  p_legacy_reference_month DATE DEFAULT NULL,
  p_audit_pin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN := false;
  v_access_role TEXT;
  v_membership_role TEXT;
  v_has_authorized_membership BOOLEAN := false;
  v_has_manager_role BOOLEAN := false;
  v_eff_tenant_id UUID;
  v_pin_authorizer_id UUID;
  v_clean_pin TEXT := NULLIF(BTRIM(COALESCE(p_audit_pin, '')), '');

  v_ids UUID[];
  v_updated_count INTEGER := 0;
BEGIN
  -- 1) Usuário autenticado obrigatório
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório';
  END IF;

  -- 2) Resolução segura do contexto do chamador
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT LOWER(BTRIM(COALESCE(p.role, ''))) INTO v_access_role
  FROM public.profiles p
  WHERE p.id = v_auth_uid
  LIMIT 1;
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s
    WHERE s.id = v_auth_uid
    LIMIT 1;
  END IF;

  -- 3) p_tenant_id obrigatório para não-superadmin
  IF NOT COALESCE(v_is_super_admin, false) AND p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obrigatório';
  END IF;

  -- 4) Membership no tenant alvo
  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid
    AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC
  LIMIT 1;

  v_has_authorized_membership :=
    COALESCE(v_membership_role IN ('owner', 'admin', 'adminmanager', 'gerente administrativo', 'manager', 'gerente', 'superadmin', 'super admin'), false);

  v_has_manager_role :=
    COALESCE(v_is_super_admin, false)
    OR COALESCE(v_access_role, '') IN ('owner', 'admin', 'adminmanager', 'gerente administrativo', 'manager', 'gerente', 'superadmin', 'super admin')
    OR v_has_authorized_membership;

  -- 5) Isolamento de tenant
  IF NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  v_eff_tenant_id := p_tenant_id;

  -- 6) Validação de PIN de gerência (obrigatório quando enviado ou quando operador não é gestor)
  IF v_clean_pin IS NOT NULL THEN
    v_pin_authorizer_id := public.verify_tenant_manager_pin(v_auth_uid, COALESCE(v_eff_tenant_id, v_auth_tenant_id), v_clean_pin);
    IF v_pin_authorizer_id IS NULL THEN
      PERFORM pg_sleep(0.25);
      RAISE EXCEPTION 'Senha/PIN de gerência inválido';
    END IF;
  ELSIF NOT v_has_manager_role THEN
    RAISE EXCEPTION 'Comanda zerada (cortesia ou baixa administrativa) exige senha/PIN de gerência';
  END IF;

  -- 7) IDs obrigatórios
  SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::UUID[])
  INTO v_ids
  FROM unnest(COALESCE(p_comanda_ids, ARRAY[]::UUID[])) AS id;

  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos uma comanda para baixa administrativa';
  END IF;

  -- 7b) Validação de pertencimento de ID (fail-closed contra IDOR)
  IF NOT COALESCE(v_is_super_admin, false)
     AND v_eff_tenant_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.comandas c
       WHERE c.id = ANY(v_ids)
         AND c.tenant_id IS DISTINCT FROM v_eff_tenant_id
     ) THEN
    RAISE EXCEPTION 'Uma ou mais comandas não pertencem ao seu tenant';
  END IF;

  -- 8) Fechamento administrativo / cortesia (sem efeito financeiro e sem consumo de crédito)
  UPDATE public.comandas
  SET
    status = 'paid',
    closure_mode = 'legacy_membership',
    closure_note = NULLIF(BTRIM(p_closure_note), ''),
    financial_effect = false,
    membership_credit_effect = false,
    legacy_reference_month = p_legacy_reference_month,
    settled_at = now(),
    settled_by_user_id = COALESCE(v_pin_authorizer_id, v_auth_uid),
    closed_at = now()
  WHERE id = ANY(v_ids)
    AND status = 'open'
    AND (v_eff_tenant_id IS NULL OR tenant_id = v_eff_tenant_id);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  UPDATE public.appointments
  SET status = 'completed'
  WHERE id IN (
    SELECT appointment_id
    FROM public.comandas
    WHERE id = ANY(v_ids)
      AND appointment_id IS NOT NULL
      AND status = 'paid'
      AND closure_mode = 'legacy_membership'
      AND (v_eff_tenant_id IS NULL OR tenant_id = v_eff_tenant_id)
  )
    AND (v_eff_tenant_id IS NULL OR tenant_id = v_eff_tenant_id)
    AND status <> 'completed';

  RETURN jsonb_build_object(
    'updated_count', v_updated_count,
    'closure_mode', 'legacy_membership',
    'financial_effect', false,
    'membership_credit_effect', false,
    'pin_authorized_by', v_pin_authorizer_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_close_comandas_admin(UUID[], UUID, TEXT, DATE, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_close_comandas_admin(UUID[], UUID, TEXT, DATE, TEXT) TO authenticated;

-- ── 3. RPC bulk_close_comandas_with_credits (suporta total = 0 quando p_apply_credits = true)
CREATE OR REPLACE FUNCTION public.bulk_close_comandas_with_credits(
  p_comanda_ids UUID[],
  p_tenant_id UUID DEFAULT NULL,
  p_closure_note TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'Dinheiro',
  p_apply_credits BOOLEAN DEFAULT true
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
  v_has_authorized_membership BOOLEAN := false;
  v_eff_tenant_id UUID;

  v_ids UUID[];
  v_updated_count INTEGER := 0;
  v_credits_consumed JSONB := '[]'::jsonb;
  v_credits_by_service JSONB := '{}'::jsonb;
  v_subscription_id UUID;
  v_client_id UUID;
  v_service_id UUID;
  v_item_count INTEGER;
  v_credit_consumed INTEGER;
  v_service_key TEXT;
  v_current_service JSONB;
  v_comanda_id UUID;
  v_any_positive_total BOOLEAN := false;
BEGIN
  -- 1) Usuário autenticado obrigatório
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório';
  END IF;

  -- 2) Resolução segura do contexto do chamador
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT LOWER(BTRIM(COALESCE(p.role, ''))) INTO v_access_role
  FROM public.profiles p
  WHERE p.id = v_auth_uid
  LIMIT 1;
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s
    WHERE s.id = v_auth_uid
    LIMIT 1;
  END IF;

  -- 3) p_tenant_id obrigatório para não-superadmin
  IF NOT COALESCE(v_is_super_admin, false) AND p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obrigatório';
  END IF;

  -- 4) Membership no tenant alvo
  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid
    AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC
  LIMIT 1;

  v_has_authorized_membership :=
    COALESCE(v_membership_role IN ('owner', 'admin', 'adminmanager', 'gerente administrativo', 'manager', 'gerente', 'superadmin', 'super admin'), false);

  -- 5) Papel autorizado: gerencial OU recepcionista quando está aplicando crédito do Clube em comanda individual
  IF NOT COALESCE(v_is_super_admin, false)
     AND COALESCE(v_access_role, '') NOT IN ('owner', 'admin', 'adminmanager', 'gerente administrativo', 'manager', 'gerente', 'superadmin', 'super admin')
     AND NOT COALESCE(v_has_authorized_membership, false) THEN
    IF NOT (COALESCE(v_access_role, '') = 'receptionist' AND COALESCE(p_apply_credits, false) = true AND COALESCE(array_length(p_comanda_ids, 1), 0) = 1) THEN
      RAISE EXCEPTION 'Usuário sem permissão para baixa em massa';
    END IF;
  END IF;

  -- 6) Isolamento de tenant
  IF NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  v_eff_tenant_id := p_tenant_id;

  -- 7) IDs obrigatórios
  SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::UUID[])
  INTO v_ids
  FROM unnest(COALESCE(p_comanda_ids, ARRAY[]::UUID[])) AS id;

  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos uma comanda';
  END IF;

  -- 7b) Validação de pertencimento de ID (fail-closed)
  IF NOT COALESCE(v_is_super_admin, false)
     AND v_eff_tenant_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.comandas c
       WHERE c.id = ANY(v_ids)
         AND c.tenant_id IS DISTINCT FROM v_eff_tenant_id
     ) THEN
    RAISE EXCEPTION 'Uma ou mais comandas não pertencem ao seu tenant';
  END IF;

  -- 8) Consumo de créditos do Clube
  IF p_apply_credits THEN
    FOR v_client_id IN
      SELECT DISTINCT c.client_id
      FROM public.comandas c
      WHERE c.id = ANY(v_ids)
        AND c.status = 'open'
        AND (v_eff_tenant_id IS NULL OR c.tenant_id = v_eff_tenant_id)
        AND c.client_id IS NOT NULL
    LOOP
      SELECT cs.id
      INTO v_subscription_id
      FROM public.customer_subscriptions cs
      WHERE cs.client_id = v_client_id
        AND cs.status = 'active'
        AND (v_eff_tenant_id IS NULL OR cs.tenant_id = v_eff_tenant_id)
      ORDER BY cs.created_at DESC
      LIMIT 1;

      IF v_subscription_id IS NOT NULL THEN
        FOR v_service_id, v_item_count IN
          SELECT ci.service_id, SUM(GREATEST(1, COALESCE(ci.quantity, 1)))::INTEGER
          FROM public.comanda_items ci
          JOIN public.comandas c ON c.id = ci.comanda_id
          WHERE c.id = ANY(v_ids)
            AND c.client_id = v_client_id
            AND c.status = 'open'
            AND (v_eff_tenant_id IS NULL OR c.tenant_id = v_eff_tenant_id)
            AND ci.service_id IS NOT NULL
          GROUP BY ci.service_id
        LOOP
          IF v_service_id IS NOT NULL THEN
            v_service_key := v_service_id::text;
            v_credit_consumed := 0;

            PERFORM public.deduct_chef_club_credits(
                v_subscription_id,
                v_service_id,
                v_item_count,
                'Baixa com créditos - Club dos Chefes'
            );

            v_credit_consumed := v_item_count;

            v_current_service := COALESCE(
                (v_credits_by_service -> v_service_key)::jsonb,
                ('{"service_id": "' || v_service_key || '", "consumed": 0}')::jsonb
            );

            v_current_service := jsonb_set(
                v_current_service,
                '{consumed}',
                to_jsonb((v_current_service ->> 'consumed')::integer + v_credit_consumed)
            );

            v_credits_by_service := jsonb_set(
                v_credits_by_service,
                ARRAY[v_service_key],
                v_current_service,
                true
            );

            v_credits_consumed := v_credits_consumed || jsonb_build_object(
                'subscription_id', v_subscription_id,
                'service_id', v_service_id,
                'consumed', v_credit_consumed
            );
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 9) Fechamento por comanda:
  --    * Se v_comanda_total > 0: executa settlement financeiro completo + outbox (D7)
  --    * Se v_comanda_total = 0 e p_apply_credits = true: fecha comanda coberta pelo
  --      Club dos Chefes sem gerar transaction de valor zero (financial_effect = false,
  --      membership_credit_effect = true).
  v_updated_count := 0;

  FOREACH v_comanda_id IN ARRAY v_ids LOOP
    DECLARE
      v_comanda_total NUMERIC;
      v_comanda_payment_method TEXT;
      v_comanda_appointment_id UUID;
      v_comanda_tenant_id UUID;
      v_settlement JSONB;
      v_idempotency_key TEXT;
      v_event_id TEXT;
      v_outbox_payload JSONB;
      v_outbox_metadata JSONB;
    BEGIN
      SELECT total, payment_method, appointment_id, tenant_id
      INTO v_comanda_total, v_comanda_payment_method, v_comanda_appointment_id, v_comanda_tenant_id
      FROM public.comandas
      WHERE id = v_comanda_id
        AND status = 'open'
        AND (v_eff_tenant_id IS NULL OR tenant_id = v_eff_tenant_id);

      -- Comanda inexistente ou não está 'open': ignora com segurança (comportamento SEC-8)
      IF v_comanda_total IS NULL THEN
        CONTINUE;
      END IF;

      IF v_comanda_total < 0 OR (v_comanda_total = 0 AND NOT COALESCE(p_apply_credits, false)) THEN
        RAISE EXCEPTION 'Comanda % com total inválido (<= 0): %', v_comanda_id, v_comanda_total;
      END IF;

      IF v_comanda_total = 0 AND COALESCE(p_apply_credits, false) THEN
        -- Fechamento zero legítimo via Club dos Chefes (sem nova entrada de caixa)
        UPDATE public.comandas
        SET
          status = 'paid',
          closure_mode = 'standard',
          closure_note = COALESCE(NULLIF(BTRIM(p_closure_note), ''), closure_note),
          financial_effect = false,
          membership_credit_effect = true,
          payment_method = COALESCE(NULLIF(BTRIM(v_comanda_payment_method), ''), NULLIF(BTRIM(p_payment_method), ''), 'Club dos Chefes'),
          payment_date_real = NULL,
          settled_at = NOW(),
          settled_by_user_id = v_auth_uid,
          closed_at = NOW()
        WHERE id = v_comanda_id
          AND tenant_id = v_comanda_tenant_id
          AND status = 'open';

        IF v_comanda_appointment_id IS NOT NULL THEN
          UPDATE public.appointments
          SET status = 'completed'
          WHERE id = v_comanda_appointment_id
            AND tenant_id = v_comanda_tenant_id
            AND status <> 'completed';
        END IF;

        v_updated_count := v_updated_count + 1;
      ELSE
        -- Settlement financeiro padrão (v_comanda_total > 0)
        v_any_positive_total := true;
        v_idempotency_key := 'bulk-close-credits:' || v_comanda_tenant_id || ':' || v_comanda_id;
        v_event_id := 'evt-bulk-close-credits:' || v_comanda_id;

        v_outbox_payload := jsonb_build_object(
          'eventId', v_event_id,
          'eventType', 'CheckoutCompleted',
          'payload', jsonb_build_object(
            'operationType', 'create_commission_record',
            'operationData', jsonb_build_object(
              'tenantId', v_comanda_tenant_id,
              'comandaId', v_comanda_id,
              'clientId', (SELECT client_id FROM public.comandas WHERE id = v_comanda_id),
              'staffId', (SELECT staff_id FROM public.comanda_items WHERE comanda_id = v_comanda_id LIMIT 1),
              'receivedValue', v_comanda_total,
              'paymentMethod', COALESCE(v_comanda_payment_method, p_payment_method),
              'hasClubCredit', p_apply_credits
            ),
            'sourceEvent', 'CheckoutCompleted',
            'idempotencyKey', v_event_id || '_create_commission_record'
          ),
          'metadata', jsonb_build_object(
            'tenantId', v_comanda_tenant_id,
            'userId', auth.uid(),
            'correlationId', v_idempotency_key,
            'causationId', v_event_id,
            'source', 'BulkCloseComandasWithCredits'
          )
        );

        v_outbox_metadata := jsonb_build_object(
          'tenantId', v_comanda_tenant_id,
          'userId', auth.uid(),
          'correlationId', v_idempotency_key,
          'causationId', v_event_id,
          'source', 'BulkCloseComandasWithCredits'
        );

        SELECT public.finance_settle_comanda_and_enqueue(
          v_comanda_tenant_id,
          v_comanda_id,
          COALESCE(v_comanda_payment_method, p_payment_method),
          v_comanda_total,
          NOW(),
          'checkout',
          NULLIF(BTRIM(p_closure_note), ''),
          v_idempotency_key,
          v_event_id,
          'CheckoutCompleted',
          v_outbox_payload,
          v_outbox_metadata,
          '[{"provider":"finance","config":{}}]'::jsonb
        ) INTO v_settlement;

        IF v_settlement IS NULL THEN
          RAISE EXCEPTION 'finance_settle_comanda_and_enqueue retornou NULL para comanda %', v_comanda_id;
        END IF;

        IF NOT (v_settlement->>'success')::boolean THEN
          RAISE EXCEPTION 'Settlement falhou para comanda %: %', v_comanda_id, v_settlement->>'message';
        END IF;

        v_updated_count := v_updated_count + 1;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'updated_count', v_updated_count,
    'closure_mode', 'standard',
    'financial_effect', v_any_positive_total,
    'membership_credit_effect', p_apply_credits,
    'credits_consumed', jsonb_build_object(
      'total', jsonb_array_length(v_credits_consumed),
      'by_service', v_credits_by_service
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_close_comandas_with_credits(UUID[], UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_close_comandas_with_credits(UUID[], UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
