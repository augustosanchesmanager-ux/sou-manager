-- ============================================================================
-- SANEAMENTO ÓRFÃOS — FASE B (comandas órfãs open -> cancelled)
-- ----------------------------------------------------------------------------
-- STATUS:            PREPARADO — NAO EXECUTADO.
-- NAO E MIGRATION:   vive fora de supabase/migrations/.
-- ALTERA SOMENTE (em comandas):
--   status               = 'cancelled'
--   cancellation_type    = appointments.cancellation_type   (convencao cancelAppointment)
--   cancelled_at         = now()
--   cancelled_by_user_id = NULL
--   closure_note         = 'Saneamento historico: comanda orfa vinculada a appointment cancelado.'
-- NAO ALTERA: financial_effect, total, transactions, payment_method,
--             comanda_items, customer_credits, customer_subscriptions.
-- NAO CRIA TRANSACTION. NAO CANCELA PAID.
-- NAO TOCA excecoes financeiras (d2845e32, 4077d722).
-- SEGURANCA: guards com RAISE EXCEPTION antes do UPDATE + transacao + idempotencia
--            + post-check com rollback.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) DEFINICAO DO ALVO (criterio congelado — recomputado; exclui excecoes/paid)
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
  AND c.status <> 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.source_type = 'comanda' AND t.source_id = c.id
  )
  AND c.id NOT IN (
    'd2845e32-a20c-47c7-9484-7992487c744b',
    '4077d722-327b-4fd1-a0ba-06850aec9d03'
  );


-- ----------------------------------------------------------------------------
-- 2) GUARDS (repetidos imediatamente antes do UPDATE — abortam se divergir)
-- ============================================================================
DO $$
DECLARE
  v_esperado         CONSTANT integer := 25;
  v_count            integer;
  v_sem_cancel_type  integer;
BEGIN
  -- Guard 1+2: exatamente 25 alvos, do tenant correto
  SELECT COUNT(*) INTO v_count FROM v_saneamento_b_alvo;
  IF v_count <> v_esperado THEN
    RAISE EXCEPTION 'FASE B: esperado % alvos, encontrado %. ABORTADO (verifique preflight).', v_esperado, v_count;
  END IF;

  -- Guard 6: coluna appointments.cancellation_type existe (necessaria p/ UPDATE)
  SELECT COUNT(*) INTO v_sem_cancel_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='appointments' AND column_name='cancellation_type';
  IF v_sem_cancel_type = 0 THEN
    RAISE EXCEPTION 'FASE B: coluna appointments.cancellation_type nao encontrada. ABORTADO.';
  END IF;

  RAISE NOTICE 'FASE B: todos os guards OK (% alvos).', v_esperado;
END $$;


-- ----------------------------------------------------------------------------
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
  AND c.status = 'open';                       -- idempotente

-- post-check: nenhum alvo deve ter ficado sem 'cancelled'
DO $$
DECLARE v_restam integer;
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


-- ----------------------------------------------------------------------------
-- 4) RELATORIO (auditabilidade)
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
