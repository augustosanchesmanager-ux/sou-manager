-- ============================================================================
-- Migration: Filter technical staff (barber, manager) in public booking RPCs
-- Date: 2026-10-28
-- Description: Excludes administrative roles (admin, receptionist) from public
--              booking staff selection, available slots, and appointment creation.
-- ============================================================================

-- 1. Update public.get_public_tenant_profile
CREATE OR REPLACE FUNCTION public.get_public_tenant_profile(
  p_tenant_identifier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant RECORD;
  v_tenant_json JSONB;
  v_settings RECORD;
  v_services JSONB;
  v_staff JSONB;
  v_address TEXT;
  v_instagram TEXT;
  v_whatsapp TEXT;
  v_maps TEXT;
  v_website TEXT;
BEGIN
  IF p_tenant_identifier IS NULL OR btrim(p_tenant_identifier) = '' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_tenant_id
    FROM public.tenants
   WHERE slug = btrim(p_tenant_identifier)
      OR id::text = btrim(p_tenant_identifier)
   LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = v_tenant_id;
  v_tenant_json := to_jsonb(v_tenant);

  SELECT * INTO v_settings FROM public.tenant_settings WHERE tenant_id = v_tenant_id;

  IF NOT COALESCE(v_settings.booking_enabled, false) THEN
    RETURN NULL;
  END IF;

  v_instagram := NULLIF(btrim(COALESCE(v_settings.instagram_url, v_tenant_json #>> '{social_links,instagram}', '')), '');
  v_whatsapp  := NULLIF(btrim(COALESCE(v_settings.whatsapp_number, v_tenant_json #>> '{social_links,whatsapp}', '')), '');
  v_maps      := NULLIF(btrim(COALESCE(v_settings.maps_url, '')), '');
  v_website   := NULLIF(btrim(COALESCE(v_tenant_json #>> '{social_links,website}', '')), '');

  v_address := COALESCE(
    NULLIF(btrim(COALESCE(v_tenant_json ->> 'address', '')), ''),
    NULLIF(btrim(concat_ws(', ',
      NULLIF(btrim(COALESCE(v_settings.address_street, '')), ''),
      NULLIF(btrim(COALESCE(v_settings.address_number, '')), ''),
      NULLIF(btrim(COALESCE(v_settings.address_city, '')), ''),
      NULLIF(btrim(COALESCE(v_settings.address_state, '')), '')
    )), '')
  );

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'price', s.price,
      'duration', s.duration,
      'active', s.active,
      'category', s.category
    ) ORDER BY s.name ASC
  ), '[]'::jsonb) INTO v_services
    FROM public.services s
   WHERE s.tenant_id = v_tenant_id
     AND s.active = true
     AND COALESCE(s.show_in_booking, true) = true;

  -- Retorna apenas perfis técnicos (barbeiro e gerente operacional) para atendimento
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', st.id,
      'name', st.name,
      'status', st.status,
      'role', st.role,
      'avatar_url', st.avatar
    )
    ORDER BY st.name
  ), '[]'::jsonb) INTO v_staff
    FROM public.staff st
   WHERE st.tenant_id = v_tenant_id
     AND st.status = 'active'
     AND lower(st.role) IN ('barber', 'manager');

  RETURN jsonb_build_object(
    'tenant_id', v_tenant.id,
    'name', v_tenant.name,
    'slug', v_tenant.slug,
    'logo_url', v_tenant_json ->> 'logo_url',
    'address', v_address,
    'phone', COALESCE(NULLIF(btrim(COALESCE(v_settings.phone, '')), ''), v_tenant_json ->> 'phone'),
    'instagram_url', v_instagram,
    'whatsapp_number', v_whatsapp,
    'maps_url', v_maps,
    'social_links', jsonb_build_object(
      'instagram', COALESCE(v_instagram, ''),
      'whatsapp', COALESCE(v_whatsapp, ''),
      'website', COALESCE(v_website, ''),
      'maps_url', COALESCE(v_maps, '')
    ),
    'booking_enabled', COALESCE(v_settings.booking_enabled, false),
    'booking_rules', jsonb_build_object(
      'horizon_days', COALESCE(v_settings.booking_horizon_days, 30),
      'min_booking_notice_minutes', COALESCE(v_settings.min_booking_notice_minutes, 30),
      'auto_confirm_online_bookings', COALESCE(v_settings.auto_confirm_online_bookings, true),
      'public_cancel_window_minutes', COALESCE(v_settings.public_cancel_window_minutes, 120),
      'appointment_interval_minutes', COALESCE(v_settings.appointment_interval_minutes, 30),
      'default_appointment_duration_minutes', COALESCE(v_settings.default_appointment_duration_minutes, 60),
      'timezone', COALESCE(v_settings.timezone, 'America/Sao_Paulo')
    ),
    'services', v_services,
    'staff', v_staff
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_tenant_profile(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_tenant_profile(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_profile(TEXT) TO anon, authenticated;

-- 2. Update public.get_public_available_slots
CREATE OR REPLACE FUNCTION public.get_public_available_slots(
  p_tenant_identifier TEXT,
  p_staff_id UUID DEFAULT NULL,
  p_service_ids UUID[] DEFAULT NULL,
  p_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_tenant_id UUID;
  v_settings RECORD;
  v_date DATE := COALESCE(p_date, CURRENT_DATE);
  v_timezone TEXT := 'America/Sao_Paulo';
  v_horizon_days INTEGER;
  v_min_notice INTEGER;
  v_interval INTEGER;
  v_work_start TIME;
  v_work_end TIME;
  v_total_duration INTEGER := 0;
  v_staff_list UUID[];
  v_staff_id UUID;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_max_date DATE;
  v_result JSONB := '[]'::jsonb;
  v_seen_slots JSONB := '{}'::jsonb;
BEGIN
  IF p_tenant_identifier IS NULL OR btrim(p_tenant_identifier) = '' THEN
    RETURN jsonb_build_object('date', v_date, 'timezone', v_timezone, 'interval_minutes', 30, 'slots', '[]'::jsonb);
  END IF;

  SELECT id INTO v_tenant_id
    FROM public.tenants
   WHERE slug = btrim(p_tenant_identifier)
      OR id::text = btrim(p_tenant_identifier)
   LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('date', v_date, 'timezone', v_timezone, 'interval_minutes', 30, 'slots', '[]'::jsonb);
  END IF;

  SELECT * INTO v_settings FROM public.tenant_settings WHERE tenant_id = v_tenant_id;

  v_timezone := COALESCE(v_settings.timezone, 'America/Sao_Paulo');
  v_horizon_days := COALESCE(v_settings.booking_horizon_days, 30);
  v_min_notice := COALESCE(v_settings.min_booking_notice_minutes, 30);
  v_interval := COALESCE(v_settings.appointment_interval_minutes, 30);
  v_work_start := COALESCE(v_settings.work_start_time, '07:00:00'::time);
  v_work_end := COALESCE(v_settings.work_end_time, '20:00:00'::time);
  v_max_date := CURRENT_DATE + v_horizon_days;

  IF v_date > v_max_date OR v_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('date', v_date, 'timezone', v_timezone, 'interval_minutes', v_interval, 'slots', '[]'::jsonb);
  END IF;

  IF p_service_ids IS NOT NULL AND array_length(p_service_ids, 1) > 0 THEN
    SELECT COALESCE(SUM(s.duration), 0) INTO v_total_duration
      FROM public.services s
     WHERE s.id = ANY(p_service_ids) AND s.active = true;
  END IF;

  IF v_total_duration = 0 THEN
    SELECT COALESCE(s.duration, 60) INTO v_total_duration
      FROM public.services s
     WHERE s.tenant_id = v_tenant_id AND s.active = true
     ORDER BY s.sort_order LIMIT 1;
    v_total_duration := COALESCE(v_total_duration, 60);
  END IF;

  IF p_staff_id IS NOT NULL THEN
    -- Valida se o profissional solicitado existe, está ativo e é técnico (barber ou manager)
    SELECT st.id INTO v_staff_id
      FROM public.staff st
     WHERE st.id = p_staff_id
       AND st.tenant_id = v_tenant_id
       AND st.status = 'active'
       AND lower(st.role) IN ('barber', 'manager');

    IF v_staff_id IS NOT NULL THEN
      v_staff_list := ARRAY[v_staff_id];
    ELSE
      v_staff_list := ARRAY[]::uuid[];
    END IF;
  ELSE
    SELECT ARRAY_AGG(st.id) INTO v_staff_list
      FROM public.staff st
     WHERE st.tenant_id = v_tenant_id
       AND st.status = 'active'
       AND lower(st.role) IN ('barber', 'manager');
  END IF;

  IF v_staff_list IS NULL OR array_length(v_staff_list, 1) IS NULL THEN
    RETURN jsonb_build_object('date', v_date, 'timezone', v_timezone, 'interval_minutes', v_interval, 'slots', '[]'::jsonb);
  END IF;

  FOREACH v_staff_id IN ARRAY v_staff_list LOOP
    v_slot_start := (v_date + v_work_start) AT TIME ZONE v_timezone;
    v_slot_end := v_slot_start + (v_interval || ' minutes')::interval;

    WHILE v_slot_end <= (v_date + v_work_end) AT TIME ZONE v_timezone LOOP
      IF v_slot_start >= v_now + (v_min_notice || ' minutes')::interval THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.appointments a
           WHERE a.tenant_id = v_tenant_id
             AND a.staff_id = v_staff_id
             AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show', 'completed')
             AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(v_slot_start, v_slot_start + (v_total_duration || ' minutes')::interval, '[)')
        ) AND NOT EXISTS (
          SELECT 1 FROM public.schedule_blocks sb
           WHERE sb.tenant_id = v_tenant_id
             AND sb.status = 'active'
             AND sb.start_date <= v_date AND sb.end_date >= v_date
             AND (sb.professional_id IS NULL OR sb.professional_id = v_staff_id)
             AND (
               sb.block_type = 'full_day'
               OR (sb.start_time IS NOT NULL AND sb.end_time IS NOT NULL
                   AND tstzrange((v_date + sb.start_time) AT TIME ZONE v_timezone, (v_date + sb.end_time) AT TIME ZONE v_timezone, '[)')
                       && tstzrange(v_slot_start, v_slot_start + (v_total_duration || ' minutes')::interval, '[)'))
             )
        ) THEN
          IF NOT v_seen_slots ? (v_staff_id::text || ':' || v_slot_start::text) THEN
            v_result := v_result || jsonb_build_object(
              'staff_id', v_staff_id,
              'start_time', v_slot_start,
              'end_time', v_slot_start + (v_total_duration || ' minutes')::interval,
              'available', true
            );
            v_seen_slots := v_seen_slots || jsonb_build_object(v_staff_id::text || ':' || v_slot_start::text, true);
          END IF;
        END IF;
      END IF;

      v_slot_start := v_slot_end;
      v_slot_end := v_slot_start + (v_interval || ' minutes')::interval;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'date', v_date,
    'timezone', v_timezone,
    'interval_minutes', v_interval,
    'slots', v_result
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_available_slots(TEXT, UUID, UUID[], DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_available_slots(TEXT, UUID, UUID[], DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_available_slots(TEXT, UUID, UUID[], DATE) TO anon, authenticated;

-- 3. Update public.create_public_booking to enforce technical staff role check
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

  SELECT id INTO v_tenant_id
    FROM public.tenants
   WHERE slug = btrim(p_tenant_identifier)
      OR id::text = btrim(p_tenant_identifier)
   LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_settings FROM public.tenant_settings WHERE tenant_id = v_tenant_id;

  IF NOT COALESCE(v_settings.booking_enabled, false) THEN
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

  -- Garante que o profissional existe, está ativo e é de perfil técnico (barber ou manager)
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

REVOKE EXECUTE ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
