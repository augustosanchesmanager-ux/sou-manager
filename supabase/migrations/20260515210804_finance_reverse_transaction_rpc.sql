BEGIN;
-- Fase 5C - RPC transacional revisavel. Nao aplicar sem aprovacao.
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
    WHEN v_original.source_type = 'comanda' AND v_reversal_type IN ('full_refund', 'partial_refund') THEN 'Devolucao de Comanda'
    WHEN v_original.source_type = 'comanda' THEN 'Estorno de Comanda'
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
  IF v_original.source_type = 'comanda' AND v_reversal_type = 'wrong_settlement' AND p_amount >= COALESCE(v_original.amount, 0) THEN
    UPDATE public.comandas SET status = 'open', payment_method = NULL, payment_date_real = NULL, settled_at = NULL, settled_by_user_id = NULL, closed_at = NULL, financial_effect = false
    WHERE id = v_original.source_id AND tenant_id = p_tenant_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'financial_reversal_id', v_reversal_id, 'original_transaction_id', p_original_transaction_id, 'reversal_transaction_id', v_reversal_transaction_id, 'message', 'Reversao financeira registrada com sucesso.');
END;
$$;
REVOKE ALL ON FUNCTION public.finance_reverse_transaction(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_reverse_transaction(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
