-- =============================================================================
-- Migration: 20261120075500_fix_appointment_duration_precision_2_decimals.sql
-- Objetivo:
--   Corrigir o arredondamento de duracao de agendamentos de 1 casa decimal
--   (NUMERIC(3,1), que transformava 45 min = 0.75h em 0.8h = 48m) para 2 casas
--   decimais (NUMERIC(4,2)), preservando duracoes de 15m (0.25h) e 45m (0.75h).
-- =============================================================================

DO $$
DECLARE
  v_relkind "char";
  v_view_def TEXT;
  v_reloptions TEXT[];
  v_with_clause TEXT := '';
  v_grants TEXT[];
  v_grant_sql TEXT;
BEGIN
  SELECT c.relkind, c.reloptions
  INTO v_relkind, v_reloptions
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'barber' AND c.relname = 'appointments';

  IF v_relkind = 'v' THEN
    v_view_def := pg_get_viewdef('barber.appointments'::regclass, true);
    IF v_reloptions IS NOT NULL AND array_length(v_reloptions, 1) > 0 THEN
      v_with_clause := 'WITH (' || array_to_string(v_reloptions, ', ') || ') ';
    END IF;

    SELECT array_agg(
      format(
        'GRANT %s ON barber.appointments TO %I%s',
        privilege_type,
        grantee,
        CASE WHEN is_grantable = 'YES' THEN ' WITH GRANT OPTION' ELSE '' END
      )
    )
    INTO v_grants
    FROM information_schema.role_table_grants
    WHERE table_schema = 'barber'
      AND table_name = 'appointments'
      AND grantee <> 'PUBLIC';

    DROP VIEW barber.appointments;

    IF to_regclass('public.appointments') IS NOT NULL THEN
      ALTER TABLE public.appointments
        ALTER COLUMN duration TYPE NUMERIC(4, 2);
    END IF;

    EXECUTE format('CREATE VIEW barber.appointments %sAS %s', v_with_clause, v_view_def);

    IF v_grants IS NOT NULL THEN
      FOREACH v_grant_sql IN ARRAY v_grants LOOP
        EXECUTE v_grant_sql;
      END LOOP;
    END IF;
  ELSE
    IF to_regclass('public.appointments') IS NOT NULL THEN
      ALTER TABLE public.appointments
        ALTER COLUMN duration TYPE NUMERIC(4, 2);
    END IF;

    IF v_relkind IN ('r', 'p') THEN
      ALTER TABLE barber.appointments
        ALTER COLUMN duration TYPE NUMERIC(4, 2);
    END IF;
  END IF;
END $$;

-- ── 1. create_appointment_with_comanda (precisao NUMERIC(4,2)) ────────────────
CREATE OR REPLACE FUNCTION public.create_appointment_with_comanda(
  p_tenant_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_service_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_price NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_is_overbooked BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_current_tenant_id UUID;
  v_is_super_admin BOOLEAN := false;
  v_timezone TEXT := 'America/Sao_Paulo';
  v_client_name TEXT;
  v_service_name TEXT;
  v_staff_name TEXT;
  v_service_price NUMERIC(10, 2) := 0;
  v_service_duration_minutes NUMERIC := 30;
  v_duration_hours NUMERIC(4, 2) := 1;
  v_end_time TIMESTAMPTZ;
  v_appointment_id UUID;
  v_comanda_id UUID;
  v_comanda_item_id UUID;
  v_existing_appointment JSONB;
  v_comanda_status TEXT := 'open';
  v_sub_id UUID;
  v_eligible BOOLEAN := false;
  v_reason TEXT;
  v_avail_credits INTEGER := 0;
  v_plan_preview JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant invalido para criar agendamento';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_current_tenant_id, v_is_super_admin;

  IF NOT COALESCE(v_is_super_admin, false) AND p_tenant_id <> v_current_tenant_id THEN
    RAISE EXCEPTION 'Tenant invalido para criar agendamento';
  END IF;

  IF p_service_id IS NULL OR p_staff_id IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Preencha todos os campos obrigatorios';
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(ts.timezone), ''), 'America/Sao_Paulo')
  INTO v_timezone
  FROM public.tenant_settings ts
  WHERE ts.tenant_id = p_tenant_id
  LIMIT 1;
  v_timezone := COALESCE(v_timezone, 'America/Sao_Paulo');

  IF p_idempotency_key IS NOT NULL THEN
    SELECT jsonb_build_object(
      'appointment_id', a.id,
      'comanda_id', c.id,
      'comanda_item_id', ci.id,
      'service_price', COALESCE(NULLIF(to_jsonb(a)->>'price', '')::numeric, 0),
      'appointment_status', a.status
    ) INTO v_existing_appointment
    FROM public.appointments a
    LEFT JOIN public.comandas c ON c.appointment_id = a.id AND c.tenant_id = a.tenant_id
    LEFT JOIN public.comanda_items ci ON ci.comanda_id = c.id AND ci.tenant_id = a.tenant_id
    WHERE a.idempotency_key = p_idempotency_key AND a.tenant_id = p_tenant_id
    LIMIT 1;

    IF v_existing_appointment IS NOT NULL THEN
      RETURN v_existing_appointment;
    END IF;
  END IF;

  SELECT
    s.name,
    COALESCE(NULLIF(to_jsonb(s)->>'price', '')::numeric, 0),
    COALESCE(
      NULLIF(to_jsonb(s)->>'duration', '')::numeric,
      NULLIF(to_jsonb(s)->>'duration_minutes', '')::numeric,
      30
    )
  INTO v_service_name, v_service_price, v_service_duration_minutes
  FROM public.services s
  WHERE s.id = p_service_id AND s.tenant_id = p_tenant_id
    AND COALESCE(
      NULLIF(to_jsonb(s)->>'active', '')::boolean,
      NULLIF(to_jsonb(s)->>'is_active', '')::boolean,
      true
    ) = true
  LIMIT 1;

  IF v_service_name IS NULL THEN
    RAISE EXCEPTION 'Servico invalido para este tenant';
  END IF;

  SELECT st.name INTO v_staff_name
  FROM public.staff st
  WHERE st.id = p_staff_id AND st.tenant_id = p_tenant_id
    AND lower(COALESCE(st.status, 'active')) = 'active'
  LIMIT 1;

  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'Profissional invalido para este tenant';
  END IF;

  IF p_client_id IS NOT NULL THEN
    SELECT c.name INTO v_client_name
    FROM public.clients c
    WHERE c.id = p_client_id AND c.tenant_id = p_tenant_id
    LIMIT 1;

    IF v_client_name IS NULL THEN
      RAISE EXCEPTION 'Cliente invalido para este tenant';
    END IF;
  END IF;

  v_client_name := NULLIF(BTRIM(COALESCE(p_client_name, v_client_name)), '');
  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Nome do cliente e obrigatorio';
  END IF;

  IF p_price IS NOT NULL AND p_price >= 0 THEN
    v_service_price := p_price;
  END IF;

  v_duration_hours := ROUND((GREATEST(COALESCE(v_service_duration_minutes, 30), 1) / 60.0)::numeric, 2);
  v_end_time := p_start_time + (GREATEST(COALESCE(v_service_duration_minutes, 30), 1) * interval '1 minute');

  IF NOT COALESCE(p_is_overbooked, false) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_staff_id::text, 0));

    IF EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.tenant_id = p_tenant_id
        AND a.staff_id = p_staff_id
        AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
        AND a.end_time > a.start_time
        AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(p_start_time, v_end_time, '[)')
    ) THEN
      RAISE EXCEPTION 'Horário já ocupado para este profissional.' USING ERRCODE = '23P01';
    END IF;
  END IF;

  IF (p_start_time AT TIME ZONE v_timezone)::date > (CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::date THEN
    v_comanda_status := 'blocked';
  END IF;

  IF p_client_id IS NOT NULL AND to_regprocedure('public.preview_plan_credit_for_service(uuid,uuid,uuid,timestamp with time zone)') IS NOT NULL THEN
    SELECT eligible, reason, available_credits, subscription_id
    INTO v_eligible, v_reason, v_avail_credits, v_sub_id
    FROM public.preview_plan_credit_for_service(p_tenant_id, p_client_id, p_service_id, p_start_time)
    LIMIT 1;

    v_plan_preview := jsonb_build_object(
      'service_id', p_service_id,
      'service_name', v_service_name,
      'subscription_id', v_sub_id,
      'eligible', v_eligible,
      'reason', v_reason,
      'available_credits', v_avail_credits,
      'checked_at', now()
    );
  END IF;

  INSERT INTO public.appointments (
    tenant_id,
    client_id,
    service_id,
    staff_id,
    client_name,
    client_phone,
    service_name,
    staff_name,
    start_time,
    end_time,
    duration,
    price,
    notes,
    status,
    idempotency_key,
    is_overbooked,
    subscription_id,
    eligible_for_plan_credit,
    expected_plan_service,
    plan_credit_preview
  )
  VALUES (
    p_tenant_id,
    p_client_id,
    p_service_id,
    p_staff_id,
    v_client_name,
    NULLIF(BTRIM(p_client_phone), ''),
    v_service_name,
    v_staff_name,
    p_start_time,
    v_end_time,
    v_duration_hours,
    v_service_price,
    NULLIF(BTRIM(p_notes), ''),
    'confirmed',
    p_idempotency_key,
    COALESCE(p_is_overbooked, false),
    v_sub_id,
    v_eligible,
    CASE WHEN v_eligible THEN v_service_name ELSE NULL END,
    v_plan_preview
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.comandas (tenant_id, appointment_id, client_id, staff_id, status, total, idempotency_key)
  VALUES (p_tenant_id, v_appointment_id, p_client_id, p_staff_id, v_comanda_status, v_service_price, p_idempotency_key)
  RETURNING id INTO v_comanda_id;

  INSERT INTO public.comanda_items (tenant_id, comanda_id, service_id, product_name, quantity, unit_price, staff_id)
  VALUES (p_tenant_id, v_comanda_id, p_service_id, v_service_name, 1, v_service_price, p_staff_id)
  RETURNING id INTO v_comanda_item_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'comanda_id', v_comanda_id,
    'comanda_item_id', v_comanda_item_id,
    'service_price', v_service_price,
    'appointment_status', 'confirmed',
    'chef_club_eligible', v_eligible,
    'subscription_id', v_sub_id,
    'plan_credit_preview', v_plan_preview
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.create_appointment_with_comanda(UUID, UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_appointment_with_comanda(UUID, UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ── 2. create_appointment_with_services (precisao NUMERIC(4,2)) ───────────────
CREATE OR REPLACE FUNCTION public.create_appointment_with_services(
  p_tenant_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_services JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_current_tenant_id UUID;
  v_is_super_admin BOOLEAN := false;
  v_timezone TEXT := 'America/Sao_Paulo';
  v_client_name TEXT;
  v_staff_name TEXT;
  v_services JSONB;
  v_services_text TEXT;
  v_service_ids UUID[];
  v_service_row RECORD;
  v_first_service_id UUID;
  v_first_service_name TEXT;
  v_total_price NUMERIC(10, 2) := 0;
  v_total_duration_minutes INTEGER := 0;
  v_duration_hours NUMERIC(4, 2) := 1;
  v_end_time TIMESTAMPTZ;
  v_appointment_id UUID;
  v_comanda_id UUID;
  v_comanda_status TEXT := 'open';
  v_sort_order INTEGER := 0;
  v_existing_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant invalido';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_current_tenant_id, v_is_super_admin;

  IF NOT COALESCE(v_is_super_admin, false) AND p_tenant_id <> v_current_tenant_id THEN
    RAISE EXCEPTION 'Tenant invalido';
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(ts.timezone), ''), 'America/Sao_Paulo')
  INTO v_timezone
  FROM public.tenant_settings ts
  WHERE ts.tenant_id = p_tenant_id
  LIMIT 1;
  v_timezone := COALESCE(v_timezone, 'America/Sao_Paulo');

  IF p_services IS NULL THEN
    RAISE EXCEPTION 'Selecione pelo menos um servico';
  END IF;

  IF jsonb_typeof(p_services) = 'array' THEN
    v_services := p_services;
  ELSIF jsonb_typeof(p_services) = 'object' THEN
    v_services := jsonb_build_array(p_services);
  ELSIF jsonb_typeof(p_services) = 'string' THEN
    v_services_text := NULLIF(BTRIM(p_services #>> '{}'), '');

    IF v_services_text IS NULL THEN
      v_services := NULL;
    ELSIF left(v_services_text, 1) IN ('[', '{') THEN
      BEGIN
        v_services := v_services_text::jsonb;
        IF jsonb_typeof(v_services) = 'object' THEN
          v_services := jsonb_build_array(v_services);
        END IF;
      EXCEPTION WHEN others THEN
        v_services := jsonb_build_array(jsonb_build_object('service_name', v_services_text));
      END;
    ELSE
      v_services := jsonb_build_array(jsonb_build_object('service_name', v_services_text));
    END IF;
  ELSE
    v_services := NULL;
  END IF;

  IF v_services IS NULL OR jsonb_array_length(v_services) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um servico';
  END IF;

  IF p_staff_id IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Profissional e horario sao obrigatorios';
  END IF;

  SELECT st.name INTO v_staff_name
  FROM public.staff st
  WHERE st.id = p_staff_id
    AND st.tenant_id = p_tenant_id
    AND lower(COALESCE(st.status, 'active')) = 'active'
  LIMIT 1;

  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'Profissional invalido';
  END IF;

  IF p_client_id IS NOT NULL THEN
    SELECT c.name INTO v_client_name
    FROM public.clients c
    WHERE c.id = p_client_id AND c.tenant_id = p_tenant_id
    LIMIT 1;

    IF v_client_name IS NULL THEN
      RAISE EXCEPTION 'Cliente invalido';
    END IF;
  END IF;

  v_client_name := NULLIF(BTRIM(COALESCE(p_client_name, v_client_name)), '');
  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Nome do cliente obrigatorio';
  END IF;

  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT jsonb_build_object(
      'appointment_id', a.id,
      'comanda_id', c.id,
      'total_price', COALESCE(c.total, COALESCE(a.price, 0)),
      'total_duration_minutes', GREATEST(ROUND(COALESCE(a.duration, 0) * 60)::integer, 0),
      'idempotent', true
    )
    INTO v_existing_result
    FROM public.appointments a
    LEFT JOIN public.comandas c ON c.appointment_id = a.id AND c.tenant_id = a.tenant_id
    WHERE a.tenant_id = p_tenant_id
      AND a.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_existing_result IS NOT NULL THEN
      RETURN v_existing_result;
    END IF;
  END IF;

  WITH requested AS (
    SELECT
      ordinality::integer AS sort_order,
      CASE
        WHEN jsonb_typeof(elem) = 'object' THEN NULLIF(elem->>'service_id', '')
        WHEN jsonb_typeof(elem) = 'string' THEN trim(both '"' from elem::text)
        ELSE NULL
      END AS service_key,
      CASE
        WHEN jsonb_typeof(elem) = 'object' THEN NULLIF(BTRIM(COALESCE(elem->>'service_name', elem->>'name')), '')
        WHEN jsonb_typeof(elem) = 'string' THEN trim(both '"' from elem::text)
        ELSE NULL
      END AS service_name
    FROM jsonb_array_elements(v_services) WITH ORDINALITY AS e(elem, ordinality)
  )
  SELECT array_agg(s.id ORDER BY requested.sort_order)
  INTO v_service_ids
  FROM requested
  JOIN public.services s
    ON s.tenant_id = p_tenant_id
   AND (
      (requested.service_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND s.id = requested.service_key::uuid)
      OR lower(s.name) = lower(COALESCE(requested.service_name, requested.service_key))
    )
   AND COALESCE(
      NULLIF(to_jsonb(s)->>'active', '')::boolean,
      NULLIF(to_jsonb(s)->>'is_active', '')::boolean,
      true
    ) = true;

  IF array_length(v_service_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum servico valido encontrado para este tenant';
  END IF;

  v_total_price := 0;
  v_total_duration_minutes := 0;
  v_sort_order := 0;

  FOR v_service_row IN
    SELECT
      s.id,
      s.name,
      COALESCE(NULLIF(to_jsonb(s)->>'price', '')::numeric, 0) AS unit_price,
      COALESCE(
        NULLIF(to_jsonb(s)->>'duration', '')::numeric,
        NULLIF(to_jsonb(s)->>'duration_minutes', '')::numeric,
        30
      )::integer AS duration_minutes,
      COALESCE(NULLIF(to_jsonb(s)->>'buffer', '')::numeric, 0)::integer AS buffer_minutes
    FROM unnest(v_service_ids) WITH ORDINALITY AS ids(service_id, ordinality)
    JOIN public.services s ON s.id = ids.service_id
    WHERE s.tenant_id = p_tenant_id
    ORDER BY ids.ordinality
  LOOP
    IF v_sort_order = 0 THEN
      v_first_service_id := v_service_row.id;
      v_first_service_name := v_service_row.name;
    END IF;

    v_total_price := v_total_price + COALESCE(v_service_row.unit_price, 0);
    v_total_duration_minutes := v_total_duration_minutes
      + COALESCE(v_service_row.duration_minutes, 30)
      + COALESCE(v_service_row.buffer_minutes, 0);
    v_sort_order := v_sort_order + 1;
  END LOOP;

  IF v_first_service_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum servico valido encontrado';
  END IF;

  v_duration_hours := ROUND((GREATEST(v_total_duration_minutes, 15)::numeric / 60.0), 2);
  v_end_time := p_start_time + (v_total_duration_minutes || ' minutes')::interval;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_staff_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.tenant_id = p_tenant_id
      AND a.staff_id = p_staff_id
      AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
      AND a.end_time > a.start_time
      AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(p_start_time, v_end_time, '[)')
  ) THEN
    RAISE EXCEPTION 'Horário já ocupado para este profissional.' USING ERRCODE = '23P01';
  END IF;

  IF (p_start_time AT TIME ZONE v_timezone)::date > (CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::date THEN
    v_comanda_status := 'blocked';
  END IF;

  INSERT INTO public.appointments (
    tenant_id,
    client_id,
    service_id,
    staff_id,
    client_name,
    client_phone,
    service_name,
    staff_name,
    start_time,
    end_time,
    duration,
    price,
    status,
    notes,
    idempotency_key
  )
  VALUES (
    p_tenant_id,
    p_client_id,
    v_first_service_id,
    p_staff_id,
    v_client_name,
    NULLIF(BTRIM(p_client_phone), ''),
    v_first_service_name,
    v_staff_name,
    p_start_time,
    v_end_time,
    v_duration_hours,
    v_total_price,
    'confirmed',
    NULLIF(BTRIM(p_notes), ''),
    p_idempotency_key
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.comandas (
    tenant_id,
    appointment_id,
    client_id,
    staff_id,
    status,
    total,
    idempotency_key
  )
  VALUES (
    p_tenant_id,
    v_appointment_id,
    p_client_id,
    p_staff_id,
    v_comanda_status,
    v_total_price,
    p_idempotency_key
  )
  RETURNING id INTO v_comanda_id;

  v_sort_order := 0;

  FOR v_service_row IN
    SELECT
      s.id,
      s.name,
      COALESCE(NULLIF(to_jsonb(s)->>'price', '')::numeric, 0) AS unit_price,
      COALESCE(
        NULLIF(to_jsonb(s)->>'duration', '')::numeric,
        NULLIF(to_jsonb(s)->>'duration_minutes', '')::numeric,
        30
      )::integer AS duration_minutes
    FROM unnest(v_service_ids) WITH ORDINALITY AS ids(service_id, ordinality)
    JOIN public.services s ON s.id = ids.service_id
    WHERE s.tenant_id = p_tenant_id
    ORDER BY ids.ordinality
  LOOP
    INSERT INTO public.comanda_items (
      tenant_id,
      comanda_id,
      service_id,
      product_name,
      quantity,
      unit_price,
      staff_id
    )
    VALUES (
      p_tenant_id,
      v_comanda_id,
      v_service_row.id,
      v_service_row.name,
      1,
      v_service_row.unit_price,
      p_staff_id
    );

    IF to_regclass('public.appointment_services') IS NOT NULL THEN
      INSERT INTO public.appointment_services (
        tenant_id,
        appointment_id,
        service_id,
        unit_price,
        duration_minutes,
        quantity,
        sort_order
      )
      VALUES (
        p_tenant_id,
        v_appointment_id,
        v_service_row.id,
        v_service_row.unit_price,
        v_service_row.duration_minutes,
        1,
        v_sort_order
      );
    END IF;

    v_sort_order := v_sort_order + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'comanda_id', v_comanda_id,
    'total_price', v_total_price,
    'total_duration_minutes', v_total_duration_minutes,
    'idempotent', false
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.create_appointment_with_services(UUID, UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_appointment_with_services(UUID, UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, JSONB) TO authenticated;

-- ── 3. Ajuste pontual em agendamentos ativos futuros (0.8 -> 0.75 p/ 45m) ─────
UPDATE public.appointments a
SET
  duration = 0.75,
  end_time = a.start_time + interval '45 minutes'
FROM public.services s
WHERE a.service_id = s.id
  AND a.tenant_id = s.tenant_id
  AND a.duration = 0.8
  AND a.start_time >= CURRENT_DATE
  AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
  AND COALESCE(
    NULLIF(to_jsonb(s)->>'duration', '')::numeric,
    NULLIF(to_jsonb(s)->>'duration_minutes', '')::numeric
  ) = 45;
