-- ============================================================
-- 20260830010000_m4_p4_p5_attendance_rpcs.sql
-- M4-P4/P5: Confirmação e correção retroativa de attended_at.
-- DECISÃO DO PO (29/08/2026):
--   P5: barbeiro (próprio), recepção, gestão confirmam atendimento
--   P4: gestão corrige retroativamente (motivo obrigatório, before/after)
--   NUNCA auto-confirmação via pagamento/tempo/desbloqueio/baixa
--   M1 COMMENT mantido: "Nunca pela finance_settle_comanda"
-- ============================================================

BEGIN;

-- ── 1. Tabela: appointment_attendance_corrections (append-only) ──

CREATE TABLE IF NOT EXISTS public.appointment_attendance_corrections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  appointment_id  UUID NOT NULL REFERENCES public.appointments(id),
  attended_before TIMESTAMPTZ,
  attended_after  TIMESTAMPTZ NOT NULL,
  source_before   TEXT,
  source_after    TEXT DEFAULT 'management_correction',
  motivo          TEXT NOT NULL,
  corrected_by    UUID REFERENCES auth.users(id) NOT NULL,
  corrected_at    TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_appointment
  ON public.appointment_attendance_corrections(appointment_id, corrected_at);

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_tenant
  ON public.appointment_attendance_corrections(tenant_id, corrected_at DESC);

ALTER TABLE public.appointment_attendance_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_corrections_select_v2" ON public.appointment_attendance_corrections;
CREATE POLICY "attendance_corrections_select_v2" ON public.appointment_attendance_corrections
  FOR SELECT USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "attendance_corrections_insert_v2" ON public.appointment_attendance_corrections;
CREATE POLICY "attendance_corrections_insert_v2" ON public.appointment_attendance_corrections
  FOR INSERT WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

-- Sem UPDATE/DELETE policies: append-only (ADR-020, histórico preservado).

-- ── 2. RPC: confirm_appointment_attendance (P5) ────────────────
-- Gate: barbeiro (somente próprio), recepção, gestão.
-- Seta attended_at = now(), attended_at_source = NULL, status = 'completed'.
-- Transacional. Sem auto-confirmação.

CREATE OR REPLACE FUNCTION public.confirm_appointment_attendance(
  p_tenant_id    UUID,
  p_appointment_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid     UUID := auth.uid();
  v_appointment  public.appointments%ROWTYPE;
  v_is_super_admin BOOLEAN;
  v_access_role  TEXT;
  v_membership_role TEXT;
  v_normalized_role TEXT;
  v_staff_record RECORD;
  v_can_confirm  BOOLEAN := false;
BEGIN
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_appointment_id IS NULL THEN RAISE EXCEPTION 'appointment_id obrigatorio'; END IF;

  SELECT public.current_is_super_admin_from_auth_uid() INTO v_is_super_admin;

  -- Resolve papel
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

  -- Management gate: owner/admin/manager/gerente/superadmin
  IF COALESCE(v_is_super_admin, false)
     OR v_normalized_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     OR v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin')
  THEN
    v_can_confirm := true;
  END IF;

  -- Barber gate: somente próprio agendamento (staff_id = auth.uid)
  IF NOT v_can_confirm THEN
    SELECT * INTO v_staff_record FROM public.staff
    WHERE id = v_auth_uid AND tenant_id = p_tenant_id;
    IF FOUND AND v_staff_record.role = 'barber' THEN
      -- Check if this appointment belongs to this barber
      SELECT * INTO v_appointment FROM public.appointments
      WHERE id = p_appointment_id AND tenant_id = p_tenant_id;
      IF FOUND AND v_appointment.staff_id = v_auth_uid THEN
        v_can_confirm := true;
      END IF;
    END IF;
  END IF;

  -- Reception gate: role = receptionist
  IF NOT v_can_confirm AND v_normalized_role = 'receptionist' THEN
    v_can_confirm := true;
  END IF;

  IF NOT v_can_confirm THEN
    RAISE EXCEPTION 'Usuario sem permissao para confirmar atendimento';
  END IF;

  -- Load appointment
  IF v_appointment.id IS NULL THEN
    SELECT * INTO v_appointment FROM public.appointments
    WHERE id = p_appointment_id AND tenant_id = p_tenant_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento nao encontrado para este tenant';
  END IF;

  IF v_appointment.status IN ('cancelled', 'no_show') THEN
    RAISE EXCEPTION 'Nao e possivel confirmar atendimento de agendamento %', v_appointment.status;
  END IF;

  IF v_appointment.attended_at IS NOT NULL THEN
    RAISE EXCEPTION 'Atendimento ja foi confirmado';
  END IF;

  -- ── Set attended_at + completed (transacional) ──
  UPDATE public.appointments
  SET attended_at = now(),
      attended_at_source = NULL,
      status = 'completed'
  WHERE id = p_appointment_id AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', p_appointment_id,
    'attended_at', now(),
    'status', 'completed',
    'message', 'Atendimento confirmado com sucesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_appointment_attendance(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_appointment_attendance(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.confirm_appointment_attendance(UUID, UUID) IS
  'M4-P5: Confirma atendimento (attended_at + completed). Gate: barbeiro proprio, recepcao, gestao. Sem auto-confirmacao.';

-- ── 3. RPC: correct_appointment_attendance (P4) ────────────────
-- Gestão SOMENTE. Motivo obrigatório. Grava before/after na tabela de correções.
-- Não recalcula comissão retroativa.

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

  v_normalized_role := COALESCE(NULLIF(v_access_role, ''), v_membership_role, '');

  IF NOT COALESCE(v_is_super_admin, false)
     AND v_normalized_role NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     AND v_membership_role NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin')
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
  'M4-P4: Correcao retroativa de attended_at (gestao somente). Motivo obrigatorio, before/after auditado, historico preservado.';

NOTIFY pgrst, 'reload schema';

COMMIT;
