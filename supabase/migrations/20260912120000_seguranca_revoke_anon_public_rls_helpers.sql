-- ============================================================
-- 20260912120000_seguranca_revoke_anon_public_rls_helpers.sql
-- INCIDENT: P2.1-OUTBOX-42501 — correção do estado desejado
--
-- CONTEXTO:
--   A migration 20260908120000 (registro histórico, PRESERVADA
--   intacta — PO-ACL-04) concedeu GRANT EXECUTE de 2 helpers RLS
--   para `anon` como correção temporária do incidente
--   P2.1-OUTBOX-42501.
--
--   Causa raiz real: o dispatch loop client-side executava queries
--   de outbox/processed_operations SEM sessão ativa (cliente `anon`).
--   Correção por código: guarda de sessão no SupabaseOutbox
--   (hasActiveSession) — nenhuma query anon é emitida.
--
--   ESTA MIGRATION REVERTE O ESTADO DESEJADO: remove EXECUTE de
--   `anon` (e de PUBLIC, alinhando staging a produção).
--   NÃO é aplicada nesta etapa — apenas versionada (PO-ACL-05:
--   "Nenhum REVOKE nesta etapa").
--
-- BASELINE (auditoria read-only):
--   PROD   (ushsnmlbeurfvlkieiln): {postgres, authenticated, service_role, anon} (sem PUBLIC)
--   STAGING (tjcvuhynckocmvtqykxp): {=X/PUBLIC, postgres, anon, authenticated, service_role}
--
-- SEGURANÇA (fail-closed, SEM vazamento):
--   1. Funções SECURITY DEFINER (executam como postgres)
--   2. Sem JWT, auth.uid() retorna NULL → helper retorna NULL
--   3. RLS policy avalia tenant_id = NULL::text → FALSE → acesso negado
--   4. Sem GRANT anon → 42501 ruidoso (desejado: falha explícita,
--      não silêncio) para qualquer query anon remanescente
--
-- IDEMPOTÊNCIA:
--   REVOKE de grant inexistente é NOTICE (não erro).
--   Em PROD (sem PUBLIC) o REVOKE FROM PUBLIC é no-op.
--
-- ============================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.current_tenant_id_from_auth_uid() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_is_super_admin_from_auth_uid() FROM anon, PUBLIC;

COMMIT;