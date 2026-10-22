-- ============================================================================
-- 20260911120000_seguranca_revoke_anon_service_role_4_m4_functions.sql
-- Frente M4 (PO-6.1.4-B2-02, escopo aprovado 2026-09-11) — Saneamento ACL
--
-- AUTORIZAÇÃO (PO, 2026-09-11, verbatim): "(1) saneamento ACL das 4 funções
-- identificadas no preflight, incluindo get_comanda_payment_summary; ... A
-- aplicação da migration ACL em PROD fica autorizada dentro deste escopo,
-- seguindo o ciclo governado e os gates de validação."
--
-- Contexto (preflight M4, 2026-09-11):
--   Evidência PROD (Management API, ref ushsnmlbeurfvlkieiln): 4 funções M4
--   permanecem com EXECUTE para anon + service_role, divergindo da intenção
--   declarada nos arquivos M4 (GRANT somente authenticated) e do padrão D2
--   (20260910150000, 9 funções). As 3 read functions são SECURITY DEFINER e
--   confiam no p_tenant_id sem verificar membership do caller — expostas a
--   anon/service_role constituem vetor de leitura cross-tenant.
--
-- Escopo (somente estas 4 funções; alinhado à matriz A1 §5 e §7):
--   1. check_comanda_has_valid_payments(UUID, UUID)   [M4-P1]  catalogada A1 §5
--   2. get_comanda_payment_summary(UUID, UUID)        [M4-P7]  novo achado preflight
--   3. get_tenant_refund_method(UUID)                 [M4-P8]  pendência A1 §7 resolvida
--   4. upsert_tenant_refund_method(UUID, TEXT)        [M4-P8]  idem (write, gate interno)
--
-- Fora do escopo (mantidos): P0.3, P0.4, P2.1, 20260908120000, 20260906000000,
-- RLS fora do catálogo, qualquer repair adicional de ledger.
--
-- Padrão seguido: D2 (REVOKE ALL FROM PUBLIC + REVOKE por role explícito +
-- GRANT authenticated), pois "REVOKE ALL ... FROM PUBLIC" não remove grants
-- explícitos por role.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. check_comanda_has_valid_payments(UUID, UUID)  [M4-P1 — read]
-- ────────────────────────────────────────────────────────────────────────────
REVOKE ALL    ON FUNCTION public.check_comanda_has_valid_payments(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_comanda_has_valid_payments(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_comanda_has_valid_payments(UUID, UUID) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.check_comanda_has_valid_payments(UUID, UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. get_comanda_payment_summary(UUID, UUID)  [M4-P7 — read]
-- ────────────────────────────────────────────────────────────────────────────
REVOKE ALL    ON FUNCTION public.get_comanda_payment_summary(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_comanda_payment_summary(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_comanda_payment_summary(UUID, UUID) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.get_comanda_payment_summary(UUID, UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. get_tenant_refund_method(UUID)  [M4-P8 — read]
-- ────────────────────────────────────────────────────────────────────────────
REVOKE ALL    ON FUNCTION public.get_tenant_refund_method(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_tenant_refund_method(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_tenant_refund_method(UUID) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.get_tenant_refund_method(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. upsert_tenant_refund_method(UUID, TEXT)  [M4-P8 — write, gate interno]
-- ────────────────────────────────────────────────────────────────────────────
REVOKE ALL    ON FUNCTION public.upsert_tenant_refund_method(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_tenant_refund_method(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_tenant_refund_method(UUID, TEXT) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.upsert_tenant_refund_method(UUID, TEXT) TO authenticated;

COMMIT;

-- ============================================================================
-- Verificação pós-aplicação (registro de evidência):
--   SELECT p.proname, p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--   WHERE n.nspname='public' AND p.proname IN
--     ('check_comanda_has_valid_payments','get_comanda_payment_summary',
--      'get_tenant_refund_method','upsert_tenant_refund_method');
--   Esperado: aclexplode SEM anon/PUBLIC/service_role; authenticated presente → {postgres, authenticated}.
-- ============================================================================