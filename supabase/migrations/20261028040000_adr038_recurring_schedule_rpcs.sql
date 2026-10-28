-- ============================================================================
-- Migration: 20261028040000_adr038_recurring_schedule_rpcs.sql
-- ADR-038: RPCs de Geração por Janela Rolante e Despejo por Inadimplência
-- ============================================================================

BEGIN;

-- 1. RPC generate_subscription_recurring_appointments
-- Materializa os slots recorrentes na tabela appointments dentro da janela rolante
-- respeitando ciclo pago, precedência de schedule_blocks do profissional e quotas.
CREATE OR REPLACE FUNCTION public.generate_subscription_recurring_appointments(
  p_tenant_id UUID,
  p_days_ahead INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_slot RECORD;
  v_target_date DATE;
  v_end_date DATE;
  v_slot_dow SMALLINT;
  v_appointment_start TIMESTAMPTZ;
  v_has_conflict BOOLEAN;
  v_credit RECORD;
  v_generated_count INTEGER := 0;
  v_skipped_conflict_count INTEGER := 0;
  v_skipped_quota_count INTEGER := 0;
  v_results JSONB := '[]'::jsonb;
BEGIN
  -- 1. Validar autenticação e isolamento multi-tenant
  v_auth_tenant_id := public.current_tenant_id_from_auth_uid();
  v_is_super_admin := public.current_is_super_admin_from_auth_uid();

  IF NOT COALESCE(v_is_super_admin, false) AND (p_tenant_id IS NULL OR p_tenant_id <> v_auth_tenant_id) THEN
    RAISE EXCEPTION 'Tenant invalido ou nao autorizado' USING ERRCODE = 'P0001';
  END IF;

  IF p_days_ahead IS NULL OR p_days_ahead < 1 THEN
    p_days_ahead := 30;
  ELSIF p_days_ahead > 60 THEN
    p_days_ahead := 60;
  END IF;

  v_end_date := CURRENT_DATE + p_days_ahead;

  -- 2. Iterar sobre todos os slots recorrentes ativos cujas assinaturas estejam ativas
  FOR v_slot IN
    SELECT 
      rs.id AS slot_id,
      rs.tenant_id,
      rs.subscription_id,
      rs.client_id,
      rs.professional_id,
      rs.service_id,
      rs.day_of_week,
      rs.start_time,
      rs.duration_minutes,
      sub.cycle_start,
      sub.cycle_end,
      c.name AS client_name,
      s.name AS staff_name,
      srv.name AS service_name,
      COALESCE(srv.duration, rs.duration_minutes) AS service_duration
    FROM public.subscription_recurring_slots rs
    JOIN public.customer_subscriptions sub ON sub.id = rs.subscription_id
    JOIN public.clients c ON c.id = rs.client_id
    JOIN public.staff s ON s.id = rs.professional_id
    JOIN public.services srv ON srv.id = rs.service_id
    WHERE rs.tenant_id = p_tenant_id
      AND rs.is_active = TRUE
      AND sub.status = 'active'
  LOOP
    -- Iterar datas no horizonte dentro do ciclo de faturamento ativo
    v_target_date := CURRENT_DATE;
    WHILE v_target_date <= v_end_date LOOP
      -- Verificar se a data está contida no ciclo de faturamento vigente
      IF v_target_date >= v_slot.cycle_start::date AND v_target_date <= v_slot.cycle_end::date THEN
        -- Verificar se o dia da semana bate (0=Dom, ..., 6=Sáb)
        v_slot_dow := EXTRACT(DOW FROM v_target_date)::smallint;
        IF v_slot_dow = v_slot.day_of_week THEN
          -- Construir timestamp do agendamento em UTC
          v_appointment_start := timezone('utc'::text, (v_target_date + v_slot.start_time));

          -- Apenas gerar para horários futuros
          IF v_appointment_start > timezone('utc'::text, now()) THEN
            -- Check 1: Idempotência — agendamento já gerado para este slot nesta data/hora
            IF NOT EXISTS (
              SELECT 1 FROM public.appointments
              WHERE tenant_id = p_tenant_id
                AND recurring_slot_id = v_slot.slot_id
                AND start_time = v_appointment_start
                AND status <> 'cancelled'
            ) THEN
              -- Check 2: Bloqueio de agenda do profissional (ADR-038 D3)
              v_has_conflict := FALSE;
              IF EXISTS (
                SELECT 1 FROM public.schedule_blocks
                WHERE tenant_id = p_tenant_id
                  AND (professional_id = v_slot.professional_id OR professional_id IS NULL)
                  AND status = 'active'
                  AND start_date <= v_target_date
                  AND end_date >= v_target_date
                  AND (
                    block_type = 'full_day'
                    OR (
                      block_type = 'time_range'
                      AND start_time <= v_slot.start_time
                      AND end_time > v_slot.start_time
                    )
                  )
              ) THEN
                v_has_conflict := TRUE;
              END IF;

              -- Check 3: Conflito com outro agendamento ativo na mesma cadeira
              IF NOT v_has_conflict AND EXISTS (
                SELECT 1 FROM public.appointments
                WHERE tenant_id = p_tenant_id
                  AND staff_id = v_slot.professional_id
                  AND start_time = v_appointment_start
                  AND status <> 'cancelled'
              ) THEN
                v_has_conflict := TRUE;
              END IF;

              IF v_has_conflict THEN
                v_skipped_conflict_count := v_skipped_conflict_count + 1;
                v_results := v_results || jsonb_build_object(
                  'slot_id', v_slot.slot_id,
                  'client_name', v_slot.client_name,
                  'date', v_target_date,
                  'status', 'skipped_conflict'
                );
              ELSE
                -- Check 4: Verificação e débito de créditos do ciclo (ADR-038 D4)
                SELECT * INTO v_credit
                FROM public.customer_credits
                WHERE tenant_id = p_tenant_id
                  AND subscription_id = v_slot.subscription_id
                FOR UPDATE;

                IF v_credit.id IS NOT NULL AND v_credit.available_credits <= 0 THEN
                  -- Sem créditos disponíveis no ciclo
                  v_skipped_quota_count := v_skipped_quota_count + 1;
                  v_results := v_results || jsonb_build_object(
                    'slot_id', v_slot.slot_id,
                    'client_name', v_slot.client_name,
                    'date', v_target_date,
                    'status', 'skipped_quota_exhausted'
                  );
                ELSE
                  -- Se houver controle de crédito, deduz 1 crédito
                  IF v_credit.id IS NOT NULL AND v_credit.available_credits > 0 THEN
                    UPDATE public.customer_credits
                    SET available_credits = available_credits - 1,
                        used_credits = used_credits + 1,
                        updated_at = timezone('utc'::text, now())
                    WHERE id = v_credit.id;
                  END IF;

                  -- Inserir agendamento confirmado
                  INSERT INTO public.appointments (
                    tenant_id,
                    client_id,
                    staff_id,
                    service_id,
                    client_name,
                    staff_name,
                    service_name,
                    start_time,
                    duration,
                    status,
                    recurring_slot_id,
                    subscription_id,
                    is_recurring
                  ) VALUES (
                    p_tenant_id,
                    v_slot.client_id,
                    v_slot.professional_id,
                    v_slot.service_id,
                    v_slot.client_name,
                    v_slot.staff_name,
                    v_slot.service_name,
                    v_appointment_start,
                    (COALESCE(v_slot.duration_minutes, 30) / 60.0)::numeric(3,1),
                    'confirmed',
                    v_slot.slot_id,
                    v_slot.subscription_id,
                    TRUE
                  );

                  v_generated_count := v_generated_count + 1;
                  v_results := v_results || jsonb_build_object(
                    'slot_id', v_slot.slot_id,
                    'client_name', v_slot.client_name,
                    'date', v_target_date,
                    'start_time', v_appointment_start,
                    'status', 'generated'
                  );
                END IF;
              END IF;
            END IF;
          END IF;
        END IF;
      END IF;

      v_target_date := v_target_date + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'generated_count', v_generated_count,
    'skipped_conflict_count', v_skipped_conflict_count,
    'skipped_quota_count', v_skipped_quota_count,
    'details', v_results
  );
END;
$$;

-- 2. RPC evict_overdue_subscription_appointments
-- Cancela agendamentos futuros não realizados de assinantes past_due após o grace period
CREATE OR REPLACE FUNCTION public.evict_overdue_subscription_appointments(
  p_tenant_id UUID,
  p_grace_period_days INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_evicted_count INTEGER := 0;
  v_evicted_records JSONB := '[]'::jsonb;
  v_record RECORD;
BEGIN
  -- 1. Validar autenticação e isolamento multi-tenant
  v_auth_tenant_id := public.current_tenant_id_from_auth_uid();
  v_is_super_admin := public.current_is_super_admin_from_auth_uid();

  IF NOT COALESCE(v_is_super_admin, false) AND (p_tenant_id IS NULL OR p_tenant_id <> v_auth_tenant_id) THEN
    RAISE EXCEPTION 'Tenant invalido ou nao autorizado' USING ERRCODE = 'P0001';
  END IF;

  IF p_grace_period_days IS NULL OR p_grace_period_days < 0 THEN
    p_grace_period_days := 5;
  END IF;

  -- 2. Localizar e cancelar agendamentos futuros de assinaturas past_due vencidas
  FOR v_record IN
    SELECT 
      a.id AS appointment_id,
      a.client_name,
      a.start_time,
      sub.id AS subscription_id
    FROM public.appointments a
    JOIN public.customer_subscriptions sub ON sub.id = a.subscription_id
    WHERE a.tenant_id = p_tenant_id
      AND a.start_time > timezone('utc'::text, now())
      AND a.status IN ('pending', 'confirmed')
      AND sub.status = 'past_due'
      AND sub.updated_at < (timezone('utc'::text, now()) - (p_grace_period_days || ' days')::interval)
    FOR UPDATE OF a
  LOOP
    UPDATE public.appointments
    SET status = 'cancelled'
    WHERE id = v_record.appointment_id;

    v_evicted_count := v_evicted_count + 1;
    v_evicted_records := v_evicted_records || jsonb_build_object(
      'appointment_id', v_record.appointment_id,
      'client_name', v_record.client_name,
      'start_time', v_record.start_time,
      'subscription_id', v_record.subscription_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'evicted_count', v_evicted_count,
    'grace_period_days', p_grace_period_days,
    'details', v_evicted_records
  );
END;
$$;

-- 3. Grants de execução seguros (least privilege, sem anon)
REVOKE ALL ON FUNCTION public.generate_subscription_recurring_appointments(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_subscription_recurring_appointments(UUID, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.evict_overdue_subscription_appointments(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evict_overdue_subscription_appointments(UUID, INTEGER) TO authenticated, service_role;

COMMIT;
