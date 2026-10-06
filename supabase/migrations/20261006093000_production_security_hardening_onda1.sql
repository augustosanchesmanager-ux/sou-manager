-- =====================================================
-- ONDA 1: Hardening de Seguranca e ACL (linter de producao Supabase)
-- Data: 2026-10-06
-- Branch: security/onda-1-security-hardening
-- Decisao PO: PENDENTE — nao aplicar em PROD sem autorizacao explicita de Augusto
--   (hard gate. Atencao: ao subir, a migration pendente
--    20261004050000_finance_settle_comanda_record_adr018.sql tambem estah na
--    fila de aplicacao — verificar estado do ledger antes de qualquer `up`.)
-- Motivo (achados do linter de producao):
--   1) public._prisma_migrations exposta sem RLS e com leitura publica.
--   2) portal_sessions: policy de UPDATE com USING (true) / WITH CHECK (true).
--   3) role_permissions_audit: policy de INSERT com WITH CHECK (true).
--   4) RPCs financeiras/estruturais (SECURITY DEFINER) executaveis por PUBLIC/anon.
--   5) Funcoes operacionais de worker executaveis por usuarios normais.
-- Garantias desta migration:
--   - Nenhum corpo, assinatura, tipo de retorno ou logica de RPC e alterado
--     (somente ACL e policies).
--   - Frontend autenticado preservado: EXECUTE mantido/reafirmado para
--     finance_settle_comanda_and_enqueue, create_commission_reversal e
--     provision_new_tenant (validado com fail-loud no bloco 6).
--   - Worker D8 preservado: worker_dispatcher mantem EXECUTE nas 4 RPCs de
--     worker (contrato D8: service_role nunca no data path do worker;
--     service_role recebe EXECUTE apenas como rota administrativa).
--   - Sem alteracao de regras financeiras, dados de comandas ou indices
--     (indices sao escopo da Onda 2).
-- Idempotente: DROP POLICY IF EXISTS + DO blocks sobre pg_proc. Nenhum erro se
--   assinatura nao existir (cancel_customer_subscription pode faltar em alguns
--   ambientes; finance_settle_comanda_and_enqueue tem variantes 13/14 args).
--
-- PREFLIGHT OBRIGATORIO (STAGING primeiro; capturar baseline antes de PROD):
--   SELECT policyname, cmd, qual, with_check FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('portal_sessions', 'role_permissions_audit');
--   SELECT p.oid::regprocedure, p.proacl FROM pg_proc p
--    JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname IN (
--      'finance_settle_comanda_and_enqueue','create_commission_reversal',
--      'insert_commission_record','cancel_customer_subscription',
--      'provision_new_tenant','claim_next_outbox_item',
--      'mark_outbox_item_processed','recover_stale_processing',
--      'upsert_worker_heartbeat');
-- =====================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) _prisma_migrations — RLS habilitado + REVOKE total de anon/authenticated
--    Tabela criada fora deste repo (Prisma/PROD); guardada com to_regclass
--    porque nao existe em bases novas. Sem policies: RLS ligado = acesso da API
--    negado para nao-dono; REVOKE abaixo fecha tambem o privilegio de tabela.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public._prisma_migrations FROM anon, authenticated;
    RAISE NOTICE '[onda1] _prisma_migrations: RLS habilitado; REVOKE ALL anon/authenticated.';
  ELSE
    RAISE NOTICE '[onda1] _prisma_migrations ausente nesta base — nada a fazer.';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) portal_sessions — substitui UPDATE permissivo por sessoes nao expiradas
--    Baseline (20260305100000): "Public can update active portal sessions"
--      FOR UPDATE USING (true)  [=> WITH CHECK default = USING]
--    Compatibilidade verificada: supabase/functions/portal-auth/index.ts so
--      grava last_seen_at em sessoes ja filtradas por expires_at >= now()
--      (SELECT .gte('expires_at', ...) antes do UPDATE .eq('id', ...)), entao
--      o novo USING nao quebra validacao nem heartbeat do portal.
--    Clients.tsx depende da policy "Tenants can view and manage portal sessions"
--      (FOR ALL) para DELETE — nao tocada aqui.
--    Policies de INSERT/SELECT desta tabela nao fazem parte deste escopo
--      (residuo registrado no relatorio da frente).
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can update active portal sessions" ON public.portal_sessions;
CREATE POLICY "Public can update active portal sessions" ON public.portal_sessions
  FOR UPDATE
  USING (expires_at > now())
  WITH CHECK (expires_at > now());

-- ────────────────────────────────────────────────────────────────────────────
-- 3) role_permissions_audit — INSERT restrito ao fluxo do sistema
--    Baseline (20260717000000): "System can insert role_permissions_audit"
--      FOR INSERT WITH CHECK (true)
--    Novo contrato:
--      - service_role / postgres (trigger SECURITY DEFINER e jobs de sistema):
--        liberado;
--      - authenticated: apenas com JWT valido E tenant_id igual ao proprio
--        tenant (helper central current_tenant_id_from_auth_uid);
--      - anon: bloqueado.
--    Compatibilidade verificada: o unico escritor e o trigger
--      audit_role_permissions_changes() (SECURITY DEFINER, dono postgres);
--      nao existe FORCE ROW LEVEL SECURITY no repo e a tabela e dono de
--      postgres — o trigger bypassa RLS e nao e afetado por esta policy.
--    tenant_id NOT NULL + FK garantem existencia do tenant (sem EXISTS extra).
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "System can insert role_permissions_audit" ON public.role_permissions_audit;
CREATE POLICY "System can insert role_permissions_audit" ON public.role_permissions_audit
  FOR INSERT
  WITH CHECK (
    tenant_id IS NOT NULL
    AND (
      current_user IN ('service_role', 'postgres')
      OR (
        current_user = 'authenticated'
        AND auth.uid() IS NOT NULL
        AND tenant_id = public.current_tenant_id_from_auth_uid()
      )
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 4) RPCs financeiras/estruturais — REVOKE de PUBLIC/anon + GRANT authenticated
--    (somente as consumidas pelo app web autenticado; corpos intactos)
-- ────────────────────────────────────────────────────────────────────────────

-- 4.1 REVOKE EXECUTE de PUBLIC e anon nas 5 RPCs
--     (no-op silencioso quando o privilegio nao existe; loop so alcanca
--      assinaturas realmente presentes — ausencia nao gera erro)
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
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', v_sig);
    RAISE NOTICE '[onda1] revoke PUBLIC/anon: %', v_sig;
  END LOOP;
END $$;

-- 4.2 GRANT EXECUTE TO authenticated nas RPCs que o frontend autenticado consome
--     - finance_settle_comanda_and_enqueue: src/lib/finance/settlement.ts
--     - create_commission_reversal:         domain/commission/commissionRecordRepository.ts
--     - provision_new_tenant:               application/tenantProvisioning.ts
--     insert_commission_record: consumida apenas pelo worker Edge (worker_dispatcher)
--       — nao recebe grant authenticated.
--     cancel_customer_subscription: nenhum consumidor no codigo — nao recebe
--       grant authenticated (grants de baseline authenticated/service_role
--       existentes nao sao revogados).
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
                         'provision_new_tenant')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_sig);
    RAISE NOTICE '[onda1] grant authenticated: %', v_sig;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5) RPCs de worker — REVOKE de PUBLIC/anon/authenticated + service_role e
--    worker_dispatcher.
--    Pedido: exclusividade service_role; CONTRATO D8 manda preservar
--      worker_dispatcher (Edge Function worker-dispatcher autentica como
--      worker_dispatcher — service_role nunca no data path). REVOKE nao toca
--      worker_dispatcher, e o GRANT abaixo apenas reafirma o estado de baseline.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_sig text;
  v_has_worker boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_dispatcher')
    INTO v_has_worker;

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
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
    IF v_has_worker THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO worker_dispatcher', v_sig);
    ELSE
      RAISE NOTICE '[onda1] role worker_dispatcher ausente — GRANT pulado em % (base sem migrations D8?)', v_sig;
    END IF;
    RAISE NOTICE '[onda1] worker isolado: %', v_sig;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6) VALIDACAO (fail-loud) — invariante violada = EXCEPTION = rollback total
--    da transacao (nunca fica estado parcial).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_sig text;
  v_fail text := '';
BEGIN
  -- 6.1 policies reescritas existem e deixaram de ser permissivas
  IF NOT EXISTS (
       SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'portal_sessions'
          AND policyname = 'Public can update active portal sessions'
          AND cmd = 'UPDATE'
          AND qual IS NOT NULL AND qual <> 'true'
          AND with_check IS NOT NULL AND with_check <> 'true') THEN
    v_fail := v_fail || E'\n  - portal_sessions: policy UPDATE ausente ou ainda permissiva';
  END IF;

  IF NOT EXISTS (
       SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'role_permissions_audit'
          AND policyname = 'System can insert role_permissions_audit'
          AND cmd = 'INSERT'
          AND with_check IS NOT NULL AND with_check <> 'true') THEN
    v_fail := v_fail || E'\n  - role_permissions_audit: policy INSERT ausente ou ainda permissiva';
  END IF;

  -- 6.2 RPCs do frontend seguem executaveis por authenticated (nao quebra o Barber)
  FOR v_sig IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND p.proname IN ('finance_settle_comanda_and_enqueue',
                         'create_commission_reversal',
                         'provision_new_tenant')
  LOOP
    IF NOT has_function_privilege('authenticated', v_sig, 'EXECUTE') THEN
      v_fail := v_fail || format(E'\n  - authenticated SEM acesso a % (quebraria o frontend)', v_sig);
    END IF;
  END LOOP;

  -- 6.3 RPCs de worker bloqueadas p/ anon/authenticated e preservadas p/ D8
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
    IF has_function_privilege('anon', v_sig, 'EXECUTE') THEN
      v_fail := v_fail || format(E'\n  - anon ainda executa %', v_sig);
    END IF;
    IF has_function_privilege('authenticated', v_sig, 'EXECUTE') THEN
      v_fail := v_fail || format(E'\n  - authenticated ainda executa %', v_sig);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_dispatcher')
       AND NOT has_function_privilege('worker_dispatcher', v_sig, 'EXECUTE') THEN
      v_fail := v_fail || format(E'\n  - worker_dispatcher perdeu % (quebraria o worker D8)', v_sig);
    END IF;
  END LOOP;

  IF v_fail <> '' THEN
    RAISE EXCEPTION '[onda1] VALIDACAO FALHOU:%', v_fail;
  END IF;

  RAISE NOTICE '[onda1] VALIDACAO OK — policies restritas e ACLs coerentes.';
END $$;

COMMIT;
