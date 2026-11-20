-- ============================================================================
-- Migration: 20261119200000_family_dependents_club_credits_and_public_booking.sql
-- Description:
--   Frentes B e C — Compartilhamento de créditos do Club dos Chefes com filhos
--   vinculados (parent_client_id) e suporte a dependentes no Agendamento Público:
--   1. Frente B: Atualiza public.bulk_close_comandas_with_credits para resolver
--      a assinatura ativa do próprio cliente OU, caso seja dependente
--      (parent_client_id IS NOT NULL) sem assinatura própria, a assinatura ativa
--      do responsável (pai/mãe), validando existência de assinatura antes de
--      permitir baixa zero via crédito do Clube.
--   2. Frente C: Atualiza public.lookup_public_booking_client para retornar o
--      array JSON `dependents` vinculados ao titular do telefone consultado.
--   3. Frente C: Atualiza public.create_public_booking com `p_dependent_client_id`
--      opcional, vinculando/reutilizando o registro de `public.clients` do filho
--      em `appointments.client_id` e `comandas.client_id` e avaliando o limite
--      diário (`same_day_booking_limit`) por pessoa atendida.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. FRENTE B: bulk_close_comandas_with_credits com fallback para parent_client_id
-- ============================================================================
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
  v_parent_client_id UUID;
  v_credit_reference TEXT;
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

  -- 8) Consumo de créditos do Clube (suporta assinatura própria ou herdada do responsável parent_client_id)
  IF p_apply_credits THEN
    FOR v_client_id IN
      SELECT DISTINCT c.client_id
      FROM public.comandas c
      WHERE c.id = ANY(v_ids)
        AND c.status = 'open'
        AND (v_eff_tenant_id IS NULL OR c.tenant_id = v_eff_tenant_id)
        AND c.client_id IS NOT NULL
    LOOP
      v_subscription_id := NULL;
      v_parent_client_id := NULL;
      v_credit_reference := 'Baixa com créditos - Club dos Chefes';

      -- 8a) Tenta assinatura ativa do próprio cliente
      SELECT cs.id
      INTO v_subscription_id
      FROM public.customer_subscriptions cs
      WHERE cs.client_id = v_client_id
        AND cs.status = 'active'
        AND (v_eff_tenant_id IS NULL OR cs.tenant_id = v_eff_tenant_id)
      ORDER BY cs.created_at DESC
      LIMIT 1;

      -- 8b) Fallback: se o cliente é filho/dependente, verifica assinatura ativa do responsável
      IF v_subscription_id IS NULL THEN
        SELECT cl.parent_client_id
        INTO v_parent_client_id
        FROM public.clients cl
        WHERE cl.id = v_client_id
          AND (v_eff_tenant_id IS NULL OR cl.tenant_id = v_eff_tenant_id)
        LIMIT 1;

        IF v_parent_client_id IS NOT NULL THEN
          SELECT cs.id
          INTO v_subscription_id
          FROM public.customer_subscriptions cs
          WHERE cs.client_id = v_parent_client_id
            AND cs.status = 'active'
            AND (v_eff_tenant_id IS NULL OR cs.tenant_id = v_eff_tenant_id)
          ORDER BY cs.created_at DESC
          LIMIT 1;

          IF v_subscription_id IS NOT NULL THEN
            v_credit_reference := 'Baixa com créditos - Club dos Chefes (Dependente: ' || v_client_id::text || ')';
          END IF;
        END IF;
      END IF;

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
                v_credit_reference
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
                'consumed', v_credit_consumed,
                'beneficiary_client_id', v_client_id
            );
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 9) Fechamento por comanda
  v_updated_count := 0;

  FOREACH v_comanda_id IN ARRAY v_ids LOOP
    DECLARE
      v_comanda_total NUMERIC;
      v_comanda_payment_method TEXT;
      v_comanda_appointment_id UUID;
      v_comanda_tenant_id UUID;
      v_comanda_client_id UUID;
      v_has_effective_subscription BOOLEAN := false;
      v_settlement JSONB;
      v_idempotency_key TEXT;
      v_event_id TEXT;
      v_outbox_payload JSONB;
      v_outbox_metadata JSONB;
    BEGIN
      SELECT total, payment_method, appointment_id, tenant_id, client_id
      INTO v_comanda_total, v_comanda_payment_method, v_comanda_appointment_id, v_comanda_tenant_id, v_comanda_client_id
      FROM public.comandas
      WHERE id = v_comanda_id
        AND status = 'open'
        AND (v_eff_tenant_id IS NULL OR tenant_id = v_eff_tenant_id);

      IF v_comanda_total IS NULL THEN
        CONTINUE;
      END IF;

      IF v_comanda_total < 0 OR (v_comanda_total = 0 AND NOT COALESCE(p_apply_credits, false)) THEN
        RAISE EXCEPTION 'Comanda % com total inválido (<= 0): %', v_comanda_id, v_comanda_total;
      END IF;

      IF v_comanda_total = 0 AND COALESCE(p_apply_credits, false) THEN
        -- Valida que o cliente (ou seu responsável) possui assinatura ativa no Clube
        SELECT EXISTS (
          SELECT 1
            FROM public.customer_subscriptions cs
           WHERE cs.tenant_id = v_comanda_tenant_id
             AND cs.status = 'active'
             AND (
               cs.client_id = v_comanda_client_id
               OR cs.client_id = (
                 SELECT cl.parent_client_id
                   FROM public.clients cl
                  WHERE cl.id = v_comanda_client_id
                    AND cl.tenant_id = v_comanda_tenant_id
               )
             )
        ) INTO v_has_effective_subscription;

        IF NOT COALESCE(v_has_effective_subscription, false) THEN
          RAISE EXCEPTION 'Comanda % zerada não possui assinatura ativa do Club dos Chefes vinculada ao cliente ou responsável', v_comanda_id;
        END IF;

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
              'clientId', v_comanda_client_id,
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

-- ============================================================================
-- 2. FRENTE C: lookup_public_booking_client com lista de filhos vinculados
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lookup_public_booking_client(
  p_tenant_identifier text,
  p_client_phone text,
  p_target_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_tenant_id uuid;
  v_canon_phone text;
  v_holder_id uuid;
  v_client_name text;
  v_timezone text := 'America/Sao_Paulo';
  v_target_day date;
  v_has_same_day boolean := false;
  v_existing_apt_id uuid := NULL;
  v_existing_time text := NULL;
  v_existing_staff text := NULL;
  v_dependents jsonb := '[]'::jsonb;
BEGIN
  IF p_tenant_identifier IS NULL OR btrim(p_tenant_identifier) = '' THEN
    RETURN jsonb_build_object(
      'found', false,
      'client_name', NULL,
      'masked_name', NULL,
      'has_same_day_booking', false,
      'existing_booking_time', NULL,
      'existing_staff_name', NULL,
      'existing_appointment_id', NULL,
      'dependents', '[]'::jsonb
    );
  END IF;

  v_tenant_id := public.resolve_public_booking_tenant_id(p_tenant_identifier);
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'client_name', NULL,
      'masked_name', NULL,
      'has_same_day_booking', false,
      'existing_booking_time', NULL,
      'existing_staff_name', NULL,
      'existing_appointment_id', NULL,
      'dependents', '[]'::jsonb
    );
  END IF;

  v_canon_phone := public.normalize_br_phone(p_client_phone);
  IF v_canon_phone IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'client_name', NULL,
      'masked_name', NULL,
      'has_same_day_booking', false,
      'existing_booking_time', NULL,
      'existing_staff_name', NULL,
      'existing_appointment_id', NULL,
      'dependents', '[]'::jsonb
    );
  END IF;

  SELECT c.id, c.name
    INTO v_holder_id, v_client_name
    FROM public.clients c
   WHERE c.tenant_id = v_tenant_id
     AND public.normalize_br_phone(c.phone) = v_canon_phone
   ORDER BY COALESCE(c.is_shared_phone, false) ASC, c.created_at ASC
   LIMIT 1;

  IF v_client_name IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'client_name', NULL,
      'masked_name', NULL,
      'has_same_day_booking', false,
      'existing_booking_time', NULL,
      'existing_staff_name', NULL,
      'existing_appointment_id', NULL,
      'dependents', '[]'::jsonb
    );
  END IF;

  -- Busca filhos/dependentes vinculados ao titular
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'name', d.name,
        'masked_name', public.mask_public_client_name(d.name)
      )
      ORDER BY d.name ASC
    ),
    '[]'::jsonb
  )
  INTO v_dependents
  FROM public.clients d
  WHERE d.tenant_id = v_tenant_id
    AND d.parent_client_id = v_holder_id
    AND COALESCE(d.status, 'active') = 'active';

  -- Checar se o titular já possui agendamento ativo na data pretendida
  IF p_target_date IS NOT NULL THEN
    SELECT COALESCE(timezone, 'America/Sao_Paulo')
      INTO v_timezone
      FROM public.tenant_settings
     WHERE tenant_id = v_tenant_id;

    v_target_day := (p_target_date AT TIME ZONE v_timezone)::date;

    SELECT a.id,
           to_char(a.start_time AT TIME ZONE v_timezone, 'HH24:MI'),
           COALESCE(a.staff_name, (SELECT s.name FROM public.staff s WHERE s.id = a.staff_id))
      INTO v_existing_apt_id, v_existing_time, v_existing_staff
      FROM public.appointments a
     WHERE a.tenant_id = v_tenant_id
       AND (
         a.client_id = v_holder_id
         OR (
           a.client_id IS NULL
           AND public.normalize_br_phone(a.client_phone) = v_canon_phone
           AND lower(btrim(COALESCE(a.client_name, ''))) = lower(btrim(v_client_name))
         )
       )
       AND lower(COALESCE(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
       AND (a.start_time AT TIME ZONE v_timezone)::date = v_target_day
     ORDER BY a.start_time ASC
     LIMIT 1;

    IF v_existing_apt_id IS NOT NULL THEN
      v_has_same_day := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'client_name', v_client_name,
    'masked_name', public.mask_public_client_name(v_client_name),
    'has_same_day_booking', v_has_same_day,
    'existing_booking_time', v_existing_time,
    'existing_staff_name', v_existing_staff,
    'existing_appointment_id', v_existing_apt_id,
    'dependents', COALESCE(v_dependents, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_public_booking_client(text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_public_booking_client(text, text, timestamptz) TO anon, authenticated, service_role;

-- ============================================================================
-- 3. FRENTE C: create_public_booking com suporte a dependente real (client_id do filho)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_tenant_identifier TEXT,
  p_staff_id UUID,
  p_service_ids UUID[],
  p_start_time TIMESTAMPTZ,
  p_client_name TEXT,
  p_client_phone TEXT,
  p_notes TEXT,
  p_idempotency_key TEXT,
  p_is_for_other BOOLEAN,
  p_beneficiary_name TEXT,
  p_dependent_client_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_tenant_id UUID;
  v_settings RECORD;
  v_timezone TEXT := 'America/Sao_Paulo';
  v_appointment_id UUID;
  v_holder_client_id UUID;
  v_client_id UUID;
  v_existing_client_name TEXT;
  v_resolved_client_name TEXT;
  v_dependent_record RECORD;
  v_clean_phone TEXT := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  v_canon_phone TEXT := public.normalize_br_phone(p_client_phone);
  v_target_day DATE;
  v_same_day_apt_id UUID;
  v_same_day_time TEXT;
  v_same_day_staff TEXT;
  v_end_time TIMESTAMPTZ;
  v_total_duration INTEGER := 0;
  v_duration_hours NUMERIC(4, 2) := 1;
  v_total_price NUMERIC(10, 2) := 0;
  v_service_names TEXT;
  v_first_service_id UUID;
  v_staff_name TEXT;
  v_comanda_id UUID;
  v_comanda_status TEXT := 'open';
  v_existing_idempotent RECORD;
  v_public_token TEXT;
  v_token_hash VARCHAR(255);
  v_token_id UUID;
  v_token_expires_at TIMESTAMPTZ;
  v_min_notice INTEGER;
  v_effective_notes TEXT := p_notes;
BEGIN
  IF p_tenant_identifier IS NULL OR btrim(p_tenant_identifier) = '' THEN
    RAISE EXCEPTION 'tenant_required' USING ERRCODE = 'P0001';
  END IF;

  v_tenant_id := public.resolve_public_booking_tenant_id(p_tenant_identifier);

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_settings FROM public.tenant_settings WHERE tenant_id = v_tenant_id;
  v_timezone := COALESCE(v_settings.timezone, 'America/Sao_Paulo');
  v_min_notice := COALESCE(v_settings.min_booking_notice_minutes, 30);

  IF NOT COALESCE(v_settings.booking_enabled, true) THEN
    RAISE EXCEPTION 'booking_disabled' USING ERRCODE = 'P0001';
  END IF;

  -- Checagem de idempotência
  IF p_idempotency_key IS NOT NULL THEN
    SELECT a.id, a.client_id, a.staff_id, a.start_time, a.end_time, a.status, a.notes
      INTO v_existing_idempotent
      FROM public.appointments a
     WHERE a.tenant_id = v_tenant_id
       AND a.idempotency_key = p_idempotency_key
     LIMIT 1;

    IF v_existing_idempotent.id IS NOT NULL THEN
      SELECT t.id, t.expires_at INTO v_token_id, v_token_expires_at
        FROM public.public_booking_tokens t
       WHERE t.appointment_id = v_existing_idempotent.id
       ORDER BY t.created_at DESC LIMIT 1;

      RETURN jsonb_build_object(
        'appointment_id', v_existing_idempotent.id,
        'client_id', v_existing_idempotent.client_id,
        'status', v_existing_idempotent.status,
        'public_token', NULL,
        'public_token_id', v_token_id,
        'expires_at', v_token_expires_at,
        'services', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('service_id', s.id, 'name', s.name, 'duration', aps.duration_minutes, 'price', aps.unit_price) ORDER BY aps.sort_order), '[]'::jsonb)
            FROM public.appointment_services aps
            JOIN public.services s ON s.id = aps.service_id
           WHERE aps.appointment_id = v_existing_idempotent.id
        ),
        'staff', (SELECT jsonb_build_object('id', st.id, 'name', st.name) FROM public.staff st WHERE st.id = v_existing_idempotent.staff_id),
        'start_time', v_existing_idempotent.start_time,
        'end_time', v_existing_idempotent.end_time,
        'idempotent', true
      );
    END IF;
  END IF;

  IF p_staff_id IS NULL OR p_service_ids IS NULL OR array_length(p_service_ids, 1) = 0 THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  IF btrim(COALESCE(p_client_name, '')) = '' THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  IF v_clean_phone !~ '^\d{10,13}$' THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  IF v_canon_phone IS NULL THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = 'P0001';
  END IF;

  IF p_start_time < (now() + (v_min_notice || ' minutes')::interval - interval '5 minutes') THEN
    RAISE EXCEPTION 'booking_too_soon' USING ERRCODE = 'P0001';
  END IF;

  IF (p_start_time AT TIME ZONE v_timezone)::date > (CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::date + COALESCE(v_settings.booking_horizon_days, 30) THEN
    RAISE EXCEPTION 'booking_too_far' USING ERRCODE = 'P0001';
  END IF;

  SELECT st.name INTO v_staff_name
    FROM public.staff st
   WHERE st.id = p_staff_id
     AND st.tenant_id = v_tenant_id
     AND st.status = 'active'
     AND lower(st.role) IN ('barber', 'manager');

  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  SELECT
    COALESCE(SUM(s.duration), 0),
    COALESCE(SUM(s.price), 0),
    string_agg(s.name, ', ' ORDER BY ord.ordinality),
    (ARRAY_AGG(s.id ORDER BY ord.ordinality))[1]
  INTO v_total_duration, v_total_price, v_service_names, v_first_service_id
  FROM public.services s
  JOIN unnest(p_service_ids) WITH ORDINALITY AS ord(val, ordinality) ON s.id = ord.val
  WHERE s.tenant_id = v_tenant_id
    AND s.active = true;

  IF v_total_duration = 0 THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  v_duration_hours := ROUND((v_total_duration::numeric / 60.0), 2);
  v_end_time := p_start_time + (v_total_duration || ' minutes')::interval;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || p_staff_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.appointments a
     WHERE a.tenant_id = v_tenant_id
       AND a.staff_id = p_staff_id
       AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show', 'completed')
       AND a.end_time > a.start_time
       AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(p_start_time, v_end_time, '[)')
  ) THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  -- Obter ou criar cliente titular pelo telefone canônico
  SELECT c.id, c.name INTO v_holder_client_id, v_existing_client_name
    FROM public.clients c
   WHERE c.tenant_id = v_tenant_id
     AND public.normalize_br_phone(c.phone) = v_canon_phone
   ORDER BY COALESCE(c.is_shared_phone, false) ASC, c.created_at ASC
   LIMIT 1;

  IF v_holder_client_id IS NULL THEN
    BEGIN
      INSERT INTO public.clients (tenant_id, name, phone)
      VALUES (v_tenant_id, btrim(p_client_name), v_canon_phone)
      RETURNING id, name INTO v_holder_client_id, v_existing_client_name;
    EXCEPTION WHEN unique_violation THEN
      SELECT c.id, c.name INTO v_holder_client_id, v_existing_client_name
        FROM public.clients c
       WHERE c.tenant_id = v_tenant_id
         AND public.normalize_br_phone(c.phone) = v_canon_phone
       ORDER BY COALESCE(c.is_shared_phone, false) ASC, c.created_at ASC
       LIMIT 1;
    END;
  END IF;

  -- Resolução do cliente atendido (Titular vs Filho/Dependente)
  v_client_id := v_holder_client_id;
  v_resolved_client_name := COALESCE(NULLIF(btrim(v_existing_client_name), ''), btrim(p_client_name));

  IF COALESCE(p_is_for_other, false) OR p_dependent_client_id IS NOT NULL THEN
    IF p_dependent_client_id IS NOT NULL THEN
      SELECT d.id, d.name
        INTO v_dependent_record
        FROM public.clients d
       WHERE d.id = p_dependent_client_id
         AND d.tenant_id = v_tenant_id
         AND d.parent_client_id = v_holder_client_id
       LIMIT 1;

      IF v_dependent_record.id IS NOT NULL THEN
        v_client_id := v_dependent_record.id;
        v_resolved_client_name := v_dependent_record.name;
      END IF;
    END IF;

    IF v_client_id = v_holder_client_id THEN
      IF btrim(COALESCE(p_beneficiary_name, '')) = '' OR
         lower(btrim(p_beneficiary_name)) = lower(btrim(COALESCE(v_existing_client_name, p_client_name))) THEN
        RAISE EXCEPTION 'same_day_beneficiary_required'
          USING ERRCODE = 'P0001',
                DETAIL = 'Informe o nome de quem será atendido (filho, parente ou amigo)';
      END IF;

      -- Verifica se já existe dependente vinculado com esse nome
      SELECT d.id, d.name
        INTO v_dependent_record
        FROM public.clients d
       WHERE d.tenant_id = v_tenant_id
         AND d.parent_client_id = v_holder_client_id
         AND lower(btrim(d.name)) = lower(btrim(p_beneficiary_name))
       ORDER BY d.created_at ASC
       LIMIT 1;

      IF v_dependent_record.id IS NOT NULL THEN
        v_client_id := v_dependent_record.id;
        v_resolved_client_name := v_dependent_record.name;
      ELSE
        -- Cria automaticamente o perfil de dependente vinculado ao responsável
        INSERT INTO public.clients (
          tenant_id,
          name,
          phone,
          parent_client_id,
          is_shared_phone
        ) VALUES (
          v_tenant_id,
          btrim(p_beneficiary_name),
          v_canon_phone,
          v_holder_client_id,
          true
        )
        RETURNING id, name INTO v_client_id, v_resolved_client_name;
      END IF;
    END IF;

    v_effective_notes := concat_ws(' | ',
      NULLIF(btrim(v_effective_notes), ''),
      'Agendado por ' || COALESCE(v_existing_client_name, p_client_name) || ' para ' || v_resolved_client_name
    );
  END IF;

  -- ==========================================================================
  -- REGRA DO MESMO DIA: Impede 2 agendamentos no mesmo dia para a MESMA pessoa
  -- (permite que pai e filhos tenham seus próprios agendamentos no mesmo dia)
  -- ==========================================================================
  v_target_day := (p_start_time AT TIME ZONE v_timezone)::date;

  SELECT a.id,
         to_char(a.start_time AT TIME ZONE v_timezone, 'HH24:MI'),
         COALESCE(a.staff_name, (SELECT s.name FROM public.staff s WHERE s.id = a.staff_id))
    INTO v_same_day_apt_id, v_same_day_time, v_same_day_staff
    FROM public.appointments a
   WHERE a.tenant_id = v_tenant_id
     AND (
       a.client_id = v_client_id
       OR (
         public.normalize_br_phone(a.client_phone) = v_canon_phone
         AND lower(btrim(COALESCE(a.client_name, ''))) = lower(btrim(v_resolved_client_name))
       )
     )
     AND lower(COALESCE(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
     AND (a.start_time AT TIME ZONE v_timezone)::date = v_target_day
   ORDER BY a.start_time ASC
   LIMIT 1;

  IF v_same_day_apt_id IS NOT NULL THEN
    RAISE EXCEPTION 'same_day_booking_limit'
      USING ERRCODE = 'P0001',
            DETAIL = 'Cliente já possui agendamento neste dia (' || COALESCE(v_same_day_time, '') || ' com ' || COALESCE(v_same_day_staff, '') || ')';
  END IF;

  -- Rate limit por telefone normalizado (máx 1 agendamento a cada 2 minutos para a mesma pessoa)
  IF NOT COALESCE(p_is_for_other, false) AND p_dependent_client_id IS NULL AND EXISTS (
    SELECT 1 FROM public.appointments a
     WHERE a.tenant_id = v_tenant_id
       AND a.client_id = v_client_id
       AND a.source = 'booking_web'
       AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
       AND a.created_at > now() - interval '2 minutes'
  ) THEN
    RAISE EXCEPTION 'rate_limit_exceeded' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.appointments (
    tenant_id, client_id, service_id, staff_id, client_name, client_phone,
    service_name, staff_name, start_time, end_time, duration, price,
    status, source, channel, notes, idempotency_key
  ) VALUES (
    v_tenant_id, v_client_id, v_first_service_id, p_staff_id, v_resolved_client_name, v_canon_phone,
    COALESCE(v_service_names, ''), COALESCE(v_staff_name, ''), p_start_time, v_end_time, v_duration_hours, v_total_price,
    CASE WHEN COALESCE(v_settings.auto_confirm_online_bookings, true) THEN 'confirmed' ELSE 'pending' END,
    'booking_web', 'site', v_effective_notes, p_idempotency_key
  ) RETURNING id INTO v_appointment_id;

  INSERT INTO public.appointment_services (
    tenant_id, appointment_id, service_id, unit_price, duration_minutes, quantity, sort_order
  )
  SELECT
    v_tenant_id, v_appointment_id, s.id, s.price, s.duration, 1, ord.ordinality
  FROM public.services s
  JOIN unnest(p_service_ids) WITH ORDINALITY AS ord(val, ordinality) ON s.id = ord.val
  WHERE s.tenant_id = v_tenant_id
    AND s.active = true;

  IF (p_start_time AT TIME ZONE v_timezone)::date > (CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::date THEN
    v_comanda_status := 'blocked';
  ELSE
    v_comanda_status := 'open';
  END IF;

  INSERT INTO public.comandas (
    tenant_id, appointment_id, client_id, staff_id, status, total, idempotency_key
  ) VALUES (
    v_tenant_id, v_appointment_id, v_client_id, p_staff_id, v_comanda_status, v_total_price, p_idempotency_key
  ) RETURNING id INTO v_comanda_id;

  INSERT INTO public.comanda_items (
    tenant_id, comanda_id, service_id, product_name, quantity, unit_price, staff_id
  )
  SELECT
    v_tenant_id,
    v_comanda_id,
    s.id,
    s.name,
    1,
    s.price,
    p_staff_id
  FROM public.services s
  JOIN unnest(p_service_ids) WITH ORDINALITY AS ord(val, ordinality) ON s.id = ord.val
  WHERE s.tenant_id = v_tenant_id
    AND s.active = true;

  v_public_token := encode(extensions.gen_random_bytes(32), 'base64');
  v_token_hash := encode(extensions.digest(btrim(v_public_token), 'sha256'), 'hex');
  v_token_expires_at := v_end_time + interval '30 days';

  INSERT INTO public.public_booking_tokens (
    tenant_id, appointment_id, token_hash, expires_at
  ) VALUES (
    v_tenant_id, v_appointment_id, v_token_hash, v_token_expires_at
  ) RETURNING id INTO v_token_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'client_id', v_client_id,
    'status', CASE WHEN COALESCE(v_settings.auto_confirm_online_bookings, true) THEN 'confirmed' ELSE 'pending' END,
    'public_token', v_public_token,
    'public_token_id', v_token_id,
    'expires_at', v_token_expires_at,
    'services', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('service_id', s.id, 'name', s.name, 'duration', aps.duration_minutes, 'price', aps.unit_price) ORDER BY aps.sort_order), '[]'::jsonb)
        FROM public.appointment_services aps
        JOIN public.services s ON s.id = aps.service_id
       WHERE aps.appointment_id = v_appointment_id
    ),
    'staff', (SELECT jsonb_build_object('id', st.id, 'name', st.name) FROM public.staff st WHERE st.id = p_staff_id),
    'start_time', p_start_time,
    'end_time', v_end_time,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, UUID) TO anon, authenticated, service_role;

-- Overload retrocompatível de 10 parâmetros delegando para a assinatura completa de 11 parâmetros
CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_tenant_identifier TEXT,
  p_staff_id UUID,
  p_service_ids UUID[],
  p_start_time TIMESTAMPTZ,
  p_client_name TEXT,
  p_client_phone TEXT,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_is_for_other BOOLEAN DEFAULT FALSE,
  p_beneficiary_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
  SELECT public.create_public_booking(
    p_tenant_identifier,
    p_staff_id,
    p_service_ids,
    p_start_time,
    p_client_name,
    p_client_phone,
    p_notes,
    p_idempotency_key,
    p_is_for_other,
    p_beneficiary_name,
    NULL::uuid
  );
$$;

REVOKE ALL ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
