-- ============================================================================
-- 20260910150000_seguranca_revoke_anon_public_service_role_9_functions.sql
-- 6.1.3 — Alinhamento de grants das 9 funções críticas (decisão PO 2026-09-10, D2)
--
-- AUTORIZAÇÃO (PO, verbatim): "REVOKE: AUTORIZADO em staging. anon, PUBLIC e
-- service_role devem ser removidos das 9 funções; authenticated permanece
-- conforme evidência de consumidores."
--
-- Contexto:
--   Evidência A (docs/audit/6.1.3_EVIDENCIA_A_CONSUMIDORES_FUNCOES.md) mostrou
--   que os bancos têm 4-5 grants (incl. anon + service_role) nas 9 funções,
--   divergindo da intenção dos arquivos M4/P0.4/P2.1 e expondo as funções a
--   chamadas anônimas. Esta migration alinha o banco à intenção declarada:
--   EXECUTE apenas para authenticated (e owner postgres, inalterado).
--
-- Padrão de grant seguido: P1.3 (REVOKE ALL FROM PUBLIC + REVOKE por role
-- explícito + GRANT authenticated), pois "REVOKE ALL ... FROM PUBLIC" não
-- remove grants explícitos por role.
--
-- ESCOPO: somente as 9 funções da matriz (M4 3× + P0.4 5× + P2.1 1×).
--   Não altera current_tenant_id_from_auth_uid / current_is_super_admin...
--   (helper de RLS — tratado à parte, incidente P2.1-OUTBOX-42501).
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- Bloco M4 (alinhado à intenção dos arquivos da branch feature/m4)
-- ────────────────────────────────────────────────────────────────────────────

-- 1. reverse_comanda_payment(UUID, UUID, TEXT, TEXT, UUID)
REVOKE ALL    ON FUNCTION public.reverse_comanda_payment(UUID, UUID, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reverse_comanda_payment(UUID, UUID, TEXT, TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reverse_comanda_payment(UUID, UUID, TEXT, TEXT, UUID) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.reverse_comanda_payment(UUID, UUID, TEXT, TEXT, UUID) TO authenticated;

-- 2. unblock_comanda(UUID, UUID, TEXT, TEXT, UUID)
REVOKE ALL    ON FUNCTION public.unblock_comanda(UUID, UUID, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unblock_comanda(UUID, UUID, TEXT, TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unblock_comanda(UUID, UUID, TEXT, TEXT, UUID) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.unblock_comanda(UUID, UUID, TEXT, TEXT, UUID) TO authenticated;

-- 3. batch_unblock_comandas(UUID, UUID[])
REVOKE ALL    ON FUNCTION public.batch_unblock_comandas(UUID, UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.batch_unblock_comandas(UUID, UUID[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.batch_unblock_comandas(UUID, UUID[]) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.batch_unblock_comandas(UUID, UUID[]) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Bloco P0.4 + P2.1 (alinhado à intenção dos arquivos em main/homologacao)
-- ────────────────────────────────────────────────────────────────────────────

-- 4. pay_account_payable(UUID)
REVOKE ALL    ON FUNCTION public.pay_account_payable(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pay_account_payable(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.pay_account_payable(UUID) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.pay_account_payable(UUID) TO authenticated;

-- 5. cancel_account_payable(UUID)
REVOKE ALL    ON FUNCTION public.cancel_account_payable(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_account_payable(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_account_payable(UUID) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.cancel_account_payable(UUID) TO authenticated;

-- 6. create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER)
REVOKE ALL    ON FUNCTION public.create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER) TO authenticated;

-- 7. create_one_time_account_payable(TEXT, NUMERIC, DATE, UUID, TEXT, TEXT)
REVOKE ALL    ON FUNCTION public.create_one_time_account_payable(TEXT, NUMERIC, DATE, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_one_time_account_payable(TEXT, NUMERIC, DATE, UUID, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_one_time_account_payable(TEXT, NUMERIC, DATE, UUID, TEXT, TEXT) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.create_one_time_account_payable(TEXT, NUMERIC, DATE, UUID, TEXT, TEXT) TO authenticated;

-- 8. create_recurring_bill(TEXT, NUMERIC, INTEGER, UUID, TEXT, TEXT)
REVOKE ALL    ON FUNCTION public.create_recurring_bill(TEXT, NUMERIC, INTEGER, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_recurring_bill(TEXT, NUMERIC, INTEGER, UUID, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_recurring_bill(TEXT, NUMERIC, INTEGER, UUID, TEXT, TEXT) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.create_recurring_bill(TEXT, NUMERIC, INTEGER, UUID, TEXT, TEXT) TO authenticated;

-- 9. import_clients_batch(UUID, JSONB)  [P2.1]
REVOKE ALL    ON FUNCTION public.import_clients_batch(UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.import_clients_batch(UUID, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.import_clients_batch(UUID, JSONB) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.import_clients_batch(UUID, JSONB) TO authenticated;

COMMIT;

-- ============================================================================
-- Verificação pós-aplicação (registro de evidência):
--   SELECT p.proname, p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.proname IN (...9...);
--   Esperado: aclexplode SEM anon/PUBLIC/service_role; authenticated presente.
-- ============================================================================