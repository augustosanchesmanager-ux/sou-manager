-- Migration: Add show_in_booking to services and update get_public_tenant_profile
-- Frente 3.2: Controle de visibilidade de servicos no agendamento publico

BEGIN;

-- 1. Adiciona coluna show_in_booking na tabela services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS show_in_booking BOOLEAN NOT NULL DEFAULT true;

-- 2. Recria a RPC get_public_tenant_profile filtrando apenas servicos com show_in_booking = true
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

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', st.id, 'name', st.name, 'status', st.status)
    ORDER BY st.name
  ), '[]'::jsonb) INTO v_staff
    FROM public.staff st
   WHERE st.tenant_id = v_tenant_id AND st.status = 'active';

  RETURN jsonb_build_object(
    'tenant_id', v_tenant.id,
    'name', v_tenant.name,
    'slug', v_tenant.slug,
    'logo_url', v_tenant_json ->> 'logo_url',
    'address', v_tenant_json ->> 'address',
    'phone', v_tenant_json ->> 'phone',
    'social_links', v_tenant_json -> 'social_links',
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

COMMIT;
