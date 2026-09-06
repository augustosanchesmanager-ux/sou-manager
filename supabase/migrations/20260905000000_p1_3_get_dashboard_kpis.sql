-- ============================================================
-- P1.3 — get_dashboard_kpis (KPIs Canônicos Server-Side)
--
-- Decisões incorporadas:
--   D-EST-01 (PO): receita líquida por reversões, preservando o original
--   D-PERF-01 (PO): service_execution_participants como autoridade de execução
--   D-RET-01 (PO): retorno = cliente com ≥1 atendimento elegível no período
--
-- Branch:  feature/p1-3-canonical-kpis
-- ============================================================

BEGIN;

-- ============================================================
-- RPC: get_dashboard_kpis
--
-- Contrato (Design Gate P1.3):
--   p_period   'today'|'yesterday'|'week'|'month'|'quarter'|'year' (dflt 'month')
--   p_staff_id UUID NULL — escopo opcional (valida pertencimento ao tenant)
--   Retorno:   JSONB envelope com KPIs canônicos
--
-- Segurança:
--   SECURITY DEFINER + gate interno obrigatório
--   p_tenant_id NUNCA aceito do frontend (derivado do contexto)
--   SET search_path = public
--   Grants: REVOKE PUBLIC/anon + GRANT authenticated
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  p_period   TEXT DEFAULT 'month',
  p_staff_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Gate
  v_auth_uid         UUID := auth.uid();
  v_tenant_id        UUID;
  v_is_super_admin   BOOLEAN := false;
  v_access_role      TEXT;
  v_membership_role  TEXT;
  v_has_membership   BOOLEAN := false;

  -- Janela (timezone fixo America/Sao_Paulo — decisão PO v1)
  v_period_key       TEXT;
  v_now_local        TIMESTAMP;
  v_unit             TEXT;
  v_start            TIMESTAMPTZ;
  v_end              TIMESTAMPTZ;
  v_prev_start       TIMESTAMPTZ;
  v_prev_end         TIMESTAMPTZ;

  -- Financeiro
  v_revenue          NUMERIC := 0;
  v_revenue_prev     NUMERIC := 0;
  v_expenses         NUMERIC := 0;
  v_result           NUMERIC := 0;
  v_reversals        NUMERIC := 0;
  v_ticket_denom     BIGINT := 0;
  v_growth           NUMERIC;

  -- Clientes / operações
  v_active_clients   BIGINT := 0;
  v_new_clients      BIGINT := 0;
  v_base_clients     BIGINT := 0;
  v_returned_clients BIGINT := 0;
  v_retention        NUMERIC;
  v_total_appt       BIGINT := 0;
  v_completed_appt   BIGINT := 0;
  v_cancelled_appt   BIGINT := 0;
  v_no_show_appt     BIGINT := 0;

  -- Performance staff
  v_staff            JSONB := '[]'::jsonb;
BEGIN
  -- ─────────── GATE 1: autenticado ───────────
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuario autenticado obrigatorio';
  END IF;

  -- ─────────── GATE 2: tenant derivado do contexto (nunca do frontend) ───────────
  SELECT public.current_tenant_id_from_auth_uid(),
         public.current_is_super_admin_from_auth_uid()
    INTO v_tenant_id, v_is_super_admin;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant nao resolvido para o usuario autenticado';
  END IF;

  -- ─────────── GATE 3: papel permitido (espelha finance_reverse_transaction) ───────────
  SELECT LOWER(BTRIM(COALESCE(p.role, ''))) INTO v_access_role
    FROM public.profiles p
   WHERE p.id = v_auth_uid
   LIMIT 1;

  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
      FROM public.staff s
     WHERE s.id = v_auth_uid
     LIMIT 1;
  END IF;

  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
    FROM public.user_tenants ut
   WHERE ut.user_id = v_auth_uid
     AND ut.tenant_id = v_tenant_id
   ORDER BY COALESCE(ut.is_primary, false) DESC
   LIMIT 1;

  v_has_membership := COALESCE(v_membership_role IN
    ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin'), false);

  IF NOT COALESCE(v_is_super_admin, false)
     AND COALESCE(v_access_role, '') NOT IN
       ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     AND NOT v_has_membership
  THEN
    RAISE EXCEPTION 'Usuario sem permissao para KPIs';
  END IF;

  -- ─────────── GATE 4: escopo de staff pertence ao tenant ───────────
  IF p_staff_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff s
     WHERE s.id = p_staff_id AND s.tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Profissional nao pertence ao tenant';
  END IF;

  -- ─────────── GATE 5: período válido + janela em America/Sao_Paulo ───────────
  v_period_key := LOWER(BTRIM(COALESCE(p_period, 'month')));
  CASE v_period_key
    WHEN 'today'     THEN v_unit := 'day';
    WHEN 'yesterday' THEN v_unit := 'day';
    WHEN 'week'      THEN v_unit := 'week';
    WHEN 'month'     THEN v_unit := 'month';
    WHEN 'quarter'   THEN v_unit := 'quarter';
    WHEN 'year'      THEN v_unit := 'year';
    ELSE RAISE EXCEPTION 'Periodo invalido: %', p_period;
  END CASE;

  v_now_local := now() AT TIME ZONE 'America/Sao_Paulo';

  IF v_period_key = 'yesterday' THEN
    v_start := (date_trunc('day', v_now_local) - interval '1 day') AT TIME ZONE 'America/Sao_Paulo';
  ELSE
    v_start := date_trunc(v_unit, v_now_local) AT TIME ZONE 'America/Sao_Paulo';
  END IF;
  v_end := v_start + (CASE v_unit WHEN 'day' THEN interval '1 day'
                                  WHEN 'week' THEN interval '1 week'
                                  WHEN 'month' THEN interval '1 month'
                                  WHEN 'quarter' THEN interval '3 months'
                                  ELSE interval '1 year' END);
  v_prev_end := v_start;
  v_prev_start := v_start - (CASE v_unit WHEN 'day' THEN interval '1 day'
                                         WHEN 'week' THEN interval '1 week'
                                         WHEN 'month' THEN interval '1 month'
                                         WHEN 'quarter' THEN interval '3 months'
                                         ELSE interval '1 year' END);

  -- ─────────── K1: Receita líq = Σ income(paid, período) − Σ reversões
  --    de originais do período (D-EST-01 — data-base = date do ORIGINAL) ───────────
  SELECT COALESCE(SUM(t.amount), 0)
    INTO v_revenue
    FROM public.transactions t
   WHERE t.tenant_id = v_tenant_id
     AND t.type = 'income'
     AND COALESCE(t.status, 'paid') = 'paid'
     AND t.date >= v_start AND t.date < v_end;

  SELECT COALESCE(SUM(fr.amount), 0)
    INTO v_reversals
    FROM public.financial_reversals fr
    JOIN public.transactions ot
      ON ot.id = fr.original_transaction_id AND ot.tenant_id = fr.tenant_id
   WHERE fr.tenant_id = v_tenant_id
     AND ot.date >= v_start AND ot.date < v_end;

  v_revenue := v_revenue - v_reversals;

  -- K1 anterior (base do Crescimento)
  SELECT COALESCE(SUM(t.amount), 0)
    INTO v_revenue_prev
    FROM public.transactions t
   WHERE t.tenant_id = v_tenant_id
     AND t.type = 'income'
     AND COALESCE(t.status, 'paid') = 'paid'
     AND t.date >= v_prev_start AND t.date < v_prev_end;

  SELECT COALESCE(SUM(fr.amount), 0)
    INTO v_reversals
    FROM public.financial_reversals fr
    JOIN public.transactions ot
      ON ot.id = fr.original_transaction_id AND ot.tenant_id = fr.tenant_id
   WHERE fr.tenant_id = v_tenant_id
     AND ot.date >= v_prev_start AND ot.date < v_prev_end;

  v_revenue_prev := v_revenue_prev - v_reversals;

  -- K5: Crescimento (NULL quando base = 0 — evita divisão por zero)
  IF v_revenue_prev <> 0 THEN
    v_growth := (v_revenue - v_revenue_prev) / v_revenue_prev;
  END IF;

  -- ─────────── K2: Despesas = Σ expense(paid, período) EXCLUINDO transações
  --    de reversão (já compensadas em K1 — evita dupla contagem) ───────────
  SELECT COALESCE(SUM(t.amount), 0)
    INTO v_expenses
    FROM public.transactions t
   WHERE t.tenant_id = v_tenant_id
     AND t.type = 'expense'
     AND COALESCE(t.status, 'paid') = 'paid'
     AND t.date >= v_start AND t.date < v_end
     AND (t.metadata->>'original_transaction_id') IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.financial_reversals fr
        WHERE fr.reversal_transaction_id = t.id
     );

  -- K3: Resultado
  v_result := v_revenue - v_expenses;

  -- K4: Ticket médio = Receita líq / nº transações income(paid) com saldo
  --    disponível > 0 (originais total/parcialmente não estornados)
  SELECT COUNT(*)
    INTO v_ticket_denom
    FROM (
      SELECT t.id
        FROM public.transactions t
        LEFT JOIN (
          SELECT fr.original_transaction_id, COALESCE(SUM(fr.amount), 0) AS reversed
            FROM public.financial_reversals fr
           WHERE fr.tenant_id = v_tenant_id
           GROUP BY fr.original_transaction_id
        ) rev ON rev.original_transaction_id = t.id
       WHERE t.tenant_id = v_tenant_id
         AND t.type = 'income'
         AND COALESCE(t.status, 'paid') = 'paid'
         AND t.date >= v_start AND t.date < v_end
         AND COALESCE(t.amount, 0) - COALESCE(rev.reversed, 0) > 0
    ) denom;

  -- ─────────── K7/K6/K8/K10: cliente e operações.
  --    Atendimento ELEGÍVEL (D-RET-01) = status 'completed' (efetivado). ───────────

  -- K7: Clientes ativos (período atual)
  SELECT COUNT(DISTINCT a.client_id)
    INTO v_active_clients
    FROM public.appointments a
   WHERE a.tenant_id = v_tenant_id
     AND a.status = 'completed'
     AND a.start_time >= v_start AND a.start_time < v_end;

  -- K6: Base (período anterior) e retornados (base ∩ período atual)
  SELECT COUNT(DISTINCT a.client_id)
    INTO v_base_clients
    FROM public.appointments a
   WHERE a.tenant_id = v_tenant_id
     AND a.status = 'completed'
     AND a.start_time >= v_prev_start AND a.start_time < v_prev_end;

  SELECT COUNT(DISTINCT a.client_id)
    INTO v_returned_clients
    FROM public.appointments a
   WHERE a.tenant_id = v_tenant_id
     AND a.status = 'completed'
     AND a.start_time >= v_start AND a.start_time < v_end
     AND a.client_id IN (
       SELECT DISTINCT a2.client_id
         FROM public.appointments a2
        WHERE a2.tenant_id = v_tenant_id
          AND a2.status = 'completed'
          AND a2.start_time >= v_prev_start AND a2.start_time < v_prev_end
     );

  IF v_base_clients > 0 THEN
    v_retention := v_returned_clients::NUMERIC / v_base_clients::NUMERIC;
  END IF;

  -- K8: Atendimentos (contagem por status do período)
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE a.status = 'completed'),
         COUNT(*) FILTER (WHERE a.status = 'cancelled'),
         COUNT(*) FILTER (WHERE a.status = 'no_show')
    INTO v_total_appt, v_completed_appt, v_cancelled_appt, v_no_show_appt
    FROM public.appointments a
   WHERE a.tenant_id = v_tenant_id
     AND a.start_time >= v_start AND a.start_time < v_end;

  -- K10: Novos clientes
  SELECT COUNT(*)
    INTO v_new_clients
    FROM public.clients c
   WHERE c.tenant_id = v_tenant_id
     AND c.created_at >= v_start AND c.created_at < v_end;

  -- ─────────── K9: Performance por profissional (D-PERF-01) ───────────
  SELECT COALESCE(jsonb_agg(x ORDER BY x.receita_gerada DESC), '[]'::jsonb)
    INTO v_staff
    FROM (
      SELECT
        s.id::TEXT                                      AS professional_id,
        s.name                                          AS professional_name,
        COUNT(DISTINCT sep.comanda_item_id)             AS atendimentos,
        COALESCE(SUM(
          CASE WHEN sep.payout_type = 'percentage'
               THEN ci.unit_price * ci.quantity * (sep.payout_value / 100.0)
               ELSE LEAST(sep.payout_value, ci.unit_price * ci.quantity)
          END
        ), 0)                                           AS receita_gerada
      FROM public.service_execution_participants sep
      JOIN public.comanda_items ci
        ON ci.id = sep.comanda_item_id AND ci.tenant_id = v_tenant_id
      JOIN public.comandas c
        ON c.id = ci.comanda_id AND c.tenant_id = v_tenant_id
      JOIN public.staff s
        ON s.id = sep.professional_id
      WHERE sep.tenant_id = v_tenant_id
        AND c.status = 'paid'
        AND COALESCE(c.financial_effect, true) = true
        AND COALESCE(c.closed_at, c.settled_at, c.created_at) >= v_start
        AND COALESCE(c.closed_at, c.settled_at, c.created_at) < v_end
        AND (p_staff_id IS NULL OR sep.professional_id = p_staff_id)
        AND sep.affects_revenue = true
      GROUP BY s.id, s.name
    ) x;

  -- ─────────── Retorno: envelope JSONB ───────────
  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'tenant_id',     v_tenant_id::TEXT,
      'period',        v_period_key,
      'start',         v_start,
      'end',           v_end,
      'timezone',      'America/Sao_Paulo',
      'generated_at',  now(),
      'result_basis',  'transactional',
      'scope_staff_id', p_staff_id::TEXT
    ),
    'financial', jsonb_build_object(
      'revenue',       v_revenue,
      'expenses',      v_expenses,
      'result',        v_result,
      'reversals',     v_reversals,
      'average_ticket', CASE WHEN v_ticket_denom > 0
                             THEN v_revenue / v_ticket_denom::NUMERIC
                             ELSE 0 END,
      'growth',        v_growth
    ),
    'clients', jsonb_build_object(
      'active_clients',   v_active_clients,
      'new_clients',      v_new_clients,
      'base_clients',     v_base_clients,
      'returned_clients', v_returned_clients,
      'retention',        v_retention
    ),
    'operations', jsonb_build_object(
      'total',      v_total_appt,
      'completed',  v_completed_appt,
      'cancelled',  v_cancelled_appt,
      'no_show',    v_no_show_appt
    ),
    'staff', v_staff
  );
END;
$$;

-- ─────────── Grants (ADR-012) ───────────
REVOKE ALL ON FUNCTION public.get_dashboard_kpis(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.get_dashboard_kpis(TEXT, UUID) IS
  'P1.3: KPIs canonicos server-side. D-EST-01 (receita liquida por reversoes), '
  'D-PERF-01 (execucao via service_execution_participants), D-RET-01 (retencao '
  'por atendimento elegivel). Seguranca: tenant derivado do contexto, papel '
  'permitido, escopo staff validado. Nao inclui dimensoes analiticas.';

NOTIFY pgrst, 'reload schema';

COMMIT;
