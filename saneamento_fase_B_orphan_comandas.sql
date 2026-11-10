-- ============================================================================
-- SANEAMENTO FASE B — comandas orfas open -> cancelled
-- ----------------------------------------------------------------------------
-- PROPOSITO: cancelar 25 comandas orfas historicas (tenant Sanchez Barber)
--            vinculadas a appointment cancelado, sem criar transaction.
--
-- STATUS:           PREPARADO — NAO EXECUTADO contra producao.
-- NAO E MIGRATION:  vive fora de supabase/migrations/.
-- SEGURANCA:        transacao propria, guards com RAISE EXCEPTION (abortam),
--                   UPDATE idempotente, post-check com rollback se falhar.
--
-- ESPECIFICACAO DO ALVO:
--   Os alvos sao DEFINIDOS POR CRITERIO (a populacao auditada/congelada),
--   recomputados na execucao sobre os dados vivos, NUNCA por lista de UUIDs.
--   A invariante EXATAMENTE=25 e imposta por guard (RAISE EXCEPTION se divergir).
--
-- ALTERA SOMENTE (em comandas):
--   status                  = 'cancelled'
--   cancellation_type       = appointments.cancellation_type
--   cancelled_at            = now() (timestamp do saneamento)
--   cancelled_by_user_id    = NULL (saneamento automatizado, sem usuario humano)
--   closure_note            = 'Saneamento historico: comanda orfa vinculada a appointment cancelado.'
-- NAO ALTERA: financial_effect, total, transactions, payment_method,
--             comanda_items, customer_credits, customer_subscriptions.
-- NAO CRIA TRANSACTION. NAO CANCELA PAID.
--
-- EXCECOES FINANCEIRAS (FORA DO LOTE — nunca podem ser canceladas e fim de B):
--   comandas que possuam transaction(s) OU financial_effect=false.
--   (Na populacao auditada: d2845e32-... com 1 txn, e 4077d722-... com
--    financial_effect=false e 2 txns — nunca entram na fase B.)
-- ============================================================================


-- ============================================================================
-- 1) DEFINICAO DO ALVO (criterio congelado da auditoria — recomputado)
--    EXCLUI explicitamente excecoes financeiras e comandas paid.
-- ============================================================================
DROP VIEW IF EXISTS v_saneamento_b_alvo;
CREATE TEMP VIEW v_saneamento_b_alvo AS
SELECT c.id AS comanda_id, c.tenant_id, c.client_id, c.created_at
FROM public.comandas c
JOIN public.appointments a
       ON a.id = c.appointment_id
      AND a.tenant_id = c.tenant_id
WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
  AND c.status = 'open'
  AND a.status = 'cancelled'
  AND c.financial_effect = true
  AND c.status <> 'paid'                                   -- nunca cancelar paid
  AND NOT EXISTS (                                          -- zero transactions
    SELECT 1 FROM public.transactions t
    WHERE t.source_type = 'comanda' AND t.source_id = c.id
  )
  AND c.id NOT IN (                                         -- excecoes financeiras
    'd2845e32-a20c-47c7-9484-7992487c744b',
    '4077d722-327b-4fd1-a0ba-06850aec9d03'
  );


-- ============================================================================
-- 2) GUARDS (abortam se qualquer condicao divergir)
-- ============================================================================
DO $$
DECLARE
  v_esperado  CONSTANT integer := 25;
  v_count     integer;
  v_sem_cancel_type integer;
BEGIN
  -- Guard 1 + 2: exatamente 25 alvos, todos do tenant correto
  SELECT COUNT(*) INTO v_count FROM v_saneamento_b_alvo;
  IF v_count <> v_esperado THEN
    RAISE EXCEPTION 'FASE B: esperado % alvos por criterio, encontrado %. ABORTADO. (Pode ja ter sido executado — verifique count_b_preview.)', v_esperado, v_count;
  END IF;

  -- Guard 3: todos os alvos ainda estao open (o criterio ja garante), e
  --          appointment ainda cancelled (o criterio ja garante).
  -- Guard 4: financial_effect ainda true (o criterio ja garante).
  -- Guard 5: transactions = 0 (o criterio ja garante).
  -- Essas invariantes sao impostas pela propria CTE; se qualquer uma divergir,
  -- o count <> 25 e o guard 1/2 aborta.

  -- Guard 6: coluna appointments.cancellation_type existe (necessaria p/ o UPDATE)
  SELECT COUNT(*) INTO v_sem_cancel_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'cancellation_type';
  IF v_sem_cancel_type = 0 THEN
    RAISE EXCEPTION 'FASE B: coluna appointments.cancellation_type nao encontrada. ABORTADO.';
  END IF;

  RAISE NOTICE 'FASE B: todos os guards OK (% alvos).', v_esperado;
END $$;


-- ============================================================================
-- 3) TRANSACAO: UPDATE idempotente + post-check
-- ============================================================================
BEGIN;

UPDATE public.comandas c
SET
  status               = 'cancelled',
  cancellation_type    = a.cancellation_type,
  cancelled_at         = now(),
  cancelled_by_user_id = NULL,
  closure_note         = 'Saneamento historico: comanda orfa vinculada a appointment cancelado.'
FROM public.appointments a
WHERE a.id = c.appointment_id
  AND c.id IN (SELECT comanda_id FROM v_saneamento_b_alvo)
  AND c.status = 'open';                       -- idempotente: 2a execucao nao altera nada

-- post-check: nenhum alvo deve ter ficado sem 'cancelled'
DO $$
DECLARE
  v_restam integer;
BEGIN
  SELECT COUNT(*) INTO v_restam
  FROM public.comandas c
  WHERE c.id IN (SELECT comanda_id FROM v_saneamento_b_alvo)
    AND c.status <> 'cancelled';
  IF v_restam <> 0 THEN
    RAISE EXCEPTION 'FASE B post-check: % alvo(s) nao ficaram cancelled. ROLLBACK.', v_restam;
  END IF;
END $$;

COMMIT;

DROP VIEW IF EXISTS v_saneamento_b_alvo;


-- ============================================================================
-- 4) RELATORIO: auditabilidade (lista os 25 cancelados)
-- ============================================================================
SELECT c.id AS comanda_id, c.tenant_id, c.client_id, c.created_at,
       c.status, c.cancellation_type, c.cancelled_at,
       c.cancelled_by_user_id, c.closure_note
FROM public.comandas c
JOIN public.appointments a ON a.id = c.appointment_id AND a.tenant_id = c.tenant_id
WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
  AND c.status = 'cancelled'
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
ORDER BY c.created_at, c.id;
