-- ==============================================================================
-- ROLLBACK — 20260813130200_h6_fix_f6_2_close_order_deactivation.sql
-- Restaura os GRANTS ORIGINAIS de public.close_order(uuid)
-- Fonte: docs/backups/backup_pre_migration_20260728_152717.sql:12262-12264
-- ==============================================================================
-- Reversão da desativação F6-2: volta a permitir EXECUTE a authenticated
-- (e service_role). ⚠️ Reintroduz o achado F6-2 (P0) — RPC sem guarda exposta
-- a qualquer autenticado. Exige aprovação explícita do PO (AGENTS.md).
-- ==============================================================================

-- Estado original do backup (12262-12264):
--   REVOKE ALL ON FUNCTION ... FROM PUBLIC;
--   GRANT ALL ... TO authenticated;
--   GRANT ALL ... TO service_role;
REVOKE ALL ON FUNCTION public.close_order(uuid) FROM service_role;
REVOKE ALL ON FUNCTION public.close_order(uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.close_order(uuid) TO authenticated;
GRANT ALL ON FUNCTION public.close_order(uuid) TO service_role;

-- NOTIFY pgrst, 'reload schema';
