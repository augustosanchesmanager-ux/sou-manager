-- ============================================================
-- 20260901150000_fix_rpc_tenant_scoped_authorization.sql
-- ADR-021: Autorização Tenant-Scoped em RPCs (Finding FASE 3 P4/P7)
--
-- Causa-raiz: SECURITY DEFINER RPCs autorizavam com papel GLOBAL
--   (profiles/staff.role) sem filtro de tenant; v_normalized_role
--   via COALESCE(global, membership) deixava o papel global vencer.
-- Fix: membership (user_tenants WHERE tenant_id = p_tenant_id) é a
--   fonte primária; papel global só como fallback quando o tenant
--   canônico do usuário É o tenant alvo (current_tenant_id_from_auth_uid).
--
-- Escopo: correct_appointment_attendance (P4) + register_comanda_payment (P7).
-- Assinaturas, SECURITY DEFINER, search_path, grants e comments preservados.
-- STAGING SOMENTE (tjcvuhynckocmvtqykxp). PRODUÇÃO NÃO TOCADA.
-- ============================================================

BEGIN;

-- ── 1. RPC: correct_appointment_attendance (P4) ────────────────
-- Gate: gestão tenant-scoped. Motivo obrigatório. Regras funcionais inalteradas.

CREATE OR REPLACE FUNCTION public.correct_appointment_attendance(
  p_tenant_id      UUID,
  p_appointment_id UUID,
  p_new_attended_at TIMESTAMPTZ,
  p_motivo         TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid       UUID := auth.uid();
  v_appointment    public.appointments%ROWTYPE;
  v_is_super_admin BOOLEAN;
  v_access_role    TEXT;
  v_membership_role TEXT;
  v_normalized_role TEXT;
BEGIN
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_appointment_id IS NULL THEN RAISE EXCEPTION 'appointment_id obrigatorio'; END IF;
  IF p_new_attended_at IS NULL THEN RAISE EXCEPTION 'attended_at obrigatorio'; END IF;
  IF p_motivo IS NULL OR BTRIM(p_motivo) = '' THEN
    RAISE EXCEPTION 'Motivo obrigatorio para correcao retroativa de attended_at';
  END IF;

  -- Management gate only
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

  -- ADR-021: autorização tenant-scoped. Fonte PRIMÁRIA = membership
  -- do tenant alvo (p_tenant_id). Papel global (profiles/staff) como
  -- fallback SOMENTE quando o tenant canônico do usuário é o alvo.
  v_normalized_role := COALESCE(
    NULLIF(v_membership_role, ''),
    CASE
      WHEN public.current_tenant_id_from_auth_uid() = p_tenant_id THEN NULLIF(v_access_role, '')
      ELSE NULL
    END,
    ''
  );

  IF NOT COALESCE(v_is_super_admin, false)
     AND v_normalized_role NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
  THEN
    RAISE EXCEPTION 'Somente gestao pode corrigir attended_at retroativamente';
  END IF;

  -- Load appointment
  SELECT * INTO v_appointment FROM public.appointments
  WHERE id = p_appointment_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento nao encontrado para este tenant';
  END IF;

  IF v_appointment.status IN ('cancelled', 'no_show') THEN
    RAISE EXCEPTION 'Nao e possivel corrigir attended_at de agendamento %', v_appointment.status;
  END IF;

  -- ── Audit: insert correction record (before) ──
  INSERT INTO public.appointment_attendance_corrections (
    tenant_id, appointment_id, attended_before, attended_after,
    source_before, source_after, motivo, corrected_by
  ) VALUES (
    p_tenant_id, p_appointment_id, v_appointment.attended_at, p_new_attended_at,
    v_appointment.attended_at_source, 'management_correction', p_motivo, v_auth_uid
  );

  -- ── Apply correction ──
  UPDATE public.appointments
  SET attended_at = p_new_attended_at,
      attended_at_source = 'management_correction'
  WHERE id = p_appointment_id AND tenant_id = p_tenant_id;

  -- If setting attended_at for first time, also mark completed
  IF v_appointment.attended_at IS NULL AND p_new_attended_at IS NOT NULL THEN
    UPDATE public.appointments
    SET status = 'completed'
    WHERE id = p_appointment_id AND tenant_id = p_tenant_id
      AND status NOT IN ('cancelled', 'no_show');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', p_appointment_id,
    'attended_before', v_appointment.attended_at,
    'attended_after', p_new_attended_at,
    'message', 'Correcao retroativa de attended_at registrada com sucesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.correct_appointment_attendance(UUID, UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.correct_appointment_attendance(UUID, UUID, TIMESTAMPTZ, TEXT) TO authenticated;

COMMENT ON FUNCTION public.correct_appointment_attendance(UUID, UUID, TIMESTAMPTZ, TEXT) IS
  'M4-P4: Correcao retroativa de attended_at (gestao somente). Motivo obrigatorio, before/after auditado, historico preservado. Autorizacao tenant-scoped (ADR-021).';

-- ── 2. RPC: register_comanda_payment (P7) ──────────────────────
-- Gate: recepção + gestão tenant-scoped. Idempotência/overpay inalterados.

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

  -- ── Role gate: recepção + gestão (tenant-scoped) ──
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

  -- ADR-021: mesmo princípio — membership do tenant alvo como fonte
  -- primária; papel global apenas no tenant canônico do usuário.
  v_normalized_role := COALESCE(
    NULLIF(v_membership_role, ''),
    CASE
      WHEN public.current_tenant_id_from_auth_uid() = p_tenant_id THEN NULLIF(v_access_role, '')
      ELSE NULL
    END,
    ''
  );

  -- Management: owner/admin/manager/gerente/superadmin
  IF COALESCE(v_is_super_admin, false)
     OR v_normalized_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
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
  'M4-P7: Registra pagamento parcial/antecipado em comanda_payments. NAO altera status, attended_at, nem comissao. Gate: recepcao + gestao. Autorizacao tenant-scoped (ADR-021).';

NOTIFY pgrst, 'reload schema';

COMMIT;