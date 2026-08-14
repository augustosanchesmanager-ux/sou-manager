-- ==============================================================================
-- ROLLBACK — 20260813120500_h6_revoke_anon_approve_access_request.sql
-- Restaura os GRANTS ORIGINAIS de public.approve_access_request(uuid)
-- Fonte: docs/backups/backup_pre_migration_20260728_152717.sql:12208-12210
-- ==============================================================================
-- Reversão do hardening F6-1: restaura o estado de grants da RPC (authenticated
-- e service_role com ALL; PUBLIC sem EXECUTE). ⚠️ A guarda auth.uid()/tenant
-- permanece uma dívida P3 (o rollback NÃO reintroduz revoke — apenas grants).
-- Exige aprovação explícita do PO (AGENTS.md — operação reversa/destrutiva).
-- ==============================================================================

-- Estado original do backup (12208-12210):
--   REVOKE ALL ON FUNCTION ... FROM PUBLIC;
--   GRANT ALL ... TO authenticated;
--   GRANT ALL ... TO service_role;
REVOKE EXECUTE ON FUNCTION public.approve_access_request(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.approve_access_request(uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.approve_access_request(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.approve_access_request(uuid) TO service_role;

-- NOTIFY pgrst, 'reload schema';
