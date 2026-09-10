-- ============================================================
-- 20260830030000_m4_p7_register_comanda_payment.sql
-- M4-P7: Pagamento parcial/antecipado em comanda_payments.
-- DECISÃO DO PO (29/08/2026):
--   Recepção pode registrar pagamento parcial
--   Parcial ≠ atendimento; não preenche attended_at
--   Não gera comissão automaticamente
--   Não marca comanda como paid (mantém open/blocked)
--   Gate: recepção + gestão
-- ============================================================

BEGIN;

-- ── 1. RPC: register_comanda_payment ────────────────────────
-- Grava em comanda_payments (M3). append-only (sem UPDATE/DELETE).
-- NÃO altera status da comanda, attended_at, nem comissão.

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
  v_auth_uid       UUID := auth.uid();
  v_comanda        public.comandas%ROWTYPE;
  v_existing       public.comanda_payments%ROWTYPE;
  v_is_super_admin BOOLEAN;
  v_access_role    TEXT;
  v_membership_role TEXT;
  v_normalized_role TEXT;
  v_can_register   BOOLEAN := false;
  v_total_paid     NUMERIC;
  v_count_paid     BIGINT;
BEGIN
  -- ── Auth + validation ──
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_comanda_id IS NULL THEN RAISE EXCEPTION 'comanda_id obrigatorio'; END IF;
  IF p_payment_type IS NULL THEN RAISE EXCEPTION 'payment_type obrigatorio'; END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'Valor deve ser maior que zero'; END IF;

  -- ── Role gate: recepção + gestão ──
  SELECT public.current_is_super_admin_from_auth_uid() INTO v_is_super_admin;
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

  -- Management: owner/admin/manager/gerente/superadmin
  IF COALESCE(v_is_super_admin, false)
     OR v_normalized_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     OR v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin')
  THEN
    v_can_register := true;
  END IF;

  -- Reception: receptionist
  IF NOT v_can_register AND v_normalized_role = 'receptionist' THEN
    v_can_register := true;
  END IF;

  IF NOT v_can_register THEN
    RAISE EXCEPTION 'Usuario sem permissao para registrar pagamento';
  END IF;

  -- ── Load comanda ──
  SELECT * INTO v_comanda FROM public.comandas
  WHERE id = p_comanda_id AND tenant_id = p_tenant_id;

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

  -- Allow small floating-point tolerance (0.01)
  IF (v_total_paid + p_amount) > (COALESCE(v_comanda.total, 0) + 0.01) THEN
    RAISE EXCEPTION 'Total de pagamentos (R$ %) excede o total da comanda (R$ %)',
      v_total_paid + p_amount, COALESCE(v_comanda.total, 0);
  END IF;

  -- ── Insert payment ──
  INSERT INTO public.comanda_payments (
    tenant_id, comanda_id, payment_type, amount,
    payment_method, actor_id, motivo, idempotency_key
  ) VALUES (
    p_tenant_id, p_comanda_id, p_payment_type, p_amount,
    p_payment_method, v_auth_uid, p_motivo, p_idempotency_key
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'comanda_id', p_comanda_id,
    'payment_type', p_payment_type::text,
    'amount', p_amount,
    'total_paid', v_total_paid + p_amount,
    'comanda_total', COALESCE(v_comanda.total, 0),
    'remaining', COALESCE(v_comanda.total, 0) - (v_total_paid + p_amount),
    'message', 'Pagamento registrado com sucesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_comanda_payment(UUID, UUID, public.payment_type, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_comanda_payment(UUID, UUID, public.payment_type, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.register_comanda_payment(UUID, UUID, public.payment_type, NUMERIC, TEXT, TEXT, TEXT) IS
  'M4-P7: Registra pagamento parcial/antecipado em comanda_payments. NAO altera status, attended_at, nem comissao. Gate: recepcao + gestao.';

-- ── 2. RPC: get_comanda_payment_summary ───────────────────────
-- Retorna resumo de pagamentos da comanda (para UI e decisões).

CREATE OR REPLACE FUNCTION public.get_comanda_payment_summary(
  p_tenant_id  UUID,
  p_comanda_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda public.comandas%ROWTYPE;
  v_total_paid NUMERIC;
  v_count      BIGINT;
  v_payments   JSONB;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_comanda_id IS NULL THEN RAISE EXCEPTION 'comanda_id obrigatorio'; END IF;

  SELECT * INTO v_comanda FROM public.comandas
  WHERE id = p_comanda_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda nao encontrada para este tenant';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_count, v_total_paid
  FROM public.comanda_payments
  WHERE comanda_id = p_comanda_id
    AND tenant_id = p_tenant_id
    AND reversed_at IS NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cp.id,
    'payment_type', cp.payment_type::text,
    'amount', cp.amount,
    'payment_method', cp.payment_method,
    'created_at', cp.created_at
  ) ORDER BY cp.created_at), '[]'::jsonb)
  INTO v_payments
  FROM public.comanda_payments cp
  WHERE cp.comanda_id = p_comanda_id
    AND cp.tenant_id = p_tenant_id
    AND cp.reversed_at IS NULL;

  RETURN jsonb_build_object(
    'comanda_id', p_comanda_id,
    'comanda_total', COALESCE(v_comanda.total, 0),
    'total_paid', v_total_paid,
    'remaining', COALESCE(v_comanda.total, 0) - v_total_paid,
    'payment_count', v_count,
    'has_valid_payments', v_count > 0,
    'payments', v_payments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_comanda_payment_summary(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_comanda_payment_summary(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.get_comanda_payment_summary(UUID, UUID) IS
  'M4-P7: Resumo de pagamentos validos de uma comanda. Usado por UI e decisoes de cancelamento.';

NOTIFY pgrst, 'reload schema';

COMMIT;
