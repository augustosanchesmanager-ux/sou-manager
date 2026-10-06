-- ============================================================================
-- ROLLBACK ONDA 1 — reverte 20261006093000_production_security_hardening_onda1.sql
-- Ambiente-alvo: STAGING/PROD (somente apos autorizacao explicita do PO)
-- Aplicar apenas se autorizado explicitamente pelo PO (rollback = operacao destrutiva).
-- Material de referencia: supabase/migrations/20261006093000_production_security_hardening_onda1.sql
--
-- CONTEUDO (espelho estrito das revogacoes e policies da migration):
--   1) _prisma_migrations: desliga RLS e restaura GRANT ALL para
--      anon/authenticated (baseline observado pelo linter: exposta sem RLS e
--      com leitura publica — o rollback reabre de proposito essa exposicao).
--   2) portal_sessions: restaura policy UPDATE "USING (true)" original
--      (20260305100000_unified_addons_and_portal.sql, verbatim).
--   3) role_permissions_audit: restaura policy INSERT "WITH CHECK (true)"
--      original (20260717000000_role_permissions_system.sql, verbatim).
--   4) RPCs financeiras/estruturais: restaura EXECUTE para PUBLIC e anon.
--   5) RPCs de worker: restaura EXECUTE para PUBLIC, anon e authenticated.
--   6) NAO revertidos (grants de baseline que a migration apenas reafirmou;
--      remove-los simetricamente quebraria app ou worker):
--      - GRANT EXECUTE TO authenticated nas RPCs do frontend;
--      - GRANT EXECUTE TO service_role/worker_dispatcher nas RPCs de worker.
--   7) Ledger (somente se rollback definitivo): apos execucao,
--      npx supabase migration repair --status reverted 20261006093000
--
-- IDEMPOTENTE: DO blocks sobre pg_proc; tolerante a assinaturas ausentes.
-- Atomicidade: aplicar em transacao unica (como a migration); falha = rollback
--   total, sem estado parcial.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) _prisma_migrations — desliga RLS e restaura grants de baseline
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public._prisma_migrations DISABLE ROW LEVEL SECURITY;
    GRANT ALL ON TABLE public._prisma_migrations TO anon, authenticated;
    RAISE NOTICE '[rollback-onda1] _prisma_migrations: RLS desligado; GRANT ALL anon/authenticated restaurado.';
  ELSE
    RAISE NOTICE '[rollback-onda1] _prisma_migrations ausente nesta base — nada a reverter.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) portal_sessions — restaura UPDATE irrestrito original (verbatim baseline)
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can update active portal sessions" ON public.portal_sessions;
CREATE POLICY "Public can update active portal sessions" ON public.portal_sessions
  FOR UPDATE USING (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 3) role_permissions_audit — restaura INSERT irrestrito original (verbatim baseline)
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "System can insert role_permissions_audit" ON public.role_permissions_audit;
CREATE POLICY "System can insert role_permissions_audit" ON public.role_permissions_audit
  FOR INSERT WITH CHECK (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 4) RPCs financeiras/estruturais — restaura EXECUTE para PUBLIC e anon
--    (reabre a exposicao do baseline — somente em emergencia)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_sig text;
BEGIN
  FOR v_sig IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND p.proname IN ('finance_settle_comanda_and_enqueue',
                         'create_commission_reversal',
                         'insert_commission_record',
                         'cancel_customer_subscription',
                         'provision_new_tenant')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC, anon', v_sig);
    RAISE NOTICE '[rollback-onda1] grant PUBLIC/anon restaurado: %', v_sig;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5) RPCs de worker — restaura EXECUTE para PUBLIC, anon e authenticated
--    (baseline pré-Onda 1: expostas a usuarios normais; worker_dispatcher e
--     service_role nao sao revogados — existiam em baseline e em contrato D8)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_sig text;
BEGIN
  FOR v_sig IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND p.proname IN ('claim_next_outbox_item',
                         'mark_outbox_item_processed',
                         'recover_stale_processing',
                         'upsert_worker_heartbeat')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC, anon, authenticated', v_sig);
    RAISE NOTICE '[rollback-onda1] grant PUBLIC/anon/authenticated restaurado: %', v_sig;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6) VERIFICACAO (NOTICE apenas — o rollback nunca deve falhar por assercao;
--    ele restaura o estado exposto de proposito)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'portal_sessions'
     AND policyname = 'Public can update active portal sessions'
     AND cmd = 'UPDATE'
     AND qual = 'true';
  IF v_count = 1 THEN
    RAISE NOTICE '[rollback-onda1] OK: portal_sessions UPDATE restaurado para USING (true).';
  ELSE
    RAISE WARNING '[rollback-onda1] policy UPDATE de portal_sessions nao confere com baseline (count=%)', v_count;
  END IF;

  SELECT count(*) INTO v_count
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'role_permissions_audit'
     AND policyname = 'System can insert role_permissions_audit'
     AND cmd = 'INSERT'
     AND with_check = 'true';
  IF v_count = 1 THEN
    RAISE NOTICE '[rollback-onda1] OK: role_permissions_audit INSERT restaurado para WITH CHECK (true).';
  ELSE
    RAISE WARNING '[rollback-onda1] policy INSERT de role_permissions_audit nao confere com baseline (count=%)', v_count;
  END IF;

  RAISE NOTICE '[rollback-onda1] rollback concluido — revogar ledger apos confirmacao do PO (migration repair --status reverted 20261006093000).';
END $$;

COMMIT;
