-- ============================================================================
-- ROLLBACK B1 — 6.1.4-B: reverte D2 (20260910150000) e D3 (20260910160000) em PROD
-- Ambiente-alvo: PROD (ushsnmlbeurfvlkieiln / sou-manager)
-- Aplicar apenas se autorizado explicitamente pelo PO (rollback = operacao destrutiva).
-- Material de referencia: docs/audit/6.1.4_B1_BASELINE_PROD_ROLLBACK.md
--
-- CONTEUDO:
--   1) Restaura ACL original das 9 funcoes (estado antes de D2)
--   2) Restaura corpo original de batch_unblock_comandas (estado antes de D3,
--      sem gate — atencao: reabre a exposicao cross-tenant; somente em emergencia)
--   3) Ledger: apos execucao, rodar migration repair --status reverted 20260910150000
--      e 20260910160000 (somente se rollback definitivo)
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1) D2 — RESTAURA ACL ORIGINAL (REVOKE authenticated + GRANT anon/service_role/public)
--    (baseline capturado em 2026-09-10 antes da aplicacao de D2)
-- ────────────────────────────────────────────────────────────────────────────

-- 1. reverse_comanda_payment(UUID, UUID, TEXT, TEXT, UUID)
--    baseline: {postgres, anon, authenticated, service_role} (sem PUBLIC)
REVOKE ALL ON FUNCTION public.reverse_comanda_payment(UUID, UUID, TEXT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_comanda_payment(UUID, UUID, TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.reverse_comanda_payment(UUID, UUID, TEXT, TEXT, UUID) TO service_role;

-- 2. unblock_comanda(UUID, UUID, TEXT, TEXT, UUID)
--    baseline: {=X/PUBLIC, postgres, anon, authenticated, service_role}
REVOKE ALL    ON FUNCTION public.unblock_comanda(UUID, UUID, TEXT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_comanda(UUID, UUID, TEXT, TEXT, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.unblock_comanda(UUID, UUID, TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.unblock_comanda(UUID, UUID, TEXT, TEXT, UUID) TO service_role;

-- 3. batch_unblock_comandas(UUID, UUID[])
--    baseline: {postgres, anon, authenticated, service_role} (sem PUBLIC)
REVOKE ALL ON FUNCTION public.batch_unblock_comandas(UUID, UUID[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.batch_unblock_comandas(UUID, UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION public.batch_unblock_comandas(UUID, UUID[]) TO service_role;

-- 4. pay_account_payable(UUID)
--    baseline: {=X/PUBLIC, postgres, anon, authenticated, service_role}
REVOKE ALL    ON FUNCTION public.pay_account_payable(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.pay_account_payable(UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_account_payable(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.pay_account_payable(UUID) TO service_role;

-- 5. cancel_account_payable(UUID)
--    baseline: {=X/PUBLIC, postgres, anon, authenticated, service_role}
REVOKE ALL    ON FUNCTION public.cancel_account_payable(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_account_payable(UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_account_payable(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.cancel_account_payable(UUID) TO service_role;

-- 6. create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER)
--    baseline: {=X/PUBLIC, postgres, anon, authenticated, service_role}
REVOKE ALL    ON FUNCTION public.create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER) TO service_role;

-- 7. create_one_time_account_payable(TEXT, NUMERIC, DATE, UUID, TEXT, TEXT)
--    baseline: {=X/PUBLIC, postgres, anon, authenticated, service_role}
REVOKE ALL    ON FUNCTION public.create_one_time_account_payable(TEXT, NUMERIC, DATE, UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_one_time_account_payable(TEXT, NUMERIC, DATE, UUID, TEXT, TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_one_time_account_payable(TEXT, NUMERIC, DATE, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.create_one_time_account_payable(TEXT, NUMERIC, DATE, UUID, TEXT, TEXT) TO service_role;

-- 8. create_recurring_bill(TEXT, NUMERIC, INTEGER, UUID, TEXT, TEXT)
--    baseline: {=X/PUBLIC, postgres, anon, authenticated, service_role}
REVOKE ALL    ON FUNCTION public.create_recurring_bill(TEXT, NUMERIC, INTEGER, UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_recurring_bill(TEXT, NUMERIC, INTEGER, UUID, TEXT, TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_recurring_bill(TEXT, NUMERIC, INTEGER, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.create_recurring_bill(TEXT, NUMERIC, INTEGER, UUID, TEXT, TEXT) TO service_role;

-- 9. import_clients_batch(UUID, JSONB)
--    baseline: {=X/PUBLIC, postgres, anon, authenticated, service_role}
REVOKE ALL    ON FUNCTION public.import_clients_batch(UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.import_clients_batch(UUID, JSONB) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_clients_batch(UUID, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.import_clients_batch(UUID, JSONB) TO service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 2) D3 — RESTAURA CORPO ORIGINAL DE batch_unblock_comandas (SEM gate)
--    (corpo capturado em docs/audit/6.1.4_B1_BASELINE_PROD_ROLLBACK.md §2)
--    ⚠ ATENCAO: reabre a exposicao cross-tenant (SECURITY DEFINER sem auth.uid()).
--    Usar SOMENTE em emergencia/rollback autorizado.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.batch_unblock_comandas(p_tenant_id uuid, p_comanda_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_comanda_id UUID;
  v_unblocked  INTEGER := 0;
  v_skipped    INTEGER := 0;
BEGIN
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_comanda_ids IS NULL OR array_length(p_comanda_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'unblocked', 0, 'skipped', 0, 'message', 'Nenhuma comanda para desbloquear.');
  END IF;

  FOREACH v_comanda_id IN ARRAY p_comanda_ids LOOP
    -- Only unblock comandas that are blocked
    UPDATE public.comandas
    SET status = 'open'
    WHERE id = v_comanda_id AND tenant_id = p_tenant_id AND status = 'blocked';

    IF FOUND THEN
      INSERT INTO public.comanda_unblock_audit (
        tenant_id, comanda_id, mode, reason, before_status, after_status
      ) VALUES (
        p_tenant_id, v_comanda_id, 'auto', 'auto-unlock by date', 'blocked', 'open'
      );
      v_unblocked := v_unblocked + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'unblocked', v_unblocked,
    'skipped', v_skipped,
    'message', v_unblocked || ' comanda(s) desbloqueada(s).'
  );
END;
$function$;

COMMIT;

-- ============================================================================
-- 3) LEDGER — executar APENAS se rollback definitivo (fora deste script):
--    npx supabase migration repair --status reverted --linked 20260910150000
--    npx supabase migration repair --status reverted --linked 20260910160000
-- ============================================================================