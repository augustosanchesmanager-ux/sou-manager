-- =============================================================================
-- Migration: 20261117122500_include_all_reviews_in_quality_dashboard.sql
-- Objetivo: Incluir todos os feedbacks (elogios 4-5★ e atritos ≤3★) no painel de
--           qualidade, mantendo os atritos pendentes com prioridade máxima no topo.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_quality_dashboard_metrics(
  p_tenant_id UUID,
  p_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := now() - make_interval(days => GREATEST(1, COALESCE(p_days, 30)));
  v_summary JSONB;
  v_staff_perf JSONB;
  v_inbox JSONB;
BEGIN
  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR p_tenant_id = public.current_tenant_id_from_auth_uid()
  ) THEN
    RAISE EXCEPTION 'access_denied' USING HINT = 'Acesso negado às métricas deste tenant.';
  END IF;

  SELECT jsonb_build_object(
    'total_reviews', COUNT(*),
    'avg_rating', COALESCE(ROUND(AVG(rating)::numeric, 2), 0),
    'promoters_count', COUNT(*) FILTER (WHERE rating >= 4),
    'detractors_count', COUNT(*) FILTER (WHERE rating <= 3),
    'pending_recovery_count', COUNT(*) FILTER (WHERE rating <= 3 AND status IN ('pending', 'in_progress')),
    'resolved_count', COUNT(*) FILTER (WHERE rating <= 3 AND status = 'resolved')
  )
  INTO v_summary
  FROM public.tenant_reviews
  WHERE tenant_id = p_tenant_id
    AND created_at >= v_cutoff;

  -- Desempenho por colaborador (todos os cargos: barbeiro, recepcionista, gerente operacional, gerente administrativo)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'staff_id', s.id,
        'staff_name', s.name,
        'role', COALESCE(s.role, 'Barber'),
        'avatar', s.avatar,
        'reviews_count', COALESCE(stats.cnt, 0),
        'avg_rating', COALESCE(stats.avg_rat, 0),
        'promoters_count', COALESCE(stats.promoters, 0),
        'detractors_count', COALESCE(stats.detractors, 0),
        'retention_rate', COALESCE(stats.retention_pct, 100)
      )
      ORDER BY COALESCE(stats.avg_rat, 0) DESC, s.name ASC
    ),
    '[]'::jsonb
  )
  INTO v_staff_perf
  FROM public.staff s
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS cnt,
      ROUND(AVG(r.rating)::numeric, 2) AS avg_rat,
      COUNT(*) FILTER (WHERE r.rating >= 4) AS promoters,
      COUNT(*) FILTER (WHERE r.rating <= 3) AS detractors,
      ROUND((COUNT(*) FILTER (WHERE r.rating >= 4)::numeric / NULLIF(COUNT(*), 0)) * 100, 1) AS retention_pct
    FROM public.tenant_reviews r
    WHERE r.tenant_id = p_tenant_id
      AND r.staff_id = s.id
      AND r.created_at >= v_cutoff
  ) stats ON true
  WHERE s.tenant_id = p_tenant_id
    AND lower(COALESCE(s.status, 'active')) = 'active';

  -- Feed de Feedbacks e Recuperação (Todos os feedbacks, mantendo atritos pendentes em evidência no topo)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'review_scope', r.review_scope,
        'rating', r.rating,
        'comment', r.comment,
        'status', r.status,
        'resolution_note', r.resolution_note,
        'resolved_at', r.resolved_at,
        'created_at', r.created_at,
        'staff_id', r.staff_id,
        'staff_name', st.name,
        'staff_role', COALESCE(r.staff_role_snapshot, st.role),
        'client_id', r.client_id,
        'client_name', COALESCE(c.name, 'Cliente'),
        'client_phone', c.phone,
        'client_ltv', COALESCE(c.lifetime_value, c.total_spent, 0)
      )
      ORDER BY
        CASE
          WHEN r.rating <= 3 AND r.status IN ('pending', 'in_progress') THEN 0
          WHEN r.rating <= 3 THEN 1
          ELSE 2
        END ASC,
        r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_inbox
  FROM (
    SELECT *
    FROM public.tenant_reviews
    WHERE tenant_id = p_tenant_id
      AND created_at >= v_cutoff
    ORDER BY created_at DESC
    LIMIT 200
  ) r
  LEFT JOIN public.staff st ON st.id = r.staff_id AND st.tenant_id = p_tenant_id
  LEFT JOIN public.clients c ON c.id = r.client_id AND c.tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'summary', v_summary,
    'staff_performance', v_staff_perf,
    'recovery_inbox', v_inbox
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_quality_dashboard_metrics(UUID, INT) TO authenticated;
