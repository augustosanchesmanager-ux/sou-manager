-- ============================================================================
-- SANEAMENTO ÓRFÃOS — FASE A (membership_credit_effect true -> false)
-- ----------------------------------------------------------------------------
-- STATUS:            PREPARADO — NAO EXECUTADO.
-- NAO E MIGRATION:   vive fora de supabase/migrations/.
-- ALTERA SOMENTE:    comandas.membership_credit_effect (true -> false) nos 24
--                    alvos validados pelo preflight.
-- NAO ALTERA:        status, financial_effect, total, items, transactions,
--                    subscriptions, credits, comissao.
-- SEGURANCA:         (1) guards com RAISE EXCEPTION imediatamente antes do
--                    UPDATE (abortam em divergencia); (2) transacao propria;
--                    (3) UPDATE idempotente; (4) post-check com rollback.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) DEFINICAO DO ALVO (criterio congelado da auditoria — recomputado)
-- ============================================================================
DROP VIEW IF EXISTS v_saneamento_a_alvo;
CREATE TEMP VIEW v_saneamento_a_alvo AS
SELECT c.id AS comanda_id, c.tenant_id, c.client_id, c.created_at
FROM public.comandas c
JOIN public.appointments a
       ON a.id = c.appointment_id
      AND a.tenant_id = c.tenant_id
WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
  AND c.status = 'open'
  AND a.status = 'cancelled'
  AND c.membership_credit_effect = true
  AND NOT EXISTS (
    SELECT 1 FROM public.customer_subscriptions s
    WHERE s.client_id = c.client_id
      AND s.tenant_id = c.tenant_id
      AND s.cycle_start <= c.created_at
      AND (s.cycle_end IS NULL OR s.cycle_end >= c.created_at)
  );


-- ----------------------------------------------------------------------------
-- 2) GUARDS (repetidos imediatamente antes do UPDATE — abortam se divergir)
-- ============================================================================
DO $$
DECLARE
  v_esperado   CONSTANT integer := 24;
  v_count      integer;
  v_flags_true integer;
  v_itens_zero integer;
BEGIN
  -- Guard 1+2: exatamente 24 alvos, do tenant correto
  SELECT COUNT(*) INTO v_count FROM v_saneamento_a_alvo;
  IF v_count <> v_esperado THEN
    RAISE EXCEPTION 'FASE A: esperado % alvos, encontrado %. ABORTADO (verifique preflight).', v_esperado, v_count;
  END IF;

  -- Guard 3: todos os alvos ainda com membership_credit_effect = true
  SELECT COUNT(*) INTO v_flags_true
  FROM public.comandas c
  WHERE c.id IN (SELECT comanda_id FROM v_saneamento_a_alvo)
    AND c.membership_credit_effect = true;
  IF v_flags_true <> v_esperado THEN
    RAISE EXCEPTION 'FASE A: esperado % alvos com membership=true, encontrado %. ABORTADO.', v_esperado, v_flags_true;
  END IF;

  -- Guard 4: nenhum item dos alvos com unit_price = 0 (alteraria comissao)
  SELECT COUNT(*) INTO v_itens_zero
  FROM public.comanda_items ci
  WHERE ci.comanda_id IN (SELECT comanda_id FROM v_saneamento_a_alvo)
    AND ci.unit_price = 0;
  IF v_itens_zero <> 0 THEN
    RAISE EXCEPTION 'FASE A: % item(s) com unit_price=0 nos alvos. ABORTADO.', v_itens_zero;
  END IF;

  RAISE NOTICE 'FASE A: todos os guards OK (% alvos).', v_esperado;
END $$;


-- ----------------------------------------------------------------------------
-- 3) TRANSACAO: UPDATE idempotente + post-check
-- ============================================================================
BEGIN;

UPDATE public.comandas c
SET membership_credit_effect = false
WHERE c.id IN (SELECT comanda_id FROM v_saneamento_a_alvo)
  AND c.membership_credit_effect = true;   -- idempotente

-- post-check: nenhum alvo deve ter ficado true
DO $$
DECLARE v_restam integer;
BEGIN
  SELECT COUNT(*) INTO v_restam
  FROM public.comandas c
  WHERE c.id IN (SELECT comanda_id FROM v_saneamento_a_alvo)
    AND c.membership_credit_effect = true;
  IF v_restam <> 0 THEN
    RAISE EXCEPTION 'FASE A post-check: % alvo(s) ainda true. ROLLBACK.', v_restam;
  END IF;
END $$;

COMMIT;

DROP VIEW IF EXISTS v_saneamento_a_alvo;


-- ----------------------------------------------------------------------------
-- 4) RELATORIO (auditabilidade)
-- ============================================================================
SELECT c.id AS comanda_id, c.tenant_id, c.client_id, c.created_at,
       c.total, c.financial_effect, c.membership_credit_effect
FROM public.comandas c
JOIN public.appointments a ON a.id = c.appointment_id AND a.tenant_id = c.tenant_id
WHERE c.tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
  AND c.status = 'open'
  AND a.status = 'cancelled'
  AND c.membership_credit_effect = false
ORDER BY c.created_at, c.id;
