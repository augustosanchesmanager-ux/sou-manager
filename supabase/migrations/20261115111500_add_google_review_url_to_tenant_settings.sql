-- Migration: 20261115111500_add_google_review_url_to_tenant_settings.sql
-- Adds nullable google_review_url column to online_booking_settings and tenant_settings.
-- Protected by existing tenant-scoped RLS policies:
--   - online_booking_settings_select_authenticated / online_booking_settings_write_manager
--   - tenant_settings RLS policies (current_tenant_id_from_auth_uid())

BEGIN;

ALTER TABLE public.online_booking_settings
  ADD COLUMN IF NOT EXISTS google_review_url TEXT NULL;

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS google_review_url TEXT NULL;

GRANT SELECT (
  tenant_id,
  is_active,
  display_name,
  slug,
  display_address,
  logo_url,
  cover_banner_url,
  primary_color,
  theme_mode,
  slogan,
  about_text,
  show_products,
  featured_product_ids,
  featured_service_ids,
  phone_whatsapp,
  instagram_url,
  google_maps_url,
  google_review_url,
  weekly_schedule
) ON public.online_booking_settings TO anon;

COMMIT;
