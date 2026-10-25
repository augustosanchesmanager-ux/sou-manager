-- ============================================================================
-- Migration: sync_comanda_from_appointment
-- Date: 2026-10-25
-- Description:
--   1. Cria indice UNIQUE parcial em comandas (tenant_id, appointment_id)
--      para status = 'open' e appointment_id IS NOT NULL, garantindo integridade
--      e impedindo race conditions de comandas duplicadas para o mesmo agendamento.
--   2. Cria a RPC atômica transacional sync_comanda_from_appointment com locks
--      pessimistas FOR UPDATE, hard gates contábeis (P0001-P0004), preservação
--      de produtos avulsos e recálculo automático de total.
-- ============================================================================

BEGIN;

-- 1. Índice parcial de unicidade para agendamentos com comanda aberta
CREATE UNIQUE INDEX IF NOT EXISTS idx_comandas_unique_active_appointment
    ON public.comandas (tenant_id, appointment_id)
    WHERE status = 'open' AND appointment_id IS NOT NULL;

-- 2. RPC Atômica de Sincronização Agenda ➔ Comanda Aberta
CREATE OR REPLACE FUNCTION public.sync_comanda_from_appointment(
  p_tenant_id UUID,
  p_appointment_id UUID,
  p_new_staff_id UUID,
  p_new_start_time TIMESTAMPTZ,
  p_new_end_time TIMESTAMPTZ,
  p_services JSONB DEFAULT '[]'::jsonb,
  p_notes TEXT DEFAULT NULL,
  p_sync_comanda BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_appointment RECORD;
  v_comanda RECORD;
  v_staff_name TEXT;
  v_service_item JSONB;
  v_first_service_id UUID := NULL;
  v_first_service_name TEXT := '';
  v_services_label TEXT := '';
  v_services_total_price NUMERIC(10,2) := 0;
  v_duration_hours NUMERIC(5,2);
  v_duration_minutes INTEGER;
  v_new_subtotal NUMERIC(10,2) := 0;
  v_preserved_products_count INTEGER := 0;
  v_has_club_credits BOOLEAN := FALSE;
  v_has_payments BOOLEAN := FALSE;
BEGIN
  -- 1. Validar autenticação e isolamento multi-tenant
  v_auth_tenant_id := public.current_tenant_id_from_auth_uid();
  v_is_super_admin := public.current_is_super_admin_from_auth_uid();

  IF NOT COALESCE(v_is_super_admin, false) AND (p_tenant_id IS NULL OR p_tenant_id <> v_auth_tenant_id) THEN
    RAISE EXCEPTION 'Tenant invalido ou nao autorizado' USING ERRCODE = 'P0001';
  END IF;

  IF p_appointment_id IS NULL OR p_new_staff_id IS NULL OR p_new_start_time IS NULL OR p_new_end_time IS NULL THEN
    RAISE EXCEPTION 'Parametros obrigatorios ausentes' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Lock pessimista no agendamento
  SELECT * INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_appointment.id IS NULL THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND: Agendamento nao encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Obter nome do novo profissional
  SELECT name INTO v_staff_name
  FROM public.staff
  WHERE id = p_new_staff_id AND tenant_id = p_tenant_id;

  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'Profissional nao encontrado' USING ERRCODE = 'P0001';
  END IF;

  -- 4. Parse e cálculo dos serviços e duração
  v_duration_hours := ROUND(EXTRACT(EPOCH FROM (p_new_end_time - p_new_start_time)) / 3600.0, 2);
  v_duration_minutes := ROUND(EXTRACT(EPOCH FROM (p_new_end_time - p_new_start_time)) / 60.0);

  IF jsonb_typeof(p_services) = 'array' AND jsonb_array_length(p_services) > 0 THEN
    FOR v_service_item IN SELECT * FROM jsonb_array_elements(p_services)
    LOOP
      IF v_first_service_id IS NULL THEN
        v_first_service_id := (v_service_item->>'service_id')::uuid;
        v_first_service_name := COALESCE(v_service_item->>'name', '');
      END IF;

      IF v_services_label = '' THEN
        v_services_label := COALESCE(v_service_item->>'name', 'Servico');
      ELSE
        v_services_label := v_services_label || ' + ' || COALESCE(v_service_item->>'name', 'Servico');
      END IF;

      v_services_total_price := v_services_total_price + COALESCE(
        (v_service_item->>'price')::numeric,
        (v_service_item->>'unit_price')::numeric,
        0
      );
    END LOOP;
  ELSE
    v_first_service_id := v_appointment.service_id;
    v_first_service_name := v_appointment.service_name;
    v_services_label := COALESCE(v_appointment.service_name, 'Servico');
    v_services_total_price := COALESCE(v_appointment.price, 0);
  END IF;

  -- 5. Atualizar agendamento atomicamente
  UPDATE public.appointments
  SET
    staff_id = p_new_staff_id,
    staff_name = v_staff_name,
    start_time = p_new_start_time,
    end_time = p_new_end_time,
    duration = v_duration_hours,
    service_id = v_first_service_id,
    service_name = v_services_label,
    price = v_services_total_price,
    notes = COALESCE(p_notes, notes)
  WHERE id = p_appointment_id AND tenant_id = p_tenant_id;

  -- 6. Atualizar appointment_services se a tabela existir
  IF to_regclass('public.appointment_services') IS NOT NULL AND jsonb_typeof(p_services) = 'array' AND jsonb_array_length(p_services) > 0 THEN
    DELETE FROM public.appointment_services
    WHERE appointment_id = p_appointment_id AND tenant_id = p_tenant_id;

    INSERT INTO public.appointment_services (
      tenant_id,
      appointment_id,
      service_id,
      unit_price,
      duration_minutes,
      quantity,
      sort_order
    )
    SELECT
      p_tenant_id,
      p_appointment_id,
      (item->>'service_id')::uuid,
      COALESCE((item->>'unit_price')::numeric, (item->>'price')::numeric, 0),
      COALESCE((item->>'duration_minutes')::integer, (item->>'duration')::integer, 30),
      COALESCE((item->>'quantity')::integer, 1),
      (ord.ordinality - 1)::integer
    FROM jsonb_array_elements(p_services) WITH ORDINALITY AS ord(item, ordinality);
  END IF;

  -- 7. Sincronizar comanda vinculada se solicitado
  IF COALESCE(p_sync_comanda, true) THEN
    SELECT * INTO v_comanda
    FROM public.comandas
    WHERE appointment_id = p_appointment_id
      AND tenant_id = p_tenant_id
      AND status <> 'cancelled'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_comanda.id IS NOT NULL THEN
      -- Hard Gate P0003: Comanda já finalizada, fechada ou liquidada
      IF LOWER(COALESCE(v_comanda.status, '')) IN ('paid', 'closed', 'billed') THEN
        RAISE EXCEPTION 'COMANDA_ALREADY_SETTLED: Comanda ja liquidada ou fechada' USING ERRCODE = 'P0003';
      END IF;

      -- Hard Gate P0003: Comanda com pagamentos parciais registrados
      IF to_regclass('public.comanda_payments') IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM public.comanda_payments
          WHERE comanda_id = v_comanda.id AND tenant_id = p_tenant_id AND reversed_at IS NULL
        ) INTO v_has_payments;

        IF v_has_payments THEN
          RAISE EXCEPTION 'COMANDA_ALREADY_SETTLED: Comanda possui pagamentos registrados' USING ERRCODE = 'P0003';
        END IF;
      END IF;

      -- Hard Gate P0004: Comanda com créditos de clube / assinatura aplicados
      IF to_regclass('public.customer_plan_credit_usages') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.customer_plan_credit_usages WHERE comanda_id = $1 AND tenant_id = $2)'
        INTO v_has_club_credits
        USING v_comanda.id, p_tenant_id;

        IF v_has_club_credits THEN
          RAISE EXCEPTION 'COMANDA_HAS_CLUB_CREDITS: Comanda possui creditos de assinatura/clube aplicados' USING ERRCODE = 'P0004';
        END IF;
      END IF;

      -- Contar produtos avulsos de consumo preservados (onde service_id IS NULL)
      SELECT COUNT(*) INTO v_preserved_products_count
      FROM public.comanda_items
      WHERE comanda_id = v_comanda.id AND tenant_id = p_tenant_id AND service_id IS NULL;

      -- Remover estritamente serviços da comanda (preserva produtos de balcão)
      DELETE FROM public.comanda_items
      WHERE comanda_id = v_comanda.id AND tenant_id = p_tenant_id AND service_id IS NOT NULL;

      -- Inserir os novos serviços na comanda com o novo profissional
      IF jsonb_typeof(p_services) = 'array' AND jsonb_array_length(p_services) > 0 THEN
        FOR v_service_item IN SELECT * FROM jsonb_array_elements(p_services)
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
            v_comanda.id,
            (v_service_item->>'service_id')::uuid,
            COALESCE(v_service_item->>'name', 'Servico'),
            COALESCE((v_service_item->>'quantity')::integer, 1),
            COALESCE((v_service_item->>'unit_price')::numeric, (v_service_item->>'price')::numeric, 0),
            p_new_staff_id
          );
        END LOOP;
      ELSE
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
          v_comanda.id,
          v_first_service_id,
          v_first_service_name,
          1,
          v_services_total_price,
          p_new_staff_id
        );
      END IF;

      -- Recalcular subtotal e total contábil da comanda
      SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_new_subtotal
      FROM public.comanda_items
      WHERE comanda_id = v_comanda.id AND tenant_id = p_tenant_id;

      -- Atualizar comanda (cabeçalho, profissional e total)
      UPDATE public.comandas
      SET
        staff_id = p_new_staff_id,
        total = GREATEST(0, v_new_subtotal)
      WHERE id = v_comanda.id AND tenant_id = p_tenant_id;

      RETURN jsonb_build_object(
        'success', true,
        'appointment_id', p_appointment_id,
        'comanda_id', v_comanda.id,
        'comanda_updated', true,
        'preserved_products_count', v_preserved_products_count,
        'new_total', v_new_subtotal,
        'appointment_status', v_appointment.status
      );
    END IF;
  END IF;

  -- Caso sem comanda vinculada (ou p_sync_comanda = false)
  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', p_appointment_id,
    'comanda_id', null,
    'comanda_updated', false,
    'preserved_products_count', 0,
    'new_total', null,
    'appointment_status', v_appointment.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_comanda_from_appointment(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_comanda_from_appointment(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, TEXT, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
