-- ==============================================================================
-- ROLLBACK — 20260813130100_h6_fix_f6_b_profiles_superadmin_policy.sql
-- Restaura a policy LEGADA e os GRANTS ORIGINAIS de public.profiles
-- Fonte:
--   policy:  docs/backups/backup_pre_migration_20260728_152717.sql:11357
--   grants:  docs/backups/backup_pre_migration_20260728_152717.sql:13090-13092
-- ==============================================================================
-- Reversão do fix F6-B: restaura a policy "Superadmins can view all profiles"
-- SEM cláusula TO (aplicável a PUBLIC, incluindo anon). ⚠️ Reintroduz F6-B (P0).
-- Exige aprovação explícita do PO (AGENTS.md — operação reversa/destrutiva).
-- ==============================================================================

-- 1. Remove a policy TO authenticated criada pelo fix
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON public.profiles;

-- 2. Restaura a policy legada (SEM TO — aplica a PUBLIC, incl. anon)
CREATE POLICY "Superadmins can view all profiles" ON public.profiles
  FOR SELECT
  USING (
    (role = ANY (ARRAY['Super Admin'::text, 'superadmin'::text]))
    OR (id = auth.uid())
  );

-- 3. Restaura os grants originais (anon + authenticated + service_role = ALL)
REVOKE SELECT, INSERT, UPDATE ON TABLE public.profiles FROM authenticated;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

-- NOTIFY pgrst, 'reload schema';
