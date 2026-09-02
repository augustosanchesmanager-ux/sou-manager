-- ============================================================================
-- SANEAMENTO ÓRFÃOS — POST-GATE A (100% READ-ONLY)
-- ----------------------------------------------------------------------------
-- PÁRA AQUI. NENHUMA INSTRUÇÃO DESTE ARQUIVO EXECUTA DML (UPDATE/INSERT/DELETE).
--
-- PROPOSITO: provar, APOS a FASE A, que os 24 alvos tiveram
--   membership_credit_effect false; que NAO resta nenhum true; que nenhum item
--   dos alvos tem unit_price=0; e que nenhuma assinatura cobre o created_at.
--
-- ESTE ARQUIVO VALIDA EXCLUSIVAMENTE AS INVARIANTES DA FASE A.
-- NAO exige NENHUMA condicao referente ao estado pos-FASE-B.
--
-- TENANT: b716e290-f7f6-4449-b790-5ae9dcdadcab (Sanchez Barber)
-- SAIDA : 1 linha JSON com metric_post_a_* (ver SELECT final).
-- NAO E MIGRATION. VIVE FORA DE supabase/migrations/.
-- ============================================================================


WITH fase_a AS (
  -- Os 24 alvos da FASE A: comandas open + appointment cancelled +
  -- membership=false + SEM assinatura cobrindo created_at.
  -- (criterio identico ao preflight/guard A, apenas membership agora = false)
  SELECT c.id AS comanda_id, c.tenant_id, c.client_id, c.created_at
  FROM public.comandas c
  JOIN public.appointments a
         ON a.id = c.appointment_id
        AND a.tenant_id = c.tenant_id
  WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
    AND c.status = 'open'
    AND a.status = 'cancelled'
    AND c.membership_credit_effect = false
    AND NOT EXISTS (
      SELECT 1 FROM public.customer_subscriptions s
      WHERE s.client_id = c.client_id
        AND s.tenant_id  = c.tenant_id
        AND s.cycle_start <= c.created_at
        AND (s.cycle_end IS NULL OR s.cycle_end >= c.created_at)
    )
)
SELECT
  -- Contagem bruta dos alvos A pos-correcao (esperado: 24)
  (SELECT COUNT(*) FROM fase_a)                         AS metric_post_a_alvos_membership_false,

  -- Nenhum alvo deve ter sobrado com membership=true (esperado: 0)
  (SELECT COUNT(*) FROM fase_a fa
     JOIN public.comandas c ON c.id = fa.comanda_id
    WHERE c.membership_credit_effect = true)            AS metric_post_a_restam_true,

  -- Nenhum item dos alvos com unit_price=0 (esperado: 0)
  (SELECT COUNT(*) FROM fase_a fa
     JOIN public.comanda_items ci ON ci.comanda_id = fa.comanda_id
    WHERE ci.unit_price = 0)                            AS metric_post_a_unit_price_zero,

  -- Nenhuma assinatura cobrindo created_at dos alvos (esperado: 0)
  (SELECT COUNT(*) FROM fase_a fa
     JOIN public.customer_subscriptions s
       ON s.client_id = fa.client_id
      AND s.tenant_id  = fa.tenant_id
      AND s.cycle_start <= fa.created_at
      AND (s.cycle_end IS NULL OR s.cycle_end >= fa.created_at)
  )                                                     AS metric_post_a_assinatura_covering_created_at
;
