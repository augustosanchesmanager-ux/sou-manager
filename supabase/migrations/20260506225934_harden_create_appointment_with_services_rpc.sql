BEGIN;

DROP FUNCTION IF EXISTS public.create_appointment_with_services(UUID, UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.create_appointment_with_services(
  p_tenant_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_services JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_current_tenant_id UUID;
  v_is_super_admin BOOLEAN := false;
  v_client_name TEXT;
  v_staff_name TEXT;
  v_services JSONB;
  v_service_ids UUID[];
  v_first_service_id UUID;
  v_first_service_name TEXT;
  v_total_price NUMERIC(10, 2) := 0;
  v_total_duration_minutes INTEGER := 0;
  v_duration_hours NUMERIC(3, 1) := 1;
  v_appointment_id UUID;
  v_comanda_id UUID;
  v_comanda_item_id UUID;
  v_service_row RECORD;
  v_sort_order INTEGER := 0;
  v_existing_result JSONB;
  v_comanda_status TEXT := 'open';
  v_services_text TEXT;
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

  v_duration_hours := ROUND((GREATEST(v_total_duration_minutes, 15)::numeric / 60.0), 1);

  IF p_start_time::date > current_date THEN
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
    p_start_time + (v_duration_hours * interval '1 hour'),
    v_duration_hours,
    v_total_price,
    'confirmed',
    NULLIF(BTRIM(p_notes), ''),
    p_idempotency_key
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.comandas (tenant_id, appointment_id, client_id, staff_id, status, total, idempotency_key)
  VALUES (p_tenant_id, v_appointment_id, p_client_id, p_staff_id, v_comanda_status, v_total_price, p_idempotency_key)
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
      )::integer AS duration_minutes,
      COALESCE(NULLIF(to_jsonb(s)->>'buffer', '')::numeric, 0)::integer AS buffer_minutes
    FROM unnest(v_service_ids) WITH ORDINALITY AS ids(service_id, ordinality)
    JOIN public.services s ON s.id = ids.service_id
    WHERE s.tenant_id = p_tenant_id
    ORDER BY ids.ordinality
  LOOP
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
      COALESCE(v_service_row.unit_price, 0),
      COALESCE(v_service_row.duration_minutes, 30) + COALESCE(v_service_row.buffer_minutes, 0),
      1,
      v_sort_order
    );

    INSERT INTO public.comanda_items (tenant_id, comanda_id, service_id, product_name, quantity, unit_price, staff_id)
    VALUES (p_tenant_id, v_comanda_id, v_service_row.id, v_service_row.name, 1, COALESCE(v_service_row.unit_price, 0), p_staff_id)
    RETURNING id INTO v_comanda_item_id;

    v_sort_order := v_sort_order + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'comanda_id', v_comanda_id,
    'comanda_item_id', v_comanda_item_id,
    'total_price', v_total_price,
    'service_price', v_total_price,
    'total_duration_minutes', v_total_duration_minutes,
    'appointment_status', 'confirmed',
    'idempotent', false
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.create_appointment_with_services(UUID, UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_appointment_with_services(UUID, UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
