-- Migration: 20261017185000_enrich_public_online_booking_appointments_and_comandas.sql
-- Description: Enriquecimento de metadados em public.appointments (service_name, staff_name, price, duration)
--              e criacao automatica de comandas e comanda_items na RPC create_public_booking,
--              alem de sincronizacao de cancelamento em cancel_public_booking e saneamento retroativo.
-- Auditoria (PO):
--   1. Conversao de timezone para 'America/Sao_Paulo' na comparacao de data de inicio (comanda.status open vs blocked).
--   2. Inclusao de AND COALESCE(s.show_in_booking, true) = true nas queries de servicos em create_public_booking.
--   3. Inclusao explicita de AND tenant_id = v_tenant_id nos UPDATEs de cancel_public_booking.

BEGIN;

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
  v_timezone TEXT := 'America/Sao_Paulo';
  v_appointment_id UUID;
  v_client_id UUID;
  v_end_time TIMESTAMPTZ;
  v_total_duration INTEGER := 0;
  v_duration_hours NUMERIC(4, 2) := 1;
  v_total_price NUMERIC(10, 2) := 0;
  v_service_names TEXT;
  v_first_service_id UUID;
  v_staff_name TEXT;
  v_comanda_id UUID;
  v_comanda_status TEXT := 'open';
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
  v_timezone := COALESCE(v_settings.timezone, 'America/Sao_Paulo');

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

  IF (p_start_time AT TIME ZONE v_timezone)::date > (CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::date + COALESCE(v_settings.booking_horizon_days, 30) THEN
    RAISE EXCEPTION 'booking_too_far' USING ERRCODE = 'P0001';
  END IF;

  -- Obter nome do profissional
  SELECT st.name INTO v_staff_name
    FROM public.staff st
   WHERE st.id = p_staff_id AND st.tenant_id = v_tenant_id AND st.status = 'active';

  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  -- Calcular total de duracao, preco, nomes dos servicos e primeiro servico
  -- Filtrando estritamente servicos ativos e liberados para vitrine online (show_in_booking)
  SELECT
    COALESCE(SUM(s.duration), 0),
    COALESCE(SUM(s.price), 0),
    string_agg(s.name, ', ' ORDER BY ord.ordinality),
    (ARRAY_AGG(s.id ORDER BY ord.ordinality))[1]
  INTO v_total_duration, v_total_price, v_service_names, v_first_service_id
  FROM public.services s
  JOIN unnest(p_service_ids) WITH ORDINALITY AS ord(val, ordinality) ON s.id = ord.val
  WHERE s.tenant_id = v_tenant_id
    AND s.active = true
    AND COALESCE(s.show_in_booking, true) = true;

  IF v_total_duration = 0 THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  v_duration_hours := ROUND((v_total_duration::numeric / 60.0), 2);
  v_end_time := p_start_time + (v_total_duration || ' minutes')::interval;

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
    RAISE EXCEPTION 'rate_limit_exceeded' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_client_id
    FROM public.clients c
   WHERE c.tenant_id = v_tenant_id
     AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = regexp_replace(p_client_phone, '\D', '', 'g')
   ORDER BY c.created_at ASC
   LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (tenant_id, name, phone)
    VALUES (v_tenant_id, btrim(p_client_name), regexp_replace(p_client_phone, '\D', '', 'g'))
    RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO public.appointments (
    tenant_id, client_id, service_id, staff_id, client_name, client_phone,
    service_name, staff_name, start_time, end_time, duration, price,
    status, source, channel, notes, idempotency_key
  ) VALUES (
    v_tenant_id, v_client_id, v_first_service_id, p_staff_id, btrim(p_client_name), regexp_replace(p_client_phone, '\D', '', 'g'),
    COALESCE(v_service_names, ''), COALESCE(v_staff_name, ''), p_start_time, v_end_time, v_duration_hours, v_total_price,
    CASE WHEN COALESCE(v_settings.auto_confirm_online_bookings, true) THEN 'confirmed' ELSE 'pending' END,
    'booking_web', 'site', p_notes, p_idempotency_key
  ) RETURNING id INTO v_appointment_id;

  INSERT INTO public.appointment_services (tenant_id, appointment_id, service_id, unit_price, duration_minutes, quantity, sort_order)
    SELECT v_tenant_id, v_appointment_id, s.id, s.price, s.duration, 1, ord.ordinality
      FROM public.services s
      JOIN unnest(p_service_ids) WITH ORDINALITY AS ord(val, ordinality) ON s.id = ord.val
     WHERE s.tenant_id = v_tenant_id
       AND s.active = true
       AND COALESCE(s.show_in_booking, true) = true;

  -- Criacao da Comanda Vinculada (regra padrao SMG com blindagem de fuso horario local)
  IF (p_start_time AT TIME ZONE v_timezone)::date > (CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::date THEN
    v_comanda_status := 'blocked';
  ELSE
    v_comanda_status := 'open';
  END IF;

  INSERT INTO public.comandas (
    tenant_id, appointment_id, client_id, staff_id, status, total, idempotency_key
  ) VALUES (
    v_tenant_id, v_appointment_id, v_client_id, p_staff_id, v_comanda_status, v_total_price, p_idempotency_key
  ) RETURNING id INTO v_comanda_id;

  INSERT INTO public.comanda_items (
    tenant_id, comanda_id, service_id, product_name, quantity, unit_price, staff_id
  )
  SELECT
    v_tenant_id,
    v_comanda_id,
    s.id,
    s.name,
    1,
    s.price,
    p_staff_id
  FROM public.services s
  JOIN unnest(p_service_ids) WITH ORDINALITY AS ord(val, ordinality) ON s.id = ord.val
  WHERE s.tenant_id = v_tenant_id
    AND s.active = true
    AND COALESCE(s.show_in_booking, true) = true;

  v_public_token := encode(extensions.gen_random_bytes(32), 'base64');
  v_token_hash := encode(extensions.digest(btrim(v_public_token), 'sha256'), 'hex');
  v_token_expires_at := now() + interval '90 days';

  INSERT INTO public.public_booking_tokens (
    tenant_id, appointment_id, token_hash, expires_at
  ) VALUES (
    v_tenant_id, v_appointment_id, v_token_hash, v_token_expires_at
  ) RETURNING id INTO v_token_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'client_id', v_client_id,
    'status', CASE WHEN COALESCE(v_settings.auto_confirm_online_bookings, true) THEN 'confirmed' ELSE 'pending' END,
    'public_token', v_public_token,
    'public_token_id', v_token_id,
    'expires_at', v_token_expires_at,
    'services', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('service_id', s.id, 'name', s.name, 'duration', s.duration, 'price', s.price) ORDER BY s.name), '[]'::jsonb)
        FROM public.services s
       WHERE s.id = ANY(p_service_ids)
         AND s.tenant_id = v_tenant_id
         AND s.active = true
         AND COALESCE(s.show_in_booking, true) = true
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

-- Atualizar cancel_public_booking para cascatear o cancelamento para a comanda vinculada com tenant_id explicito
CREATE OR REPLACE FUNCTION public.cancel_public_booking(
  p_tenant_identifier TEXT,
  p_public_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_tenant_id UUID;
  v_token RECORD;
  v_appointment RECORD;
  v_cancel_window INTEGER;
BEGIN
  IF p_tenant_identifier IS NULL OR btrim(p_tenant_identifier) = '' OR p_public_token IS NULL OR btrim(p_public_token) = '' THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_tenant_id
    FROM public.tenants
   WHERE slug = btrim(p_tenant_identifier)
      OR id::text = btrim(p_tenant_identifier)
   LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.id, t.appointment_id, t.expires_at, t.revoked_at, a.status, a.start_time, a.staff_id
    INTO v_token
    FROM public.public_booking_tokens t
    JOIN public.appointments a ON a.id = t.appointment_id AND a.tenant_id = v_tenant_id
   WHERE t.tenant_id = v_tenant_id
     AND t.token_hash = encode(extensions.digest(btrim(p_public_token), 'sha256'), 'hex')
   LIMIT 1;

  IF v_token.id IS NULL THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;

  IF v_token.expires_at <= now() THEN
    RAISE EXCEPTION 'token_expired' USING ERRCODE = 'P0001';
  END IF;

  IF v_token.revoked_at IS NOT NULL AND v_token.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'appointment_id', v_token.appointment_id,
      'status', 'cancelled',
      'cancelled_at', (SELECT cancelled_at FROM public.appointments WHERE id = v_token.appointment_id AND tenant_id = v_tenant_id),
      'cancelled', true,
      'idempotent', true
    );
  END IF;

  IF v_token.revoked_at IS NOT NULL AND v_token.status != 'cancelled' THEN
    RAISE EXCEPTION 'token_revoked' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(ts.public_cancel_window_minutes, 120) INTO v_cancel_window
    FROM public.tenant_settings ts WHERE ts.tenant_id = v_tenant_id;

  IF now() > v_token.start_time - (v_cancel_window || ' minutes')::interval THEN
    RAISE EXCEPTION 'cancellation_window_closed' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || v_token.staff_id::text, 0));

  UPDATE public.appointments
     SET status = 'cancelled', cancelled_at = now(), cancellation_type = NULL
   WHERE id = v_token.appointment_id
     AND tenant_id = v_tenant_id
     AND lower(coalesce(status, 'pending')) NOT IN ('cancelled', 'no_show', 'completed');

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'appointment_id', v_token.appointment_id,
      'status', 'cancelled',
      'cancelled_at', (SELECT cancelled_at FROM public.appointments WHERE id = v_token.appointment_id AND tenant_id = v_tenant_id),
      'cancelled', true,
      'idempotent', true
    );
  END IF;

  -- Cancelar comanda vinculada com tenant_id explicito
  UPDATE public.comandas
     SET status = 'cancelled'
   WHERE appointment_id = v_token.appointment_id
     AND tenant_id = v_tenant_id
     AND status IN ('open', 'blocked');

  UPDATE public.public_booking_tokens
     SET revoked_at = now()
   WHERE id = v_token.id
     AND tenant_id = v_tenant_id;

  RETURN jsonb_build_object(
    'appointment_id', v_token.appointment_id,
    'status', 'cancelled',
    'cancelled_at', now(),
    'cancelled', true,
    'idempotent', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_public_booking(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_public_booking(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_public_booking(TEXT, TEXT) TO anon, authenticated;

-- Saneamento retroativo para agendamentos existentes vindos de booking_web
DO $$
DECLARE
  r RECORD;
  v_staff_name TEXT;
  v_svc_name TEXT;
  v_total_p NUMERIC(10,2);
  v_total_d INTEGER;
  v_first_svc UUID;
  v_cid UUID;
BEGIN
  FOR r IN
    SELECT a.id, a.tenant_id, a.client_id, a.staff_id, a.start_time, a.price, a.idempotency_key
    FROM public.appointments a
    WHERE a.source = 'booking_web' AND (COALESCE(a.service_name, '') = '' OR a.price = 0)
  LOOP
    SELECT name INTO v_staff_name FROM public.staff WHERE id = r.staff_id AND tenant_id = r.tenant_id;

    SELECT
      string_agg(s.name, ', ' ORDER BY aps.sort_order),
      COALESCE(SUM(aps.unit_price), 0),
      COALESCE(SUM(aps.duration_minutes), 30),
      (ARRAY_AGG(aps.service_id ORDER BY aps.sort_order))[1]
    INTO v_svc_name, v_total_p, v_total_d, v_first_svc
    FROM public.appointment_services aps
    JOIN public.services s ON s.id = aps.service_id
    WHERE aps.appointment_id = r.id;

    IF v_svc_name IS NOT NULL THEN
      UPDATE public.appointments
      SET service_name = v_svc_name,
          staff_name = COALESCE(v_staff_name, ''),
          service_id = COALESCE(service_id, v_first_svc),
          price = v_total_p,
          duration = ROUND((v_total_d::numeric / 60.0), 2),
          channel = COALESCE(channel, 'site')
      WHERE id = r.id AND tenant_id = r.tenant_id;

      IF NOT EXISTS (SELECT 1 FROM public.comandas WHERE appointment_id = r.id AND tenant_id = r.tenant_id) THEN
        INSERT INTO public.comandas (tenant_id, appointment_id, client_id, staff_id, status, total, idempotency_key)
        VALUES (
          r.tenant_id,
          r.id,
          r.client_id,
          r.staff_id,
          CASE WHEN (r.start_time AT TIME ZONE 'America/Sao_Paulo')::date > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date THEN 'blocked' ELSE 'open' END,
          v_total_p,
          r.idempotency_key
        ) RETURNING id INTO v_cid;

        INSERT INTO public.comanda_items (tenant_id, comanda_id, service_id, product_name, quantity, unit_price, staff_id)
        SELECT
          r.tenant_id,
          v_cid,
          s.id,
          s.name,
          1,
          aps.unit_price,
          r.staff_id
        FROM public.appointment_services aps
        JOIN public.services s ON s.id = aps.service_id
        WHERE aps.appointment_id = r.id;
      END IF;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
