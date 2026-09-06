-- ============================================================
-- 20260830020000_m4_p6_unblock_comanda.sql
-- M4-P6: Desbloqueio híbrido (auto + manual) auditável via RPC.
-- DECISÃO DO PO (29/08/2026):
--   Automático: auditável, sem operador humano inventado, prev/next state, timestamp
--   Manual: usuários autorizados, operador, timestamp, motivo
--   BLOCKED → OPEN sem attended_at, sem completed, sem comissão
--   Substitui auto-unlock client-side Comandas.tsx:670-717
-- ============================================================

BEGIN;

-- ── 1. Tabela: comanda_unblock_audit (append-only) ────────────

CREATE TABLE IF NOT EXISTS public.comanda_unblock_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  comanda_id      UUID NOT NULL REFERENCES public.comandas(id),
  mode            TEXT NOT NULL CHECK (mode IN ('auto', 'manual')),
  operator_id     UUID REFERENCES auth.users(id),
  reason          TEXT,
  before_status   TEXT NOT NULL DEFAULT 'blocked',
  after_status    TEXT NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_unblock_audit_comanda
  ON public.comanda_unblock_audit(comanda_id, created_at);

CREATE INDEX IF NOT EXISTS idx_unblock_audit_tenant
  ON public.comanda_unblock_audit(tenant_id, created_at DESC);

ALTER TABLE public.comanda_unblock_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unblock_audit_select_v2" ON public.comanda_unblock_audit;
CREATE POLICY "unblock_audit_select_v2" ON public.comanda_unblock_audit
  FOR SELECT USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "unblock_audit_insert_v2" ON public.comanda_unblock_audit;
CREATE POLICY "unblock_audit_insert_v2" ON public.comanda_unblock_audit
  FOR INSERT WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

-- Sem UPDATE/DELETE: append-only (histórico de desbloqueios preservado).

-- ── 2. RPC: unblock_comanda (híbrido auto + manual) ──────────
-- Modo manual: exige papel autorizado + motivo obrigatório.
-- Modo auto: chamado server-side, sem operador humano inventado.
-- BLOCKED → OPEN sem attended_at/completed/comissão.

CREATE OR REPLACE FUNCTION public.unblock_comanda(
  p_tenant_id  UUID,
  p_comanda_id UUID,
  p_mode       TEXT,
  p_reason     TEXT DEFAULT NULL,
  p_operator_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid     UUID := auth.uid();
  v_comanda      public.comandas%ROWTYPE;
  v_is_super_admin BOOLEAN;
  v_access_role  TEXT;
  v_membership_role TEXT;
  v_normalized_role TEXT;
  v_can_unblock  BOOLEAN := false;
BEGIN
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_comanda_id IS NULL THEN RAISE EXCEPTION 'comanda_id obrigatorio'; END IF;
  IF p_mode NOT IN ('auto', 'manual') THEN RAISE EXCEPTION 'Mode deve ser auto ou manual'; END IF;

  -- Manual mode: motivo obrigatório + role gate
  IF p_mode = 'manual' THEN
    IF p_reason IS NULL OR BTRIM(p_reason) = '' THEN
      RAISE EXCEPTION 'Motivo obrigatorio para desbloqueio manual';
    END IF;

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

    IF COALESCE(v_is_super_admin, false)
       OR v_normalized_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
       OR v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin')
    THEN
      v_can_unblock := true;
    END IF;

    IF NOT v_can_unblock THEN
      RAISE EXCEPTION 'Usuario sem permissao para desbloqueio manual';
    END IF;
  END IF;

  -- Load comanda
  SELECT * INTO v_comanda FROM public.comandas
  WHERE id = p_comanda_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda nao encontrada para este tenant';
  END IF;

  IF v_comanda.status != 'blocked' THEN
    RAISE EXCEPTION 'Comanda nao esta bloqueada (status atual: %)', v_comanda.status;
  END IF;

  -- ── Unblock: BLOCKED → OPEN ──
  UPDATE public.comandas
  SET status = 'open'
  WHERE id = p_comanda_id AND tenant_id = p_tenant_id;

  -- ── Audit ──
  INSERT INTO public.comanda_unblock_audit (
    tenant_id, comanda_id, mode, operator_id, reason,
    before_status, after_status
  ) VALUES (
    p_tenant_id, p_comanda_id, p_mode,
    CASE WHEN p_mode = 'manual' THEN v_auth_uid ELSE p_operator_id END,
    p_reason, 'blocked', 'open'
  );

  RETURN jsonb_build_object(
    'success', true,
    'comanda_id', p_comanda_id,
    'mode', p_mode,
    'before_status', 'blocked',
    'after_status', 'open',
    'message', 'Comanda desbloqueada com sucesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.unblock_comanda(UUID, UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unblock_comanda(UUID, UUID, TEXT, TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.unblock_comanda(UUID, UUID, TEXT, TEXT, UUID) IS
  'M4-P6: Desbloqueio hibrido (auto/manual) auditavel. BLOCKED→OPEN sem attended_at/completed/comissao. Manual: papel autorizado + motivo.';

-- ── 3. RPC: batch_unblock_comandas (auto mode) ────────────────
-- Para auto-unlock de múltiplas comandas (substitui Comandas.tsx:670-717).
-- Modo auto: sem motivo, sem operador humano.

CREATE OR REPLACE FUNCTION public.batch_unblock_comandas(
  p_tenant_id UUID,
  p_comanda_ids UUID[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comanda_id UUID;
  v_unblocked  INTEGER := 0;
  v_skipped    INTEGER := 0;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_comanda_ids IS NULL OR array_length(p_comanda_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'unblocked', 0, 'skipped', 0, 'message', 'Nenhuma comanda para desbloquear.');
  END IF;

  FOREACH v_comanda_id IN ARRAY p_comanda_ids LOOP
    -- Only unblock comandas that are blocked
    UPDATE public.comandas
    SET status = 'open'
    WHERE id = v_comanda_id AND tenant_id = p_tenant_id AND status = 'blocked';

    IF FOUND THEN
      INSERT INTO public.comanda_unblock_audit (
        tenant_id, comanda_id, mode, reason, before_status, after_status
      ) VALUES (
        p_tenant_id, v_comanda_id, 'auto', 'auto-unlock by date', 'blocked', 'open'
      );
      v_unblocked := v_unblocked + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'unblocked', v_unblocked,
    'skipped', v_skipped,
    'message', v_unblocked || ' comanda(s) desbloqueada(s).'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.batch_unblock_comandas(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.batch_unblock_comandas(UUID, UUID[]) TO authenticated;

COMMENT ON FUNCTION public.batch_unblock_comandas(UUID, UUID[]) IS
  'M4-P6: Desbloqueio em lote (auto mode). Substitui auto-unlock client-side. Auditable via comanda_unblock_audit.';

NOTIFY pgrst, 'reload schema';

COMMIT;
