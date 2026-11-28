-- ============================================================
-- 20261127203500_adr059_fase_a_split_payment_mirror_and_business_rules.sql
-- ADR-059 (Fase A — Fundação Financeira):
--   D-1: Espelhamento atômico comanda_payments <-> transactions
--   D-2: Quitação com múltiplas formas de pagamento (finance_settle_comanda_split)
--   D-3: Estorno em /cashflow propaga reversed_at em comanda_payments e recompõe saldo
--   D-4: Coluna aditiva payment_pending_since + rotina diária 00:05 BRT (pg_cron)
--   D-5: RPCs get_tenant_business_rules / upsert_tenant_business_rules (+ audit_logs)
--
-- GOVERNANÇA (ADR-048): NÃO aplicar em PROD sem autorização explícita do PO.
-- ============================================================

BEGIN;

-- ── 1. D-4: Coluna aditiva payment_pending_since em comandas ──────────────────
-- Preserva integralmente o CHECK constraint de comandas.status (ADR-017 D-1).

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS payment_pending_since TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.comandas.payment_pending_since IS
  'ADR-059 D-4: Timestamp em que comanda aberta/parcial passou do dia do atendimento com saldo > 0 (Pagamento Pendente).';

CREATE INDEX IF NOT EXISTS idx_comandas_tenant_open_pending
  ON public.comandas (tenant_id, status, payment_pending_since)
  WHERE status = 'open';

-- ── 2. D-1: register_comanda_payment com espelho atômico em transactions ──────
-- Mantém a assinatura existente (7 params), adiciona FOR UPDATE na comanda e
-- grava espelho imediato em public.transactions (source_type = 'comanda_payment').

CREATE OR REPLACE FUNCTION public.register_comanda_payment(
  p_tenant_id       UUID,
  p_comanda_id      UUID,
  p_payment_type    public.payment_type,
  p_amount          NUMERIC,
  p_payment_method  TEXT DEFAULT NULL,
  p_motivo          TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid        UUID := auth.uid();
  v_auth_tenant_id  UUID;
  v_comanda         public.comandas%ROWTYPE;
  v_existing        public.comanda_payments%ROWTYPE;
  v_is_super_admin  BOOLEAN := false;
  v_access_role     TEXT;
  v_membership_role TEXT;
  v_normalized_role TEXT;
  v_can_register    BOOLEAN := false;
  v_total_paid      NUMERIC := 0;
  v_count_paid      BIGINT := 0;
  v_payment_id      UUID;
  v_transaction_id  UUID;
  v_method          TEXT := COALESCE(NULLIF(BTRIM(COALESCE(p_payment_method, '')), ''), 'other');
  v_tx_key          TEXT;
BEGIN
  -- ── Auth + validation ──
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_comanda_id IS NULL THEN RAISE EXCEPTION 'comanda_id obrigatorio'; END IF;
  IF p_payment_type IS NULL THEN RAISE EXCEPTION 'payment_type obrigatorio'; END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'Valor deve ser maior que zero'; END IF;

  -- ── Tenant + Role gate: recepção + gestão (ADR-021) ──
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT LOWER(BTRIM(COALESCE(p2.role, ''))) INTO v_access_role
  FROM public.profiles p2 WHERE p2.id = v_auth_uid LIMIT 1;
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s WHERE s.id = v_auth_uid LIMIT 1;
  END IF;

  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC LIMIT 1;

  v_normalized_role := COALESCE(NULLIF(v_access_role, ''), v_membership_role, '');

  IF COALESCE(v_is_super_admin, false)
     OR v_normalized_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin', 'receptionist')
     OR v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'receptionist')
  THEN
    v_can_register := true;
  END IF;

  IF NOT v_can_register THEN
    RAISE EXCEPTION 'Usuario sem permissao para registrar pagamento';
  END IF;

  IF NOT COALESCE(v_is_super_admin, false)
     AND v_membership_role IS NULL
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id
  THEN
    RAISE EXCEPTION 'Tenant nao autorizado';
  END IF;

  -- ── Lock & load comanda ──
  SELECT * INTO v_comanda FROM public.comandas
  WHERE id = p_comanda_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda nao encontrada para este tenant';
  END IF;

  IF v_comanda.status IN ('cancelled', 'paid') THEN
    RAISE EXCEPTION 'Comanda com status "%" nao pode receber pagamento', v_comanda.status;
  END IF;

  -- ── Idempotency check ──
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.comanda_payments
    WHERE tenant_id = p_tenant_id
      AND idempotency_key = p_idempotency_key
      AND reversed_at IS NULL
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'comanda_payment_id', v_existing.id,
        'comanda_id', p_comanda_id,
        'payment_type', v_existing.payment_type::text,
        'amount', v_existing.amount,
        'message', 'Pagamento ja registrado anteriormente.'
      );
    END IF;
  END IF;

  -- ── Validate total doesn't exceed comanda total ──
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_count_paid, v_total_paid
  FROM public.comanda_payments
  WHERE comanda_id = p_comanda_id
    AND tenant_id = p_tenant_id
    AND reversed_at IS NULL;

  IF (v_total_paid + p_amount) > (COALESCE(v_comanda.total, 0) + 0.01) THEN
    RAISE EXCEPTION 'Total de pagamentos (R$ %) excede o total da comanda (R$ %)',
      v_total_paid + p_amount, COALESCE(v_comanda.total, 0);
  END IF;

  -- ── Insert payment (append-only) ──
  INSERT INTO public.comanda_payments (
    tenant_id, comanda_id, payment_type, amount,
    payment_method, actor_id, motivo, idempotency_key
  ) VALUES (
    p_tenant_id, p_comanda_id, p_payment_type, p_amount,
    v_method, v_auth_uid, p_motivo, p_idempotency_key
  )
  RETURNING id INTO v_payment_id;

  -- ── ADR-059 D-1: Espelho contábil atômico em public.transactions ──
  v_tx_key := CASE WHEN p_idempotency_key IS NOT NULL THEN p_idempotency_key || '::tx' ELSE NULL END;

  INSERT INTO public.transactions (
    tenant_id, user_id, type, category, description, amount,
    payment_method, date, status, notes, source_type, source_id,
    idempotency_key, metadata
  ) VALUES (
    p_tenant_id,
    v_auth_uid,
    'income',
    'Receita de Comanda',
    'Pagamento ' || p_payment_type::text || ' da comanda ' || LEFT(p_comanda_id::text, 8),
    p_amount,
    v_method,
    now(),
    'paid',
    p_motivo,
    'comanda_payment',
    v_payment_id,
    v_tx_key,
    jsonb_build_object(
      'comanda_id', p_comanda_id,
      'comanda_payment_id', v_payment_id,
      'payment_type', p_payment_type::text,
      'tenant_id', p_tenant_id,
      'comanda_total', COALESCE(v_comanda.total, 0),
      'total_paid_after', v_total_paid + p_amount,
      'remaining_after', GREATEST(COALESCE(v_comanda.total, 0) - (v_total_paid + p_amount), 0),
      'source', 'register_comanda_payment'
    )
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'comanda_payment_id', v_payment_id,
    'transaction_id', v_transaction_id,
    'comanda_id', p_comanda_id,
    'payment_type', p_payment_type::text,
    'amount', p_amount,
    'total_paid', v_total_paid + p_amount,
    'comanda_total', COALESCE(v_comanda.total, 0),
    'remaining', GREATEST(COALESCE(v_comanda.total, 0) - (v_total_paid + p_amount), 0),
    'message', 'Pagamento registrado com rastreabilidade no fluxo de caixa.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_comanda_payment(UUID, UUID, public.payment_type, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_comanda_payment(UUID, UUID, public.payment_type, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- ── 3. D-1 & D-2: finance_settle_comanda_split (Múltiplas Formas + Saldo Restante) ──
-- Permite 1 ou N parcelas em p_payments JSONB, grava comanda_payments + transactions
-- exclusivamente pelo saldo restante (nunca total cheio), e marca comanda como paid
-- quando o acumulado cobrir o total.

CREATE OR REPLACE FUNCTION public.finance_settle_comanda_split(
  p_tenant_id         UUID,
  p_comanda_id        UUID,
  p_payments          JSONB,
  p_payment_date_real TIMESTAMPTZ DEFAULT now(),
  p_source            TEXT DEFAULT 'checkout',
  p_notes             TEXT DEFAULT NULL,
  p_idempotency_key   TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid          UUID := auth.uid();
  v_auth_tenant_id    UUID;
  v_is_super_admin    BOOLEAN := false;
  v_access_role       TEXT;
  v_membership_role   TEXT;
  v_normalized_role   TEXT;
  v_comanda           public.comandas%ROWTYPE;
  v_total_prev_paid   NUMERIC := 0;
  v_remaining_before  NUMERIC := 0;
  v_split_sum         NUMERIC := 0;
  v_payment_count     INTEGER := 0;
  v_item              JSONB;
  v_item_idx          INTEGER := 0;
  v_item_amount       NUMERIC;
  v_item_method       TEXT;
  v_item_type         public.payment_type;
  v_item_key          TEXT;
  v_payment_id        UUID;
  v_transaction_id    UUID;
  v_first_tx_id       UUID;
  v_payment_ids       UUID[] := ARRAY[]::UUID[];
  v_transaction_ids   UUID[] := ARRAY[]::UUID[];
  v_payment_date_real TIMESTAMPTZ := COALESCE(p_payment_date_real, now());
  v_settled_at        TIMESTAMPTZ := now();
  v_is_fully_paid     BOOLEAN := false;
  v_summary_method    TEXT;
  v_distinct_methods  TEXT[] := ARRAY[]::TEXT[];
  v_key_base          TEXT := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
BEGIN
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_comanda_id IS NULL THEN RAISE EXCEPTION 'comanda_id obrigatorio'; END IF;
  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' THEN
    RAISE EXCEPTION 'p_payments deve ser um array JSON de parcelas';
  END IF;

  -- ── Tenant + Role gate (recepção + gestão) ──
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT LOWER(BTRIM(COALESCE(p2.role, ''))) INTO v_access_role
  FROM public.profiles p2 WHERE p2.id = v_auth_uid LIMIT 1;
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s WHERE s.id = v_auth_uid LIMIT 1;
  END IF;

  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC LIMIT 1;

  v_normalized_role := COALESCE(NULLIF(v_access_role, ''), v_membership_role, '');

  IF NOT COALESCE(v_is_super_admin, false)
     AND v_normalized_role NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin', 'receptionist')
     AND v_membership_role NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'receptionist')
  THEN
    RAISE EXCEPTION 'Usuario sem permissao para liquidar comanda';
  END IF;

  IF NOT COALESCE(v_is_super_admin, false)
     AND v_membership_role IS NULL
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id
  THEN
    RAISE EXCEPTION 'Tenant nao autorizado';
  END IF;

  -- ── Lock & load comanda ──
  PERFORM pg_advisory_xact_lock(hashtext('finance_settle_comanda:' || p_tenant_id::text || ':' || p_comanda_id::text));

  SELECT * INTO v_comanda FROM public.comandas
  WHERE id = p_comanda_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda nao encontrada para este tenant'; END IF;
  IF v_comanda.status = 'paid' THEN
    RAISE EXCEPTION 'Comanda ja esta baixada';
  END IF;
  IF v_comanda.status NOT IN ('open', 'blocked') THEN
    RAISE EXCEPTION 'Comanda nao pode ser baixada no status atual: %', v_comanda.status;
  END IF;

  -- ── Compute remaining balance from existing valid comanda_payments ──
  SELECT COALESCE(SUM(cp.amount), 0) INTO v_total_prev_paid
  FROM public.comanda_payments cp
  WHERE cp.tenant_id = p_tenant_id
    AND cp.comanda_id = p_comanda_id
    AND cp.reversed_at IS NULL;

  v_remaining_before := GREATEST(COALESCE(v_comanda.total, 0) - v_total_prev_paid, 0);

  -- ── Validate split items ──
  v_payment_count := jsonb_array_length(p_payments);

  IF v_payment_count = 0 AND v_remaining_before > 0.01 THEN
    RAISE EXCEPTION 'Ao menos uma parcela de pagamento e obrigatoria quando ha saldo restante';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_item_amount := COALESCE((v_item->>'amount')::NUMERIC, 0);
    v_item_method := NULLIF(BTRIM(COALESCE(v_item->>'payment_method', '')), '');
    IF v_item_amount <= 0 THEN
      RAISE EXCEPTION 'Cada parcela deve ter valor maior que zero';
    END IF;
    IF v_item_method IS NULL THEN
      RAISE EXCEPTION 'Forma de pagamento obrigatoria em cada parcela';
    END IF;
    v_split_sum := v_split_sum + v_item_amount;
    IF NOT (v_item_method = ANY(v_distinct_methods)) THEN
      v_distinct_methods := array_append(v_distinct_methods, v_item_method);
    END IF;
  END LOOP;

  IF v_split_sum > (v_remaining_before + 0.01) THEN
    RAISE EXCEPTION 'Soma das parcelas (R$ %) excede o saldo restante da comanda (R$ %)',
      v_split_sum, v_remaining_before;
  END IF;

  v_is_fully_paid := (v_total_prev_paid + v_split_sum) >= (COALESCE(v_comanda.total, 0) - 0.01);

  -- ── Insert each payment + mirrored transaction atomically ──
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_item_idx := v_item_idx + 1;
    v_item_amount := (v_item->>'amount')::NUMERIC;
    v_item_method := BTRIM(v_item->>'payment_method');
    v_item_type := CASE
      WHEN v_is_fully_paid THEN 'final'::public.payment_type
      ELSE 'parcial'::public.payment_type
    END;
    v_item_key := CASE
      WHEN v_key_base IS NOT NULL THEN v_key_base || '::split:' || v_item_idx::text
      ELSE NULL
    END;

    INSERT INTO public.comanda_payments (
      tenant_id, comanda_id, payment_type, amount, payment_method,
      actor_id, motivo, idempotency_key,
      terminal_id, fee_percentage, fee_amount, net_amount, estimated_settlement_date
    ) VALUES (
      p_tenant_id,
      p_comanda_id,
      v_item_type,
      v_item_amount,
      v_item_method,
      v_auth_uid,
      COALESCE(NULLIF(BTRIM(COALESCE(v_item->>'description', '')), ''), p_notes),
      v_item_key,
      CASE WHEN NULLIF(v_item->>'terminal_id', '') IS NOT NULL THEN (v_item->>'terminal_id')::UUID ELSE NULL END,
      CASE WHEN NULLIF(v_item->>'fee_percentage', '') IS NOT NULL THEN (v_item->>'fee_percentage')::NUMERIC ELSE NULL END,
      CASE WHEN NULLIF(v_item->>'fee_amount', '') IS NOT NULL THEN (v_item->>'fee_amount')::NUMERIC ELSE NULL END,
      CASE WHEN NULLIF(v_item->>'net_amount', '') IS NOT NULL THEN (v_item->>'net_amount')::NUMERIC ELSE NULL END,
      CASE WHEN NULLIF(v_item->>'estimated_settlement_date', '') IS NOT NULL THEN (v_item->>'estimated_settlement_date')::DATE ELSE NULL END
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO public.transactions (
      tenant_id, user_id, type, category, description, amount,
      payment_method, date, status, notes, source_type, source_id,
      idempotency_key, metadata
    ) VALUES (
      p_tenant_id,
      v_auth_uid,
      'income',
      'Receita de Comanda',
      'Baixa financeira de comanda ' || LEFT(p_comanda_id::text, 8) || ' (' || v_item_method || ') via ' || COALESCE(p_source, 'checkout'),
      v_item_amount,
      v_item_method,
      v_payment_date_real,
      'paid',
      COALESCE(NULLIF(BTRIM(COALESCE(v_item->>'description', '')), ''), p_notes),
      'comanda_payment',
      v_payment_id,
      CASE WHEN v_item_key IS NOT NULL THEN v_item_key || '::tx' ELSE NULL END,
      jsonb_build_object(
        'source', COALESCE(p_source, 'checkout'),
        'comanda_id', p_comanda_id,
        'comanda_payment_id', v_payment_id,
        'tenant_id', p_tenant_id,
        'comanda_total', COALESCE(v_comanda.total, 0),
        'split_index', v_item_idx,
        'split_count', v_payment_count,
        'payment_date_real', v_payment_date_real,
        'settled_at', v_settled_at
      )
    )
    RETURNING id INTO v_transaction_id;

    IF v_first_tx_id IS NULL THEN v_first_tx_id := v_transaction_id; END IF;
    v_payment_ids := array_append(v_payment_ids, v_payment_id);
    v_transaction_ids := array_append(v_transaction_ids, v_transaction_id);
  END LOOP;

  -- ── Update comanda status if fully paid ──
  IF v_is_fully_paid THEN
    v_summary_method := CASE
      WHEN array_length(v_distinct_methods, 1) = 1 AND v_total_prev_paid = 0 THEN v_distinct_methods[1]
      WHEN array_length(v_distinct_methods, 1) IS NULL THEN COALESCE(v_comanda.payment_method, 'other')
      ELSE 'split'
    END;

    UPDATE public.comandas
    SET status = 'paid',
        payment_method = v_summary_method,
        closure_mode = COALESCE(NULLIF(closure_mode, ''), 'standard'),
        financial_effect = true,
        payment_date_real = v_payment_date_real,
        settled_at = v_settled_at,
        settled_by_user_id = v_auth_uid,
        closed_at = v_payment_date_real,
        payment_pending_since = NULL
    WHERE id = p_comanda_id AND tenant_id = p_tenant_id;

    IF v_comanda.appointment_id IS NOT NULL THEN
      UPDATE public.appointments
      SET status = 'completed'
      WHERE id = v_comanda.appointment_id
        AND tenant_id = p_tenant_id
        AND status <> 'completed';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'comanda_id', p_comanda_id,
    'status', CASE WHEN v_is_fully_paid THEN 'paid' ELSE v_comanda.status END,
    'transaction_id', v_first_tx_id,
    'transaction_ids', to_jsonb(v_transaction_ids),
    'comanda_payment_ids', to_jsonb(v_payment_ids),
    'total_paid', v_total_prev_paid + v_split_sum,
    'remaining', GREATEST(COALESCE(v_comanda.total, 0) - (v_total_prev_paid + v_split_sum), 0),
    'message', CASE
      WHEN v_is_fully_paid THEN 'Comanda quitada com sucesso.'
      ELSE 'Pagamento parcial registrado no fluxo de caixa.'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finance_settle_comanda_split(UUID, UUID, JSONB, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_settle_comanda_split(UUID, UUID, JSONB, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;

-- ── 4. D-3: finance_reverse_transaction propagando estorno para comanda_payments ──

CREATE OR REPLACE FUNCTION public.finance_reverse_transaction(
  p_tenant_id UUID,
  p_original_transaction_id UUID,
  p_reversal_type TEXT,
  p_amount NUMERIC,
  p_reason_type TEXT,
  p_reason_note TEXT,
  p_refund_method TEXT DEFAULT NULL,
  p_reversal_date TIMESTAMPTZ DEFAULT now(),
  p_idempotency_key TEXT DEFAULT NULL
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
  v_original public.transactions%ROWTYPE;
  v_reversal_id UUID;
  v_reversal_transaction_id UUID;
  v_existing_original_transaction_id UUID;
  v_reversed_amount NUMERIC := 0;
  v_available_amount NUMERIC := 0;
  v_reversal_date TIMESTAMPTZ := COALESCE(p_reversal_date, now());
  v_key TEXT := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  v_reversal_type TEXT := NULLIF(BTRIM(COALESCE(p_reversal_type, '')), '');
  v_reason_type TEXT := NULLIF(BTRIM(COALESCE(p_reason_type, '')), '');
  v_reason_note TEXT := NULLIF(BTRIM(COALESCE(p_reason_note, '')), '');
  v_refund_method TEXT := NULLIF(BTRIM(COALESCE(p_refund_method, '')), '');
  v_category TEXT;
  v_payment_comanda_id UUID;
  v_remaining_paid NUMERIC := 0;
  v_comanda_total NUMERIC := 0;
BEGIN
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_original_transaction_id IS NULL THEN RAISE EXCEPTION 'transaction original obrigatoria'; END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'Valor de reversao deve ser maior que zero'; END IF;
  IF v_reversal_type IS NULL THEN RAISE EXCEPTION 'Tipo de reversao obrigatorio'; END IF;
  IF v_reason_type IS NULL THEN RAISE EXCEPTION 'Motivo obrigatorio'; END IF;
  IF v_reason_note IS NULL THEN RAISE EXCEPTION 'Observacao obrigatoria'; END IF;

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
     AND NOT v_has_authorized_membership THEN
    RAISE EXCEPTION 'Usuario sem permissao para reversao financeira';
  END IF;
  IF NOT COALESCE(v_is_super_admin, false) AND NOT v_has_authorized_membership
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant nao autorizado';
  END IF;

  IF v_key IS NOT NULL THEN
    SELECT fr.id, fr.reversal_transaction_id, fr.original_transaction_id
    INTO v_reversal_id, v_reversal_transaction_id, v_existing_original_transaction_id
    FROM public.financial_reversals fr
    WHERE fr.tenant_id = p_tenant_id AND fr.idempotency_key = v_key LIMIT 1;
    IF FOUND THEN
      IF v_existing_original_transaction_id IS DISTINCT FROM p_original_transaction_id THEN
        RAISE EXCEPTION 'Chave de idempotencia ja utilizada em outra reversao';
      END IF;
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'financial_reversal_id', v_reversal_id, 'reversal_transaction_id', v_reversal_transaction_id, 'message', 'Reversao ja processada anteriormente.');
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('finance_reverse_transaction:' || p_tenant_id::text || ':' || p_original_transaction_id::text));

  SELECT * INTO v_original FROM public.transactions t
  WHERE t.id = p_original_transaction_id AND t.tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transacao original nao encontrada para este tenant'; END IF;
  IF v_original.type IS DISTINCT FROM 'income' THEN RAISE EXCEPTION 'Somente receitas podem ser revertidas nesta versao'; END IF;
  IF COALESCE(v_original.status, 'paid') <> 'paid' THEN RAISE EXCEPTION 'Transacao original nao esta paga'; END IF;

  SELECT COALESCE(SUM(fr.amount), 0) INTO v_reversed_amount
  FROM public.financial_reversals fr
  WHERE fr.tenant_id = p_tenant_id AND fr.original_transaction_id = p_original_transaction_id;

  v_available_amount := COALESCE(v_original.amount, 0) - v_reversed_amount;
  IF p_amount > v_available_amount THEN RAISE EXCEPTION 'Valor de reversao excede saldo disponivel'; END IF;

  v_category := CASE
    WHEN v_original.source_type IN ('comanda', 'comanda_payment') AND v_reversal_type IN ('full_refund', 'partial_refund') THEN 'Devolucao de Comanda'
    WHEN v_original.source_type IN ('comanda', 'comanda_payment') THEN 'Estorno de Comanda'
    ELSE 'Estorno Financeiro'
  END;

  INSERT INTO public.transactions (tenant_id, user_id, type, category, description, amount, payment_method, date, status, notes, source_type, source_id, idempotency_key, metadata)
  VALUES (p_tenant_id, v_auth_uid, 'expense', v_category, 'Reversao da transacao ' || p_original_transaction_id::text, p_amount, COALESCE(v_refund_method, v_original.payment_method), v_reversal_date, 'paid', v_reason_note, v_original.source_type, v_original.source_id, v_key,
    jsonb_build_object('original_transaction_id', p_original_transaction_id, 'reversal_type', v_reversal_type, 'reason_type', v_reason_type, 'reason_note', v_reason_note, 'amount', p_amount, 'reversal_date', v_reversal_date, 'idempotency_key', v_key, 'available_before', v_available_amount))
  RETURNING id INTO v_reversal_transaction_id;

  INSERT INTO public.financial_reversals (tenant_id, original_transaction_id, reversal_transaction_id, source_type, source_id, reversal_type, amount, reason_type, reason_note, refund_method, idempotency_key, created_by_user_id, metadata)
  VALUES (p_tenant_id, p_original_transaction_id, v_reversal_transaction_id, v_original.source_type, v_original.source_id, v_reversal_type, p_amount, v_reason_type, v_reason_note, v_refund_method, v_key, v_auth_uid,
    jsonb_build_object('original_amount', v_original.amount, 'available_before', v_available_amount, 'reversal_date', v_reversal_date))
  RETURNING id INTO v_reversal_id;

  -- Legado: source_type = 'comanda'
  IF v_original.source_type = 'comanda' AND v_reversal_type = 'wrong_settlement' AND p_amount >= COALESCE(v_original.amount, 0) THEN
    UPDATE public.comandas SET status = 'open', payment_method = NULL, payment_date_real = NULL, settled_at = NULL, settled_by_user_id = NULL, closed_at = NULL, financial_effect = false
    WHERE id = v_original.source_id AND tenant_id = p_tenant_id;
  END IF;

  -- ADR-059 D-3: source_type = 'comanda_payment' -> marca reversed_at na parcela e recompõe saldo
  IF v_original.source_type = 'comanda_payment' AND (v_reversed_amount + p_amount) >= (COALESCE(v_original.amount, 0) - 0.01) THEN
    UPDATE public.comanda_payments
    SET reversed_at = v_reversal_date
    WHERE id = v_original.source_id
      AND tenant_id = p_tenant_id
      AND reversed_at IS NULL
    RETURNING comanda_id INTO v_payment_comanda_id;

    IF v_payment_comanda_id IS NOT NULL THEN
      SELECT COALESCE(SUM(cp.amount), 0) INTO v_remaining_paid
      FROM public.comanda_payments cp
      WHERE cp.tenant_id = p_tenant_id
        AND cp.comanda_id = v_payment_comanda_id
        AND cp.reversed_at IS NULL;

      SELECT COALESCE(c.total, 0) INTO v_comanda_total
      FROM public.comandas c
      WHERE c.id = v_payment_comanda_id AND c.tenant_id = p_tenant_id;

      IF v_remaining_paid < (v_comanda_total - 0.01) THEN
        UPDATE public.comandas
        SET status = 'open',
            payment_date_real = NULL,
            settled_at = NULL,
            closed_at = NULL,
            financial_effect = (v_remaining_paid > 0)
        WHERE id = v_payment_comanda_id
          AND tenant_id = p_tenant_id
          AND status = 'paid';
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'financial_reversal_id', v_reversal_id,
    'original_transaction_id', p_original_transaction_id,
    'reversal_transaction_id', v_reversal_transaction_id,
    'message', 'Reversao financeira registrada com sucesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finance_reverse_transaction(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_reverse_transaction(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

-- ── 5. D-4: Rotina diária de marcação de Pagamento Pendente (00:05 BRT) ───────
-- Executada apenas por service_role / postgres (pg_cron). Nunca exposta a authenticated/PUBLIC.

CREATE OR REPLACE FUNCTION public.mark_overdue_comandas_pending_payment()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_brt DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v_updated   INTEGER := 0;
BEGIN
  WITH candidates AS (
    SELECT c.id
    FROM public.comandas c
    JOIN public.tenants t ON t.id = c.tenant_id
    LEFT JOIN public.appointments a ON a.id = c.appointment_id AND a.tenant_id = c.tenant_id
    LEFT JOIN (
      SELECT comanda_id, tenant_id, COALESCE(SUM(amount), 0) AS paid_sum
      FROM public.comanda_payments
      WHERE reversed_at IS NULL
      GROUP BY comanda_id, tenant_id
    ) cp ON cp.comanda_id = c.id AND cp.tenant_id = c.tenant_id
    WHERE c.status = 'open'
      AND c.payment_pending_since IS NULL
      AND COALESCE(c.hidden_from_financial, false) = false
      AND COALESCE(t.settings->'business_rules'->>'overdue_open_comanda_policy', 'auto_pending_payment') = 'auto_pending_payment'
      AND (COALESCE(c.total, 0) - COALESCE(cp.paid_sum, 0)) > 0.01
      AND (COALESCE(a.start_time, c.created_at) AT TIME ZONE 'America/Sao_Paulo')::DATE < v_today_brt
  )
  UPDATE public.comandas c
  SET payment_pending_since = now()
  FROM candidates
  WHERE c.id = candidates.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_overdue_comandas_pending_payment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_overdue_comandas_pending_payment() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_overdue_comandas_pending_payment() TO service_role;

-- Agendamento pg_cron (00:05 BRT = 03:05 UTC). Usa cron.unschedule + cron.schedule (nunca UPDATE em cron.job).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    BEGIN
      PERFORM cron.unschedule('adr059-mark-overdue-comandas-pending-payment');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    PERFORM cron.schedule(
      'adr059-mark-overdue-comandas-pending-payment',
      '5 3 * * *',
      $cron$SELECT public.mark_overdue_comandas_pending_payment();$cron$
    );
  END IF;
END;
$$;

-- ── 6. D-5: RPCs get_tenant_business_rules & upsert_tenant_business_rules ─────

CREATE OR REPLACE FUNCTION public.get_tenant_business_rules(
  p_tenant_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid        UUID := auth.uid();
  v_auth_tenant_id  UUID;
  v_is_super_admin  BOOLEAN := false;
  v_has_membership  BOOLEAN := false;
  v_settings        JSONB;
  v_rules           JSONB;
BEGIN
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT EXISTS (
    SELECT 1 FROM public.user_tenants ut
    WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id
  ) INTO v_has_membership;

  IF NOT COALESCE(v_is_super_admin, false)
     AND NOT v_has_membership
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id
  THEN
    RAISE EXCEPTION 'Tenant nao autorizado';
  END IF;

  SELECT COALESCE(settings, '{}'::jsonb) INTO v_settings
  FROM public.tenants WHERE id = p_tenant_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant nao encontrado'; END IF;

  v_rules := COALESCE(v_settings->'business_rules', '{}'::jsonb);

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'refund_method', COALESCE(v_settings->>'refund_method', 'internal_credit'),
    'business_rules', v_rules
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_business_rules(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_business_rules(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_tenant_business_rules(
  p_tenant_id UUID,
  p_rules     JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid        UUID := auth.uid();
  v_auth_tenant_id  UUID;
  v_is_super_admin  BOOLEAN := false;
  v_access_role     TEXT;
  v_membership_role TEXT;
  v_normalized_role TEXT;
  v_settings        JSONB;
  v_prev_rules      JSONB;
  v_next_rules      JSONB;
  v_refund_method   TEXT;
BEGIN
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_rules IS NULL OR jsonb_typeof(p_rules) <> 'object' THEN
    RAISE EXCEPTION 'p_rules deve ser um objeto JSON valido';
  END IF;

  -- Management gate + tenant check
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT LOWER(BTRIM(COALESCE(p2.role, ''))) INTO v_access_role
  FROM public.profiles p2 WHERE p2.id = v_auth_uid LIMIT 1;
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s WHERE s.id = v_auth_uid LIMIT 1;
  END IF;

  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC LIMIT 1;

  v_normalized_role := COALESCE(NULLIF(v_access_role, ''), v_membership_role, '');

  IF NOT COALESCE(v_is_super_admin, false)
     AND v_normalized_role NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     AND v_membership_role NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin')
  THEN
    RAISE EXCEPTION 'Somente gestao pode alterar regras de negocio';
  END IF;

  IF NOT COALESCE(v_is_super_admin, false)
     AND v_membership_role IS NULL
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id
  THEN
    RAISE EXCEPTION 'Tenant nao autorizado';
  END IF;

  SELECT COALESCE(settings, '{}'::jsonb) INTO v_settings
  FROM public.tenants WHERE id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tenant nao encontrado'; END IF;

  v_prev_rules := COALESCE(v_settings->'business_rules', '{}'::jsonb);
  v_next_rules := v_prev_rules || p_rules;

  -- Sincroniza refund_method se presente em p_rules (compatibilidade P8)
  v_refund_method := NULLIF(BTRIM(COALESCE(v_next_rules->>'refund_method', '')), '');
  IF v_refund_method IS NOT NULL THEN
    IF v_refund_method NOT IN ('internal_credit', 'pix', 'cash', 'card_reversal', 'store_credit') THEN
      RAISE EXCEPTION 'refund_method invalido: %', v_refund_method;
    END IF;
    v_settings := v_settings || jsonb_build_object('refund_method', v_refund_method);
  END IF;

  v_settings := v_settings || jsonb_build_object('business_rules', v_next_rules);

  UPDATE public.tenants
  SET settings = v_settings,
      updated_at = now()
  WHERE id = p_tenant_id;

  -- Trilha de auditoria (best-effort se tabela audit_logs existir)
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      tenant_id, user_id, action, entity_type, entity_id, details
    ) VALUES (
      p_tenant_id,
      v_auth_uid,
      'UPDATE_BUSINESS_RULES',
      'tenant_business_rules',
      p_tenant_id::text,
      jsonb_build_object('previous', v_prev_rules, 'next', v_next_rules)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'business_rules', v_next_rules,
    'refund_method', COALESCE(v_settings->>'refund_method', 'internal_credit'),
    'message', 'Regras de negocio atualizadas com sucesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_tenant_business_rules(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_tenant_business_rules(UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
