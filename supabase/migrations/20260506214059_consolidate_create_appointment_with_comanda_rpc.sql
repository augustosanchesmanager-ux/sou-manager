BEGIN;

DROP FUNCTION IF EXISTS public.create_appointment_with_comanda(UUID, UUID, TEXT, UUID, UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.create_appointment_with_comanda(UUID, UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.create_appointment_with_comanda(UUID, UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_appointment_with_comanda(UUID, UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, NUMERIC, TEXT, TEXT, BOOLEAN);

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS client_phone TEXT,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS is_overbooked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_id UUID,
  ADD COLUMN IF NOT EXISTS eligible_for_plan_credit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expected_plan_service TEXT,
  ADD COLUMN IF NOT EXISTS plan_credit_preview JSONB;

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_idempotency_key
  ON public.appointments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_comandas_idempotency_key
  ON public.comandas(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

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
  v_client_name TEXT;
  v_service_name TEXT;
  v_staff_name TEXT;
  v_service_price NUMERIC(10, 2) := 0;
  v_service_duration_minutes NUMERIC := 30;
  v_duration_hours NUMERIC(3, 1) := 1;
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

  v_duration_hours := ROUND((GREATEST(COALESCE(v_service_duration_minutes, 30), 1) / 60.0)::numeric, 1);

  IF p_start_time::date > current_date THEN
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
    p_start_time + (v_duration_hours * interval '1 hour'),
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

NOTIFY pgrst, 'reload schema';

COMMIT;
