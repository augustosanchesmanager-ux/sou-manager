-- ============================================================================
-- AUDITORIA READ-ONLY: relações financeiras das 27 comandas órfãs (tenant alvo)
-- ----------------------------------------------------------------------------
-- SEGURANÇA: SELECT / WITH / JOIN / GROUP BY / COUNT / SUM / CASE / ORDER BY.
--   NENHUM UPDATE / DELETE / INSERT / RPC mutável / migration.
--
-- CRITÉRIO = MESMO DO DIAGNÓSTICO (sem lista manual de IDs, reproduzível):
--   comandas.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
--   comandas.status    = 'open'
--   appointments.status= 'cancelled'
--   comandas.appointment_id = appointments.id  (JOIN, NUNCA customer_id)
--
-- OBJETIVO: antes de qualquer UPDATE de saneamento, confirmar se alguma das 27
--   tem pagamento/transação/voucher associado (relação financeira indireta).
--   Esperado (comandas 'open'): 0 transações. Se aparecer algo, PARE o saneamento.
-- ============================================================================


-- ============================================================================
-- QUERY A — DETALHAMENTO POR COMANDA (órfã + contagem de vínculos financeiros)
-- ============================================================================
SELECT
  c.id                                           AS comanda_id,
  c.tenant_id,
  c.appointment_id,
  c.status                                       AS comanda_status,
  a.status                                       AS appointment_status,
  c.total                                        AS comanda_total,
  COALESCE(t.n_transacoes, 0)                    AS n_transacoes,
  COALESCE(t.soma_transacoes, 0)                 AS soma_transacoes,
  COALESCE(v.n_vouchers, 0)                      AS n_vouchers,
  COALESCE(ci.n_itens, 0)                        AS n_itens
FROM public.comandas c
JOIN public.appointments a
       ON a.id = c.appointment_id
      AND a.tenant_id = c.tenant_id
LEFT JOIN (
  SELECT source_id      AS comanda_id,
         COUNT(*)       AS n_transacoes,
         SUM(amount)    AS soma_transacoes
  FROM public.transactions
  WHERE source_type = 'comanda'
  GROUP BY source_id
) t  ON t.comanda_id = c.id
LEFT JOIN (
  SELECT used_comanda_id AS comanda_id,
         COUNT(*)        AS n_vouchers
  FROM public.customer_vouchers
  GROUP BY used_comanda_id
) v  ON v.comanda_id = c.id
LEFT JOIN (
  SELECT comanda_id,
         COUNT(*) AS n_itens
  FROM public.comanda_items
  GROUP BY comanda_id
) ci ON ci.comanda_id = c.id
WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
  AND c.status   = 'open'
  AND a.status   = 'cancelled'
ORDER BY c.id;


-- ============================================================================
-- QUERY B — RESUMO AGREGADO (quantas das 27 têm QUALQUER vínculo financeiro)
-- ============================================================================
WITH alvo AS (
  SELECT c.id AS comanda_id
  FROM public.comandas c
  JOIN public.appointments a
         ON a.id = c.appointment_id
        AND a.tenant_id = c.tenant_id
  WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
    AND c.status   = 'open'
    AND a.status   = 'cancelled'
)
SELECT
  (SELECT COUNT(*) FROM alvo)                                                  AS total_orfas,
  (SELECT COUNT(DISTINCT alvo.comanda_id)
     FROM alvo
     JOIN public.transactions t
       ON t.source_type = 'comanda'
      AND t.source_id = alvo.comanda_id)                                       AS com_transacao,
  (SELECT COUNT(DISTINCT alvo.comanda_id)
     FROM alvo
     JOIN public.customer_vouchers v
       ON v.used_comanda_id = alvo.comanda_id)                                 AS com_voucher,
  (SELECT COUNT(DISTINCT alvo.comanda_id)
     FROM alvo
     JOIN public.comanda_items ci
       ON ci.comanda_id = alvo.comanda_id)                                     AS com_itens,
  (SELECT COALESCE(SUM(t.amount), 0)
     FROM alvo
     JOIN public.transactions t
       ON t.source_type = 'comanda'
      AND t.source_id = alvo.comanda_id)                                       AS soma_transacoes_orfas;
