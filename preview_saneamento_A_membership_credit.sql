-- ============================================================================
-- PREVIEW A (READ-ONLY) — membership_credit_effect true→false (esperado: 24)
-- ----------------------------------------------------------------------------
-- Critério: tenant alvo + comanda open + appointment cancelled +
--           membership_credit_effect=true + SEM assinatura (qualquer status
--           atual) cujo ciclo cubra created_at.
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
    AND c.membership_credit_effect = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.customer_subscriptions s
      WHERE s.client_id = c.client_id
        AND s.tenant_id = c.tenant_id
        AND s.cycle_start <= c.created_at
        AND (s.cycle_end IS NULL OR s.cycle_end >= c.created_at)
    )
)

-- GUARDA: deve retornar 24
SELECT COUNT(*) AS count_a_preview FROM alvo;

-- DETALHE: as 24
SELECT
  comanda_id,
  tenant_id,
  appointment_id,
  client_id,
  created_at,
  total,
  financial_effect,
  membership_credit_effect,
  n_transactions
FROM alvo
ORDER BY created_at, comanda_id;
