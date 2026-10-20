-- Migration: 20261020111000_booking_settings_social_and_location_links.sql
-- Description: Fase 1 de /booking-settings — adiciona canais de atendimento e localizacao
--              (instagram_url, whatsapp_number, maps_url) em public.tenant_settings,
--              ajusta RLS de escrita para admin/manager e projeta campos publicos na RPC
--              get_public_tenant_profile sem expor dados sensiveis da organizacao.
-- STOP GATE: nao aplicar em STAGING/PROD sem aprovacao explicita do PO.

BEGIN;

-- ============================================================================
-- 1. public.tenant_settings — novas colunas de links sociais e localizacao
-- ============================================================================

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_booking_notice_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS auto_confirm_online_bookings BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS public_cancel_window_minutes INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS work_start_time TIME DEFAULT '07:00:00',
  ADD COLUMN IF NOT EXISTS work_end_time TIME DEFAULT '20:00:00',
  ADD COLUMN IF NOT EXISTS instagram_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT NULL,
  ADD COLUMN IF NOT EXISTS maps_url TEXT NULL;

-- ============================================================================
-- 2. RLS — isolamento multi-tenant + escrita restrita a admin/manager + leitura anon restrita
-- ============================================================================

-- Garantir helper current_is_manager_from_auth_uid disponivel (idempotente, padrao ADR-021)
CREATE OR REPLACE FUNCTION public.current_is_manager_from_auth_uid(
    p_tenant_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_tenants ut
        WHERE ut.user_id = auth.uid()
          AND ut.tenant_id = p_tenant_id
          AND LOWER(BTRIM(COALESCE(ut.role, ''))) IN
              ('owner', 'admin', 'manager', 'gerente')
    )
    OR (
        public.current_tenant_id_from_auth_uid() = p_tenant_id
        AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND LOWER(BTRIM(COALESCE(p.role, ''))) IN
                  ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
        )
    );
$$;

REVOKE ALL ON FUNCTION public.current_is_manager_from_auth_uid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_is_manager_from_auth_uid(UUID) TO authenticated;

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- Substituir policy generica por policies granulares de SELECT (membros do tenant) e WRITE (admin/manager)
DROP POLICY IF EXISTS "tenant_settings_isolation" ON public.tenant_settings;
DROP POLICY IF EXISTS "tenant_settings_select_authenticated" ON public.tenant_settings;
DROP POLICY IF EXISTS "tenant_settings_write_manager" ON public.tenant_settings;
DROP POLICY IF EXISTS "tenant_settings_select_anon_public_booking" ON public.tenant_settings;

CREATE POLICY "tenant_settings_select_authenticated" ON public.tenant_settings
  FOR SELECT TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

CREATE POLICY "tenant_settings_write_manager" ON public.tenant_settings
  FOR ALL TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND public.current_is_manager_from_auth_uid(tenant_id)
    )
  )
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND public.current_is_manager_from_auth_uid(tenant_id)
    )
  );

-- Leitura anonima segura: revogar SELECT amplo de anon e conceder apenas nas colunas publicas de agendamento
REVOKE ALL ON TABLE public.tenant_settings FROM anon;
GRANT SELECT (
  tenant_id,
  booking_enabled,
  work_start_time,
  work_end_time,
  instagram_url,
  whatsapp_number,
  maps_url
) ON public.tenant_settings TO anon;

CREATE POLICY "tenant_settings_select_anon_public_booking" ON public.tenant_settings
  FOR SELECT TO anon
  USING (COALESCE(booking_enabled, false) = true);

-- ============================================================================
-- 3. RPC 1: get_public_tenant_profile — projetar instagram_url, whatsapp_number e maps_url
-- ============================================================================

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

NOTIFY pgrst, 'reload schema';

COMMIT;
