-- ============================================================================
-- Migration: ADR-047 — Unificação E2E de Comissão de Produtos e Competência de Vales
-- Date: 2026-11-11
-- Description:
--   1. Atualiza public.get_financial_operation_context para incluir
--      product_id / product_name em comanda_items e product_commission_rate
--      em staff, permitindo que o worker D8 aplique a alíquota correta por perfil.
--   2. Atualiza public.register_barber_advance para gravar date = now() (evitando
--      deslocamento de competência por meia-noite UTC no fuso BRT UTC-3) e
--      status = 'paid' (alinhado com CashLedger e CashClosing).
--   3. Corrige retroativamente transações source_type = 'barber_advance' gravadas
--      em 00:00:00+00 ou status 'completed'.
-- ============================================================================

-- ── 1. get_financial_operation_context (D8 worker surface) ──────────────────

CREATE OR REPLACE FUNCTION public.get_financial_operation_context(
  p_item_id   UUID,
  p_tenant_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item        public.outbox_items%ROWTYPE;
  v_payload     JSONB;
  v_op_type     TEXT;
  v_odata       JSONB;
  v_comanda_id  UUID;
  v_received    NUMERIC;
  v_comanda     JSONB;
  v_items       JSONB;
  v_participants JSONB;
  v_staff       JSONB;
  v_item_ids    UUID[] := ARRAY[]::UUID[];
BEGIN
  SELECT * INTO v_item FROM public.outbox_items WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'outbox item % not found', p_item_id;
  END IF;

  -- ISOLATION: item must belong to requesting tenant.
  IF v_item.tenant_id <> p_tenant_id::text THEN
    RAISE EXCEPTION 'tenant mismatch: item belongs to tenant %, requested %',
      v_item.tenant_id, p_tenant_id;
  END IF;

  IF v_item.status <> 'processing' THEN
    RAISE EXCEPTION 'item % not in processing state (current %)', p_item_id, v_item.status;
  END IF;

  v_payload := v_item.payload;
  v_op_type := v_payload->>'operationType';
  v_odata   := COALESCE(v_payload->'operationData', '{}'::jsonb);

  IF v_op_type IS NULL THEN
    RAISE EXCEPTION 'item % payload missing operationType', p_item_id;
  END IF;

  IF v_op_type NOT IN ('create_commission_record', 'reverse_commission') THEN
    RAISE EXCEPTION 'operationType % not authorized on worker surface', v_op_type;
  END IF;

  v_comanda_id := (v_odata->>'comandaId')::UUID;
  v_received := COALESCE((v_odata->>'receivedValue')::NUMERIC, 0);

  IF v_op_type = 'create_commission_record' THEN
    SELECT jsonb_build_object(
      'id', c.id,
      'staff_id', c.staff_id,
      'total', c.total,
      'discount', c.discount
    ) INTO v_comanda
    FROM public.comandas c
    WHERE c.id = v_comanda_id AND c.tenant_id = p_tenant_id;

    IF v_comanda IS NULL THEN
      RAISE EXCEPTION 'comanda % not found for tenant %', v_comanda_id, p_tenant_id;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', ci.id,
      'service_id', ci.service_id,
      'product_id', ci.product_id,
      'product_name', ci.product_name,
      'staff_id', ci.staff_id,
      'unit_price', ci.unit_price,
      'quantity', ci.quantity
    )), '[]'::jsonb) INTO v_items
    FROM public.comanda_items ci
    WHERE ci.comanda_id = v_comanda_id AND ci.tenant_id = p_tenant_id;

    SELECT ARRAY_AGG(ci.id) INTO v_item_ids
    FROM public.comanda_items ci
    WHERE ci.comanda_id = v_comanda_id AND ci.tenant_id = p_tenant_id;

    IF cardinality(v_item_ids) > 0 THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'comanda_item_id', p.comanda_item_id,
        'staff_id', p.staff_id,
        'payout_type', p.payout_type,
        'payout_value', p.payout_value,
        'affects_commission', p.affects_commission
      )), '[]'::jsonb) INTO v_participants
      FROM public.service_execution_participants p
      WHERE p.comanda_item_id = ANY(v_item_ids) AND p.tenant_id = p_tenant_id;
    ELSE
      v_participants := '[]'::jsonb;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'role', s.role,
      'commission_rate', s.commission_rate,
      'product_commission_rate', COALESCE(s.product_commission_rate, 0)
    )), '[]'::jsonb) INTO v_staff
    FROM public.staff s
    WHERE s.tenant_id = p_tenant_id;

    RETURN jsonb_build_object(
      'event_id', v_item.event_id,
      'tenant_id', p_tenant_id,
      'operation_type', v_op_type,
      'idempotency_key', v_payload->>'idempotencyKey',
      'source_event', v_payload->>'sourceEvent',
      'receivedValue', v_received,
      'comandaId', v_comanda_id,
      'comanda', v_comanda,
      'comanda_items', COALESCE(v_items, '[]'::jsonb),
      'participants', COALESCE(v_participants, '[]'::jsonb),
      'staff', COALESCE(v_staff, '[]'::jsonb)
    );
  END IF;

  RETURN jsonb_build_object(
    'event_id', v_item.event_id,
    'tenant_id', p_tenant_id,
    'operation_type', v_op_type,
    'idempotency_key', v_payload->>'idempotencyKey',
    'source_event', v_payload->>'sourceEvent',
    'comandaId', v_comanda_id,
    'receivedValue', v_received
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_financial_operation_context(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_operation_context(UUID, UUID) TO worker_dispatcher;

-- ── 2. register_barber_advance (competência real now() + status 'paid') ─────

CREATE OR REPLACE FUNCTION public.register_barber_advance(
    p_tenant_id       UUID,
    p_staff_id        UUID,
    p_amount          NUMERIC,
    p_payment_method  TEXT DEFAULT NULL,
    p_notes           TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_auth_uid       UUID := auth.uid();
    v_is_super       BOOLEAN;
    v_advance_id     UUID;
    v_transaction_id UUID;
    v_staff_name     TEXT;
    v_now            TIMESTAMPTZ := now();
BEGIN
    IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
    IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
    IF p_staff_id IS NULL THEN RAISE EXCEPTION 'staff_id obrigatorio'; END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Valor do vale deve ser maior que zero';
    END IF;

    SELECT public.current_is_super_admin_from_auth_uid() INTO v_is_super;
    IF NOT COALESCE(v_is_super, false)
       AND NOT public.current_is_manager_from_auth_uid(p_tenant_id) THEN
        RAISE EXCEPTION 'Somente gestao do tenant pode lancar vale';
    END IF;

    -- Idempotência
    IF p_idempotency_key IS NOT NULL THEN
        SELECT a.id INTO v_advance_id
        FROM public.barber_advances a
        WHERE a.tenant_id = p_tenant_id AND a.idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'advance_id', v_advance_id,
                'message', 'Vale ja registrado.'
            );
        END IF;
    END IF;

    SELECT s.name INTO v_staff_name
    FROM public.staff s
    WHERE s.id = p_staff_id AND s.tenant_id = p_tenant_id;

    IF v_staff_name IS NULL THEN
        RAISE EXCEPTION 'Profissional nao encontrado para este tenant';
    END IF;

    INSERT INTO public.barber_advances (
        tenant_id, staff_id, amount, notes, created_by, idempotency_key
    ) VALUES (
        p_tenant_id, p_staff_id, p_amount, p_notes, v_auth_uid, p_idempotency_key
    )
    RETURNING id INTO v_advance_id;

    -- Espelho no caixa: usa v_now (timestamp real) e status 'paid' para manter
    -- competência consistente entre CashClosing, Fluxo de Caixa e Livro Razão.
    INSERT INTO public.transactions (
        tenant_id, type, category, amount, description,
        payment_method, date, source_type, source_id, status
    ) VALUES (
        p_tenant_id,
        'expense',
        'vale_comissao',
        p_amount,
        'Vale / Adiantamento - ' || v_staff_name,
        p_payment_method,
        v_now,
        'barber_advance',
        v_advance_id,
        'paid'
    )
    RETURNING id INTO v_transaction_id;

    UPDATE public.barber_advances
    SET transaction_id = v_transaction_id
    WHERE id = v_advance_id;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'advance_id', v_advance_id,
        'transaction_id', v_transaction_id,
        'amount', p_amount,
        'message', 'Vale registrado.'
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.register_barber_advance(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_barber_advance(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- ── 3. Backfill idempotente de transações de vale em 00:00:00+00 / completed ─

UPDATE public.transactions
SET
    date = created_at,
    status = CASE WHEN status = 'completed' THEN 'paid' ELSE status END,
    updated_at = now()
WHERE source_type = 'barber_advance'
  AND (
      date = date_trunc('day', date AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      OR status = 'completed'
  );
