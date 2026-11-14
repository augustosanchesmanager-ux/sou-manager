-- ============================================================================
-- Migration: 20261114180000_same_day_booking_limit_and_beneficiary.sql
-- Description:
--   1. Atualiza lookup_public_booking_client para aceitar p_target_date opcional
--      e retornar informacoes sobre agendamento ativo no mesmo dia.
--   2. Atualiza create_public_booking com parametros p_is_for_other e
--      p_beneficiary_name, bloqueando 2o agendamento no mesmo dia para si mesmo
--      e permitindo agendamento para terceiro (filho/parente/amigo) com o nome
--      do beneficiario no agendamento e telefone do titular.
-- ============================================================================

-- 1. lookup_public_booking_client com verificacao de agendamento no mesmo dia
DROP FUNCTION IF EXISTS public.lookup_public_booking_client(text, text);
DROP FUNCTION IF EXISTS public.lookup_public_booking_client(text, text, timestamptz);

CREATE OR REPLACE FUNCTION public.lookup_public_booking_client(
  p_tenant_identifier text,
  p_client_phone text,
  p_target_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_tenant_id uuid;
  v_canon_phone text;
  v_client_name text;
  v_timezone text := 'America/Sao_Paulo';
  v_target_day date;
  v_has_same_day boolean := false;
  v_existing_apt_id uuid := NULL;
  v_existing_time text := NULL;
  v_existing_staff text := NULL;
BEGIN
  IF p_tenant_identifier IS NULL OR btrim(p_tenant_identifier) = '' THEN
    RETURN jsonb_build_object(
      'found', false,
      'client_name', NULL,
      'masked_name', NULL,
      'has_same_day_booking', false,
      'existing_booking_time', NULL,
      'existing_staff_name', NULL,
      'existing_appointment_id', NULL
    );
  END IF;

  v_tenant_id := public.resolve_public_booking_tenant_id(p_tenant_identifier);
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'client_name', NULL,
      'masked_name', NULL,
      'has_same_day_booking', false,
      'existing_booking_time', NULL,
      'existing_staff_name', NULL,
      'existing_appointment_id', NULL
    );
  END IF;

  v_canon_phone := public.normalize_br_phone(p_client_phone);
  IF v_canon_phone IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'client_name', NULL,
      'masked_name', NULL,
      'has_same_day_booking', false,
      'existing_booking_time', NULL,
      'existing_staff_name', NULL,
      'existing_appointment_id', NULL
    );
  END IF;

  SELECT c.name
    INTO v_client_name
    FROM public.clients c
   WHERE c.tenant_id = v_tenant_id
     AND public.normalize_br_phone(c.phone) = v_canon_phone
   ORDER BY COALESCE(c.is_shared_phone, false) ASC, c.created_at ASC
   LIMIT 1;

  IF v_client_name IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'client_name', NULL,
      'masked_name', NULL,
      'has_same_day_booking', false,
      'existing_booking_time', NULL,
      'existing_staff_name', NULL,
      'existing_appointment_id', NULL
    );
  END IF;

  -- Se foi informada a data pretendida, checar se ja ha agendamento ativo nessa data
  IF p_target_date IS NOT NULL THEN
    SELECT COALESCE(timezone, 'America/Sao_Paulo')
      INTO v_timezone
      FROM public.tenant_settings
     WHERE tenant_id = v_tenant_id;

    v_target_day := (p_target_date AT TIME ZONE v_timezone)::date;

    SELECT a.id,
           to_char(a.start_time AT TIME ZONE v_timezone, 'HH24:MI'),
           COALESCE(a.staff_name, (SELECT s.name FROM public.staff s WHERE s.id = a.staff_id))
      INTO v_existing_apt_id, v_existing_time, v_existing_staff
      FROM public.appointments a
     WHERE a.tenant_id = v_tenant_id
       AND public.normalize_br_phone(a.client_phone) = v_canon_phone
       AND lower(COALESCE(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
       AND (a.start_time AT TIME ZONE v_timezone)::date = v_target_day
     ORDER BY a.start_time ASC
     LIMIT 1;

    IF v_existing_apt_id IS NOT NULL THEN
      v_has_same_day := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'client_name', v_client_name,
    'masked_name', public.mask_public_client_name(v_client_name),
    'has_same_day_booking', v_has_same_day,
    'existing_booking_time', v_existing_time,
    'existing_staff_name', v_existing_staff,
    'existing_appointment_id', v_existing_apt_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_public_booking_client(text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_public_booking_client(text, text, timestamptz) TO anon, authenticated, service_role;

-- 2. create_public_booking com bloqueio no mesmo dia e suporte a terceiro (beneficiario)
DROP FUNCTION IF EXISTS public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_tenant_identifier TEXT,
  p_staff_id UUID,
  p_service_ids UUID[],
  p_start_time TIMESTAMPTZ,
  p_client_name TEXT,
  p_client_phone TEXT,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_is_for_other BOOLEAN DEFAULT FALSE,
  p_beneficiary_name TEXT DEFAULT NULL
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
  v_existing_client_name TEXT;
  v_resolved_client_name TEXT;
  v_clean_phone TEXT := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  v_canon_phone TEXT := public.normalize_br_phone(p_client_phone);
  v_target_day DATE;
  v_same_day_apt_id UUID;
  v_same_day_time TEXT;
  v_same_day_staff TEXT;
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
  v_min_notice INTEGER;
  v_effective_notes TEXT := p_notes;
BEGIN
  IF p_tenant_identifier IS NULL OR btrim(p_tenant_identifier) = '' THEN
    RAISE EXCEPTION 'tenant_required' USING ERRCODE = 'P0001';
  END IF;

  v_tenant_id := public.resolve_public_booking_tenant_id(p_tenant_identifier);

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_settings FROM public.tenant_settings WHERE tenant_id = v_tenant_id;
  v_timezone := COALESCE(v_settings.timezone, 'America/Sao_Paulo');
  v_min_notice := COALESCE(v_settings.min_booking_notice_minutes, 30);

  IF NOT COALESCE(v_settings.booking_enabled, true) THEN
    RAISE EXCEPTION 'booking_disabled' USING ERRCODE = 'P0001';
  END IF;

  -- Checagem de idempotência
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

  IF v_clean_phone !~ '^\d{10,13}$' THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  -- Telefone placeholder/inválido (ex.: 0000) não pode gerar cadastro
  IF v_canon_phone IS NULL THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = 'P0001';
  END IF;

  -- Tolerância de 5 minutos na antecedência mínima para evitar falso positivo por lag de rede/relógio
  IF p_start_time < (now() + (v_min_notice || ' minutes')::interval - interval '5 minutes') THEN
    RAISE EXCEPTION 'booking_too_soon' USING ERRCODE = 'P0001';
  END IF;

  IF (p_start_time AT TIME ZONE v_timezone)::date > (CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::date + COALESCE(v_settings.booking_horizon_days, 30) THEN
    RAISE EXCEPTION 'booking_too_far' USING ERRCODE = 'P0001';
  END IF;

  -- Obter nome do profissional
  SELECT st.name INTO v_staff_name
    FROM public.staff st
   WHERE st.id = p_staff_id
     AND st.tenant_id = v_tenant_id
     AND st.status = 'active'
     AND lower(st.role) IN ('barber', 'manager');

  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  -- Calcular total de duração, preço, nomes e primeiro serviço
  SELECT
    COALESCE(SUM(s.duration), 0),
    COALESCE(SUM(s.price), 0),
    string_agg(s.name, ', ' ORDER BY ord.ordinality),
    (ARRAY_AGG(s.id ORDER BY ord.ordinality))[1]
  INTO v_total_duration, v_total_price, v_service_names, v_first_service_id
  FROM public.services s
  JOIN unnest(p_service_ids) WITH ORDINALITY AS ord(val, ordinality) ON s.id = ord.val
  WHERE s.tenant_id = v_tenant_id
    AND s.active = true;

  IF v_total_duration = 0 THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  v_duration_hours := ROUND((v_total_duration::numeric / 60.0), 2);
  v_end_time := p_start_time + (v_total_duration || ' minutes')::interval;

  -- Trava transacional de concorrência por profissional
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || p_staff_id::text, 0));

  -- Verificar colisão com agendamentos existentes do mesmo profissional
  IF EXISTS (
    SELECT 1 FROM public.appointments a
     WHERE a.tenant_id = v_tenant_id
       AND a.staff_id = p_staff_id
       AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show', 'completed')
       AND a.end_time > a.start_time
       AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(p_start_time, v_end_time, '[)')
  ) THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  -- Obter cliente existente pelo telefone canônico (prioriza titular não compartilhado)
  SELECT c.id, c.name INTO v_client_id, v_existing_client_name
    FROM public.clients c
   WHERE c.tenant_id = v_tenant_id
     AND public.normalize_br_phone(c.phone) = v_canon_phone
   ORDER BY COALESCE(c.is_shared_phone, false) ASC, c.created_at ASC
   LIMIT 1;

  IF v_client_id IS NULL THEN
    BEGIN
      INSERT INTO public.clients (tenant_id, name, phone)
      VALUES (v_tenant_id, btrim(p_client_name), v_canon_phone)
      RETURNING id, name INTO v_client_id, v_existing_client_name;
    EXCEPTION WHEN unique_violation THEN
      SELECT c.id, c.name INTO v_client_id, v_existing_client_name
        FROM public.clients c
       WHERE c.tenant_id = v_tenant_id
         AND public.normalize_br_phone(c.phone) = v_canon_phone
       ORDER BY COALESCE(c.is_shared_phone, false) ASC, c.created_at ASC
       LIMIT 1;
    END;
  END IF;

  -- ==========================================================================
  -- REGRA DO MESMO DIA: Impede 2 agendamentos no mesmo dia para a mesma pessoa
  -- ==========================================================================
  v_target_day := (p_start_time AT TIME ZONE v_timezone)::date;

  SELECT a.id,
         to_char(a.start_time AT TIME ZONE v_timezone, 'HH24:MI'),
         COALESCE(a.staff_name, (SELECT s.name FROM public.staff s WHERE s.id = a.staff_id))
    INTO v_same_day_apt_id, v_same_day_time, v_same_day_staff
    FROM public.appointments a
   WHERE a.tenant_id = v_tenant_id
     AND public.normalize_br_phone(a.client_phone) = v_canon_phone
     AND lower(COALESCE(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
     AND (a.start_time AT TIME ZONE v_timezone)::date = v_target_day
   ORDER BY a.start_time ASC
   LIMIT 1;

  IF v_same_day_apt_id IS NOT NULL THEN
    IF NOT COALESCE(p_is_for_other, false) THEN
      RAISE EXCEPTION 'same_day_booking_limit'
        USING ERRCODE = 'P0001',
              DETAIL = 'Cliente já possui agendamento neste dia (' || COALESCE(v_same_day_time, '') || ' com ' || COALESCE(v_same_day_staff, '') || ')';
    ELSE
      -- Se for para terceiro, exige nome válido e diferente do titular
      IF btrim(COALESCE(p_beneficiary_name, '')) = '' OR
         lower(btrim(p_beneficiary_name)) = lower(btrim(COALESCE(v_existing_client_name, p_client_name))) THEN
        RAISE EXCEPTION 'same_day_beneficiary_required'
          USING ERRCODE = 'P0001',
                DETAIL = 'Informe o nome de quem será atendido (filho, parente ou amigo)';
      END IF;
    END IF;
  END IF;

  -- Rate limit por telefone normalizado (máx 1 agendamento a cada 2 minutos pelo portal web para si mesmo)
  -- Não bloqueia quando sinalizado para terceiro (permite pai e filho consecutivamente)
  IF NOT COALESCE(p_is_for_other, false) AND EXISTS (
    SELECT 1 FROM public.appointments a
     WHERE a.tenant_id = v_tenant_id
       AND public.normalize_br_phone(a.client_phone) = v_canon_phone
       AND a.source = 'booking_web'
       AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
       AND a.created_at > now() - interval '2 minutes'
  ) THEN
    RAISE EXCEPTION 'rate_limit_exceeded' USING ERRCODE = 'P0001';
  END IF;

  -- Resolução do nome: Se for para terceiro, usa o nome do beneficiario no agendamento
  -- Caso contrario, prevalece o nome oficial do cadastro unificado
  IF COALESCE(p_is_for_other, false) AND btrim(COALESCE(p_beneficiary_name, '')) <> '' THEN
    v_resolved_client_name := btrim(p_beneficiary_name);
    v_effective_notes := concat_ws(' | ',
      NULLIF(btrim(v_effective_notes), ''),
      'Agendado por ' || COALESCE(v_existing_client_name, p_client_name) || ' para ' || v_resolved_client_name
    );
  ELSE
    v_resolved_client_name := COALESCE(NULLIF(btrim(v_existing_client_name), ''), btrim(p_client_name));
  END IF;

  -- Inserir agendamento com dados completos de serviço e valor
  INSERT INTO public.appointments (
    tenant_id, client_id, service_id, staff_id, client_name, client_phone,
    service_name, staff_name, start_time, end_time, duration, price,
    status, source, channel, notes, idempotency_key
  ) VALUES (
    v_tenant_id, v_client_id, v_first_service_id, p_staff_id, v_resolved_client_name, v_canon_phone,
    COALESCE(v_service_names, ''), COALESCE(v_staff_name, ''), p_start_time, v_end_time, v_duration_hours, v_total_price,
    CASE WHEN COALESCE(v_settings.auto_confirm_online_bookings, true) THEN 'confirmed' ELSE 'pending' END,
    'booking_web', 'site', v_effective_notes, p_idempotency_key
  ) RETURNING id INTO v_appointment_id;

  -- Inserir tabela associativa de serviços
  INSERT INTO public.appointment_services (
    tenant_id, appointment_id, service_id, unit_price, duration_minutes, quantity, sort_order
  )
  SELECT
    v_tenant_id, v_appointment_id, s.id, s.price, s.duration, 1, ord.ordinality
  FROM public.services s
  JOIN unnest(p_service_ids) WITH ORDINALITY AS ord(val, ordinality) ON s.id = ord.val
  WHERE s.tenant_id = v_tenant_id
    AND s.active = true;

  -- Criação automática da comanda vinculada ao agendamento
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

  -- Inserir itens da comanda
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
    AND s.active = true;

  -- Gerar token público de consulta/cancelamento
  v_public_token := encode(extensions.gen_random_bytes(32), 'base64');
  v_token_hash := encode(extensions.digest(btrim(v_public_token), 'sha256'), 'hex');
  v_token_expires_at := v_end_time + interval '30 days';

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

REVOKE ALL ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated, service_role;
