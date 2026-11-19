-- ============================================================================
-- ADR-050: SMG Barber Intelligence — Fase 1 (Diagnóstico Inteligente de Gestão)
-- T1: Tabelas ai_insights e ai_usage_logs + RLS multi-tenant
-- T2: RPC determinística get_tenant_weekly_metrics(p_tenant_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reference_date date NOT NULL DEFAULT CURRENT_DATE,
  model text NOT NULL,
  cards jsonb NOT NULL,
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_insights_tenant_reference_date_unique UNIQUE (tenant_id, reference_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_tenant_date
  ON public.ai_insights (tenant_id, reference_date DESC);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_insights_select_tenant" ON public.ai_insights;
CREATE POLICY "ai_insights_select_tenant"
  ON public.ai_insights
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "ai_insights_insert_tenant" ON public.ai_insights;
CREATE POLICY "ai_insights_insert_tenant"
  ON public.ai_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

-- ============================================================================
-- Tabela de auditoria de consumo de tokens por tenant
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature text NOT NULL DEFAULT 'strategic_diagnosis',
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  cached boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant_created
  ON public.ai_usage_logs (tenant_id, created_at DESC);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_logs_select_tenant" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_select_tenant"
  ON public.ai_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "ai_usage_logs_insert_tenant" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_insert_tenant"
  ON public.ai_usage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

-- ============================================================================
-- T2: RPC determinística de métricas semanais consolidadas
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tenant_weekly_metrics(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_tenant uuid;
  v_is_super_admin boolean;
  v_today date := CURRENT_DATE;
  v_current_start date := CURRENT_DATE - INTERVAL '6 days';
  v_prev_start date := CURRENT_DATE - INTERVAL '13 days';
  v_prev_end date := CURRENT_DATE - INTERVAL '7 days';

  v_income_current numeric := 0;
  v_income_previous numeric := 0;
  v_expense_current numeric := 0;
  v_appointment_count integer := 0;
  v_completed_count integer := 0;
  v_no_show_count integer := 0;
  v_cancelled_count integer := 0;
  v_avg_ticket numeric := 0;
  v_growth_pct numeric := 0;
  v_active_staff_count integer := 0;
  v_total_clients integer := 0;
  v_inactive_clients_30d integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: authentication required';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_caller_tenant, v_is_super_admin;

  IF p_tenant_id IS NULL OR (NOT COALESCE(v_is_super_admin, false) AND p_tenant_id IS DISTINCT FROM v_caller_tenant) THEN
    RAISE EXCEPTION 'Forbidden: tenant mismatch';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN type = 'income' AND date >= v_current_start AND date <= v_today THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'income' AND date >= v_prev_start AND date <= v_prev_end THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'expense' AND date >= v_current_start AND date <= v_today THEN amount ELSE 0 END), 0)
  INTO v_income_current, v_income_previous, v_expense_current
  FROM public.transactions
  WHERE tenant_id = p_tenant_id
    AND date >= v_prev_start
    AND date <= v_today;

  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE status = 'completed')::integer,
    COUNT(*) FILTER (WHERE status = 'no_show')::integer,
    COUNT(*) FILTER (WHERE status = 'cancelled')::integer
  INTO v_appointment_count, v_completed_count, v_no_show_count, v_cancelled_count
  FROM public.appointments
  WHERE tenant_id = p_tenant_id
    AND start_time >= v_current_start::timestamptz
    AND start_time < (v_today + INTERVAL '1 day')::timestamptz;

  IF v_completed_count > 0 THEN
    v_avg_ticket := ROUND(v_income_current / v_completed_count, 2);
  END IF;

  IF v_income_previous > 0 THEN
    v_growth_pct := ROUND(((v_income_current - v_income_previous) / v_income_previous) * 100, 1);
  END IF;

  SELECT COUNT(*)::integer
  INTO v_active_staff_count
  FROM public.staff
  WHERE tenant_id = p_tenant_id
    AND status = 'active';

  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE last_visit IS NOT NULL AND last_visit < (v_today - INTERVAL '30 days'))::integer
  INTO v_total_clients, v_inactive_clients_30d
  FROM public.clients
  WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'reference_date', v_today,
    'period_days', 7,
    'appointment_count', v_appointment_count,
    'completed_count', v_completed_count,
    'no_show_count', v_no_show_count,
    'cancelled_count', v_cancelled_count,
    'income_current', ROUND(v_income_current, 2),
    'income_previous', ROUND(v_income_previous, 2),
    'expense_current', ROUND(v_expense_current, 2),
    'net_result_current', ROUND(v_income_current - v_expense_current, 2),
    'growth_pct', v_growth_pct,
    'avg_ticket', v_avg_ticket,
    'active_staff_count', v_active_staff_count,
    'total_clients', v_total_clients,
    'inactive_clients_30d', v_inactive_clients_30d
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_weekly_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_weekly_metrics(uuid) TO authenticated;
