-- ============================================================================
-- Migration: 20261110184000_fix_public_available_slots_resolution_and_schedule.sql
-- Description: Corrige regressões na RPC public.get_public_available_slots:
--   1. Restaura resolução de tenant via resolve_public_booking_tenant_id (suporta
--      online_booking_settings.slug customizado além de tenants.slug e UUID).
--   2. Suporta chaves completas (monday..sunday) e abreviadas (mon..sun) em
--      weekly_schedule, business_hours e staff.working_hours, mantendo fallback
--      seguro para work_start_time/work_end_time quando não há grade semanal.
--   3. Corrige detecção de colisão para agendamentos e bloqueios parciais já em
--      andamento em v_slot_start (não apenas start_time > v_slot_start).
--   4. Restaura ordenação cronológica final e permissões ADR-012.
-- ============================================================================

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
  v_obs RECORD;
  v_is_active BOOLEAN;
  v_date DATE := COALESCE(p_date, CURRENT_DATE);
  v_timezone TEXT := 'America/Sao_Paulo';
  v_horizon_days INTEGER;
  v_min_notice INTEGER;
  v_interval INTEGER;
  v_day_key TEXT;
  v_day_short_key TEXT;
  v_schedule_source JSONB;
  v_day_schedule JSONB;
  v_has_schedule_entry BOOLEAN := false;
  v_shop_closed_today BOOLEAN := false;
  v_shop_open TIME;
  v_shop_close TIME;
  v_staff_open TIME;
  v_staff_close TIME;
  v_break_start TIME;
  v_break_end TIME;
  v_staff_open_tz TIMESTAMPTZ;
  v_staff_close_tz TIMESTAMPTZ;
  v_break_start_tz TIMESTAMPTZ;
  v_break_end_tz TIMESTAMPTZ;
  v_staff_list UUID[];
  v_staff_id UUID;
  v_staff_record RECORD;
  v_barber_day JSONB;
  v_has_barber_day BOOLEAN := false;
  v_cand_record RECORD;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_total_duration INTEGER := 0;
  v_now TIMESTAMPTZ := now();
  v_result JSONB := '[]'::jsonb;
  v_seen_slots JSONB := '{}'::jsonb;
  v_next_limit TIMESTAMPTZ;
  v_gap_minutes NUMERIC;
  v_tolerance_minutes INTEGER := 5;
BEGIN
  -- 1. Resolver Tenant via resolve_public_booking_tenant_id (obs.slug, tenants.slug ou UUID)
  v_tenant_id := public.resolve_public_booking_tenant_id(p_tenant_identifier);

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('date', v_date, 'timezone', v_timezone, 'interval_minutes', 30, 'slots', '[]'::jsonb);
  END IF;

  -- 2. Carregar configurações da Barbearia
  SELECT * INTO v_settings FROM public.tenant_settings WHERE tenant_id = v_tenant_id;
  SELECT * INTO v_obs FROM public.online_booking_settings WHERE tenant_id = v_tenant_id;

  v_is_active := COALESCE(v_obs.is_active, v_settings.booking_enabled, false);
  v_timezone := COALESCE(NULLIF(btrim(COALESCE(v_settings.timezone, '')), ''), 'America/Sao_Paulo');
  v_horizon_days := COALESCE(v_settings.booking_horizon_days, 30);
  v_min_notice := COALESCE(v_settings.min_booking_notice_minutes, 30);
  v_interval := COALESCE(v_settings.appointment_interval_minutes, 30);
  IF v_interval <= 0 THEN v_interval := 30; END IF;

  IF NOT v_is_active THEN
    RETURN jsonb_build_object('date', v_date, 'timezone', v_timezone, 'interval_minutes', v_interval, 'slots', '[]'::jsonb);
  END IF;

  -- Se a data solicitada estiver fora do horizonte permitido no fuso da barbearia
  IF v_date < (v_now AT TIME ZONE v_timezone)::date OR v_date > ((v_now AT TIME ZONE v_timezone)::date + v_horizon_days) THEN
    RETURN jsonb_build_object('date', v_date, 'timezone', v_timezone, 'interval_minutes', v_interval, 'slots', '[]'::jsonb);
  END IF;

  -- Identificar dia da semana (completo e abreviado para compatibilidade com onboarding)
  SELECT d.full_key, d.short_key
    INTO v_day_key, v_day_short_key
    FROM (
      VALUES
        (0, 'sunday', 'sun'),
        (1, 'monday', 'mon'),
        (2, 'tuesday', 'tue'),
        (3, 'wednesday', 'wed'),
        (4, 'thursday', 'thu'),
        (5, 'friday', 'fri'),
        (6, 'saturday', 'sat')
    ) AS d(dow, full_key, short_key)
   WHERE d.dow = EXTRACT(DOW FROM v_date)::integer;

  -- Resolver grade da loja priorizando weekly_schedule e fallback para business_hours
  v_schedule_source := NULL;
  IF v_obs.id IS NOT NULL AND v_obs.weekly_schedule IS NOT NULL THEN
    IF v_obs.weekly_schedule ? v_day_key THEN
      v_has_schedule_entry := true;
      v_day_schedule := v_obs.weekly_schedule -> v_day_key;
    ELSIF v_obs.weekly_schedule ? v_day_short_key THEN
      v_has_schedule_entry := true;
      v_day_schedule := v_obs.weekly_schedule -> v_day_short_key;
    END IF;
  END IF;

  IF NOT v_has_schedule_entry AND v_settings.business_hours IS NOT NULL THEN
    IF v_settings.business_hours ? v_day_key THEN
      v_has_schedule_entry := true;
      v_day_schedule := v_settings.business_hours -> v_day_key;
    ELSIF v_settings.business_hours ? v_day_short_key THEN
      v_has_schedule_entry := true;
      v_day_schedule := v_settings.business_hours -> v_day_short_key;
    END IF;
  END IF;

  IF v_has_schedule_entry AND (v_day_schedule IS NULL OR jsonb_typeof(v_day_schedule) = 'null') THEN
    v_shop_closed_today := true;
  END IF;

  v_shop_open := CASE
    WHEN v_day_schedule IS NOT NULL AND jsonb_typeof(v_day_schedule) = 'object'
    THEN NULLIF(v_day_schedule ->> 'open', '')::time
    ELSE NULL
  END;
  v_shop_close := CASE
    WHEN v_day_schedule IS NOT NULL AND jsonb_typeof(v_day_schedule) = 'object'
    THEN NULLIF(v_day_schedule ->> 'close', '')::time
    ELSE NULL
  END;

  IF v_shop_open IS NULL THEN
    v_shop_open := COALESCE(v_settings.work_start_time, '08:00:00'::time);
  END IF;
  IF v_shop_close IS NULL THEN
    v_shop_close := COALESCE(v_settings.work_end_time, '20:00:00'::time);
  END IF;

  -- Duração total dos serviços selecionados (isolado por tenant_id)
  IF p_service_ids IS NOT NULL AND array_length(p_service_ids, 1) > 0 THEN
    SELECT COALESCE(SUM(s.duration), 0) INTO v_total_duration
      FROM public.services s
     WHERE s.id = ANY(p_service_ids)
       AND s.tenant_id = v_tenant_id
       AND s.active = true;
  END IF;

  IF v_total_duration = 0 THEN
    SELECT COALESCE(s.duration, 60) INTO v_total_duration
      FROM public.services s
     WHERE s.tenant_id = v_tenant_id AND s.active = true
     ORDER BY s.name LIMIT 1;
    v_total_duration := COALESCE(v_total_duration, 60);
  END IF;

  -- Resolver lista de profissionais elegíveis
  IF p_staff_id IS NOT NULL THEN
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

  -- Processar cada profissional
  FOREACH v_staff_id IN ARRAY v_staff_list LOOP
    -- Ignorar profissional se houver bloqueio de dia inteiro na data
    IF EXISTS (
      SELECT 1 FROM public.schedule_blocks sb
       WHERE sb.tenant_id = v_tenant_id
         AND sb.status = 'active'
         AND sb.start_date <= v_date AND sb.end_date >= v_date
         AND (sb.professional_id IS NULL OR sb.professional_id = v_staff_id)
         AND sb.block_type = 'full_day'
    ) THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_staff_record FROM public.staff WHERE id = v_staff_id;

    -- Verificar jornada própria do profissional (full key ou short key)
    v_has_barber_day := false;
    v_barber_day := NULL;
    IF v_staff_record.working_hours IS NOT NULL THEN
      IF v_staff_record.working_hours ? v_day_key THEN
        v_has_barber_day := true;
        v_barber_day := v_staff_record.working_hours -> v_day_key;
      ELSIF v_staff_record.working_hours ? v_day_short_key THEN
        v_has_barber_day := true;
        v_barber_day := v_staff_record.working_hours -> v_day_short_key;
      END IF;
    END IF;

    IF v_has_barber_day THEN
      -- Se configurado como folga (null) para o barbeiro, pula este profissional
      IF v_barber_day IS NULL OR jsonb_typeof(v_barber_day) = 'null' THEN
        CONTINUE;
      END IF;

      v_staff_open := COALESCE(NULLIF(v_barber_day ->> 'open', '')::time, v_shop_open);
      v_staff_close := COALESCE(NULLIF(v_barber_day ->> 'close', '')::time, v_shop_close);
      v_break_start := NULLIF(v_barber_day ->> 'break_start', '')::time;
      v_break_end := NULLIF(v_barber_day ->> 'break_end', '')::time;
    ELSE
      -- Se a barbearia está explicitamente fechada neste dia e o barbeiro não tem jornada própria, pula
      IF v_shop_closed_today THEN
        CONTINUE;
      END IF;

      v_staff_open := v_shop_open;
      v_staff_close := v_shop_close;
      v_break_start := NULL;
      v_break_end := NULL;
    END IF;

    IF v_staff_close <= v_staff_open THEN
      CONTINUE;
    END IF;

    v_staff_open_tz := (v_date + v_staff_open) AT TIME ZONE v_timezone;
    v_staff_close_tz := (v_date + v_staff_close) AT TIME ZONE v_timezone;

    IF v_break_start IS NOT NULL AND v_break_end IS NOT NULL AND v_break_end > v_break_start THEN
      v_break_start_tz := (v_date + v_break_start) AT TIME ZONE v_timezone;
      v_break_end_tz := (v_date + v_break_end) AT TIME ZONE v_timezone;
    ELSE
      v_break_start_tz := NULL;
      v_break_end_tz := NULL;
    END IF;

    -- Unir candidatos da grade padrão + término de atendimentos existentes (encaixe sequencial)
    FOR v_cand_record IN
      WITH cand_times AS (
        SELECT ((v_date + (v_staff_open + (n || ' minutes')::interval)) AT TIME ZONE v_timezone) AS start_at
          FROM generate_series(0, 24 * 60, v_interval) n
         WHERE (v_staff_open + (n || ' minutes')::interval) < v_staff_close

        UNION

        SELECT a.end_time AS start_at
          FROM public.appointments a
         WHERE a.tenant_id = v_tenant_id
           AND a.staff_id = v_staff_id
           AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
           AND a.end_time > a.start_time
           AND date(a.start_time AT TIME ZONE v_timezone) = v_date
      )
      SELECT DISTINCT start_at
        FROM cand_times
       WHERE start_at >= v_staff_open_tz
         AND start_at < v_staff_close_tz
         AND start_at >= v_now + (v_min_notice || ' minutes')::interval
       ORDER BY start_at ASC
    LOOP
      v_slot_start := v_cand_record.start_at;

      -- Verificar se o início colide com intervalo de almoço do profissional
      IF v_break_start_tz IS NOT NULL AND v_slot_start >= v_break_start_tz AND v_slot_start < v_break_end_tz THEN
        CONTINUE;
      END IF;

      -- Verificar se já existe atendimento ou bloqueio parcial cobrindo v_slot_start
      IF EXISTS (
        SELECT 1 FROM public.appointments a
         WHERE a.tenant_id = v_tenant_id
           AND a.staff_id = v_staff_id
           AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show', 'completed')
           AND a.end_time > a.start_time
           AND a.start_time <= v_slot_start
           AND a.end_time > v_slot_start
      ) OR EXISTS (
        SELECT 1 FROM public.schedule_blocks sb
         WHERE sb.tenant_id = v_tenant_id
           AND sb.status = 'active'
           AND sb.start_date <= v_date AND sb.end_date >= v_date
           AND (sb.professional_id IS NULL OR sb.professional_id = v_staff_id)
           AND sb.block_type <> 'full_day'
           AND sb.start_time IS NOT NULL AND sb.end_time IS NOT NULL
           AND sb.end_time > sb.start_time
           AND ((v_date + sb.start_time) AT TIME ZONE v_timezone) <= v_slot_start
           AND ((v_date + sb.end_time) AT TIME ZONE v_timezone) > v_slot_start
      ) THEN
        CONTINUE;
      END IF;

      -- Encontrar o próximo limite onde a janela livre termina
      SELECT LEAST(
        v_staff_close_tz,
        COALESCE(
          (SELECT MIN(a.start_time)
             FROM public.appointments a
            WHERE a.tenant_id = v_tenant_id
              AND a.staff_id = v_staff_id
              AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show', 'completed')
              AND a.end_time > a.start_time
              AND a.start_time > v_slot_start),
          v_staff_close_tz
        ),
        COALESCE(
          (SELECT MIN((v_date + sb.start_time) AT TIME ZONE v_timezone)
             FROM public.schedule_blocks sb
            WHERE sb.tenant_id = v_tenant_id
              AND sb.status = 'active'
              AND sb.start_date <= v_date AND sb.end_date >= v_date
              AND (sb.professional_id IS NULL OR sb.professional_id = v_staff_id)
              AND sb.block_type <> 'full_day'
              AND sb.start_time IS NOT NULL AND sb.end_time IS NOT NULL
              AND sb.end_time > sb.start_time
              AND ((v_date + sb.start_time) AT TIME ZONE v_timezone) > v_slot_start),
          v_staff_close_tz
        ),
        CASE
          WHEN v_break_start_tz IS NOT NULL AND v_break_start_tz > v_slot_start
          THEN v_break_start_tz
          ELSE v_staff_close_tz
        END
      ) INTO v_next_limit;

      v_gap_minutes := EXTRACT(EPOCH FROM (v_next_limit - v_slot_start)) / 60;

      -- Avaliar se cabe com ou sem tolerância inteligente de microjanela
      IF v_gap_minutes >= v_total_duration THEN
        v_slot_end := v_slot_start + (v_total_duration || ' minutes')::interval;
      ELSIF v_gap_minutes >= (v_total_duration - v_tolerance_minutes) AND v_total_duration >= 30 THEN
        v_slot_end := v_next_limit;
      ELSE
        CONTINUE;
      END IF;

      IF NOT v_seen_slots ? (v_staff_id::text || ':' || v_slot_start::text) THEN
        v_result := v_result || jsonb_build_object(
          'staff_id', v_staff_id,
          'start_time', v_slot_start,
          'end_time', v_slot_end,
          'start_time_display', to_char(v_slot_start AT TIME ZONE v_timezone, 'HH24:MI'),
          'end_time_display', to_char(v_slot_end AT TIME ZONE v_timezone, 'HH24:MI'),
          'available', true
        );
        v_seen_slots := jsonb_set(v_seen_slots, ARRAY[v_staff_id::text || ':' || v_slot_start::text], 'true'::jsonb);
      END IF;
    END LOOP;
  END LOOP;

  -- Ordenar o resultado final cronologicamente
  IF jsonb_array_length(v_result) > 1 THEN
    SELECT COALESCE(
      jsonb_agg(elem ORDER BY (elem->>'start_time') ASC, (elem->>'staff_id') ASC),
      '[]'::jsonb
    )
      INTO v_result
      FROM jsonb_array_elements(v_result) elem;
  END IF;

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
