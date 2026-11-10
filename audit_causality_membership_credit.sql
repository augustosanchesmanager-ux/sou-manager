-- ============================================================================
-- AUDITORIA READ-ONLY: CAUSALIDADE de membership_credit_effect=true (27 comandas)
-- ----------------------------------------------------------------------------
-- SEGURANÇA: SELECT / WITH / JOIN / GROUP BY / COUNT / SUM / CASE / ORDER BY /
--           sub-SELECTs correlacionados. NENHUM UPDATE/DELETE/INSERT/RPC/migration.
--
-- PERGUNTA: para cada uma das 27 (tenant alvo + comanda open + appointment
--   cancelled + membership_credit_effect=true), o CLIENTE tinha plano/assinatura
--   ATIVA na data da comanda, e havia créditos disponíveis? Isso separa
--   "marcador histórico" de "crédito realmente consumido".
--
-- NOTA DE SCHEMA (IMPORTANTE): no repo de migrations, comanda_items NÃO possui
--   paid_with_plan_credit / credit_usage_id, e NÃO existe customer_plan_credit_usages.
--   Essas colunas podem existir SÓ em produção. O bloco "Query C (opcional)" está
--   comentado — descomente APENAS se essas colunas existirem no seu ambiente.
-- ============================================================================


-- ============================================================================
-- CTE ALVO: as 27 (mesmo critério do diagnóstico + membership_credit_effect=true)
-- ============================================================================
WITH alvo AS (
  SELECT c.id AS comanda_id, c.tenant_id, c.client_id, c.created_at
  FROM public.comandas c
  JOIN public.appointments a
         ON a.id = c.appointment_id
        AND a.tenant_id = c.tenant_id
  WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
    AND c.status   = 'open'
    AND a.status   = 'cancelled'
    AND c.membership_credit_effect = true
)


-- ============================================================================
-- QUERY A — POR COMANDA: cliente tinha plano ativo + créditos na DATA?
-- ============================================================================
SELECT
  c.id                                                       AS comanda_id,
  c.created_at                                               AS comanda_created_at,
  c.client_id,
  c.appointment_id,
  c.total,
  c.membership_credit_effect,
  c.financial_effect,
  c.status                                                   AS comanda_status,
  c.payment_method,
  COALESCE((
    SELECT COUNT(*)
    FROM public.transactions t
    WHERE t.source_type = 'comanda' AND t.source_id = c.id
  ), 0)                                                      AS n_transactions,
  -- assinaturas ativas na data da comanda
  (
    SELECT COUNT(*)
    FROM public.customer_subscriptions s
    WHERE s.client_id = c.client_id
      AND s.tenant_id = c.tenant_id
      AND s.status = 'active'
      AND s.cycle_start <= c.created_at
      AND (s.cycle_end IS NULL OR s.cycle_end >= c.created_at)
  )                                                          AS n_assinaturas_ativas_na_data,
  -- créditos DISPONÍVEIS na data (soma das customer_credits das assinaturas ativas)
  COALESCE((
    SELECT SUM(cc.available_credits)
    FROM public.customer_credits cc
    JOIN public.customer_subscriptions s
           ON s.id = cc.subscription_id
    WHERE s.client_id = c.client_id
      AND s.tenant_id = c.tenant_id
      AND s.status = 'active'
      AND s.cycle_start <= c.created_at
      AND (s.cycle_end IS NULL OR s.cycle_end >= c.created_at)
      AND (cc.period_start IS NULL OR cc.period_start <= c.created_at)
      AND (cc.period_end   IS NULL OR cc.period_end   >= c.created_at)
  ), 0)                                                      AS creditos_disponiveis_na_data,
  -- créditos USADOS (ledger) na data
  COALESCE((
    SELECT SUM(cc.used_credits)
    FROM public.customer_credits cc
    JOIN public.customer_subscriptions s
           ON s.id = cc.subscription_id
    WHERE s.client_id = c.client_id
      AND s.tenant_id = c.tenant_id
      AND s.status = 'active'
      AND s.cycle_start <= c.created_at
      AND (s.cycle_end IS NULL OR s.cycle_end >= c.created_at)
      AND (cc.period_start IS NULL OR cc.period_start <= c.created_at)
      AND (cc.period_end   IS NULL OR cc.period_end   >= c.created_at)
  ), 0)                                                      AS creditos_usados_na_data
FROM public.comandas c
WHERE c.id IN (SELECT comanda_id FROM alvo)
ORDER BY c.created_at, c.id;


-- ============================================================================
-- QUERY B — ASSINATURAS + PLANOS dos clientes dessas 27 (contexto)
-- ============================================================================
WITH alvo AS (
  SELECT c.id AS comanda_id, c.tenant_id, c.client_id, c.created_at
  FROM public.comandas c
  JOIN public.appointments a
         ON a.id = c.appointment_id
        AND a.tenant_id = c.tenant_id
  WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
    AND c.status   = 'open'
    AND a.status   = 'cancelled'
    AND c.membership_credit_effect = true
)
SELECT
  c.id                                AS comanda_id,
  c.client_id,
  s.id                                AS subscription_id,
  p.name                              AS plano_nome,
  s.status                            AS subscription_status,
  s.cycle_start,
  s.cycle_end,
  cc.available_credits,
  cc.used_credits,
  cc.period_start                     AS credit_period_start,
  cc.period_end                       AS credit_period_end
FROM public.comandas c
JOIN public.customer_subscriptions s
       ON s.client_id = c.client_id
      AND s.tenant_id = c.tenant_id
JOIN public.customer_plans p
       ON p.id = s.plan_id
LEFT JOIN public.customer_credits cc
        ON cc.subscription_id = s.id
WHERE c.id IN (SELECT comanda_id FROM alvo)
ORDER BY c.id, s.cycle_start;


-- ============================================================================
-- QUERY C — ITENS DA COMANDA (o que deveria consumir crédito)
-- OBS: paid_with_plan_credit / credit_usage_id NÃO existem no repo de migrations.
--      Descomente o bloco abaixo SOMENTE se essas colunas existirem em produção.
-- ============================================================================
WITH alvo AS (
  SELECT c.id AS comanda_id, c.tenant_id, c.client_id, c.created_at
  FROM public.comandas c
  JOIN public.appointments a
         ON a.id = c.appointment_id
        AND a.tenant_id = c.tenant_id
  WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
    AND c.status   = 'open'
    AND a.status   = 'cancelled'
    AND c.membership_credit_effect = true
)
SELECT
  ci.comanda_id,
  ci.id                                AS item_id,
  ci.service_id,
  ci.product_name,
  ci.quantity,
  ci.unit_price,
  ci.staff_id
  -- , ci.paid_with_plan_credit          -- DESCOMENTE SE EXISTIR EM PRODUÇÃO
  -- , ci.credit_usage_id                -- DESCOMENTE SE EXISTIR EM PRODUÇÃO
FROM public.comanda_items ci
WHERE ci.comanda_id IN (SELECT comanda_id FROM alvo)
ORDER BY ci.comanda_id, ci.id;


-- ============================================================================
-- QUERY D — RESUMO (números do gate) — standalone
-- Buckets: assinatura ativa na data (0 vs 1+), créditos (0 vs >0), crossover
--          com status=open + financial_effect=true + n_transactions=0.
-- ============================================================================
WITH base AS (
  SELECT
    c.id                AS comanda_id,
    c.created_at,
    c.client_id,
    c.total,
    c.financial_effect,
    c.status,
    COALESCE((
      SELECT COUNT(*)
      FROM public.customer_subscriptions s
      WHERE s.client_id = c.client_id
        AND s.tenant_id = c.tenant_id
        AND s.status = 'active'
        AND s.cycle_start <= c.created_at
        AND (s.cycle_end IS NULL OR s.cycle_end >= c.created_at)
    ), 0)               AS n_assinaturas_ativas_na_data,
    COALESCE((
      SELECT SUM(cc.available_credits)
      FROM public.customer_credits cc
      JOIN public.customer_subscriptions s ON s.id = cc.subscription_id
      WHERE s.client_id = c.client_id
        AND s.tenant_id = c.tenant_id
        AND s.status = 'active'
        AND s.cycle_start <= c.created_at
        AND (s.cycle_end IS NULL OR s.cycle_end >= c.created_at)
        AND (cc.period_start IS NULL OR cc.period_start <= c.created_at)
        AND (cc.period_end   IS NULL OR cc.period_end   >= c.created_at)
    ), 0)               AS creditos_disponiveis_na_data,
    COALESCE((
      SELECT COUNT(*)
      FROM public.transactions t
      WHERE t.source_type = 'comanda' AND t.source_id = c.id
    ), 0)               AS n_transactions
  FROM public.comandas c
  WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
    AND c.status = 'open'
    AND c.membership_credit_effect = true
    AND c.appointment_id IN (
      SELECT a.id FROM public.appointments a
      WHERE a.tenant_id = c.tenant_id AND a.status = 'cancelled'
    )
)
SELECT
  COUNT(*)                                                                  AS total_comandas,
  COUNT(*) FILTER (WHERE n_assinaturas_ativas_na_data = 0)
                                                                             AS sem_assinatura_ativa_na_data,
  COUNT(*) FILTER (WHERE n_assinaturas_ativas_na_data >= 1)
                                                                             AS com_assinatura_ativa_na_data,
  COUNT(*) FILTER (WHERE creditos_disponiveis_na_data = 0)
                                                                             AS creditos_zero_na_data,
  COUNT(*) FILTER (WHERE creditos_disponiveis_na_data > 0)
                                                                             AS creditos_positivos_na_data,
  COUNT(*) FILTER (WHERE status = 'open' AND financial_effect = true
                        AND n_transactions = 0)                              AS open_financial_true_sem_transacao
FROM base;


-- ============================================================================
-- QUERY E — RESUMO DE ITENS (o que deveria consumir crédito)
-- ============================================================================
SELECT
  COUNT(*)                     AS total_itens,
  COUNT(DISTINCT comanda_id)   AS comandas_com_item,
  SUM(quantity)                AS total_quantidades
FROM public.comanda_items ci
WHERE ci.comanda_id IN (
  SELECT c.id FROM public.comandas c
  WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
    AND c.status = 'open'
    AND c.membership_credit_effect = true
    AND c.appointment_id IN (
      SELECT a.id FROM public.appointments a
      WHERE a.tenant_id = c.tenant_id AND a.status = 'cancelled'
    )
);
