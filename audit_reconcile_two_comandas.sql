-- ============================================================================
-- AUDITORIA READ-ONLY: reconciliação das 2 comandas órfãs COM transação
-- ----------------------------------------------------------------------------
-- SEGURANÇA: SELECT / WITH / JOIN / GROUP BY / COUNT / SUM / CASE / ORDER BY.
--   NENHUM UPDATE / DELETE / INSERT / RPC mutável / migration.
--
-- SELEÇÃO REPRODUZÍVEL (sem lista manual de IDs):
--   do conjunto das 27 (tenant alvo + comanda open + appointment cancelled),
--   filtra ONLY as que possuem ao menos 1 transação (source_type='comanda').
--   Isso isola exatamente as 2 comandas financeiras (d2845e32..., 4077d722...).
--
-- OBJETIVO: reconiliar saldo líquido, efeito financeiro e vínculo original↔estorno
--   ANTES de decidir saneamento. Não mexer em nada com efeito financeiro real.
-- ============================================================================


-- ============================================================================
-- CTE ALVO: as 2 comandas (27 diagnosticadas, com transação)
-- ============================================================================
WITH alvo AS (
  SELECT c.id AS comanda_id, c.tenant_id
  FROM public.comandas c
  JOIN public.appointments a
         ON a.id = c.appointment_id
        AND a.tenant_id = c.tenant_id
  WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
    AND c.status   = 'open'
    AND a.status   = 'cancelled'
    AND EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.source_type = 'comanda' AND t.source_id = c.id
    )
)


-- ============================================================================
-- QUERY A — CABEÇALHO DA COMANDA (campos de reconciliação)
-- ============================================================================
SELECT
  c.id                                           AS comanda_id,
  c.tenant_id,
  c.appointment_id,
  c.status                                       AS comanda_status,
  a.status                                       AS appointment_status,
  c.total,
  c.financial_effect,
  c.membership_credit_effect,
  c.closed_at,
  c.settled_at,
  c.payment_date_real,
  c.hidden_from_financial,
  c.cancellation_type,
  c.cancelled_at,
  c.created_at,
  c.updated_at
FROM public.comandas c
JOIN public.appointments a
       ON a.id = c.appointment_id
      AND a.tenant_id = c.tenant_id
WHERE c.id IN (SELECT comanda_id FROM alvo)
ORDER BY c.id;


-- ============================================================================
-- QUERY B — RAZONETE DE TRANSAÇÕES (original ↔ estorno visível no metadata)
-- ============================================================================
SELECT
  t.source_id                                    AS comanda_id,
  t.id                                           AS transaction_id,
  t.type,
  t.category,
  t.amount,
  t.status                                       AS transaction_status,
  t.date,
  t.description,
  t.metadata,
  t.idempotency_key
FROM public.transactions t
WHERE t.source_type = 'comanda'
  AND t.source_id IN (SELECT comanda_id FROM alvo)
ORDER BY t.source_id, t.date;


-- ============================================================================
-- QUERY C — SALDO LÍQUIDO POR COMANDA (income - expense)
-- ============================================================================
SELECT
  t.source_id                                                       AS comanda_id,
  COUNT(*)                                                          AS n_lancamentos,
  SUM(CASE WHEN t.type = 'income'  THEN t.amount ELSE 0 END)        AS total_income,
  SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END)        AS total_expense,
  SUM(CASE WHEN t.type = 'income'  THEN  t.amount
           WHEN t.type = 'expense' THEN -t.amount
           ELSE 0 END)                                              AS saldo_liquido
FROM public.transactions t
WHERE t.source_type = 'comanda'
  AND t.source_id IN (SELECT comanda_id FROM alvo)
GROUP BY t.source_id
ORDER BY t.source_id;


-- ============================================================================
-- QUERY D — ITENS DA COMANDA (valor conteúdo, não pagamento)
-- ============================================================================
SELECT
  ci.comanda_id,
  ci.id                                           AS item_id,
  ci.service_id,
  ci.product_name,
  ci.quantity,
  ci.unit_price,
  ci.staff_id
FROM public.comanda_items ci
WHERE ci.comanda_id IN (SELECT comanda_id FROM alvo)
ORDER BY ci.comanda_id, ci.id;


-- ============================================================================
-- QUERY E — CONTEXTO HISTÓRICO DE CAIXA (SEM FK para comanda)
-- cash_closing_events NÃO possui coluna comanda_id; isto é apenas evidência
-- temporal do período das transações. NÃO inferir vínculo direto.
-- ============================================================================
SELECT
  cce.id,
  cce.business_date,
  cce.event_type,
  cce.event_time,
  cce.label,
  cce.detail,
  cce.metadata
FROM public.cash_closing_events cce
WHERE cce.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
  AND cce.event_type IN ('service', 'reversal')
  AND cce.business_date >= '2026-05-01'
  AND cce.business_date <= '2026-05-31'
ORDER BY cce.business_date, cce.event_time;
