BEGIN;

CREATE OR REPLACE FUNCTION public.create_appointment_with_comanda(
  p_tenant_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_service_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE s.id = p_service_id
    AND s.tenant_id = p_tenant_id
    AND COALESCE(
      NULLIF(to_jsonb(s)->>'active', '')::boolean,
      NULLIF(to_jsonb(s)->>'is_active', '')::boolean,
      true
    ) = true
  LIMIT 1;

  IF v_service_name IS NULL THEN
    RAISE EXCEPTION 'Servico invalido para este tenant';
  END IF;

  SELECT st.name
  INTO v_staff_name
  FROM public.staff st
  WHERE st.id = p_staff_id
    AND st.tenant_id = p_tenant_id
    AND lower(COALESCE(st.status, 'active')) = 'active'
  LIMIT 1;

  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'Profissional invalido para este tenant';
  END IF;

  IF p_client_id IS NOT NULL THEN
    SELECT c.name
    INTO v_client_name
    FROM public.clients c
    WHERE c.id = p_client_id
      AND c.tenant_id = p_tenant_id
    LIMIT 1;

    IF v_client_name IS NULL THEN
      RAISE EXCEPTION 'Cliente invalido para este tenant';
    END IF;
  END IF;

  v_client_name := NULLIF(BTRIM(COALESCE(p_client_name, v_client_name)), '');
  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Nome do cliente e obrigatorio';
  END IF;

  v_duration_hours := ROUND((GREATEST(COALESCE(v_service_duration_minutes, 30), 1) / 60.0)::numeric, 1);

  INSERT INTO public.appointments (
    tenant_id,
    client_id,
    service_id,
    staff_id,
    client_name,
    service_name,
    staff_name,
    start_time,
    duration,
    status
  )
  VALUES (
    p_tenant_id,
    p_client_id,
    p_service_id,
    p_staff_id,
    v_client_name,
    v_service_name,
    v_staff_name,
    p_start_time,
    v_duration_hours,
    'confirmed'
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.comandas (
    tenant_id,
    appointment_id,
    client_id,
    staff_id,
    status,
    total
  )
  VALUES (
    p_tenant_id,
    v_appointment_id,
    p_client_id,
    p_staff_id,
    'open',
    v_service_price
  )
  RETURNING id INTO v_comanda_id;

  INSERT INTO public.comanda_items (
    tenant_id,
    comanda_id,
    service_id,
    product_name,
    quantity,
    unit_price
  )
  VALUES (
    p_tenant_id,
    v_comanda_id,
    p_service_id,
    v_service_name,
    1,
    v_service_price
  )
  RETURNING id INTO v_comanda_item_id;

  UPDATE public.comandas
  SET total = v_service_price
  WHERE id = v_comanda_id
    AND tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'comanda_id', v_comanda_id,
    'comanda_item_id', v_comanda_item_id,
    'service_price', v_service_price,
    'appointment_status', 'confirmed'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_appointment_with_comanda(UUID, UUID, TEXT, UUID, UUID, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
