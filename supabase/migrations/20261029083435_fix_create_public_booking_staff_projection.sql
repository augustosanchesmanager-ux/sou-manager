CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_tenant_identifier TEXT,
  p_staff_id UUID,
  p_service_ids UUID[],
  p_start_time TIMESTAMPTZ,
  p_client_name TEXT,
  p_client_phone TEXT,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_tenant_id UUID;
  v_settings RECORD;
  v_obs RECORD;
  v_appointment_id UUID;
  v_client_id UUID;
  v_end_time TIMESTAMPTZ;
  v_total_duration INTEGER := 0;
  v_service_id UUID;
  v_existing_idempotent RECORD;
  v_public_token TEXT;
  v_token_hash VARCHAR(255);
  v_token_id UUID;
  v_token_expires_at TIMESTAMPTZ;
BEGIN
  IF p_tenant_identifier IS NULL OR btrim(p_tenant_identifier) = '' THEN
    RAISE EXCEPTION 'tenant_required' USING ERRCODE = 'P0001';
  END IF;

  v_tenant_id := public.resolve_public_booking_tenant_id(p_tenant_identifier);

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_settings FROM public.tenant_settings WHERE tenant_id = v_tenant_id;
  SELECT * INTO v_obs FROM public.online_booking_settings WHERE tenant_id = v_tenant_id;

  IF NOT COALESCE(v_obs.is_active, v_settings.booking_enabled, false) THEN
    RAISE EXCEPTION 'booking_disabled' USING ERRCODE = 'P0001';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT a.id, a.client_id, a.staff_id, a.start_time, a.end_time, a.status, a.notes
      INTO v_existing_idempotent
      FROM public.appointments a
     WHERE a.tenant_id = v_tenant_id
       AND a.idempotency_key = p_idempotency_key
     LIMIT 1;

    IF v_existing_idempotent.id IS NOT NULL THEN
      SELECT t.id, t.expires_at INTO v_token_id, v_token_expires_at
        FROM public.public_booking_tokens t
       WHERE t.appointment_id = v_existing_idempotent.id
       ORDER BY t.created_at DESC LIMIT 1;

      RETURN jsonb_build_object(
        'appointment_id', v_existing_idempotent.id,
        'client_id', v_existing_idempotent.client_id,
        'status', v_existing_idempotent.status,
        'public_token', NULL,
        'public_token_id', v_token_id,
        'expires_at', v_token_expires_at,
        'services', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('service_id', s.id, 'name', s.name, 'duration', aps.duration_minutes, 'price', aps.unit_price) ORDER BY aps.sort_order), '[]'::jsonb)
            FROM public.appointment_services aps
            JOIN public.services s ON s.id = aps.service_id
           WHERE aps.appointment_id = v_existing_idempotent.id
        ),
        'staff', (SELECT jsonb_build_object('id', st.id, 'name', st.name) FROM public.staff st WHERE st.id = v_existing_idempotent.staff_id),
        'start_time', v_existing_idempotent.start_time,
        'end_time', v_existing_idempotent.end_time,
        'idempotent', true
      );
    END IF;
  END IF;

  IF p_staff_id IS NULL OR p_service_ids IS NULL OR array_length(p_service_ids, 1) = 0 THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  IF btrim(COALESCE(p_client_name, '')) = '' THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  IF regexp_replace(COALESCE(p_client_phone, ''), '\D', '', 'g') !~ '^\d{10,13}$' THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  IF p_start_time < now() + (COALESCE(v_settings.min_booking_notice_minutes, 30) || ' minutes')::interval THEN
    RAISE EXCEPTION 'booking_too_soon' USING ERRCODE = 'P0001';
  END IF;

  IF p_start_time::date > CURRENT_DATE + COALESCE(v_settings.booking_horizon_days, 30) THEN
    RAISE EXCEPTION 'booking_too_far' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(s.duration), 0) INTO v_total_duration
    FROM public.services s
   WHERE s.id = ANY(p_service_ids) AND s.active = true;

  IF v_total_duration = 0 THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  v_end_time := p_start_time + (v_total_duration || ' minutes')::interval;

  IF NOT EXISTS (
    SELECT 1 FROM public.staff st
     WHERE st.id = p_staff_id
       AND st.tenant_id = v_tenant_id
       AND st.status = 'active'
       AND lower(st.role) IN ('barber', 'manager')
  ) THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || p_staff_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.appointments a
     WHERE a.tenant_id = v_tenant_id
       AND a.staff_id = p_staff_id
       AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show', 'completed')
       AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(p_start_time, v_end_time, '[)')
  ) THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments a
     WHERE a.tenant_id = v_tenant_id
       AND regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g') = regexp_replace(p_client_phone, '\D', '', 'g')
       AND a.source = 'booking_web'
       AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
       AND a.created_at > now() - interval '10 minutes'
  ) THEN
    RAISE EXCEPTION 'rate_limit' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_client_id
    FROM public.clients c
   WHERE c.tenant_id = v_tenant_id
     AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = regexp_replace(p_client_phone, '\D', '', 'g')
   LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (tenant_id, name, phone)
    VALUES (v_tenant_id, p_client_name, p_client_phone)
    RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO public.appointments (
    tenant_id,
    client_id,
    client_name,
    client_phone,
    staff_id,
    start_time,
    end_time,
    duration,
    status,
    notes,
    source,
    idempotency_key
  ) VALUES (
    v_tenant_id,
    v_client_id,
    p_client_name,
    p_client_phone,
    p_staff_id,
    p_start_time,
    v_end_time,
    v_total_duration,
    CASE WHEN COALESCE(v_settings.auto_confirm_online_bookings, true) THEN 'confirmed' ELSE 'pending' END,
    p_notes,
    'booking_web',
    p_idempotency_key
  ) RETURNING id INTO v_appointment_id;

  FOREACH v_service_id IN ARRAY p_service_ids LOOP
    INSERT INTO public.appointment_services (
      tenant_id,
      appointment_id,
      service_id,
      duration_minutes,
      unit_price
    )
    SELECT
      v_tenant_id,
      v_appointment_id,
      s.id,
      s.duration,
      s.price
    FROM public.services s
    WHERE s.id = v_service_id;
  END LOOP;

  v_public_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_public_token, 'sha256'), 'hex');
  v_token_expires_at := v_end_time + interval '30 days';

  INSERT INTO public.public_booking_tokens (
    tenant_id,
    appointment_id,
    token_hash,
    expires_at
  ) VALUES (
    v_tenant_id,
    v_appointment_id,
    v_token_hash,
    v_token_expires_at
  ) RETURNING id INTO v_token_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'client_id', v_client_id,
    'status', CASE WHEN COALESCE(v_settings.auto_confirm_online_bookings, true) THEN 'confirmed' ELSE 'pending' END,
    'public_token', v_public_token,
    'public_token_id', v_token_id,
    'expires_at', v_token_expires_at,
    'services', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('service_id', s.id, 'name', s.name, 'duration', aps.duration_minutes, 'price', aps.unit_price) ORDER BY aps.sort_order), '[]'::jsonb)
        FROM public.appointment_services aps
        JOIN public.services s ON s.id = aps.service_id
       WHERE aps.appointment_id = v_appointment_id
    ),
    'staff', (SELECT jsonb_build_object('id', st.id, 'name', st.name) FROM public.staff st WHERE st.id = p_staff_id),
    'start_time', p_start_time,
    'end_time', v_end_time,
    'idempotent', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';