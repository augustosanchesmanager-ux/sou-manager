-- ============================================================================
-- Fase 2: Motor de Automação (Trigger de Alerta <= 3) e RPCs Universais
-- (Funil Público de Avaliação + Painel de Qualidade & Churn Recovery)
-- ============================================================================

-- 1. Trigger em tempo real: gera alerta em public.tenant_alerts quando rating <= 3
CREATE OR REPLACE FUNCTION public.fn_low_rating_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_name TEXT;
  v_client_name TEXT;
  v_title TEXT;
  v_message TEXT;
  v_severity TEXT;
BEGIN
  IF NEW.rating > 3 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.rating <= 3 AND COALESCE(OLD.comment, '') = COALESCE(NEW.comment, '') THEN
    RETURN NEW;
  END IF;

  IF NEW.staff_id IS NOT NULL THEN
    SELECT s.name INTO v_staff_name
    FROM public.staff s
    WHERE s.id = NEW.staff_id
      AND s.tenant_id = NEW.tenant_id;
  END IF;

  IF NEW.client_id IS NOT NULL THEN
    SELECT c.name INTO v_client_name
    FROM public.clients c
    WHERE c.id = NEW.client_id
      AND c.tenant_id = NEW.tenant_id;
  END IF;

  v_severity := CASE WHEN NEW.rating <= 2 THEN 'critical' ELSE 'warning' END;

  IF NEW.review_scope = 'staff' AND v_staff_name IS NOT NULL THEN
    v_title := format('Alerta de Avaliação (%s★) — %s', NEW.rating, v_staff_name);
  ELSE
    v_title := format('Alerta de Avaliação (%s★) — Estabelecimento', NEW.rating);
  END IF;

  v_message := COALESCE(
    NULLIF(btrim(NEW.comment), ''),
    format(
      'Cliente %s registrou nota %s★%s.',
      COALESCE(v_client_name, 'anônimo'),
      NEW.rating,
      CASE WHEN v_staff_name IS NOT NULL THEN format(' para %s (%s)', v_staff_name, COALESCE(NEW.staff_role_snapshot, 'Equipe')) ELSE '' END
    )
  );

  -- Evita duplicar alerta se o cliente apenas adicionou o comentário logo após clicar na estrela
  UPDATE public.tenant_alerts
  SET message = v_message,
      severity = v_severity,
      metadata = jsonb_build_object(
        'review_id', NEW.id,
        'rating', NEW.rating,
        'review_scope', NEW.review_scope,
        'staff_id', NEW.staff_id,
        'staff_name', v_staff_name,
        'staff_role', NEW.staff_role_snapshot,
        'client_id', NEW.client_id,
        'client_name', v_client_name
      )
  WHERE tenant_id = NEW.tenant_id
    AND reference_table = 'tenant_reviews'
    AND reference_id = NEW.id;

  IF NOT FOUND THEN
    INSERT INTO public.tenant_alerts (
      tenant_id,
      alert_type,
      severity,
      title,
      message,
      reference_table,
      reference_id,
      metadata
    ) VALUES (
      NEW.tenant_id,
      'low_rating',
      v_severity,
      v_title,
      v_message,
      'tenant_reviews',
      NEW.id,
      jsonb_build_object(
        'review_id', NEW.id,
        'rating', NEW.rating,
        'review_scope', NEW.review_scope,
        'staff_id', NEW.staff_id,
        'staff_name', v_staff_name,
        'staff_role', NEW.staff_role_snapshot,
        'client_id', NEW.client_id,
        'client_name', v_client_name
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_low_rating_alert ON public.tenant_reviews;
CREATE TRIGGER trg_low_rating_alert
  AFTER INSERT OR UPDATE OF rating, comment
  ON public.tenant_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_low_rating_alert();

-- 2. RPC Pública: Contexto da tela de avaliação (Estabelecimento + Toda a Equipe do Tenant)
CREATE OR REPLACE FUNCTION public.get_public_feedback_context(
  p_tenant_identifier TEXT,
  p_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant_name TEXT;
  v_obs RECORD;
  v_staff JSONB;
BEGIN
  v_tenant_id := public.resolve_public_booking_tenant_id(p_tenant_identifier);
  IF v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT name INTO v_tenant_name FROM public.tenants WHERE id = v_tenant_id;
  SELECT * INTO v_obs FROM public.online_booking_settings WHERE tenant_id = v_tenant_id;

  -- Retorna TODOS os colaboradores ativos do tenant (Recepcionistas, Gerentes Operacionais e Barbeiros)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'role', COALESCE(s.role, 'Barber'),
        'avatar', NULLIF(s.avatar, '')
      )
      ORDER BY s.name ASC
    ),
    '[]'::jsonb
  )
  INTO v_staff
  FROM public.staff s
  WHERE s.tenant_id = v_tenant_id
    AND lower(COALESCE(s.status, 'active')) = 'active';

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'name', COALESCE(NULLIF(v_obs.display_name, ''), v_tenant_name, 'Barbearia'),
    'slug', COALESCE(v_obs.slug, p_tenant_identifier),
    'logo_url', v_obs.logo_url,
    'primary_color', COALESCE(v_obs.primary_color, '#B88A44'),
    'google_place_id', v_obs.google_place_id,
    'is_review_funnel_active', COALESCE(v_obs.is_review_funnel_active, true),
    'staff', v_staff
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_feedback_context(TEXT, TEXT) TO anon, authenticated;

-- 3. RPC Pública: Gravação imediata (clique na estrela) e atualização de comentário (UX Routing)
CREATE OR REPLACE FUNCTION public.submit_public_review(
  p_tenant_identifier TEXT,
  p_rating INT,
  p_review_scope TEXT DEFAULT 'establishment',
  p_staff_id UUID DEFAULT NULL,
  p_comment TEXT DEFAULT NULL,
  p_public_token TEXT DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_source_channel TEXT DEFAULT 'whatsapp',
  p_redirected_to_google BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_scope TEXT := CASE WHEN p_review_scope = 'staff' THEN 'staff' ELSE 'establishment' END;
  v_staff_role TEXT := NULL;
  v_existing_id UUID := NULL;
  v_review_id UUID;
  v_google_place_id TEXT;
  v_google_url TEXT := NULL;
  v_clean_token TEXT := NULLIF(btrim(COALESCE(p_public_token, '')), '');
  v_clean_comment TEXT := NULLIF(btrim(COALESCE(p_comment, '')), '');
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid_rating' USING HINT = 'A nota deve estar entre 1 e 5.';
  END IF;

  v_tenant_id := public.resolve_public_booking_tenant_id(p_tenant_identifier);
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_not_found' USING HINT = 'Estabelecimento não encontrado.';
  END IF;

  IF p_staff_id IS NOT NULL THEN
    SELECT s.role INTO v_staff_role
    FROM public.staff s
    WHERE s.id = p_staff_id
      AND s.tenant_id = v_tenant_id;

    IF v_staff_role IS NULL THEN
      RAISE EXCEPTION 'staff_not_found' USING HINT = 'Colaborador não pertence a este estabelecimento.';
    END IF;
    v_scope := 'staff';
  END IF;

  SELECT google_place_id INTO v_google_place_id
  FROM public.online_booking_settings
  WHERE tenant_id = v_tenant_id;

  IF p_rating >= 4 AND v_google_place_id IS NOT NULL AND btrim(v_google_place_id) <> '' THEN
    v_google_url := 'https://search.google.com/local/writereview?placeid=' || btrim(v_google_place_id);
  END IF;

  -- Idempotência por public_token + escopo + colaborador (permite gravar estrela primeiro e texto depois)
  IF v_clean_token IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.tenant_reviews
    WHERE tenant_id = v_tenant_id
      AND public_token = v_clean_token
      AND review_scope = v_scope
      AND COALESCE(staff_id, '00000000-0000-0000-0000-000000000000'::uuid) =
          COALESCE(p_staff_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.tenant_reviews
    SET rating = p_rating,
        comment = COALESCE(v_clean_comment, comment),
        redirected_to_google = (redirected_to_google OR COALESCE(p_redirected_to_google, false)),
        updated_at = now()
    WHERE id = v_existing_id
    RETURNING id INTO v_review_id;
  ELSE
    INSERT INTO public.tenant_reviews (
      tenant_id,
      appointment_id,
      client_id,
      review_scope,
      staff_id,
      staff_role_snapshot,
      rating,
      comment,
      status,
      source_channel,
      public_token,
      redirected_to_google
    ) VALUES (
      v_tenant_id,
      p_appointment_id,
      p_client_id,
      v_scope,
      p_staff_id,
      v_staff_role,
      p_rating,
      v_clean_comment,
      CASE WHEN p_rating <= 3 THEN 'pending' ELSE 'resolved' END,
      COALESCE(NULLIF(btrim(p_source_channel), ''), 'whatsapp'),
      v_clean_token,
      COALESCE(p_redirected_to_google, false)
    )
    RETURNING id INTO v_review_id;
  END IF;

  RETURN jsonb_build_object(
    'review_id', v_review_id,
    'rating', p_rating,
    'review_scope', v_scope,
    'should_redirect_google', (p_rating >= 4 AND v_google_url IS NOT NULL),
    'google_review_url', v_google_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_review(TEXT, INT, TEXT, UUID, TEXT, TEXT, UUID, UUID, TEXT, BOOLEAN) TO anon, authenticated;

-- 4. RPC do Painel do Gestor: get_quality_dashboard_metrics
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

  -- Desempenho por colaborador (todos os cargos: barbeiro, recepcionista, gerente operacional)
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

  -- Inbox de Recuperação (Churn Recovery)
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
        CASE WHEN r.status IN ('pending', 'in_progress') THEN 0 ELSE 1 END ASC,
        r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_inbox
  FROM (
    SELECT *
    FROM public.tenant_reviews
    WHERE tenant_id = p_tenant_id
      AND rating <= 3
    ORDER BY created_at DESC
    LIMIT 100
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

-- 5. RPC do Gestor: Resolução de Atrito (Playbook de Churn Recovery)
CREATE OR REPLACE FUNCTION public.resolve_tenant_review(
  p_review_id UUID,
  p_resolution_note TEXT,
  p_status TEXT DEFAULT 'resolved'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review RECORD;
  v_next_status TEXT := CASE
    WHEN p_status IN ('pending', 'in_progress', 'resolved', 'archived') THEN p_status
    ELSE 'resolved'
  END;
BEGIN
  SELECT * INTO v_review
  FROM public.tenant_reviews
  WHERE id = p_review_id;

  IF v_review.id IS NULL THEN
    RAISE EXCEPTION 'review_not_found' USING HINT = 'Avaliação não encontrada.';
  END IF;

  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR v_review.tenant_id = public.current_tenant_id_from_auth_uid()
  ) THEN
    RAISE EXCEPTION 'access_denied' USING HINT = 'Sem permissão para alterar esta avaliação.';
  END IF;

  UPDATE public.tenant_reviews
  SET status = v_next_status,
      resolution_note = NULLIF(btrim(COALESCE(p_resolution_note, '')), ''),
      resolved_by = auth.uid(),
      resolved_at = CASE WHEN v_next_status = 'resolved' THEN now() ELSE resolved_at END,
      updated_at = now()
  WHERE id = p_review_id;

  IF v_next_status = 'resolved' THEN
    UPDATE public.tenant_alerts
    SET is_read = true,
        read_at = COALESCE(read_at, now())
    WHERE tenant_id = v_review.tenant_id
      AND reference_table = 'tenant_reviews'
      AND reference_id = p_review_id;
  END IF;

  RETURN jsonb_build_object(
    'id', p_review_id,
    'status', v_next_status,
    'resolved_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_tenant_review(UUID, TEXT, TEXT) TO authenticated;
