-- =============================================================================
-- GTM-004 (#403) / ADR-050: SMG Barber Intelligence — Fase 1
-- Tabelas: public.ai_insights, public.ai_usage_logs
-- RPC: public.get_tenant_weekly_metrics(p_tenant_id uuid)
-- Isolamento multi-tenant via RLS (current_tenant_id_from_auth_uid / superadmin)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reference_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  model text NOT NULL DEFAULT 'gemini-2.5-flash',
  cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  cold_start boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_insights_tenant_reference_date_unique UNIQUE (tenant_id, reference_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_tenant_date
  ON public.ai_insights (tenant_id, reference_date DESC);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature text NOT NULL DEFAULT 'ai_analyst_weekly',
  model text NOT NULL DEFAULT 'gemini-2.5-flash',
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  latency_ms integer NOT NULL DEFAULT 0,
  cached boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant_created
  ON public.ai_usage_logs (tenant_id, created_at DESC);

-- Row Level Security
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_insights_tenant_select" ON public.ai_insights;
CREATE POLICY "ai_insights_tenant_select"
  ON public.ai_insights
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id_from_auth_uid()
    OR public.current_is_super_admin_from_auth_uid()
  );

DROP POLICY IF EXISTS "ai_insights_tenant_insert" ON public.ai_insights;
CREATE POLICY "ai_insights_tenant_insert"
  ON public.ai_insights
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id_from_auth_uid()
    OR public.current_is_super_admin_from_auth_uid()
  );

DROP POLICY IF EXISTS "ai_insights_tenant_update" ON public.ai_insights;
CREATE POLICY "ai_insights_tenant_update"
  ON public.ai_insights
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id_from_auth_uid()
    OR public.current_is_super_admin_from_auth_uid()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id_from_auth_uid()
    OR public.current_is_super_admin_from_auth_uid()
  );

DROP POLICY IF EXISTS "ai_usage_logs_tenant_select" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_tenant_select"
  ON public.ai_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id_from_auth_uid()
    OR public.current_is_super_admin_from_auth_uid()
  );

DROP POLICY IF EXISTS "ai_usage_logs_tenant_insert" ON public.ai_usage_logs;
CREATE POLICY "ai_usage_logs_tenant_insert"
  ON public.ai_usage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id_from_auth_uid()
    OR public.current_is_super_admin_from_auth_uid()
  );

REVOKE ALL ON TABLE public.ai_insights FROM anon;
REVOKE ALL ON TABLE public.ai_usage_logs FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_insights TO authenticated;
GRANT SELECT, INSERT ON TABLE public.ai_usage_logs TO authenticated;

-- =============================================================================
-- RPC deterministica: get_tenant_weekly_metrics(p_tenant_id uuid)
-- Calcula agregados semanais exatos no PostgreSQL (zero alucinacao matematica)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_tenant_weekly_metrics(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_caller_tenant uuid;
  v_is_superadmin boolean := false;
  v_now timestamptz := now();
  v_cur_start timestamptz := v_now - interval '7 days';
  v_prev_start timestamptz := v_now - interval '14 days';
  v_appointment_count integer := 0;
  v_completed_count integer := 0;
  v_cancelled_count integer := 0;
  v_no_show_count integer := 0;
  v_prev_appointment_count integer := 0;
  v_cur_revenue numeric(12,2) := 0;
  v_prev_revenue numeric(12,2) := 0;
  v_cur_expenses numeric(12,2) := 0;
  v_avg_ticket numeric(12,2) := 0;
  v_active_clients integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria' USING ERRCODE = '42501';
  END IF;

  v_caller_tenant := public.current_tenant_id_from_auth_uid();
  v_is_superadmin := public.current_is_super_admin_from_auth_uid();

  IF NOT v_is_superadmin AND (v_caller_tenant IS NULL OR v_caller_tenant <> p_tenant_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant solicitado' USING ERRCODE = '42501';
  END IF;

  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE status IN ('completed', 'finished', 'concluido'))::integer,
    COUNT(*) FILTER (WHERE status IN ('cancelled', 'canceled', 'cancelado'))::integer,
    COUNT(*) FILTER (WHERE status IN ('no_show', 'faltou'))::integer,
    COUNT(DISTINCT client_id)::integer
  INTO
    v_appointment_count,
    v_completed_count,
    v_cancelled_count,
    v_no_show_count,
    v_active_clients
  FROM public.appointments
  WHERE tenant_id = p_tenant_id
    AND start_time >= v_cur_start
    AND start_time <= v_now;

  SELECT COUNT(*)::integer
  INTO v_prev_appointment_count
  FROM public.appointments
  WHERE tenant_id = p_tenant_id
    AND start_time >= v_prev_start
    AND start_time < v_cur_start;

  SELECT COALESCE(SUM(amount), 0)::numeric(12,2)
  INTO v_cur_revenue
  FROM public.transactions
  WHERE tenant_id = p_tenant_id
    AND type = 'income'
    AND date >= v_cur_start::date
    AND date <= v_now::date;

  SELECT COALESCE(SUM(amount), 0)::numeric(12,2)
  INTO v_prev_revenue
  FROM public.transactions
  WHERE tenant_id = p_tenant_id
    AND type = 'income'
    AND date >= v_prev_start::date
    AND date < v_cur_start::date;

  SELECT COALESCE(SUM(amount), 0)::numeric(12,2)
  INTO v_cur_expenses
  FROM public.transactions
  WHERE tenant_id = p_tenant_id
    AND type = 'expense'
    AND date >= v_cur_start::date
    AND date <= v_now::date;

  IF v_completed_count > 0 THEN
    v_avg_ticket := ROUND(v_cur_revenue / v_completed_count, 2);
  END IF;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'window_days', 7,
    'generated_at', v_now,
    'appointment_count', v_appointment_count,
    'completed_count', v_completed_count,
    'cancelled_count', v_cancelled_count,
    'no_show_count', v_no_show_count,
    'previous_appointment_count', v_prev_appointment_count,
    'cancellation_rate_pct', CASE WHEN v_appointment_count > 0 THEN ROUND((v_cancelled_count::numeric / v_appointment_count) * 100, 1) ELSE 0 END,
    'no_show_rate_pct', CASE WHEN v_appointment_count > 0 THEN ROUND((v_no_show_count::numeric / v_appointment_count) * 100, 1) ELSE 0 END,
    'current_revenue', v_cur_revenue,
    'previous_revenue', v_prev_revenue,
    'revenue_delta_pct', CASE WHEN v_prev_revenue > 0 THEN ROUND(((v_cur_revenue - v_prev_revenue) / v_prev_revenue) * 100, 1) ELSE 0 END,
    'current_expenses', v_cur_expenses,
    'net_result', ROUND(v_cur_revenue - v_cur_expenses, 2),
    'average_ticket', v_avg_ticket,
    'active_clients', v_active_clients
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_weekly_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_weekly_metrics(uuid) TO authenticated;
