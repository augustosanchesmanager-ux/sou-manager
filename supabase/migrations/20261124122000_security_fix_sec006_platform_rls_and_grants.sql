-- ============================================================================
-- Migration: 20261124122000_security_fix_sec006_platform_rls_and_grants.sql
-- Issue: #376 (SEC-006 / P0-01)
-- Scope:
--   1. Tighten platform_subscriptions & platform_invoices RLS so tenants can
--      only SELECT their own rows and only superadmins can INSERT/UPDATE/DELETE.
--   2. Replace case-sensitive profiles.role = 'superadmin' checks on
--      access_requests with public.current_is_super_admin_from_auth_uid().
--   3. Revoke excessive PUBLIC / anon / authenticated table privileges across
--      platform_subscriptions, platform_invoices, access_requests,
--      feature_flags, plans, subscriptions, and invoices.
-- Note: Applied ONLY after PO review and explicit production authorization.
-- ============================================================================

BEGIN;

-- 1. Ensure RLS is enabled on target tables
ALTER TABLE IF EXISTS public.platform_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.feature_flags ENABLE ROW LEVEL SECURITY;

-- 2. Hardening: public.platform_subscriptions
DROP POLICY IF EXISTS platform_subscriptions_select_policy ON public.platform_subscriptions;
DROP POLICY IF EXISTS platform_subscriptions_insert_policy ON public.platform_subscriptions;
DROP POLICY IF EXISTS platform_subscriptions_update_policy ON public.platform_subscriptions;
DROP POLICY IF EXISTS platform_subscriptions_delete_policy ON public.platform_subscriptions;

CREATE POLICY platform_subscriptions_select_policy
  ON public.platform_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY platform_subscriptions_insert_policy
  ON public.platform_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_is_super_admin_from_auth_uid());

CREATE POLICY platform_subscriptions_update_policy
  ON public.platform_subscriptions
  FOR UPDATE
  TO authenticated
  USING (public.current_is_super_admin_from_auth_uid())
  WITH CHECK (public.current_is_super_admin_from_auth_uid());

CREATE POLICY platform_subscriptions_delete_policy
  ON public.platform_subscriptions
  FOR DELETE
  TO authenticated
  USING (public.current_is_super_admin_from_auth_uid());

-- 3. Hardening: public.platform_invoices
DROP POLICY IF EXISTS platform_invoices_select_policy ON public.platform_invoices;
DROP POLICY IF EXISTS platform_invoices_insert_policy ON public.platform_invoices;
DROP POLICY IF EXISTS platform_invoices_update_policy ON public.platform_invoices;
DROP POLICY IF EXISTS platform_invoices_delete_policy ON public.platform_invoices;

CREATE POLICY platform_invoices_select_policy
  ON public.platform_invoices
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY platform_invoices_insert_policy
  ON public.platform_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_is_super_admin_from_auth_uid());

CREATE POLICY platform_invoices_update_policy
  ON public.platform_invoices
  FOR UPDATE
  TO authenticated
  USING (public.current_is_super_admin_from_auth_uid())
  WITH CHECK (public.current_is_super_admin_from_auth_uid());

CREATE POLICY platform_invoices_delete_policy
  ON public.platform_invoices
  FOR DELETE
  TO authenticated
  USING (public.current_is_super_admin_from_auth_uid());

-- 4. Hardening: public.access_requests (remove case-sensitive role check)
DROP POLICY IF EXISTS "public insert access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "superadmin full access access_requests" ON public.access_requests;
DROP POLICY IF EXISTS "superadmin_requests_visibility" ON public.access_requests;

CREATE POLICY "public insert access_requests"
  ON public.access_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "superadmin full access access_requests"
  ON public.access_requests
  FOR ALL
  TO authenticated
  USING (public.current_is_super_admin_from_auth_uid())
  WITH CHECK (public.current_is_super_admin_from_auth_uid());

-- 5. Least-privilege table GRANT hardening
REVOKE ALL ON TABLE public.platform_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_subscriptions TO authenticated;

REVOKE ALL ON TABLE public.platform_invoices FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_invoices TO authenticated;

REVOKE ALL ON TABLE public.access_requests FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.access_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.access_requests TO authenticated;

-- Keep SELECT for authenticated so RLS filters non-superadmins to [] (H6-15 compliance)
REVOKE ALL ON TABLE public.feature_flags FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.feature_flags TO authenticated;

REVOKE ALL ON TABLE public.plans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.plans TO anon, authenticated;

REVOKE ALL ON TABLE public.subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.subscriptions TO authenticated;

REVOKE ALL ON TABLE public.invoices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.invoices TO authenticated;

COMMIT;
