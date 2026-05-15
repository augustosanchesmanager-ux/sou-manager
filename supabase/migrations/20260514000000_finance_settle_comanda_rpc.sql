BEGIN;

-- Fase 4B - Baixa financeira centralizada de comandas.
-- Revisavel: nao aplicar sem aprovacao operacional.
-- Objetivo: registrar baixa, transacao e auditoria minima em uma unica transacao.

ALTER TABLE public.comandas
ADD COLUMN IF NOT EXISTS payment_date_real TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS settled_by_user_id UUID;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS source_type TEXT,
ADD COLUMN IF NOT EXISTS source_id UUID,
ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_comandas_tenant_settled_at
ON public.comandas(tenant_id, settled_at DESC)
WHERE settled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comandas_tenant_payment_date_real
ON public.comandas(tenant_id, payment_date_real DESC)
WHERE payment_date_real IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_source
ON public.transactions(tenant_id, source_type, source_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_tenant_idempotency_key
ON public.transactions(tenant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.finance_settle_comanda(
  p_tenant_id UUID,
  p_comanda_id UUID,
  p_payment_method TEXT,
  p_paid_amount NUMERIC,
  p_payment_date_real TIMESTAMPTZ DEFAULT now(),
  p_source TEXT DEFAULT 'checkout',
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
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
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obrigatório';
  END IF;

  IF p_comanda_id IS NULL THEN
    RAISE EXCEPTION 'comanda_id obrigatório';
  END IF;

  IF v_payment_method IS NULL THEN
    RAISE EXCEPTION 'Forma de pagamento obrigatória';
  END IF;

  IF COALESCE(p_paid_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Valor pago deve ser maior que zero';
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

  v_has_authorized_membership := COALESCE(v_membership_role IN (
    'owner',
    'admin',
    'manager',
    'gerente',
    'superadmin',
    'super admin'
  ), false);

  IF NOT COALESCE(v_is_super_admin, false)
     AND COALESCE(v_access_role, '') NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     AND NOT COALESCE(v_has_authorized_membership, false) THEN
    RAISE EXCEPTION 'Usuário sem permissão para baixa financeira central';
  END IF;

  IF NOT COALESCE(v_is_super_admin, false)
     AND NOT COALESCE(v_has_authorized_membership, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT *
    INTO v_existing_transaction
    FROM public.transactions t
    WHERE t.tenant_id = p_tenant_id
      AND t.idempotency_key = v_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      IF v_existing_transaction.source_type IS DISTINCT FROM 'comanda'
         OR v_existing_transaction.source_id IS DISTINCT FROM p_comanda_id THEN
        RAISE EXCEPTION 'Chave de idempotência já utilizada em outro lançamento';
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'comanda_id', v_existing_transaction.source_id,
        'transaction_id', v_existing_transaction.id,
        'status', 'paid',
        'message', 'Baixa já processada anteriormente. Transação original retornada.'
      );
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('finance_settle_comanda:' || p_tenant_id::text || ':' || p_comanda_id::text));

  SELECT *
  INTO v_comanda
  FROM public.comandas c
  WHERE c.id = p_comanda_id
    AND c.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda não encontrada para este tenant';
  END IF;

  IF v_comanda.status = 'paid' THEN
    SELECT *
    INTO v_existing_transaction
    FROM public.transactions t
    WHERE t.tenant_id = p_tenant_id
      AND t.source_type = 'comanda'
      AND t.source_id = p_comanda_id
      AND t.idempotency_key = v_idempotency_key
      AND t.type = 'income'
      AND COALESCE(t.status, 'paid') = 'paid'
    ORDER BY t.date DESC, t.id DESC
    LIMIT 1;

    IF FOUND AND v_idempotency_key IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'comanda_id', p_comanda_id,
        'transaction_id', v_existing_transaction.id,
        'status', 'paid',
        'message', 'Comanda já estava baixada. Transação existente retornada.'
      );
    END IF;

    RAISE EXCEPTION 'Comanda já está baixada';
  END IF;

  IF v_comanda.status NOT IN ('open', 'blocked') THEN
    RAISE EXCEPTION 'Comanda não pode ser baixada no status atual: %', v_comanda.status;
  END IF;

  UPDATE public.comandas
  SET
    status = 'paid',
    payment_method = v_payment_method,
    closure_mode = COALESCE(NULLIF(closure_mode, ''), 'standard'),
    financial_effect = true,
    payment_date_real = v_payment_date_real,
    settled_at = v_settled_at,
    settled_by_user_id = v_auth_uid,
    closed_at = v_payment_date_real
  WHERE id = p_comanda_id
    AND tenant_id = p_tenant_id;

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
    notes,
    source_type,
    source_id,
    idempotency_key,
    metadata
  )
  VALUES (
    p_tenant_id,
    v_auth_uid,
    'income',
    'Receita de Comanda',
    'Baixa financeira de comanda ' || p_comanda_id::text || ' via ' || COALESCE(v_source, 'financeiro'),
    p_paid_amount,
    v_payment_method,
    v_payment_date_real,
    'paid',
    v_notes,
    'comanda',
    p_comanda_id,
    v_idempotency_key,
    jsonb_build_object(
      'source', COALESCE(v_source, 'financeiro'),
      'comanda_id', p_comanda_id,
      'tenant_id', p_tenant_id,
      'comanda_total', COALESCE(v_comanda.total, 0),
      'paid_amount', p_paid_amount,
      'amount_difference', p_paid_amount - COALESCE(v_comanda.total, 0),
      'payment_date_real', v_payment_date_real,
      'settled_at', v_settled_at,
      'settled_by_user_id', v_auth_uid,
      'notes', v_notes,
      'idempotency_key', v_idempotency_key
    )
  )
  RETURNING id INTO v_transaction_id;

  IF v_comanda.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
    SET status = 'completed'
    WHERE id = v_comanda.appointment_id
      AND tenant_id = p_tenant_id
      AND status <> 'completed';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'comanda_id', p_comanda_id,
    'transaction_id', v_transaction_id,
    'status', 'paid',
    'message', 'Baixa financeira registrada com sucesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finance_settle_comanda(UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_settle_comanda(UUID, UUID, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
