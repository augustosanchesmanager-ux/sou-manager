-- ==============================================================================
-- ROLLBACK — 20260813120200_h6_fix_f6_5_plan_change_requests_policies.sql
-- Restaura as policies LEGADAS de public.plan_change_requests
-- Fonte: docs/backups/backup_pre_migration_20260728_152717.sql:11301-11305
-- ==============================================================================
-- Reversão do fix F6-5: volta a permitir SELECT/INSERT de QUALQUER autenticado
-- em plan_change_requests (USING/WITH CHECK true). ⚠️ Reintroduz o achado F6-5.
-- Exige aprovação explícita do PO (AGENTS.md — operação reversa/destrutiva).
-- ==============================================================================

-- 1. Remove as policies restritas a superadmin criadas pelo fix
DROP POLICY IF EXISTS "superadmin can insert plan requests" ON public.plan_change_requests;
DROP POLICY IF EXISTS "superadmin can view plan requests" ON public.plan_change_requests;

-- 2. Restaura as policies legadas abertas
CREATE POLICY "Admins can view plan requests" ON public.plan_change_requests
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert plan requests" ON public.plan_change_requests
  FOR INSERT
  WITH CHECK (true);

-- NOTIFY pgrst, 'reload schema';
