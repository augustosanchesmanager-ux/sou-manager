-- ============================================================================
-- 20261004050000_finance_settle_comanda_record_adr018.sql
-- ADR-018: grava a baixa de comanda tambem em comanda_payments (regime de caixa)
--
-- PROBLEMA: o fechamento de comanda no balcao gravava apenas
-- `comandas.status = 'paid'` e `transactions`, nunca `comanda_payments`. A
-- ADR-018 ficava inerte e o fallback legado do fechamento de caixa operava
-- sem base liquidada comprovada.
--
-- ESCOPO: superset fiel das 117 linhas de finance_settle_comanda, com um
-- INSERT condicional em comanda_payments. Nenhuma logica de validacao,
-- lock ou autorizacao foi reescrita.
--
-- ISOLAMENTO: o novo comportamento e opt-in via p_record_comanda_payment.
-- Chamadores legados (bulk_close_comandas_admin, baixa de clube, inventario)
-- continuam com o default false e NAO geram pagamento — conforme decisao de
-- que baixa administrativa nao e quitacao em caixa.
--
-- NAO APLICADO. Exige preflight e autorizacao explicita do PO.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. GUARD FAIL-LOUD: as assinaturas legadas precisam existir exatamente
--    como esperado. Sem este check, um DROP com tipos divergentes seria
--    no-op silencioso (IF EXISTS nao erra) e o CREATE geraria um OVERLOAD.
--    Os chamadores legados continuariam resolvendo para a assinatura antiga
--    e a ADR-018 nunca seria gravada — falha silenciosa, sem erro visivel.
-- ============================================================================

DO $$
DECLARE
    v_legacy_settle TEXT;
    v_legacy_enqueue TEXT;
BEGIN
    SELECT pg_get_function_identity_arguments(p.oid) INTO v_legacy_settle
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'finance_settle_comanda'
      AND pg_get_function_identity_arguments(p.oid) =
          'uuid, uuid, text, numeric, timestamp with time zone, text, text, text';

    IF v_legacy_settle IS NULL THEN
        RAISE EXCEPTION
            'Assinatura legada (8 params) de finance_settle_comanda nao encontrada. Abortando migration para evitar overload zumbi.';
    END IF;

    SELECT pg_get_function_identity_arguments(p.oid) INTO v_legacy_enqueue
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'finance_settle_comanda_and_enqueue'
      AND pg_get_function_identity_arguments(p.oid) =
          'uuid, uuid, text, numeric, timestamp with time zone, text, text, text, text, text, jsonb, jsonb, jsonb';

    IF v_legacy_enqueue IS NULL THEN
        RAISE EXCEPTION
            'Assinatura legada (13 params) de finance_settle_comanda_and_enqueue nao encontrada. Abortando migration para evitar overload zumbi.';
    END IF;
END $$;

-- ============================================================================
-- 2. Wrapper primeiro: assim nunca existe instante em que ele aponte para
--    uma assinatura inexistente. So depois de recria-lo as legadas saem.
-- ============================================================================

DROP FUNCTION public.finance_settle_comanda_and_enqueue(
    UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB
);

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
    p_record_comanda_payment BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settlement JSONB;
    v_targets    JSONB;
BEGIN
    -- ── Step 1: Execute original settlement ──
    -- Se falhar, EXCEPTION propaga → ROLLBACK (nada persistido).
    SELECT public.finance_settle_comanda(
        p_tenant_id,
        p_comanda_id,
        p_payment_method,
        p_paid_amount,
        p_payment_date_real,
        p_source,
        p_notes,
        p_idempotency_key,
        p_record_comanda_payment
    ) INTO v_settlement;

    IF v_settlement IS NULL THEN
        RAISE EXCEPTION 'finance_settle_comanda retornou NULL';
    END IF;

    IF NOT (v_settlement->>'success')::boolean THEN
        RETURN v_settlement;
    END IF;

    -- ── Step 3: Replay idempotente → nao enfileira outbox ──
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
-- 3. Drops das legadas de finance_settle_comanda
-- ============================================================================

DROP FUNCTION public.finance_settle_comanda(
    UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT
);

-- ============================================================================
-- 4. finance_settle_comanda com 9 parametros
--    As 117 linhas originais preservadas. Unica mudanca: o INSERT
--    condicional em comanda_payments.
--
--    Defaults preservados da original (p_payment_date_real DEFAULT now(),
--    p_source DEFAULT 'checkout'). Alterar para NULL mudaria a descricao
--    da transactions de 'via checkout' para 'via financeiro'.
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
    p_record_comanda_payment BOOLEAN DEFAULT false
) RETURNS JSONB
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
  v_comanda public.comandas%ROWTYPE;
  v_existing_transaction public.transactions%ROWTYPE;
  v_transaction_id UUID;
  v_payment_date_real TIMESTAMPTZ := COALESCE(p_payment_date_real, now());
  v_settled_at TIMESTAMPTZ := now();
  v_source TEXT := NULLIF(BTRIM(COALESCE(p_source, '')), '');
  v_notes TEXT := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
  v_idempotency_key TEXT := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  v_payment_method TEXT := NULLIF(BTRIM(COALESCE(p_payment_method, '')), '');
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
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s WHERE s.id = v_auth_uid LIMIT 1;
  END IF;
  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC LIMIT 1;
  v_has_authorized_membership := COALESCE(v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin'), false);

  IF NOT COALESCE(v_is_super_admin, false)
     AND COALESCE(v_access_role, '') NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     AND NOT COALESCE(v_has_authorized_membership, false) THEN
    RAISE EXCEPTION 'Usuario sem permissao para baixa financeira central';
  END IF;
  IF NOT COALESCE(v_is_super_admin, false)
     AND NOT COALESCE(v_has_authorized_membership, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant nao autorizado';
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_transaction FROM public.transactions t
    WHERE t.tenant_id = p_tenant_id AND t.idempotency_key = v_idempotency_key LIMIT 1;
    IF FOUND THEN
      IF v_existing_transaction.source_type IS DISTINCT FROM 'comanda'
         OR v_existing_transaction.source_id IS DISTINCT FROM p_comanda_id THEN
        RAISE EXCEPTION 'Chave de idempotencia ja utilizada em outro lancamento';
      END IF;
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'comanda_id', v_existing_transaction.source_id, 'transaction_id', v_existing_transaction.id, 'status', 'paid', 'message', 'Baixa ja processada anteriormente. Transacao original retornada.');
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('finance_settle_comanda:' || p_tenant_id::text || ':' || p_comanda_id::text));
  SELECT * INTO v_comanda FROM public.comandas c
  WHERE c.id = p_comanda_id AND c.tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda nao encontrada para este tenant'; END IF;

  IF v_comanda.status = 'paid' THEN
    SELECT * INTO v_existing_transaction FROM public.transactions t
    WHERE t.tenant_id = p_tenant_id AND t.source_type = 'comanda' AND t.source_id = p_comanda_id
      AND t.idempotency_key = v_idempotency_key AND t.type = 'income' AND COALESCE(t.status, 'paid') = 'paid'
    ORDER BY t.date DESC, t.id DESC LIMIT 1;
    IF FOUND AND v_idempotency_key IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'comanda_id', p_comanda_id, 'transaction_id', v_existing_transaction.id, 'status', 'paid', 'message', 'Comanda ja estava baixada. Transacao existente retornada.');
    END IF;
    RAISE EXCEPTION 'Comanda ja esta baixada';
  END IF;
  IF v_comanda.status NOT IN ('open', 'blocked') THEN RAISE EXCEPTION 'Comanda nao pode ser baixada no status atual: %', v_comanda.status; END IF;

  UPDATE public.comandas SET status = 'paid', payment_method = v_payment_method,
    closure_mode = COALESCE(NULLIF(closure_mode, ''), 'standard'), financial_effect = true,
    payment_date_real = v_payment_date_real, settled_at = v_settled_at,
    settled_by_user_id = v_auth_uid, closed_at = v_payment_date_real
  WHERE id = p_comanda_id AND tenant_id = p_tenant_id;

  INSERT INTO public.transactions (tenant_id, user_id, type, category, description, amount, payment_method, date, status, notes, source_type, source_id, idempotency_key, metadata)
  VALUES (p_tenant_id, v_auth_uid, 'income', 'Receita de Comanda',
    'Baixa financeira de comanda ' || p_comanda_id::text || ' via ' || COALESCE(v_source, 'financeiro'),
    p_paid_amount, v_payment_method, v_payment_date_real, 'paid', v_notes, 'comanda', p_comanda_id, v_idempotency_key,
    jsonb_build_object('source', COALESCE(v_source, 'financeiro'), 'comanda_id', p_comanda_id, 'tenant_id', p_tenant_id, 'comanda_total', COALESCE(v_comanda.total, 0), 'paid_amount', p_paid_amount, 'amount_difference', p_paid_amount - COALESCE(v_comanda.total, 0), 'payment_date_real', v_payment_date_real, 'settled_at', v_settled_at, 'settled_by_user_id', v_auth_uid, 'notes', v_notes, 'idempotency_key', v_idempotency_key))
  RETURNING id INTO v_transaction_id;

  -- ADR-018: baixa de comanda no balcao tambem e um pagamento comprovado.
  -- A chave deriva com sufixo para que transactions e comanda_payments
  -- tenham ciclos de idempotencia independentes sem colidirem.
  IF p_record_comanda_payment THEN
    INSERT INTO public.comanda_payments (
      tenant_id, comanda_id, payment_type, amount,
      payment_method, actor_id, idempotency_key
    ) VALUES (
      p_tenant_id,
      p_comanda_id,
      'total',
      p_paid_amount,
      v_payment_method,
      v_auth_uid,
      CASE WHEN v_idempotency_key IS NOT NULL
           THEN v_idempotency_key || '::comanda_payment'
           ELSE NULL END
    );
  END IF;

  IF v_comanda.appointment_id IS NOT NULL THEN
    UPDATE public.appointments SET status = 'completed'
    WHERE id = v_comanda.appointment_id AND tenant_id = p_tenant_id AND status <> 'completed';
  END IF;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'comanda_id', p_comanda_id, 'transaction_id', v_transaction_id, 'status', 'paid', 'message', 'Baixa financeira registrada com sucesso.');
END;
$$;

-- ============================================================================
-- 5. ACLs: o DROP remove o ACL anterior. Sem reaplicar, a funcao nasceria
--    com EXECUTE liberado para PUBLIC — elevacao de privilegio numa
--    SECURITY DEFINER que baixa comanda e grava receita.
-- ============================================================================

REVOKE ALL ON FUNCTION public.finance_settle_comanda(
    UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_settle_comanda(
    UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, BOOLEAN
) TO authenticated;

REVOKE ALL ON FUNCTION public.finance_settle_comanda_and_enqueue(
    UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_settle_comanda_and_enqueue(
    UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, BOOLEAN
) TO authenticated;

COMMENT ON FUNCTION public.finance_settle_comanda(UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, BOOLEAN) IS
    'Baixa financeira centralizada de comanda. Quando p_record_comanda_payment = true, grava tambem em comanda_payments (ADR-018) com idempotency_key derivada. Superset fiel da versao de 8 parametros.';

COMMENT ON FUNCTION public.finance_settle_comanda_and_enqueue(UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, BOOLEAN) IS
    'D7: Transactional Outbox composite RPC. Repassa p_record_comanda_payment para finance_settle_comanda. Atomic: settlement, comanda_payments e outboxInsert na mesma transacao.';

NOTIFY pgrst, 'reload schema';

COMMIT;