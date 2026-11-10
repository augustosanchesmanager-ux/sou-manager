-- ============================================================================
-- AUDITORIA READ-ONLY: comandas órfãs / inconsistentes (todos os tenants)
-- ----------------------------------------------------------------------------
-- SEGURANÇA (etapa de auditoria — PROIBIDO mutar):
--   Apenas: SELECT / WITH / JOIN / GROUP BY / COUNT / CASE / ORDER BY / FILTER
--   NUNCA:  UPDATE / DELETE / INSERT / RPC mutável / migration / CREATE VIEW
--
-- VÍNCULO: por appointment_id (comandas.appointment_id -> appointments.id).
--          NÃO usar customer_id/client_id para inferir vínculo.
--
-- ESCOPO: todos os tenants; agregado por tenant_id onde aplicável.
--
-- EXECUÇÃO: cada query abaixo é AUTOCONTIDA (possui sua própria CTE ou não a
--           usa). Podem ser rodadas isoladamente ou o arquivo inteiro de uma vez
--           no Supabase SQL Editor (role postgres/service_role -> BYPASS RLS ->
--           todos os tenants). Via API anon o RLS isola por tenant.
--
-- NOTA DE FK: comandas.appointment_id REFERENCES appointments(id) ON DELETE SET NULL.
--   "orfa_referencial" (appointment_id preenchido p/ id inexistente) é improvável;
--   mantida defensivamente. O caso real de desvinculação é appointment_id IS NULL.
--
-- P1 (commit ae38faa) já previne NOVAS órfãs (cancelled -> comanda open/blocked
-- cancelada). Esta query mede o ESTOQUE HISTÓRICO. NÃO altera dados.
-- ============================================================================


-- ============================================================================
-- QUERY 1 — DETALHAMENTO DAS ANOMALIAS (🔴 e 🟡), por linha
-- Colunas: tenant_id, appointment_id, appointment_status, comanda.id,
--          comanda.status, comanda.created_at, comanda.updated_at, classificacao.
-- Remova o WHERE para listar tudo; adicione LIMIT 1000 se a tabela for enorme.
-- ============================================================================
WITH classificadas AS (
  SELECT
    c.tenant_id,
    c.appointment_id,
    a.status                                            AS appointment_status,
    c.id                                                AS comanda_id,
    c.status                                            AS comanda_status,
    c.created_at                                        AS comanda_created_at,
    c.updated_at                                        AS comanda_updated_at,
    CASE
      WHEN c.appointment_id IS NULL
        THEN '🟡 comanda_sem_appointment_id'
      WHEN a.id IS NULL
        THEN '🔴 orfa_referencial'
      WHEN a.status = 'cancelled' AND c.status IN ('open', 'blocked')
        THEN '🔴 orfa'
      WHEN a.status = 'cancelled' AND c.status = 'cancelled'
        THEN '🟢 corrigida'
      WHEN a.status = 'cancelled' AND c.status = 'paid'
        THEN '🟢 normal'
      WHEN a.status = 'no_show' AND c.status IN ('open', 'blocked')
        THEN '🟡 no_show_comanda_ativa'
      WHEN a.status = 'completed' AND c.status IN ('open', 'blocked')
        THEN '🟡 concluido_comanda_ativa'
      WHEN a.status = 'completed' AND c.status = 'paid'
        THEN '🟢 normal'
      WHEN a.status NOT IN ('cancelled', 'completed', 'no_show')
           AND c.status IN ('open', 'blocked', 'paid')
        THEN '🟢 normal'
      WHEN c.status = 'cancelled'
        THEN '🟢 normal'
      ELSE '🟡 investigar_outro'
    END                                                AS classificacao
  FROM public.comandas c
  LEFT JOIN public.appointments a
         ON a.id = c.appointment_id
        AND a.tenant_id = c.tenant_id
)
SELECT
  tenant_id,
  appointment_id,
  appointment_status,
  comanda_id,
  comanda_status,
  comanda_created_at,
  comanda_updated_at,
  classificacao
FROM classificadas
WHERE classificacao NOT LIKE '🟢%'
ORDER BY
  tenant_id,
  CASE
    WHEN classificacao LIKE '🔴%' THEN 1
    WHEN classificacao LIKE '🟡%' THEN 2
    ELSE 3
  END,
  comanda_created_at DESC;


-- ============================================================================
-- QUERY 2 — CONTAGEM POR TENANT x CLASSIFICAÇÃO (concentração/impacto)
-- ============================================================================
WITH classificadas AS (
  SELECT
    c.tenant_id,
    c.appointment_id,
    a.status                                            AS appointment_status,
    c.id                                                AS comanda_id,
    c.status                                            AS comanda_status,
    c.created_at                                        AS comanda_created_at,
    c.updated_at                                        AS comanda_updated_at,
    CASE
      WHEN c.appointment_id IS NULL
        THEN '🟡 comanda_sem_appointment_id'
      WHEN a.id IS NULL
        THEN '🔴 orfa_referencial'
      WHEN a.status = 'cancelled' AND c.status IN ('open', 'blocked')
        THEN '🔴 orfa'
      WHEN a.status = 'cancelled' AND c.status = 'cancelled'
        THEN '🟢 corrigida'
      WHEN a.status = 'cancelled' AND c.status = 'paid'
        THEN '🟢 normal'
      WHEN a.status = 'no_show' AND c.status IN ('open', 'blocked')
        THEN '🟡 no_show_comanda_ativa'
      WHEN a.status = 'completed' AND c.status IN ('open', 'blocked')
        THEN '🟡 concluido_comanda_ativa'
      WHEN a.status = 'completed' AND c.status = 'paid'
        THEN '🟢 normal'
      WHEN a.status NOT IN ('cancelled', 'completed', 'no_show')
           AND c.status IN ('open', 'blocked', 'paid')
        THEN '🟢 normal'
      WHEN c.status = 'cancelled'
        THEN '🟢 normal'
      ELSE '🟡 investigar_outro'
    END                                                AS classificacao
  FROM public.comandas c
  LEFT JOIN public.appointments a
         ON a.id = c.appointment_id
        AND a.tenant_id = c.tenant_id
)
SELECT
  tenant_id,
  classificacao,
  COUNT(*) AS qtd
FROM classificadas
GROUP BY tenant_id, classificacao
ORDER BY tenant_id, qtd DESC;


-- ============================================================================
-- QUERY 3 — RESUMO EXECUTIVO POR TENANT (ranking de órfãs)
-- ============================================================================
WITH classificadas AS (
  SELECT
    c.tenant_id,
    c.appointment_id,
    a.status                                            AS appointment_status,
    c.id                                                AS comanda_id,
    c.status                                            AS comanda_status,
    c.created_at                                        AS comanda_created_at,
    c.updated_at                                        AS comanda_updated_at,
    CASE
      WHEN c.appointment_id IS NULL
        THEN '🟡 comanda_sem_appointment_id'
      WHEN a.id IS NULL
        THEN '🔴 orfa_referencial'
      WHEN a.status = 'cancelled' AND c.status IN ('open', 'blocked')
        THEN '🔴 orfa'
      WHEN a.status = 'cancelled' AND c.status = 'cancelled'
        THEN '🟢 corrigida'
      WHEN a.status = 'cancelled' AND c.status = 'paid'
        THEN '🟢 normal'
      WHEN a.status = 'no_show' AND c.status IN ('open', 'blocked')
        THEN '🟡 no_show_comanda_ativa'
      WHEN a.status = 'completed' AND c.status IN ('open', 'blocked')
        THEN '🟡 concluido_comanda_ativa'
      WHEN a.status = 'completed' AND c.status = 'paid'
        THEN '🟢 normal'
      WHEN a.status NOT IN ('cancelled', 'completed', 'no_show')
           AND c.status IN ('open', 'blocked', 'paid')
        THEN '🟢 normal'
      WHEN c.status = 'cancelled'
        THEN '🟢 normal'
      ELSE '🟡 investigar_outro'
    END                                                AS classificacao
  FROM public.comandas c
  LEFT JOIN public.appointments a
         ON a.id = c.appointment_id
        AND a.tenant_id = c.tenant_id
)
SELECT
  tenant_id,
  COUNT(*)                                                        AS total_comandas,
  COUNT(appointment_id)                                           AS total_vinculadas,
  COUNT(*) FILTER (WHERE classificacao IN ('🔴 orfa', '🔴 orfa_referencial'))
                                                                  AS total_orfas,
  COUNT(*) FILTER (WHERE classificacao = '🟢 corrigida')         AS total_ja_corrigidas,
  COUNT(*) FILTER (WHERE classificacao LIKE '🟡%')               AS total_investigar,
  COUNT(*) FILTER (WHERE classificacao = '🟡 comanda_sem_appointment_id')
                                                                  AS total_sem_appointment_id
FROM classificadas
GROUP BY tenant_id
ORDER BY total_orfas DESC, total_comandas DESC;


-- ============================================================================
-- QUERY 4 — TOTAIS GLOBAIS DO SaaS (uma linha)
-- ============================================================================
WITH classificadas AS (
  SELECT
    c.tenant_id,
    c.appointment_id,
    a.status                                            AS appointment_status,
    c.id                                                AS comanda_id,
    c.status                                            AS comanda_status,
    c.created_at                                        AS comanda_created_at,
    c.updated_at                                        AS comanda_updated_at,
    CASE
      WHEN c.appointment_id IS NULL
        THEN '🟡 comanda_sem_appointment_id'
      WHEN a.id IS NULL
        THEN '🔴 orfa_referencial'
      WHEN a.status = 'cancelled' AND c.status IN ('open', 'blocked')
        THEN '🔴 orfa'
      WHEN a.status = 'cancelled' AND c.status = 'cancelled'
        THEN '🟢 corrigida'
      WHEN a.status = 'cancelled' AND c.status = 'paid'
        THEN '🟢 normal'
      WHEN a.status = 'no_show' AND c.status IN ('open', 'blocked')
        THEN '🟡 no_show_comanda_ativa'
      WHEN a.status = 'completed' AND c.status IN ('open', 'blocked')
        THEN '🟡 concluido_comanda_ativa'
      WHEN a.status = 'completed' AND c.status = 'paid'
        THEN '🟢 normal'
      WHEN a.status NOT IN ('cancelled', 'completed', 'no_show')
           AND c.status IN ('open', 'blocked', 'paid')
        THEN '🟢 normal'
      WHEN c.status = 'cancelled'
        THEN '🟢 normal'
      ELSE '🟡 investigar_outro'
    END                                                AS classificacao
  FROM public.comandas c
  LEFT JOIN public.appointments a
         ON a.id = c.appointment_id
        AND a.tenant_id = c.tenant_id
)
SELECT
  COUNT(*)                                                        AS total_comandas,
  COUNT(appointment_id)                                           AS total_vinculadas,
  COUNT(*) FILTER (WHERE classificacao IN ('🔴 orfa', '🔴 orfa_referencial'))
                                                                  AS total_orfas,
  COUNT(*) FILTER (WHERE classificacao = '🟢 corrigida')         AS total_ja_corrigidas,
  COUNT(*) FILTER (WHERE classificacao LIKE '🟡%')               AS total_investigar,
  COUNT(*) FILTER (WHERE classificacao = '🟡 comanda_sem_appointment_id')
                                                                  AS total_sem_appointment_id
FROM classificadas;


-- ============================================================================
-- QUERY 5 — DISTRIBUIÇÃO POR STATUS DA COMANDA (todos os tenants, standalone)
-- ============================================================================
SELECT
  status      AS comanda_status,
  COUNT(*)    AS qtd
FROM public.comandas
GROUP BY status
ORDER BY qtd DESC;


-- ============================================================================
-- QUERY 6 — CROSS-TAB GLOBAL: appointment.status x comanda.status
-- Responde diretamente: das 482 ativas (open+blocked), quantas estão ligadas a
-- appointment cancelled / no_show / completed? (e quantas sem appointment)
-- Combos-chave: cancelled+open, cancelled+blocked, no_show+open, no_show+blocked,
--               completed+open, completed+blocked.
-- Linhas com appointment_status NULL = comandas sem appointment_id.
-- ============================================================================
SELECT
  a.status      AS appointment_status,
  c.status      AS comanda_status,
  COUNT(*)      AS qtd
FROM public.comandas c
LEFT JOIN public.appointments a
       ON a.id = c.appointment_id
      AND a.tenant_id = c.tenant_id
GROUP BY a.status, c.status
ORDER BY qtd DESC;


-- ============================================================================
-- QUERY 7 — CROSS-TAB POR TENANT: appointment.status x comanda.status
-- Igual à Query 6, particionado por tenant_id (concentração por empresa).
-- ============================================================================
SELECT
  c.tenant_id,
  a.status      AS appointment_status,
  c.status      AS comanda_status,
  COUNT(*)      AS qtd
FROM public.comandas c
LEFT JOIN public.appointments a
       ON a.id = c.appointment_id
      AND a.tenant_id = c.tenant_id
GROUP BY c.tenant_id, a.status, c.status
ORDER BY c.tenant_id, qtd DESC;
