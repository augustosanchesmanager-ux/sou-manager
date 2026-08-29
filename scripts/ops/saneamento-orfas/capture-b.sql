-- ============================================================================
-- SANEAMENTO ÓRFÃOS — CAPTURE B (100% READ-ONLY)
-- ----------------------------------------------------------------------------
-- PÁRA AQUI. NENHUMA INSTRUÇÃO DESTE ARQUIVO EXECUTA DML (UPDATE/INSERT/DELETE).
--
-- PROPOSITO: materializar a IDENTIDADE do lote da FASE B ANTES do UPDATE, para
--            que o POST-GATE B valide o estado dos MESMOS registros que a FASE B
--            vai modificar — e nao de um conjunto re-derivado do estado final.
--
--            Regra de ouro: IDENTIDADE DO LOTE != ESTADO FINAL DO LOTE.
--
-- SAIDA : 1 linha por comanda-alvo (a FASE B deve cancelar exatamente estas),
--         com o comanda_id e atributos de identidade. O runner usa este arquivo
--         para gravar um ARTEFATO DE EXECUCAO (lista de UUIDs) que e passado ao
--         postflight-b.sql na etapa de POST-GATE B.
--
-- CRITERIO: identico ao guard/update da FASE B (fase-b.sql), recomputado.
--   - comandas open + appointment cancelled + financial_effect=true
--   - nao paid, sem transaction, excluindo excecoes d2845e32 e 4077d722.
--
-- TENANT: b716e290-f7f6-4449-b790-5ae9dcdadcab (Sanchez Barber)
-- NAO E MIGRATION. VIVE FORA DE supabase/migrations/.
-- ============================================================================


SELECT c.id                            AS comanda_id,
       c.tenant_id,
       c.created_at,
       c.appointment_id,
       a.status                         AS appointment_status
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
ORDER BY c.created_at, c.id;
