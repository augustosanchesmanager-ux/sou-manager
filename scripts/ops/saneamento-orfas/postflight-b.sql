-- ============================================================================
-- SANEAMENTO ÓRFÃOS — POST-GATE B (100% READ-ONLY)
-- ----------------------------------------------------------------------------
-- PÁRA AQUI. NENHUMA INSTRUÇÃO DESTE ARQUIVO EXECUTA DML (UPDATE/INSERT/DELETE).
--
-- PROPOSITO: provar, APOS a FASE B, que os MESMOS 25 registros que a FASE B
--            modificou ficaram no estado esperado. Nao mede o universo historico
--            (96 comandas cancelled): mede EXATAMENTE o lote capturado antes do
--            UPDATE (capture-b.sql), cuja lista de UUIDs e INJETADA abaixo pelo
--            runner em tempo de execucao via placeholder __LOTE_B_IDS__.
--
--            Regra de ouro: IDENTIDADE DO LOTE != ESTADO FINAL DO LOTE.
--            O placeholder restringe a identidade ao lote pre-B; o SELECT verifica
--            o estado pos-B desses mesmos ids.
--
-- TENANT: b716e290-f7f6-4449-b790-5ae9dcdadcab (Sanchez Barber)
-- SAIDA : 1 linha JSON com metric_post_b_*. Ver SELECT final.
-- NAO E MIGRATION. VIVE FORA DE supabase/migrations/.
-- ============================================================================


-- O runner substitui __LOTE_B_IDS__ por uma lista literal de UUIDs entre
-- parenteses, ex.: ('uuid1','uuid2',...). E o unico ponto de interpolacao.
-- NADA mais neste arquivo e parametrizado; os criterios de identidade da FASE B
-- (nao-paid, sem transaction, excecoes excluidas) permanecem fixos e iguais ao
-- guard/update da FASE B, de modo que so podem casar os registros do lote B.


-- CTE: restringe aos ids do lote pre-B (identidade) e, por defesa em profundidade,
-- aos registros que a FASE B de fato marcou (closure_note exclusivo do saneamento
-- + appointment cancelled + financial_effect=true + nao-paid + sem transaction +
-- excecoes excluidas). Assim, se algum id do lote NAO foi cancelado, ele NAO
-- aparece aqui e a contagem < 25 -> pós-gate falha.
WITH fase_b AS (
  SELECT c.id AS comanda_id, c.tenant_id, c.client_id, c.created_at,
         c.status, c.cancellation_type, c.cancelled_at,
         c.cancelled_by_user_id, c.closure_note,
         a.status AS appointment_status
  FROM public.comandas c
  JOIN public.appointments a
         ON a.id = c.appointment_id
        AND a.tenant_id = c.tenant_id
  WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
    AND c.id IN __LOTE_B_IDS__
    AND c.status = 'cancelled'
    AND a.status = 'cancelled'
    AND c.financial_effect = true
    AND c.status <> 'paid'
    AND c.cancelled_by_user_id IS NULL
    AND c.closure_note = 'Saneamento historico: comanda orfa vinculada a appointment cancelado.'
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
  -- Comandas do lote B que ficaram cancelled (esperado: 25)
  (SELECT COUNT(*) FROM fase_b)                          AS metric_post_b_alvos_cancelled,

  -- Da lista capturada, quantas NAO estao no estado esperado (esperado: 0):
  --   n_capturado = COUNT(* moradores da lista)  (calculado a partir do CTE nao filtrado abaixo)
  (SELECT COUNT(*) FROM public.comandas c
    WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
      AND c.id IN __LOTE_B_IDS__)                        AS metric_post_b_total_capturado,

  -- Da lista capturada, quantas permanecem open (esperado: 0)
  (SELECT COUNT(*) FROM public.comandas c
    WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
      AND c.id IN __LOTE_B_IDS__
      AND c.status = 'open')                             AS metric_post_b_restam_open,

  -- Da lista capturada, quantas NAO estao cancelled (esperado: 0)
  (SELECT COUNT(*) FROM public.comandas c
    WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
      AND c.id IN __LOTE_B_IDS__
      AND c.status <> 'cancelled')                        AS metric_post_b_nao_cancelled,

  -- Da lista capturada, quantas NAO tem appointment cancelled (esperado: 0)
  (SELECT COUNT(*) FROM public.comandas c
    JOIN public.appointments a ON a.id = c.appointment_id AND a.tenant_id = c.tenant_id
    WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
      AND c.id IN __LOTE_B_IDS__
      AND a.status <> 'cancelled')                        AS metric_post_b_nao_appointment_cancelled,

  -- Da lista capturada, quantas NAO tem financial_effect=true (esperado: 0)
  (SELECT COUNT(*) FROM public.comandas c
    WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
      AND c.id IN __LOTE_B_IDS__
      AND c.financial_effect <> true)                     AS metric_post_b_financial_effect_nao_true,

  -- Da lista capturada, quantas tem transaction (esperado: 0)
  (SELECT COUNT(*) FROM public.comandas c
    WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
      AND c.id IN __LOTE_B_IDS__
      AND EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.source_type = 'comanda' AND t.source_id = c.id
      ))                                                 AS metric_post_b_transactions,

  -- Da lista capturada, quantas estao paid (esperado: 0)
  (SELECT COUNT(*) FROM public.comandas c
    WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
      AND c.id IN __LOTE_B_IDS__
      AND c.status = 'paid')                              AS metric_post_b_paid,

  -- Da lista capturada, quantas coincidem com as excecoes financeiras (esperado: 0)
  (SELECT COUNT(*) FROM public.comandas c
    WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
      AND c.id IN __LOTE_B_IDS__
      AND c.id IN ('d2845e32-a20c-47c7-9484-7992487c744b',
                   '4077d722-327b-4fd1-a0ba-06850aec9d03')) AS metric_post_b_excecoes_presentes
;
