-- ============================================================================
-- PREVIEW B (READ-ONLY) — saneamento de cancelamento open→cancelled (esperado: 25)
-- ----------------------------------------------------------------------------
-- Critério: tenant alvo + comanda open + financial_effect=true +
--           n_transactions=0 + appointment cancelled.
-- EXCLUIR explicitamente (exceções financeiras):
--   d2845e32-a20c-47c7-9484-7992487c744b  (1 transação real)
--   4077d722-327b-4fd1-a0ba-06850aec9d03  (2 transações, líquido zero)
-- hidden_from_financial NÃO será alterado neste lote (mantém valor atual).
-- SEGURANÇA: apenas SELECT/CTE. NENHUM UPDATE/DELETE/INSERT/RPC.
-- ============================================================================

WITH alvo AS (
  SELECT
    c.id                      AS comanda_id,
    c.tenant_id,
    c.appointment_id,
    c.client_id,
    c.created_at,
    c.total,
    c.financial_effect,
    c.hidden_from_financial,
    c.membership_credit_effect,
    (SELECT COUNT(*) FROM public.transactions t
     WHERE t.source_type = 'comanda' AND t.source_id = c.id) AS n_transactions
  FROM public.comandas c
  JOIN public.appointments a
         ON a.id = c.appointment_id
        AND a.tenant_id = c.tenant_id
  WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
    AND c.status = 'open'
    AND a.status = 'cancelled'
    AND c.financial_effect = true
    AND NOT EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.source_type = 'comanda' AND t.source_id = c.id
    )
    AND c.id NOT IN (
      'd2845e32-a20c-47c7-9484-7992487c744b',
      '4077d722-327b-4fd1-a0ba-06850aec9d03'
    )
)

-- GUARDA: deve retornar 25
SELECT COUNT(*) AS count_b_preview FROM alvo;

-- DETALHE: as 25
SELECT
  comanda_id,
  tenant_id,
  appointment_id,
  client_id,
  created_at,
  total,
  financial_effect,
  hidden_from_financial,
  membership_credit_effect,
  n_transactions
FROM alvo
ORDER BY created_at, comanda_id;
