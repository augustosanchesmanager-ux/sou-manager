-- ==============================================================================
-- H6 F6-2: close_order — desativação para anon/authenticated/PUBLIC
-- ==============================================================================
-- Contexto: homologação H-6 (docs/audit/H6_SECURITY_AUDIT.md). Achado F6-2 (P0).
--   close_order(uuid) é SECURITY DEFINER legado (20260220145723) SEM guarda de
--   tenant/auth: marcava comanda 'open' -> 'paid' e decrementava estoque de
--   QUALQUER tenant. Estava fora da lista de revoke de 20260808110000 e sem
--   call site no app (o fluxo usa finance_settle_comanda em
--   src/lib/finance/settlement.ts:82). close_order_with_chef_club (SECURITY
--   DEFINER, owner postgres) chama close_order internamente — não é afetada.
-- Correção (aprovada pelo PO — desativação, já que não há call site):
--   REVOKE EXECUTE de anon, authenticated e PUBLIC; service_role é re-granted
--   explicitamente para preservar operações internas/legadas via chave de
--   serviço. Com REVOKE FROM PUBLIC o default de execução (PUBLIC) é removido,
--   por isso o grant explícito a service_role é necessário.
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.close_order(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.close_order(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.close_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_order(uuid) TO service_role;

-- NOTIFY pgrst, 'reload schema';
