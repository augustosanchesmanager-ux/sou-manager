-- ============================================================================
-- SANEAMENTO ÓRFÃOS — PRE-FLIGHT (100% READ-ONLY)
-- ----------------------------------------------------------------------------
-- PÁRA AQUI. NENHUMA INSTRUÇÃO DESTE ARQUIVO EXECUTA DML (UPDATE/INSERT/DELETE).
--
-- PROPOSITO: validar, contra o estado VIVO de produção, TODOS os invariantes
--            das FASE A (membership_credit_effect) e FASE B (comandas órfãs),
--            e emitir uma ÚNICA linha JSON com os contadores para o runner
--            decidir se as mutações podem prosseguir.
--
-- TENANT:     b716e290-f7f6-4449-b790-5ae9dcdadcab (Sanchez Barber)
-- SAIDA:      1 linha com colunas metric_* (ver SELECT final).
--
-- NAO E MIGRATION, NAO E APLICADO POR MIGRATION, VIVE FORA DE supabase/migrations/.
-- ============================================================================


-- CTE compartilhada: alvo A = FASE A (24 comandas órfãs já sanadas, membership=false).
-- NOTA: a FASE A JÁ FOI APLICADA (24/24, consolidada). Este CTE mede o ESTADO
-- CONSIDERADO POS-A: as 24 comandas órfãs com membership_credit_effect = false.
-- NAO re-exige 24 com membership=true (isso era o estado PRE-aplicacao).
WITH fase_a AS (
  SELECT c.id AS comanda_id, c.appointment_id, c.tenant_id, c.client_id, c.created_at
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
        AND s.tenant_id = c.tenant_id
        AND s.cycle_start <= c.created_at
        AND (s.cycle_end IS NULL OR s.cycle_end >= c.created_at)
    )
),
-- CTE compartilhada: alvo B = FASE B (25 comandas órfãs, sem transação, sem paid,
-- excluindo exceções financeiras d2845e32 e 4077d722)
fase_b AS (
  SELECT c.id AS comanda_id, c.appointment_id, c.tenant_id, c.client_id, c.created_at
  FROM public.comandas c
  JOIN public.appointments a
         ON a.id = c.appointment_id
        AND a.tenant_id = c.tenant_id
  WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
    AND c.status = 'open'
    AND a.status = 'cancelled'
    AND c.financial_effect = true
    AND c.status <> 'paid'
    AND NOT EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.source_type = 'comanda' AND t.source_id = c.id
    )
    AND c.id NOT IN (
      'd2845e32-a20c-47c7-9484-7992487c744b',
      '4077d722-327b-4fd1-a0ba-06850aec9d03'
    )
)
SELECT
  -- Contagem bruta dos alvos (esperado: A=24, B=25)
  (SELECT COUNT(*) FROM fase_a)                         AS metric_a_alvos,
  (SELECT COUNT(*) FROM fase_b)                         AS metric_b_alvos,

  -- FASE A: sub-invariantes
  (SELECT COUNT(*) FROM fase_a fa
     JOIN public.comandas c ON c.id = fa.comanda_id
    WHERE c.membership_credit_effect = true)            AS metric_a_flags_true,
  (SELECT COUNT(*) FROM fase_a fa
     JOIN public.comanda_items ci ON ci.comanda_id = fa.comanda_id
    WHERE ci.unit_price = 0)                            AS metric_a_itens_unit_price_zero,
  (SELECT COUNT(*) FROM fase_a fa
     JOIN public.customer_subscriptions s
       ON s.client_id = fa.client_id
      AND s.tenant_id  = fa.tenant_id
      AND s.cycle_start <= fa.created_at
      AND (s.cycle_end IS NULL OR s.cycle_end >= fa.created_at)
  )                                                     AS metric_a_assinatura_covering_created_at,

  -- FASE B: sub-invariantes
  (SELECT COUNT(*) FROM fase_b fb
     JOIN public.comandas c ON c.id = fb.comanda_id
    WHERE c.status = 'open')                            AS metric_b_status_open,
  (SELECT COUNT(*) FROM fase_b fb
     JOIN public.appointments a ON a.id = fb.appointment_id
    WHERE a.status = 'cancelled')                       AS metric_b_appointment_cancelled,
  (SELECT COUNT(*) FROM fase_b fb
     JOIN public.comandas c ON c.id = fb.comanda_id
    WHERE c.financial_effect = true)                    AS metric_b_financial_effect_true,
  (SELECT COUNT(*) FROM fase_b fb
     JOIN public.transactions t
       ON t.source_type = 'comanda' AND t.source_id = fb.comanda_id
  )                                                     AS metric_b_transactions,
  (SELECT COUNT(*) FROM fase_b fb
     JOIN public.comandas c ON c.id = fb.comanda_id
    WHERE c.status = 'paid')                            AS metric_b_paid,
  (SELECT COUNT(*) FROM fase_b
    WHERE comanda_id IN ('d2845e32-a20c-47c7-9484-7992487c744b',
                         '4077d722-327b-4fd1-a0ba-06850aec9d03')) AS metric_b_excecoes_presentes,

  -- Sinalizador da existência da coluna cancellation_type (necessária p/ UPDATE B)
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='appointments'
      AND column_name='cancellation_type')              AS metric_b_cancellation_type_col
;
