-- ============================================================================
-- Migration: 20261107105000_fix_public_available_slots_day_schedule_and_contiguous_booking.sql
-- Description: Corrige a geração de horários disponíveis no agendamento online público:
--   1. Respeita o weekly_schedule / business_hours do dia da semana (abertura, fechamento e dias fechados)
--   2. Implementa Encaixe Sequencial Contínuo (gera slots colados no término de atendimentos existentes)
--   3. Corrige o fallback de ordenação de serviços (s.name em vez do inexistente s.sort_order)
--   4. Garante ordenação cronológica rigorosa e previne slots fora do expediente
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
  v_date DATE := COALESCE(p_date, CURRENT_DATE);
  v_timezone TEXT := 'America/Sao_Paulo';
  v_horizon_days INTEGER;
  v_min_notice INTEGER;
  v_interval INTEGER;
  v_day_key TEXT;
  v_day_schedule JSONB;
  v_day_open TIME;
  v_day_close TIME;
  v_day_open_tz TIMESTAMPTZ;
  v_day_close_tz TIMESTAMPTZ;
  v_total_duration INTEGER := 0;
  v_staff_list UUID[];
  v_staff_id UUID;
  v_slot_start TIMESTAMPTZ;
  v_slot_end TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_max_date DATE;
  v_result JSONB := '[]'::jsonb;
  v_seen_slots JSONB := '{}'::jsonb;
  v_cand_record RECORD;
BEGIN
  v_tenant_id := public.resolve_public_booking_tenant_id(p_tenant_identifier);

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('date', v_date, 'timezone', v_timezone, 'interval_minutes', 30, 'slots', '[]'::jsonb);
  END IF;

  SELECT * INTO v_settings FROM public.tenant_settings WHERE tenant_id = v_tenant_id;
  SELECT * INTO v_obs FROM public.online_booking_settings WHERE tenant_id = v_tenant_id;

  v_timezone := COALESCE(v_settings.timezone, 'America/Sao_Paulo');
  v_horizon_days := COALESCE(v_settings.booking_horizon_days, 30);
  v_min_notice := COALESCE(v_settings.min_booking_notice_minutes, 30);
  v_interval := COALESCE(v_settings.appointment_interval_minutes, 30);
  v_max_date := CURRENT_DATE + v_horizon_days;

  IF v_date > v_max_date OR v_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('date', v_date, 'timezone', v_timezone, 'interval_minutes', v_interval, 'slots', '[]'::jsonb);
  END IF;

  -- Determinar dia da semana de forma determinística e independente de locale
  v_day_key := CASE extract(dow from v_date)
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END;

  -- Buscar horário específico do dia no weekly_schedule ou business_hours
  v_day_schedule := COALESCE(
    v_obs.weekly_schedule -> v_day_key,
    v_settings.business_hours -> v_day_key
  );

  -- Se o dia estiver nulo, a barbearia está fechada neste dia da semana
  IF v_day_schedule IS NULL OR jsonb_typeof(v_day_schedule) = 'null' THEN
    RETURN jsonb_build_object('date', v_date, 'timezone', v_timezone, 'interval_minutes', v_interval, 'slots', '[]'::jsonb);
  END IF;

  -- Extrair horário de abertura e fechamento do dia
  v_day_open := NULLIF(v_day_schedule ->> 'open', '')::time;
  v_day_close := NULLIF(v_day_schedule ->> 'close', '')::time;

  -- Fallback defensivo para os horários gerais caso o JSON não especifique
  IF v_day_open IS NULL THEN
    v_day_open := COALESCE(v_settings.work_start_time, '08:00:00'::time);
  END IF;
  IF v_day_close IS NULL THEN
    v_day_close := COALESCE(v_settings.work_end_time, '20:00:00'::time);
  END IF;

  v_day_open_tz := (v_date + v_day_open) AT TIME ZONE v_timezone;
  v_day_close_tz := (v_date + v_day_close) AT TIME ZONE v_timezone;

  -- Calcular duração total dos serviços selecionados
  IF p_service_ids IS NOT NULL AND array_length(p_service_ids, 1) > 0 THEN
    SELECT COALESCE(SUM(s.duration), 0) INTO v_total_duration
      FROM public.services s
     WHERE s.id = ANY(p_service_ids) AND s.active = true;
  END IF;

  IF v_total_duration = 0 THEN
    SELECT COALESCE(s.duration, 60) INTO v_total_duration
      FROM public.services s
     WHERE s.tenant_id = v_tenant_id AND s.active = true
     ORDER BY s.name LIMIT 1;
    v_total_duration := COALESCE(v_total_duration, 60);
  END IF;

  -- Resolver lista de profissionais
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

  -- Gerar slots candidatos para cada profissional
  FOREACH v_staff_id IN ARRAY v_staff_list LOOP
    -- Unir candidatos da grade padrão (múltiplos do intervalo) + término de atendimentos existentes (encaixe sequencial)
    FOR v_cand_record IN
      WITH cand_times AS (
        -- 1. Grade fixa padrão
        SELECT ((v_date + (v_day_open + (n || ' minutes')::interval)) AT TIME ZONE v_timezone) AS start_at
          FROM generate_series(0, 24 * 60, v_interval) n
         WHERE (v_day_open + (n || ' minutes')::interval) < v_day_close

        UNION

        -- 2. Encaixe contínuo: término de cada agendamento ativo de hoje do profissional
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
       WHERE start_at >= v_day_open_tz
         AND start_at + (v_total_duration || ' minutes')::interval <= v_day_close_tz
         AND start_at >= v_now + (v_min_notice || ' minutes')::interval
       ORDER BY start_at ASC
    LOOP
      v_slot_start := v_cand_record.start_at;
      v_slot_end := v_slot_start + (v_total_duration || ' minutes')::interval;

      -- Verificar se colide com agendamentos existentes (protegendo contra start_time >= end_time inconsistente)
      IF NOT EXISTS (
        SELECT 1 FROM public.appointments a
         WHERE a.tenant_id = v_tenant_id
           AND a.staff_id = v_staff_id
           AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show', 'completed')
           AND a.end_time > a.start_time
           AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(v_slot_start, v_slot_end, '[)')
      ) AND NOT EXISTS (
        -- Verificar se colide com bloqueios de agenda
        SELECT 1 FROM public.schedule_blocks sb
         WHERE sb.tenant_id = v_tenant_id
           AND sb.status = 'active'
           AND sb.start_date <= v_date AND sb.end_date >= v_date
           AND (sb.professional_id IS NULL OR sb.professional_id = v_staff_id)
           AND (
             sb.block_type = 'full_day'
             OR (sb.start_time IS NOT NULL AND sb.end_time IS NOT NULL
                 AND sb.end_time > sb.start_time
                 AND tstzrange((v_date + sb.start_time) AT TIME ZONE v_timezone, (v_date + sb.end_time) AT TIME ZONE v_timezone, '[)')
                     && tstzrange(v_slot_start, v_slot_end, '[)'))
           )
      ) THEN
        IF NOT v_seen_slots ? (v_staff_id::text || ':' || v_slot_start::text) THEN
          v_result := v_result || jsonb_build_object(
            'staff_id', v_staff_id,
            'start_time', v_slot_start,
            'end_time', v_slot_end,
            'available', true
          );
          v_seen_slots := v_seen_slots || jsonb_build_object(v_staff_id::text || ':' || v_slot_start::text, true);
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- Ordenar o resultado final cronologicamente
  IF jsonb_array_length(v_result) > 1 THEN
    SELECT COALESCE(jsonb_agg(elem ORDER BY (elem->>'start_time') ASC), '[]'::jsonb)
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
