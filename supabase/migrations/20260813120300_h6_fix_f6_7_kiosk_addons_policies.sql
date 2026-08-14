-- ==============================================================================
-- H6 F6-7: kiosk_addons — policies com isolamento por tenant + revoke anon
-- ==============================================================================
-- Contexto: homologação H-6 (docs/audit/H6_SECURITY_AUDIT.md). Achado F6-7 (P2).
--   Policies legadas USING (true) / WITH CHECK (true) de 20260304_kiosk_module.sql
--   permitiam a qualquer autenticado ler e ALTERAR a config de kiosk de outro
--   tenant (upsert persistiu: status=disabled/max_devices=9/theme=custom), além de
--   leitura anon (dado real do Sanchez retornado).
-- Correção (aprovada pelo PO): tenant-scope nas policies SELECT/INSERT/UPDATE
--   (tenant_id = current_tenant_id_from_auth_uid() OU superadmin) + revoke de anon.
-- A tabela kiosk_addons é órfã no frontend (KioskAdmin usa tenant_addons e
-- kiosk_devices) — o tenant-scope mantém compatibilidade sem quebrar fluxo.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "kiosk_addons_select" ON public.kiosk_addons;
DROP POLICY IF EXISTS "kiosk_addons_insert" ON public.kiosk_addons;
DROP POLICY IF EXISTS "kiosk_addons_update" ON public.kiosk_addons;

CREATE POLICY "kiosk_addons_select" ON public.kiosk_addons
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id_from_auth_uid()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY "kiosk_addons_insert" ON public.kiosk_addons
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id_from_auth_uid()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY "kiosk_addons_update" ON public.kiosk_addons
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id_from_auth_uid()
    OR public.current_is_super_admin_from_auth_uid()
  );

-- Revoke de anon/PUBLIC (defesa em profundidade — RLS já bloqueia anon)
REVOKE ALL ON TABLE public.kiosk_addons FROM anon;
REVOKE ALL ON TABLE public.kiosk_addons FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.kiosk_addons TO authenticated;

-- NOTIFY pgrst, 'reload schema';
