-- ============================================================
-- 20260901160100_fix_confirm_appointment_attendance_tenant_scoped.sql
-- GATE 1 CORREÇÃO: confirm_appointment_attendance (P5) — tenant-scoped
--
-- Contexto: GATE 1 (auditoria read-only, 01/09/2026) identificou finding
--   CRITICAL com o padrão global-first:
--     v_normalized_role := COALESCE(NULLIF(v_access_role, ''), v_membership_role, '')
--   Gestão e recepção autorizavam por papel GLOBAL (profiles/staff.role)
--   sem garantir pertencimento ao tenant alvo → escrita cross-tenant
--   possível (mesma classe do finding P4/P7 da FASE 3, já corrigido).
--
-- Fix (mesmo princípio do ADR-021, ver 20260901150000):
--   membership (user_tenants WHERE tenant_id = p_tenant_id) é a fonte
--   PRIMÁRIA; papel global (profiles/staff) só como fallback quando o
--   tenant canônico do usuário É o tenant alvo
--   (current_tenant_id_from_auth_uid() = p_tenant_id).
--
-- Preservados integralmente:
--   - assinatura (UUID, UUID), return JSONB
--   - SECURITY DEFINER, SET search_path = public
--   - bypass canônico de superadmin (current_is_super_admin_from_auth_uid)
--   - gate do barbeiro (staff.id = auth.uid() + staff.tenant_id = p_tenant_id
--     + appointment.staff_id = auth.uid()) — já era tenant-scoped
--   - regras funcionais: status cancelled/no_show bloqueado, attended_at
--     duplicado bloqueado, UPDATE attended_at/status='completed' transacional
--   - grants (authenticated) e NOTIFY pgrst
--
-- Escopo: SOMENTE confirm_appointment_attendance. Nenhuma outra RPC
--   alterada. Nenhuma regra de negócio, cálculo financeiro, comanda,
--   checkout ou frontend alterados.
-- STAGING SOMENTE (tjcvuhynckocmvtqykxp). PRODUÇÃO NÃO TOCADA.
-- ============================================================

BEGIN;

-- ── RPC: confirm_appointment_attendance (P5) ────────────────
-- Gate: barbeiro (somente próprio), recepção, gestão — TODOS tenant-scoped.
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

  -- Management gate: owner/admin/manager/gerente/superadmin (tenant-scoped)
  IF COALESCE(v_is_super_admin, false)
     OR v_normalized_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
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

  -- Reception gate: role = receptionist (tenant-scoped)
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
  'M4-P5: Confirma atendimento (attended_at + completed). Gate: barbeiro proprio, recepcao, gestao. Autorizacao tenant-scoped (ADR-021). Sem auto-confirmacao.';

NOTIFY pgrst, 'reload schema';

COMMIT;