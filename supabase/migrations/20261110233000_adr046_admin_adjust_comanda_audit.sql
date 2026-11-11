-- ============================================================================
-- 20261110233000_adr046_admin_adjust_comanda_audit.sql
--
-- ADR-046: Ajuste Gerencial Auditado de Comanda
--   1. Tabela append-only public.comanda_admin_adjustments (RLS tenant-scoped,
--      SELECT apenas para gestao do tenant; escrita exclusiva via RPC).
--   2. RPC public.admin_adjust_comanda_audit(
--        p_tenant_id, p_comanda_id, p_reason,
--        p_new_status, p_new_created_at, p_new_payment_date, p_audit_pin
--      ):
--      - Somente gestao (owner/admin/manager/gerente/superadmin) tenant-scoped (ADR-021).
--      - Motivo obrigatorio.
--      - Status: alterna apenas open <-> blocked (nunca em paid/cancelled, ADR-035).
--      - Data de abertura (created_at): nao futura no fuso do tenant.
--      - Data de pagamento: apenas para comanda paid; exige PIN gerencial (ADR-039);
--        nao futura; sincroniza atomicamente comandas, comanda_payments e transactions.
--      - Se qualquer data afetada atingir cash_closings.status = 'confirmed',
--        exige PIN gerencial e marca transactions.retroactive_adjustment = true.
-- ============================================================================

BEGIN;

-- ── 1. Tabela append-only de auditoria administrativa ────────────────────────
CREATE TABLE IF NOT EXISTS public.comanda_admin_adjustments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  comanda_id             UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  operator_id            UUID NOT NULL REFERENCES auth.users(id),
  reason                 TEXT NOT NULL CHECK (BTRIM(reason) <> ''),
  adjusted_fields        TEXT[] NOT NULL CHECK (array_length(adjusted_fields, 1) >= 1),
  before_snapshot        JSONB NOT NULL,
  after_snapshot         JSONB NOT NULL,
  pin_authorized         BOOLEAN NOT NULL DEFAULT false,
  retroactive_adjustment BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comanda_admin_adjustments_comanda
  ON public.comanda_admin_adjustments (comanda_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comanda_admin_adjustments_tenant
  ON public.comanda_admin_adjustments (tenant_id, created_at DESC);

ALTER TABLE public.comanda_admin_adjustments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.comanda_admin_adjustments FROM PUBLIC;
REVOKE ALL ON TABLE public.comanda_admin_adjustments FROM anon;
REVOKE ALL ON TABLE public.comanda_admin_adjustments FROM authenticated;
GRANT SELECT ON TABLE public.comanda_admin_adjustments TO authenticated;

DROP POLICY IF EXISTS "comanda_admin_adjustments_select_manager" ON public.comanda_admin_adjustments;
CREATE POLICY "comanda_admin_adjustments_select_manager"
  ON public.comanda_admin_adjustments
  FOR SELECT
  USING (
    COALESCE(public.current_is_super_admin_from_auth_uid(), false)
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND (
        EXISTS (
          SELECT 1
          FROM public.user_tenants ut
          WHERE ut.user_id = auth.uid()
            AND ut.tenant_id = comanda_admin_adjustments.tenant_id
            AND LOWER(BTRIM(COALESCE(ut.role, ''))) IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND LOWER(BTRIM(COALESCE(p.role, ''))) IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
        )
      )
    )
  );

COMMENT ON TABLE public.comanda_admin_adjustments IS
  'ADR-046: Trilha append-only de ajustes gerenciais auditados em comandas (status, data de abertura e data de pagamento). Escrita exclusiva via RPC SECURITY DEFINER.';

-- ── 2. RPC: admin_adjust_comanda_audit ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_adjust_comanda_audit(
  p_tenant_id        UUID,
  p_comanda_id       UUID,
  p_reason           TEXT,
  p_new_status       TEXT DEFAULT NULL,
  p_new_created_at   TIMESTAMPTZ DEFAULT NULL,
  p_new_payment_date TIMESTAMPTZ DEFAULT NULL,
  p_audit_pin        TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_auth_uid              UUID := auth.uid();
  v_caller_tenant         UUID;
  v_is_super_admin        BOOLEAN := false;
  v_access_role           TEXT;
  v_membership_role       TEXT;
  v_normalized_role       TEXT;
  v_can_adjust            BOOLEAN := false;
  v_reason                TEXT := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
  v_audit_pin             TEXT := NULLIF(BTRIM(COALESCE(p_audit_pin, '')), '');
  v_new_status            TEXT := NULLIF(LOWER(BTRIM(COALESCE(p_new_status, ''))), '');
  v_comanda               public.comandas%ROWTYPE;
  v_timezone              TEXT := 'America/Sao_Paulo';
  v_today_date            DATE;
  v_old_payment_ts        TIMESTAMPTZ;
  v_adjusted_fields       TEXT[] := ARRAY[]::TEXT[];
  v_affected_dates        DATE[] := ARRAY[]::DATE[];
  v_touches_closed_cash   BOOLEAN := false;
  v_requires_pin          BOOLEAN := false;
  v_apply_status          TEXT := NULL;
  v_apply_created_at      TIMESTAMPTZ := NULL;
  v_apply_payment_date    TIMESTAMPTZ := NULL;
  v_before_snapshot       JSONB;
  v_after_snapshot        JSONB;
  v_adjustment_id         UUID;
  v_tx_dates              DATE[];
BEGIN
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado obrigatorio';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obrigatorio';
  END IF;
  IF p_comanda_id IS NULL THEN
    RAISE EXCEPTION 'comanda_id obrigatorio';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Motivo obrigatorio para ajuste gerencial auditado';
  END IF;
  IF v_new_status IS NULL AND p_new_created_at IS NULL AND p_new_payment_date IS NULL THEN
    RAISE EXCEPTION 'Informe ao menos um campo para ajustar';
  END IF;

  -- Gate tenant-scoped exclusivo de gestao (ADR-021 / ADR-019)
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_caller_tenant, v_is_super_admin;

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

  IF NOT COALESCE(v_is_super_admin, false)
     AND COALESCE(v_membership_role, '') = ''
     AND v_caller_tenant IS DISTINCT FROM p_tenant_id
  THEN
    RAISE EXCEPTION 'Acesso negado: chamador nao pertence ao tenant informado';
  END IF;

  v_normalized_role := COALESCE(
    NULLIF(v_membership_role, ''),
    CASE
      WHEN v_caller_tenant = p_tenant_id THEN NULLIF(v_access_role, '')
      ELSE NULL
    END,
    ''
  );

  IF COALESCE(v_is_super_admin, false)
     OR v_normalized_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
  THEN
    v_can_adjust := true;
  END IF;

  IF NOT v_can_adjust THEN
    RAISE EXCEPTION 'Somente gerentes ou administradores podem realizar ajustes auditados em comandas';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('admin_adjust_comanda_audit:' || p_tenant_id::text || ':' || p_comanda_id::text));

  SELECT * INTO v_comanda
  FROM public.comandas
  WHERE id = p_comanda_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda nao encontrada para este tenant';
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(ts.timezone), ''), 'America/Sao_Paulo')
  INTO v_timezone
  FROM public.tenant_settings ts
  WHERE ts.tenant_id = p_tenant_id
  LIMIT 1;
  v_timezone := COALESCE(v_timezone, 'America/Sao_Paulo');
  v_today_date := (now() AT TIME ZONE v_timezone)::date;

  -- 1) Validacao de status (ADR-035: paga/cancelada nunca altera status aqui)
  IF v_new_status IS NOT NULL THEN
    IF v_new_status NOT IN ('open', 'blocked') THEN
      RAISE EXCEPTION 'Status permitido apenas entre open e blocked';
    END IF;
    IF v_comanda.status NOT IN ('open', 'blocked') THEN
      RAISE EXCEPTION 'Comanda com status "%" nao permite alteracao de status por ajuste administrativo (use estorno auditado)', v_comanda.status;
    END IF;
    IF v_new_status IS DISTINCT FROM v_comanda.status THEN
      v_apply_status := v_new_status;
      v_adjusted_fields := array_append(v_adjusted_fields, 'status');
      v_affected_dates := array_append(v_affected_dates, (v_comanda.created_at AT TIME ZONE v_timezone)::date);
    END IF;
  END IF;

  -- 2) Validacao de data de abertura (created_at)
  IF p_new_created_at IS NOT NULL THEN
    IF v_comanda.status = 'cancelled' THEN
      RAISE EXCEPTION 'Nao e possivel alterar data de abertura de comanda cancelada';
    END IF;
    IF (p_new_created_at AT TIME ZONE v_timezone)::date > v_today_date THEN
      RAISE EXCEPTION 'Data de abertura nao pode ser futura';
    END IF;
    IF p_new_created_at IS DISTINCT FROM v_comanda.created_at THEN
      v_apply_created_at := p_new_created_at;
      v_adjusted_fields := array_append(v_adjusted_fields, 'created_at');
      v_affected_dates := array_append(v_affected_dates, (v_comanda.created_at AT TIME ZONE v_timezone)::date);
      v_affected_dates := array_append(v_affected_dates, (p_new_created_at AT TIME ZONE v_timezone)::date);
    END IF;
  END IF;

  -- 3) Validacao de data de pagamento (somente comandas pagas)
  v_old_payment_ts := COALESCE(v_comanda.payment_date_real, v_comanda.settled_at, v_comanda.closed_at);
  IF p_new_payment_date IS NOT NULL THEN
    IF v_comanda.status <> 'paid' THEN
      RAISE EXCEPTION 'Data de pagamento so pode ser ajustada em comandas ja pagas';
    END IF;
    IF (p_new_payment_date AT TIME ZONE v_timezone)::date > v_today_date THEN
      RAISE EXCEPTION 'Data de pagamento nao pode ser futura';
    END IF;
    IF p_new_payment_date IS DISTINCT FROM v_old_payment_ts
       OR p_new_payment_date IS DISTINCT FROM v_comanda.payment_date_real
       OR p_new_payment_date IS DISTINCT FROM v_comanda.settled_at
       OR p_new_payment_date IS DISTINCT FROM v_comanda.closed_at
    THEN
      v_apply_payment_date := p_new_payment_date;
      v_adjusted_fields := array_append(v_adjusted_fields, 'payment_date');
      IF v_old_payment_ts IS NOT NULL THEN
        v_affected_dates := array_append(v_affected_dates, (v_old_payment_ts AT TIME ZONE v_timezone)::date);
      END IF;
      v_affected_dates := array_append(v_affected_dates, (p_new_payment_date AT TIME ZONE v_timezone)::date);

      SELECT ARRAY_AGG(DISTINCT (t.date AT TIME ZONE v_timezone)::date)
      INTO v_tx_dates
      FROM public.transactions t
      WHERE t.tenant_id = p_tenant_id
        AND t.source_type = 'comanda'
        AND t.source_id = p_comanda_id
        AND t.type = 'income'
        AND COALESCE(t.status, 'paid') = 'paid';

      IF v_tx_dates IS NOT NULL THEN
        v_affected_dates := v_affected_dates || v_tx_dates;
      END IF;
    END IF;
  END IF;

  IF array_length(v_adjusted_fields, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'changed', false,
      'comanda_id', p_comanda_id,
      'message', 'Nenhuma alteracao detectada na comanda.'
    );
  END IF;

  -- Checagem de caixa fechado + exigencia de PIN gerencial (ADR-039)
  SELECT EXISTS (
    SELECT 1
    FROM public.cash_closings cc
    WHERE cc.tenant_id = p_tenant_id
      AND cc.status = 'confirmed'
      AND cc.business_date = ANY(v_affected_dates)
  ) INTO v_touches_closed_cash;

  v_requires_pin := (v_apply_payment_date IS NOT NULL) OR v_touches_closed_cash;

  IF v_requires_pin AND v_audit_pin IS NULL THEN
    RAISE EXCEPTION 'Ajuste de data de pagamento ou em caixa fechado exige PIN de gerente';
  END IF;

  IF v_audit_pin IS NOT NULL THEN
    IF NOT public.verify_audit_pin(v_auth_uid, p_tenant_id, v_audit_pin) THEN
      RAISE EXCEPTION 'PIN de autorizacao invalido';
    END IF;
  END IF;

  v_before_snapshot := jsonb_build_object(
    'status', v_comanda.status,
    'created_at', v_comanda.created_at,
    'payment_date_real', v_comanda.payment_date_real,
    'settled_at', v_comanda.settled_at,
    'closed_at', v_comanda.closed_at
  );

  UPDATE public.comandas
  SET
    status            = COALESCE(v_apply_status, status),
    created_at        = COALESCE(v_apply_created_at, created_at),
    payment_date_real = COALESCE(v_apply_payment_date, payment_date_real),
    settled_at        = COALESCE(v_apply_payment_date, settled_at),
    closed_at         = COALESCE(v_apply_payment_date, closed_at)
  WHERE id = p_comanda_id AND tenant_id = p_tenant_id;

  -- Mantem comanda_unblock_audit consistente se houve desbloqueio manual blocked -> open
  IF v_comanda.status = 'blocked' AND v_apply_status = 'open' THEN
    INSERT INTO public.comanda_unblock_audit (
      tenant_id, comanda_id, mode, operator_id, reason, before_status, after_status
    ) VALUES (
      p_tenant_id, p_comanda_id, 'manual', v_auth_uid, v_reason, 'blocked', 'open'
    );
  END IF;

  -- Sincronia atomica de data de pagamento em comanda_payments e transactions
  IF v_apply_payment_date IS NOT NULL THEN
    UPDATE public.comanda_payments
    SET created_at = v_apply_payment_date
    WHERE tenant_id = p_tenant_id
      AND comanda_id = p_comanda_id
      AND reversed_at IS NULL;

    UPDATE public.transactions
    SET
      date = v_apply_payment_date,
      retroactive_adjustment = retroactive_adjustment OR v_touches_closed_cash,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'admin_payment_date_adjusted', true,
        'admin_adjustment_reason', v_reason,
        'admin_adjusted_by', v_auth_uid,
        'admin_adjusted_at', now(),
        'pin_authorized', v_audit_pin IS NOT NULL,
        'retroactive_adjustment', v_touches_closed_cash
      )
    WHERE tenant_id = p_tenant_id
      AND source_type = 'comanda'
      AND source_id = p_comanda_id
      AND type = 'income'
      AND COALESCE(status, 'paid') = 'paid';
  END IF;

  v_after_snapshot := jsonb_build_object(
    'status', COALESCE(v_apply_status, v_comanda.status),
    'created_at', COALESCE(v_apply_created_at, v_comanda.created_at),
    'payment_date_real', COALESCE(v_apply_payment_date, v_comanda.payment_date_real),
    'settled_at', COALESCE(v_apply_payment_date, v_comanda.settled_at),
    'closed_at', COALESCE(v_apply_payment_date, v_comanda.closed_at)
  );

  INSERT INTO public.comanda_admin_adjustments (
    tenant_id,
    comanda_id,
    operator_id,
    reason,
    adjusted_fields,
    before_snapshot,
    after_snapshot,
    pin_authorized,
    retroactive_adjustment
  ) VALUES (
    p_tenant_id,
    p_comanda_id,
    v_auth_uid,
    v_reason,
    v_adjusted_fields,
    v_before_snapshot,
    v_after_snapshot,
    v_audit_pin IS NOT NULL,
    v_touches_closed_cash
  )
  RETURNING id INTO v_adjustment_id;

  RETURN jsonb_build_object(
    'success', true,
    'changed', true,
    'adjustment_id', v_adjustment_id,
    'comanda_id', p_comanda_id,
    'adjusted_fields', to_jsonb(v_adjusted_fields),
    'before_snapshot', v_before_snapshot,
    'after_snapshot', v_after_snapshot,
    'pin_authorized', v_audit_pin IS NOT NULL,
    'retroactive_adjustment', v_touches_closed_cash,
    'message', 'Ajuste gerencial registrado com sucesso.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_comanda_audit(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_comanda_audit(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_comanda_audit(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM service_role;
GRANT EXECUTE ON FUNCTION public.admin_adjust_comanda_audit(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_adjust_comanda_audit(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) IS
  'ADR-046: Ajuste gerencial auditado de comanda (status open/blocked, created_at e data de pagamento). Exclusivo de gestao, motivo obrigatorio, PIN em pagamento/caixa fechado.';

NOTIFY pgrst, 'reload schema';

COMMIT;
