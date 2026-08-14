-- ==============================================================================
-- ROLLBACK — 20260813120400_h6_fix_f6_8_current_tenant_status.sql
-- Restaura o corpo ORIGINAL de public.current_tenant_id_from_auth_uid()
-- Fonte: docs/backups/backup_pre_migration_20260728_152717.sql:3175-3186
-- ==============================================================================
-- Reversão do fix F6-8: volta a resolver tenant SEM checar status (profile OU
-- staff). ⚠️ Reintroduz o achado F6-8 (usuário suspenso volta a ler via REST).
-- ⚠️ ESTE ROLLBACK AFETA o comportamento de TODAS as policies que usam o helper.
-- Exige aprovação explícita do PO (AGENTS.md — operação reversa/destrutiva).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.current_tenant_id_from_auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    (SELECT s.tenant_id FROM public.staff s WHERE s.id = auth.uid() LIMIT 1)
  );
$$;

-- NOTIFY pgrst, 'reload schema';
