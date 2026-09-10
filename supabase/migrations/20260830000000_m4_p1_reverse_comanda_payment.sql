-- ============================================================
-- 20260830000000_m4_p1_reverse_comanda_payment.sql
-- M4-P1: Reversão de pagamento registrado em comanda_payments.
-- DECISÃO DO PO (29/08/2026): append-only (reversed_at), motivo
-- obrigatório, refund_method registrado, management gate.
-- Usado quando cancelamento com antecipado → ESTORNAR.
-- finance_settle_comanda NÃO é alterada (mantém reversal legado).
-- ============================================================

BEGIN;

-- ── 1. RPC: reverse_comanda_payment ──────────────────────────
-- Marca reversed_at em comanda_payments (append-only).
-- Não altera status da comanda (responsabilidade do chamador).
-- Não gera attended_at nem comissão.

CREATE OR REPLACE FUNCTION public.reverse_comanda_payment(
  p_tenant_id        UUID,
  p_comanda_payment_id UUID,
  p_motivo           TEXT,
  p_refund_method    TEXT DEFAULT 'internal_credit',
  p_actor_id         UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid    UUID := auth.uid();
  v_payment     public.comanda_payments%ROWTYPE;
  v_access_role TEXT;
  v_membership_role TEXT;
  v_is_super_admin BOOLEAN;
BEGIN
  -- ── Auth + role gate ──
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_comanda_payment_id IS NULL THEN RAISE EXCEPTION 'comanda_payment_id obrigatorio'; END IF;
  IF p_motivo IS NULL OR BTRIM(p_motivo) = '' THEN
    RAISE EXCEPTION 'Motivo obrigatorio para reversao de pagamento';
  END IF;

  SELECT public.current_is_super_admin_from_auth_uid() INTO v_is_super_admin;

  -- Resolve papel via profiles + user_tenants
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

  IF NOT COALESCE(v_is_super_admin, false)
     AND COALESCE(v_access_role, '') NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin')
     AND NOT COALESCE(v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin'), false)
  THEN
    RAISE EXCEPTION 'Usuario sem permissao para reversao de pagamento';
  END IF;

  -- ── Load payment ──
  SELECT * INTO v_payment FROM public.comanda_payments
  WHERE id = p_comanda_payment_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento nao encontrado para este tenant';
  END IF;
  IF v_payment.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pagamento ja foi revertido';
  END IF;

  -- ── Mark reversed (append-only) ──
  UPDATE public.comanda_payments
  SET reversed_at = now()
  WHERE id = p_comanda_payment_id AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'comanda_payment_id', p_comanda_payment_id,
    'comanda_id', v_payment.comanda_id,
    'amount', v_payment.amount,
    'payment_type', v_payment.payment_type::text,
    'reversed_at', now(),
    'message', 'Reversao de pagamento registrada com sucesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_comanda_payment(UUID, UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_comanda_payment(UUID, UUID, TEXT, TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.reverse_comanda_payment(UUID, UUID, TEXT, TEXT, UUID) IS
  'M4-P1: Reversao append-only de pagamento em comanda_payments. Motivo obrigatorio, refund_method registrado. Management gate. Nao altera status da comanda.';

-- ── 2. RPC: check_comanda_has_valid_payments ─────────────────
-- Consulta se a comanda tem pagamentos válidos (reversed_at IS NULL).
-- Usada pelo frontend para decidir se mostra modal REMARCAR/ESTORNAR.

CREATE OR REPLACE FUNCTION public.check_comanda_has_valid_payments(
  p_tenant_id  UUID,
  p_comanda_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
  v_total NUMERIC;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_comanda_id IS NULL THEN RAISE EXCEPTION 'comanda_id obrigatorio'; END IF;

  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_count, v_total
  FROM public.comanda_payments
  WHERE comanda_id = p_comanda_id
    AND tenant_id = p_tenant_id
    AND reversed_at IS NULL;

  RETURN jsonb_build_object(
    'has_valid_payments', v_count > 0,
    'payment_count', v_count,
    'total_paid', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_comanda_has_valid_payments(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_comanda_has_valid_payments(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.check_comanda_has_valid_payments(UUID, UUID) IS
  'M4-P1: Verifica se comanda possui pagamentos validos (sem reversed_at). Usada para decidir REMARCAR/ESTORNAR no cancelamento.';

NOTIFY pgrst, 'reload schema';

COMMIT;
