-- ==============================================================================
-- ROLLBACK — 20260813120300_h6_fix_f6_7_kiosk_addons_policies.sql
-- Restaura as policies LEGADAS e os GRANTS ORIGINAIS de public.kiosk_addons
-- Fonte:
--   policies: supabase/migrations/20260304_kiosk_module.sql:99-104
--   grants:   docs/backups/backup_pre_migration_20260728_152717.sql:13042-13044
-- ==============================================================================
-- Reversão do fix F6-7: volta a permitir leitura/escrita de QUALQUER autenticado
-- (USING/WITH CHECK true) e a leitura de anon (GRANT ALL). ⚠️ Reintroduz F6-7.
-- Exige aprovação explícita do PO (AGENTS.md — operação reversa/destrutiva).
-- ==============================================================================

-- 1. Remove as policies tenant-scoped criadas pelo fix
DROP POLICY IF EXISTS "kiosk_addons_select" ON public.kiosk_addons;
DROP POLICY IF EXISTS "kiosk_addons_insert" ON public.kiosk_addons;
DROP POLICY IF EXISTS "kiosk_addons_update" ON public.kiosk_addons;

-- 2. Restaura as policies legadas abertas
CREATE POLICY "kiosk_addons_select" ON public.kiosk_addons
  FOR SELECT
  USING (true);

CREATE POLICY "kiosk_addons_insert" ON public.kiosk_addons
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "kiosk_addons_update" ON public.kiosk_addons
  FOR UPDATE
  USING (true);

-- 3. Restaura os grants originais (anon + authenticated + service_role = ALL)
REVOKE SELECT, INSERT, UPDATE ON TABLE public.kiosk_addons FROM authenticated;
REVOKE ALL ON TABLE public.kiosk_addons FROM anon;
REVOKE ALL ON TABLE public.kiosk_addons FROM PUBLIC;
GRANT ALL ON TABLE public.kiosk_addons TO anon;
GRANT ALL ON TABLE public.kiosk_addons TO authenticated;
GRANT ALL ON TABLE public.kiosk_addons TO service_role;

-- NOTIFY pgrst, 'reload schema';
