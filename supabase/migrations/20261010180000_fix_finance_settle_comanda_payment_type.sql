-- ============================================================================
-- 20261010180000_fix_finance_settle_comanda_payment_type.sql
-- CORRETIVA da 20261004050000_finance_settle_comanda_record_adr018.sql.
--
-- BUG: o bloco `IF p_record_comanda_payment THEN` inseria
-- `payment_type = 'total'` em `public.comanda_payments.payment_type`, mas
-- `'total'` NAO existe no enum `public.payment_type`
-- ('anticipado', 'no_atendimento', 'posterior', 'parcial', 'final').
-- O checkout que liquidava comanda com `p_record_comanda_payment = true`
-- falhava com `code=22P02 | invalid input value for enum payment_type`.
--
-- CORRECAO (escopo minimo, sem reescrever validacao/lock/autorizacao):
--   1. `payment_type` passa a `'final'` — quitacao no balcao (checkout).
--   2. `amount` passa a ser o SALDO RESTANTE efetivamente pago
--      (`LEAST(p_paid_amount, comanda.total - SUM(pagamentos previos))`),
--      para nao duplicar receita no fechamento de caixa quando ja existem
--      parciais/antecipados previos em `comanda_payments`.
--   3. Idempotencia preservada: `ON CONFLICT (tenant_id, idempotency_key)
--      WHERE idempotency_key IS NOT NULL DO NOTHING` na mesma chave
--      derivada (`<key>::comanda_payment`).
--
-- NOTA DE ARQUITETURA: o INSERT vive em `finance_settle_comanda` (9 params);
-- `finance_settle_comanda_and_enqueue` (14 params) apenas delega via
-- `p_record_comanda_payment`. Esta migration recria AMBAS com
-- `CREATE OR REPLACE` (sem DROP, sem overload, sem tocar na migration
-- historica 20261004050000, sem ALTER TYPE, sem tocar RLS/tenant_id,
-- sem tocar comissao ou outras RPCs).
--
-- ISOLAMENTO: todos os SELECTs/INSERTs filtram por `p_tenant_id`.
-- NAO APLICADO. Exige preflight e autorizacao explicita do PO (STAGING/PROD).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. finance_settle_comanda (9 params) — copia fiel da 20261004050000,
--    com excecao do bloco ADR-018 corrigido (payment_type + saldo restante).
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
  -- CORRECAO 20261010: saldo restante para nao duplicar receita.
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

  -- ADR-018 (CORRIGIDO 20261010): baixa de comanda no balcao tambem e um
  -- pagamento comprovado. `payment_type = 'final'` (quitacao no checkout) —
  -- `'total'` nao existe no enum public.payment_type (22P02).
  -- `amount` = saldo restante efetivamente pago no ato, para que
  -- antecipados/parciais previos nao sejam contabilizados em duplicidade
  -- no fechamento de caixa. A chave deriva com sufixo para que
  -- transactions e comanda_payments tenham ciclos de idempotencia
  -- independentes sem colidirem.
  IF p_record_comanda_payment THEN
    SELECT COALESCE(SUM(cp.amount), 0) INTO v_total_prev_paid
    FROM public.comanda_payments cp
    WHERE cp.tenant_id = p_tenant_id
      AND cp.comanda_id = p_comanda_id
      AND cp.reversed_at IS NULL;

    v_remaining_balance := GREATEST(COALESCE(v_comanda.total, 0) - COALESCE(v_total_prev_paid, 0), 0);
    v_comanda_payment_amount := LEAST(p_paid_amount, v_remaining_balance);

    -- Saldo zero (parciais ja cobrem o total): nao ha valor a comprovar no
    -- ato; pular o INSERT evita violar CHECK (amount > 0). A baixa e a
    -- transaction acima seguem registradas normalmente.
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
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'comanda_id', p_comanda_id, 'transaction_id', v_transaction_id, 'status', 'paid', 'message', 'Baixa financeira registrada com sucesso.');
END;
$$;

-- ============================================================================
-- 2. finance_settle_comanda_and_enqueue (14 params) — repasse fiel da
--    20261004050000 (settlement + outbox atomicos). Sem alteracao de logica;
--    recriado via CREATE OR REPLACE para garantir que o caminho do checkout
--    resolve para a assinatura corrigida acima.
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
-- 3. ACLs (reaplicadas; CREATE OR REPLACE preserva, mas sem reaplicar um
--    DROP futuro nasceria com EXECUTE para PUBLIC numa SECURITY DEFINER).
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
    'Baixa financeira centralizada de comanda. Quando p_record_comanda_payment = true, grava tambem em comanda_payments (ADR-018) com payment_type = ''final'' e amount limitado ao saldo restante, com idempotency_key derivada. Corretiva 20261010 do enum invalido ''total'' (22P02).';
COMMENT ON FUNCTION public.finance_settle_comanda_and_enqueue(UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, BOOLEAN) IS
    'D7: Transactional Outbox composite RPC. Repassa p_record_comanda_payment para finance_settle_comanda. Atomic: settlement, comanda_payments e outboxInsert na mesma transacao.';

NOTIFY pgrst, 'reload schema';

COMMIT;
