-- ============================================================================
-- 20261128000000_adr059_quick_pdv_scoped_rbac_and_retroactive_pin.sql
--
-- ADR-059: PDV Rápido Dual (Express 1-Toque + Lançamento e Baixa Simultânea)
-- Emenda escopada ao ADR-019 + suporte à competência retroativa com PIN
-- gerencial (ADR-039) no settlement central.
--
-- REGRAS DE SEGURANÇA & RBAC:
--   1. Gestores (owner/admin/manager/gerente/superadmin):
--      - Podem liquidar qualquer comanda do tenant para Hoje ou dias anteriores.
--      - Data futura é sempre rejeitada.
--      - Se a data de competência cair em cash_closings.status = 'confirmed',
--        EXIGE p_audit_pin válido (verify_audit_pin) e grava
--        transactions.retroactive_adjustment = true + pin_authorized = true.
--   2. Recepcionista / Caixa (receptionist/recepcionista/cashier/caixa):
--      - Podem liquidar comandas do tenant SOMENTE na data de Hoje (e se o
--        caixa não estiver confirmado).
--   3. Barbeiro (barber/barbeiro):
--      - Pode liquidar SOMENTE comandas próprias (comandas.staff_id = auth.uid()
--        ou comanda_items.staff_id = auth.uid() ou participante em
--        service_execution_participants.staff_id = auth.uid()) e SOMENTE na
--        data de Hoje (e se o caixa não estiver confirmado).
--   4. Sem overloads órfãos: remove assinaturas antigas (9/14 e 8/13 params)
--      dentro da mesma transação antes de criar as assinaturas com p_audit_pin
--      DEFAULT NULL, evitando ambiguidade PGRST203 ou bypass do PIN.
--   5. ISOLAMENTO: todos os SELECTs/INSERTs/UPDATEs filtram por p_tenant_id.
--
-- NÃO APLICAR EM STAGING/PRODUÇÃO SEM AUTORIZAÇÃO EXPLÍCITA DO PO (ADR-048).
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Garante presença da coluna de ajuste retroativo (ADR-039) caso esta migration
-- seja avaliada isoladamente antes de staging promotion.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS retroactive_adjustment BOOLEAN NOT NULL DEFAULT false;

-- Remove assinaturas anteriores para impedir overload PGRST203 ou bypass sem PIN.
DROP FUNCTION IF EXISTS public.finance_settle_comanda_and_enqueue(
  UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, BOOLEAN
);
DROP FUNCTION IF EXISTS public.finance_settle_comanda_and_enqueue(
  UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB
);
DROP FUNCTION IF EXISTS public.finance_settle_comanda(
  UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, BOOLEAN
);
DROP FUNCTION IF EXISTS public.finance_settle_comanda(
  UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT
);

-- ============================================================================
-- 1. finance_settle_comanda (10 params)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.finance_settle_comanda(
    p_tenant_id              UUID,
    p_comanda_id             UUID,
    p_payment_method         TEXT,
    p_paid_amount            NUMERIC,
    p_payment_date_real      TIMESTAMPTZ DEFAULT now(),
    p_source                 TEXT DEFAULT 'checkout',
    p_notes                  TEXT DEFAULT NULL,
    p_idempotency_key        TEXT DEFAULT NULL,
    p_record_comanda_payment BOOLEAN DEFAULT false,
    p_audit_pin              TEXT DEFAULT NULL
) RETURNS JSONB
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
  v_is_manager_like BOOLEAN := false;
  v_is_receptionist BOOLEAN := false;
  v_is_barber BOOLEAN := false;
  v_comanda public.comandas%ROWTYPE;
  v_existing_transaction public.transactions%ROWTYPE;
  v_transaction_id UUID;
  v_payment_date_real TIMESTAMPTZ := COALESCE(p_payment_date_real, now());
  v_settled_at TIMESTAMPTZ := now();
  v_source TEXT := NULLIF(BTRIM(COALESCE(p_source, '')), '');
  v_notes TEXT := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
  v_idempotency_key TEXT := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  v_payment_method TEXT := NULLIF(BTRIM(COALESCE(p_payment_method, '')), '');
  v_audit_pin TEXT := NULLIF(BTRIM(COALESCE(p_audit_pin, '')), '');
  v_timezone TEXT := 'America/Sao_Paulo';
  v_business_date DATE;
  v_today_date DATE;
  v_is_closed_cash BOOLEAN := false;
  v_retroactive BOOLEAN := false;
  v_total_prev_paid NUMERIC := 0;
  v_remaining_balance NUMERIC := 0;
  v_comanda_payment_amount NUMERIC := 0;
BEGIN
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_comanda_id IS NULL THEN RAISE EXCEPTION 'comanda_id obrigatorio'; END IF;
  IF v_payment_method IS NULL THEN RAISE EXCEPTION 'Forma de pagamento obrigatoria'; END IF;
  IF COALESCE(p_paid_amount, 0) <= 0 THEN RAISE EXCEPTION 'Valor pago deve ser maior que zero'; END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT LOWER(BTRIM(COALESCE(p.role, ''))) INTO v_access_role
  FROM public.profiles p WHERE p.id = v_auth_uid LIMIT 1;

  IF NULLIF(v_access_role, '') IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s WHERE s.id = v_auth_uid LIMIT 1;
  END IF;

  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC LIMIT 1;

  -- Isolamento estrito de tenant
  IF NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id
     AND NOT EXISTS (
       SELECT 1 FROM public.user_tenants ut
       WHERE ut.user_id = v_auth_uid
         AND ut.tenant_id = p_tenant_id
     ) THEN
    RAISE EXCEPTION 'Tenant nao autorizado';
  END IF;

  v_is_manager_like := COALESCE(v_is_super_admin, false)
    OR COALESCE(v_access_role, '') IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
    OR COALESCE(v_membership_role, '') IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin');

  v_is_receptionist := COALESCE(v_access_role, '') IN ('receptionist', 'recepcionista', 'cashier', 'caixa')
    OR COALESCE(v_membership_role, '') IN ('receptionist', 'recepcionista', 'cashier', 'caixa');

  v_is_barber := COALESCE(v_access_role, '') IN ('barber', 'barbeiro')
    OR COALESCE(v_membership_role, '') IN ('barber', 'barbeiro');

  IF NOT v_is_manager_like AND NOT v_is_receptionist AND NOT v_is_barber THEN
    RAISE EXCEPTION 'Usuario sem permissao para baixa financeira central';
  END IF;

  -- Competência e validação de caixa fechado (ADR-039 + ADR-059)
  SELECT COALESCE(NULLIF(BTRIM(ts.timezone), ''), 'America/Sao_Paulo')
  INTO v_timezone
  FROM public.tenant_settings ts
  WHERE ts.tenant_id = p_tenant_id
  LIMIT 1;
  v_timezone := COALESCE(v_timezone, 'America/Sao_Paulo');

  v_business_date := (v_payment_date_real AT TIME ZONE v_timezone)::date;
  v_today_date := (now() AT TIME ZONE v_timezone)::date;

  IF v_business_date > v_today_date THEN
    RAISE EXCEPTION 'Data de competencia nao pode ser futura';
  END IF;

  IF v_business_date < v_today_date AND NOT v_is_manager_like THEN
    RAISE EXCEPTION 'Lancamento retroativo permitido apenas para gestores';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.cash_closings cc
    WHERE cc.tenant_id = p_tenant_id
      AND cc.business_date = v_business_date
      AND cc.status = 'confirmed'
  ) INTO v_is_closed_cash;

  IF v_is_closed_cash THEN
    IF NOT v_is_manager_like THEN
      RAISE EXCEPTION 'Caixa do dia ja esta confirmado';
    END IF;
    IF v_audit_pin IS NULL THEN
      RAISE EXCEPTION 'Lancamento retroativo em caixa fechado exige PIN de gerente';
    END IF;
    IF NOT public.verify_audit_pin(v_auth_uid, p_tenant_id, v_audit_pin) THEN
      PERFORM pg_sleep(0.25);
      RAISE EXCEPTION 'PIN de autorizacao invalido';
    END IF;
    v_retroactive := true;
  END IF;

  -- Idempotência
  IF v_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_transaction FROM public.transactions t
    WHERE t.tenant_id = p_tenant_id AND t.idempotency_key = v_idempotency_key LIMIT 1;
    IF FOUND THEN
      IF v_existing_transaction.source_type IS DISTINCT FROM 'comanda'
         OR v_existing_transaction.source_id IS DISTINCT FROM p_comanda_id THEN
        RAISE EXCEPTION 'Chave de idempotencia ja utilizada em outro lancamento';
      END IF;
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'comanda_id', v_existing_transaction.source_id,
        'transaction_id', v_existing_transaction.id,
        'status', 'paid',
        'message', 'Baixa ja processada anteriormente. Transacao original retornada.'
      );
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('finance_settle_comanda:' || p_tenant_id::text || ':' || p_comanda_id::text));
  SELECT * INTO v_comanda FROM public.comandas c
  WHERE c.id = p_comanda_id AND c.tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda nao encontrada para este tenant'; END IF;

  -- Isolamento horizontal por papel: barbeiro só pode liquidar comandas próprias
  IF v_is_barber AND NOT v_is_manager_like AND NOT v_is_receptionist THEN
    IF NOT (
      v_comanda.staff_id = v_auth_uid
      OR EXISTS (
        SELECT 1
        FROM public.comanda_items ci
        WHERE ci.comanda_id = p_comanda_id
          AND ci.tenant_id = p_tenant_id
          AND ci.staff_id = v_auth_uid
      )
      OR EXISTS (
        SELECT 1
        FROM public.comanda_items ci
        JOIN public.service_execution_participants sep
          ON sep.comanda_item_id = ci.id
         AND sep.tenant_id = p_tenant_id
        WHERE ci.comanda_id = p_comanda_id
          AND ci.tenant_id = p_tenant_id
          AND sep.staff_id = v_auth_uid
      )
    ) THEN
      RAISE EXCEPTION 'Barbeiro so pode liquidar comandas proprias';
    END IF;
  END IF;

  IF v_comanda.status = 'paid' THEN
    SELECT * INTO v_existing_transaction FROM public.transactions t
    WHERE t.tenant_id = p_tenant_id AND t.source_type = 'comanda' AND t.source_id = p_comanda_id
      AND t.idempotency_key = v_idempotency_key AND t.type = 'income' AND COALESCE(t.status, 'paid') = 'paid'
    ORDER BY t.date DESC, t.id DESC LIMIT 1;
    IF FOUND AND v_idempotency_key IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'comanda_id', p_comanda_id,
        'transaction_id', v_existing_transaction.id,
        'status', 'paid',
        'message', 'Comanda ja estava baixada. Transacao existente retornada.'
      );
    END IF;
    RAISE EXCEPTION 'Comanda ja esta baixada';
  END IF;

  IF v_comanda.status NOT IN ('open', 'blocked') THEN
    RAISE EXCEPTION 'Comanda nao pode ser baixada no status atual: %', v_comanda.status;
  END IF;

  UPDATE public.comandas SET
    status = 'paid',
    payment_method = v_payment_method,
    closure_mode = COALESCE(NULLIF(closure_mode, ''), 'standard'),
    financial_effect = true,
    payment_date_real = v_payment_date_real,
    settled_at = v_settled_at,
    settled_by_user_id = v_auth_uid,
    closed_at = v_payment_date_real
  WHERE id = p_comanda_id AND tenant_id = p_tenant_id;

  INSERT INTO public.transactions (
    tenant_id, user_id, type, category, description, amount, payment_method,
    date, status, notes, source_type, source_id, idempotency_key,
    retroactive_adjustment, metadata
  ) VALUES (
    p_tenant_id,
    v_auth_uid,
    'income',
    'Receita de Comanda',
    'Baixa financeira de comanda ' || p_comanda_id::text || ' via ' || COALESCE(v_source, 'financeiro')
      || CASE WHEN v_retroactive THEN ' (lancamento retroativo em caixa fechado)' ELSE '' END,
    p_paid_amount,
    v_payment_method,
    v_payment_date_real,
    'paid',
    v_notes,
    'comanda',
    p_comanda_id,
    v_idempotency_key,
    v_retroactive,
    jsonb_build_object(
      'source', COALESCE(v_source, 'financeiro'),
      'comanda_id', p_comanda_id,
      'tenant_id', p_tenant_id,
      'comanda_total', COALESCE(v_comanda.total, 0),
      'paid_amount', p_paid_amount,
      'amount_difference', p_paid_amount - COALESCE(v_comanda.total, 0),
      'payment_date_real', v_payment_date_real,
      'competence_date', v_business_date,
      'retroactive_adjustment', v_retroactive,
      'pin_authorized', v_retroactive,
      'settled_at', v_settled_at,
      'settled_by_user_id', v_auth_uid,
      'notes', v_notes,
      'idempotency_key', v_idempotency_key
    )
  )
  RETURNING id INTO v_transaction_id;

  -- ADR-018: grava pagamento comprovado em comanda_payments (limitado ao saldo restante)
  IF p_record_comanda_payment THEN
    SELECT COALESCE(SUM(cp.amount), 0) INTO v_total_prev_paid
    FROM public.comanda_payments cp
    WHERE cp.tenant_id = p_tenant_id
      AND cp.comanda_id = p_comanda_id
      AND cp.reversed_at IS NULL;

    v_remaining_balance := GREATEST(COALESCE(v_comanda.total, 0) - COALESCE(v_total_prev_paid, 0), 0);
    v_comanda_payment_amount := LEAST(p_paid_amount, v_remaining_balance);

    IF v_comanda_payment_amount > 0 THEN
      INSERT INTO public.comanda_payments (
        tenant_id, comanda_id, payment_type, amount,
        payment_method, actor_id, idempotency_key
      ) VALUES (
        p_tenant_id,
        p_comanda_id,
        'final'::public.payment_type,
        v_comanda_payment_amount,
        v_payment_method,
        v_auth_uid,
        CASE WHEN v_idempotency_key IS NOT NULL
             THEN v_idempotency_key || '::comanda_payment'
             ELSE NULL END
      )
      ON CONFLICT (tenant_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL
        DO NOTHING;
    END IF;
  END IF;

  IF v_comanda.appointment_id IS NOT NULL THEN
    UPDATE public.appointments SET status = 'completed'
    WHERE id = v_comanda.appointment_id AND tenant_id = p_tenant_id AND status <> 'completed';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'comanda_id', p_comanda_id,
    'transaction_id', v_transaction_id,
    'status', 'paid',
    'retroactive_adjustment', v_retroactive,
    'message', 'Baixa financeira registrada com sucesso.'
  );
END;
$$;

-- ============================================================================
-- 2. finance_settle_comanda_and_enqueue (15 params)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.finance_settle_comanda_and_enqueue(
    p_tenant_id              UUID,
    p_comanda_id             UUID,
    p_payment_method         TEXT,
    p_paid_amount            NUMERIC,
    p_payment_date_real      TIMESTAMPTZ DEFAULT now(),
    p_source                 TEXT DEFAULT 'checkout',
    p_notes                  TEXT DEFAULT NULL,
    p_idempotency_key        TEXT DEFAULT NULL,
    p_outbox_event_id        TEXT DEFAULT NULL,
    p_outbox_event_type      TEXT DEFAULT NULL,
    p_outbox_payload         JSONB DEFAULT NULL,
    p_outbox_metadata        JSONB DEFAULT NULL,
    p_outbox_targets         JSONB DEFAULT NULL,
    p_record_comanda_payment BOOLEAN DEFAULT false,
    p_audit_pin              TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_settlement JSONB;
    v_targets    JSONB;
BEGIN
    SELECT public.finance_settle_comanda(
        p_tenant_id,
        p_comanda_id,
        p_payment_method,
        p_paid_amount,
        p_payment_date_real,
        p_source,
        p_notes,
        p_idempotency_key,
        p_record_comanda_payment,
        p_audit_pin
    ) INTO v_settlement;

    IF v_settlement IS NULL THEN
        RAISE EXCEPTION 'finance_settle_comanda retornou NULL';
    END IF;

    IF NOT (v_settlement->>'success')::boolean THEN
        RETURN v_settlement;
    END IF;

    IF (v_settlement->>'idempotent')::boolean THEN
        RETURN v_settlement;
    END IF;

    v_targets := COALESCE(
        p_outbox_targets,
        '[{"provider":"finance","config":{}}]'::jsonb
    );

    INSERT INTO public.outbox_items (
        event_id,
        event_type,
        tenant_id,
        targets,
        status,
        payload,
        metadata,
        retry_attempts,
        retry_max_attempts,
        retry_base_delay_ms,
        created_at,
        updated_at
    ) VALUES (
        p_outbox_event_id,
        p_outbox_event_type,
        p_tenant_id::text,
        v_targets,
        'pending',
        p_outbox_payload,
        p_outbox_metadata,
        0,
        5,
        1000,
        now(),
        now()
    )
    ON CONFLICT (event_id) DO NOTHING;

    RETURN v_settlement;
END;
$$;

-- ============================================================================
-- 3. ACLs estritas (ADR-012)
-- ============================================================================
REVOKE ALL ON FUNCTION public.finance_settle_comanda(
    UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, BOOLEAN, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_settle_comanda(
    UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, BOOLEAN, TEXT
) FROM anon;
GRANT EXECUTE ON FUNCTION public.finance_settle_comanda(
    UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, BOOLEAN, TEXT
) TO authenticated;

REVOKE ALL ON FUNCTION public.finance_settle_comanda_and_enqueue(
    UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, BOOLEAN, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_settle_comanda_and_enqueue(
    UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, BOOLEAN, TEXT
) FROM anon;
GRANT EXECUTE ON FUNCTION public.finance_settle_comanda_and_enqueue(
    UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, BOOLEAN, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.finance_settle_comanda(UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, BOOLEAN, TEXT) IS
    'ADR-059 + ADR-039: Baixa financeira centralizada com RBAC escopado (gestores, recepcao hoje, barbeiro proprias comandas hoje) e PIN gerencial obrigatorio em caixa confirmado.';
COMMENT ON FUNCTION public.finance_settle_comanda_and_enqueue(UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, BOOLEAN, TEXT) IS
    'D7 + ADR-059: Transactional Outbox composite RPC repassando p_record_comanda_payment e p_audit_pin.';

NOTIFY pgrst, 'reload schema';

COMMIT;
