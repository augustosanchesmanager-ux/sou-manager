-- ============================================================
-- 20260908120000_fix_grant_execute_anon_rls_functions.sql
-- INCIDENT: P2.1-OUTBOX-42501
--
-- CAUSA RAIZ:
--   Em produção (ushsnmlbeurfvlkieiln), as funções SECURITY DEFINER
--   usadas por RLS policies não possuem GRANT EXECUTE para o role
--   `anon`. Staging (tjcvuhynckocmvtqykxp) possui esses grants.
--
--   Quando o dispatch loop (client-side, 5s interval) executa sem
--   sessão válida, o PostgREST usa o role `anon`. A RLS policy
--   `outbox_items_tenant_select` chama `current_tenant_id_from_auth_uid()`,
--   mas `anon` não tem EXECUTE → erro 42501.
--
-- SEGURANÇA:
--   Conceder EXECUTE para `anon` é SEGURO porque:
--   1. A função é SECURITY DEFINER (executa como postgres)
--   2. Sem JWT, auth.uid() retorna NULL → função retorna NULL
--   3. RLS policy avalia tenant_id = NULL::text → FALSE → acesso negado
--   4. Nenhum dado é vazado
--
-- ESCOPO:
--   - Apenas GRANT EXECUTE (não altera corpos de funções)
--   - Apenas nas 2 funções afetadas pelas RLS policies de outbox_items
--   - Match exato com o estado de staging
--
-- ============================================================

BEGIN;

-- Restaurar EXECUTE para anon nas funções usadas por RLS
-- (staging já possui esses grants, produção não)
GRANT EXECUTE ON FUNCTION public.current_tenant_id_from_auth_uid() TO anon;
GRANT EXECUTE ON FUNCTION public.current_is_super_admin_from_auth_uid() TO anon;

COMMIT;
