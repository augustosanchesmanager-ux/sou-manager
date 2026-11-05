-- ============================================================================
-- 20261105120000_add_audit_pin_and_retroactive_adjustment.sql
--
-- Frente: correção auditada de comanda fechada (estorno com competência).
-- Decisão do PO (2026-11-04/05):
--   1. ADR-035 permanece válido: valores de comanda paga só mudam via
--      estorno/reabertura. Nada de edição silenciosa.
--   2. O estorno passa a aceitar uma DATA DE COMPETÊNCIA escolhida pelo
--      gerente (caixa atual ou caixa da data original).
--   3. PIN de autorização por usuário, hash em profiles.audit_pin, validado
--      exclusivamente no banco. O hash nunca é retornado ao frontend.
--   4. Se a competência cair em caixa CONFIRMADO, a alteração é permitida
--      mas marcada com transactions.retroactive_adjustment = true.
--
-- NÃO APLICAR EM PRODUÇÃO SEM AUTORIZAÇÃO EXPLÍCITA DO PO.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. PIN de autorização por usuário ───────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS audit_pin TEXT;

COMMENT ON COLUMN public.profiles.audit_pin IS
  'Hash bcrypt (pgcrypto crypt/gen_salt) do PIN gerencial de 6 a 8 digitos. '
  'Escrita somente via RPC set_audit_pin (trigger bloqueia UPDATE direto). '
  'RISCO RESIDUAL: a policy de SELECT de profiles permite leitura por pares do tenant; '
  'a UI nunca seleciona esta coluna e o endurecimento do RLS e tratado no relatorio da frente.';

-- Impede que o hash seja trocado por UPDATE direto no PostgREST. A RPC
-- set_audit_pin liga a flag transacional app.audit_pin_write antes do UPDATE.
CREATE OR REPLACE FUNCTION public.guard_profile_audit_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.audit_pin IS DISTINCT FROM OLD.audit_pin
     AND COALESCE(current_setting('app.audit_pin_write', true), '') <> 'on' THEN
    RAISE EXCEPTION 'audit_pin so pode ser alterado pela RPC set_audit_pin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_audit_pin ON public.profiles;
CREATE TRIGGER trg_guard_profile_audit_pin
  BEFORE UPDATE OF audit_pin ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_audit_pin();

-- Verificador interno. Não é exposto ao PostgREST: somente as RPCs
-- SECURITY DEFINER abaixo podem executá-lo.
CREATE OR REPLACE FUNCTION public.verify_audit_pin(p_user_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_user_id IS NULL OR p_pin IS NULL THEN
    RETURN false;
  END IF;

  IF p_pin !~ '^[0-9]{6,8}$' THEN
    RETURN false;
  END IF;

  SELECT p.audit_pin INTO v_hash
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_hash IS NULL OR BTRIM(v_hash) = '' THEN
    RETURN false;
  END IF;

  RETURN v_hash = crypt(p_pin, v_hash);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_audit_pin(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_audit_pin(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.verify_audit_pin(UUID, TEXT) FROM authenticated;

-- Pré-validação usada pelo frontend para feedback imediato. Não substitui a
-- checagem atômica feita dentro de finance_reverse_transaction.
CREATE OR REPLACE FUNCTION public.validate_audit_pin(p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_hash TEXT;
BEGIN
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado obrigatorio';
  END IF;

  SELECT p.audit_pin INTO v_hash
  FROM public.profiles p
  WHERE p.id = v_auth_uid;

  IF v_hash IS NULL OR BTRIM(v_hash) = '' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_configured');
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6,8}$' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_format');
  END IF;

  IF v_hash = crypt(p_pin, v_hash) THEN
    RETURN jsonb_build_object('valid', true);
  END IF;

  -- Throttle simples contra varredura de PIN. Não substitui lockout
  -- persistente (GAP registrado no relatório da frente).
  PERFORM pg_sleep(0.25);
  RETURN jsonb_build_object('valid', false, 'reason', 'invalid_pin');
END;
$$;

REVOKE ALL ON FUNCTION public.validate_audit_pin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_audit_pin(TEXT) TO authenticated;

-- Autoatendimento: o próprio usuário define/troca seu PIN. Nenhum hash é
-- retornado. Exigir 6 a 8 dígitos reduz a superfície de força bruta.
CREATE OR REPLACE FUNCTION public.set_audit_pin(p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
BEGIN
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado obrigatorio';
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{6,8}$' THEN
    RAISE EXCEPTION 'PIN deve conter de 6 a 8 digitos';
  END IF;

  PERFORM set_config('app.audit_pin_write', 'on', true);

  UPDATE public.profiles
  SET audit_pin = crypt(p_pin, gen_salt('bf', 12)),
      updated_at = now()
  WHERE id = v_auth_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil nao encontrado';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_audit_pin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_audit_pin(TEXT) TO authenticated;

COMMENT ON FUNCTION public.validate_audit_pin(TEXT) IS
  'Valida o PIN gerencial do usuário autenticado. Retorna apenas { valid, reason }. Nunca retorna hash.';
COMMENT ON FUNCTION public.set_audit_pin(TEXT) IS
  'Define o PIN gerencial (6-8 dígitos) do usuário autenticado com bcrypt.';

-- ── 2. Marca de ajuste retroativo em caixa fechado ──────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS retroactive_adjustment BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.transactions.retroactive_adjustment IS
  'true quando o lançamento foi realizado com competência em um dia cujo cash_closings já está confirmed.';

-- ── 3. finance_reverse_transaction com competência + PIN + flag ─────────────
-- Remove a assinatura antiga (9 args) para não deixar um overload sem PIN.
DROP FUNCTION IF EXISTS public.finance_reverse_transaction(
  UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
);

CREATE OR REPLACE FUNCTION public.finance_reverse_transaction(
  p_tenant_id UUID,
  p_original_transaction_id UUID,
  p_reversal_type TEXT,
  p_amount NUMERIC,
  p_reason_type TEXT,
  p_reason_note TEXT,
  p_refund_method TEXT DEFAULT NULL,
  p_reversal_date TIMESTAMPTZ DEFAULT now(),
  p_idempotency_key TEXT DEFAULT NULL,
  p_audit_pin TEXT DEFAULT NULL
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
  v_audit_pin TEXT := NULLIF(BTRIM(COALESCE(p_audit_pin, '')), '');
  v_category TEXT;
  v_timezone TEXT;
  v_business_date DATE;
  v_retroactive BOOLEAN := false;
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

  -- PIN é opcional nesta assinatura para não quebrar os fluxos existentes
  -- (Cashflow/Receipts/AccountsReceivable). Quando enviado, é validado aqui,
  -- na mesma transação, e não pode ser contornado pelo cliente.
  IF v_audit_pin IS NOT NULL THEN
    IF NOT public.verify_audit_pin(v_auth_uid, v_audit_pin) THEN
      RAISE EXCEPTION 'PIN de autorizacao invalido';
    END IF;
  END IF;

  -- Data de competência (fuso do tenant). Não permite data futura.
  SELECT COALESCE(NULLIF(BTRIM(t.timezone), ''), 'America/Sao_Paulo')
  INTO v_timezone
  FROM public.tenants t
  WHERE t.id = p_tenant_id;
  v_timezone := COALESCE(v_timezone, 'America/Sao_Paulo');
  v_business_date := (v_reversal_date AT TIME ZONE v_timezone)::date;

  IF v_business_date > (now() AT TIME ZONE v_timezone)::date THEN
    RAISE EXCEPTION 'Data de competencia nao pode ser futura';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.cash_closings cc
    WHERE cc.tenant_id = p_tenant_id
      AND cc.business_date = v_business_date
      AND cc.status = 'confirmed'
  ) INTO v_retroactive;

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

  INSERT INTO public.transactions (
    tenant_id, user_id, type, category, description, amount, payment_method, date,
    status, notes, source_type, source_id, idempotency_key, metadata, retroactive_adjustment
  )
  VALUES (
    p_tenant_id, v_auth_uid, 'expense', v_category,
    'Reversao da transacao ' || p_original_transaction_id::text ||
      CASE WHEN v_retroactive THEN ' (ajuste retroativo em caixa fechado)' ELSE '' END,
    p_amount, COALESCE(v_refund_method, v_original.payment_method), v_reversal_date,
    'paid', v_reason_note, v_original.source_type, v_original.source_id, v_key,
    jsonb_build_object(
      'original_transaction_id', p_original_transaction_id,
      'reversal_type', v_reversal_type,
      'reason_type', v_reason_type,
      'reason_note', v_reason_note,
      'amount', p_amount,
      'reversal_date', v_reversal_date,
      'competence_date', v_business_date,
      'retroactive_adjustment', v_retroactive,
      'pin_authorized', v_audit_pin IS NOT NULL,
      'idempotency_key', v_key,
      'available_before', v_available_amount
    ),
    v_retroactive
  )
  RETURNING id INTO v_reversal_transaction_id;

  INSERT INTO public.financial_reversals (
    tenant_id, original_transaction_id, reversal_transaction_id, source_type, source_id,
    reversal_type, amount, reason_type, reason_note, refund_method, idempotency_key,
    created_by_user_id, metadata
  )
  VALUES (
    p_tenant_id, p_original_transaction_id, v_reversal_transaction_id, v_original.source_type, v_original.source_id,
    v_reversal_type, p_amount, v_reason_type, v_reason_note, v_refund_method, v_key,
    v_auth_uid,
    jsonb_build_object(
      'original_amount', v_original.amount,
      'available_before', v_available_amount,
      'reversal_date', v_reversal_date,
      'competence_date', v_business_date,
      'retroactive_adjustment', v_retroactive,
      'pin_authorized', v_audit_pin IS NOT NULL
    )
  )
  RETURNING id INTO v_reversal_id;

  IF v_original.source_type = 'comanda' AND v_reversal_type = 'wrong_settlement' AND p_amount >= COALESCE(v_original.amount, 0) THEN
    UPDATE public.comandas SET status = 'open', payment_method = NULL, payment_date_real = NULL, settled_at = NULL, settled_by_user_id = NULL, closed_at = NULL, financial_effect = false
    WHERE id = v_original.source_id AND tenant_id = p_tenant_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'financial_reversal_id', v_reversal_id,
    'original_transaction_id', p_original_transaction_id,
    'reversal_transaction_id', v_reversal_transaction_id,
    'competence_date', v_business_date,
    'retroactive_adjustment', v_retroactive,
    'message', 'Reversao financeira registrada com sucesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finance_reverse_transaction(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_reverse_transaction(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.finance_reverse_transaction(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) IS
  'Reversao financeira auditada. p_reversal_date define a competencia; p_audit_pin valida PIN gerencial quando informado; marca retroactive_adjustment quando o caixa do dia ja esta confirmed.';

NOTIFY pgrst, 'reload schema';

COMMIT;
