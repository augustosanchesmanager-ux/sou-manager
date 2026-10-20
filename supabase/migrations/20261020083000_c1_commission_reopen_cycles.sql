-- Migration: 20261020083000_c1_commission_reopen_cycles.sql
-- Description: [ADR-033] Ciclos de comissao em comandas reabertas e transicao de status no ledger D7/D8.
--              1. Atualiza create_commission_reversal para marcar status = 'reversed' no registro original
--                 quando a reversao acumulada for integral (ABS(v_new_total) >= ABS(v_original.commission_value)).
--              2. Backfill idempotente em commission_records: marca status = 'reversed' nos registros originais
--                 que ja possuem estorno integral ativo.
--              3. Atualiza o indice unico parcial idx_commission_records_staff_comanda para considerar apenas
--                 registros com status = 'active'.
--              4. Atualiza a RPC exists_commission_record (D8 / worker) para verificar status = 'active'.

BEGIN;

-- ── 1. Atualizar RPC create_commission_reversal ──────────────────────────────
CREATE OR REPLACE FUNCTION public.create_commission_reversal(
  p_tenant_id UUID,
  p_original_record_id UUID,
  p_commission_value NUMERIC,
  p_idempotency_key TEXT,
  p_event_id TEXT DEFAULT NULL,
  p_event_type TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original public.commission_records%ROWTYPE;
  v_total_reversed NUMERIC;
  v_new_total NUMERIC;
  v_abs_new_amount NUMERIC;
  v_reversal_id UUID;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria';
  END IF;

  -- Input validation
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obrigatorio';
  END IF;
  IF p_original_record_id IS NULL THEN
    RAISE EXCEPTION 'original_record_id obrigatorio';
  END IF;
  v_abs_new_amount := ABS(COALESCE(p_commission_value, 0));
  IF v_abs_new_amount <= 0 THEN
    RAISE EXCEPTION 'commission_value deve ser negativo e nao zero';
  END IF;

  -- Idempotency check (before lock for performance)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_reversal_id
    FROM public.commission_records
    WHERE tenant_id = p_tenant_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true, 'idempotent', true,
        'reversal_id', v_reversal_id,
        'message', 'Reversao ja processada'
      );
    END IF;
  END IF;

  -- Advisory lock: serialize reversals on the same original record
  PERFORM pg_advisory_xact_lock(
    hashtext('commission_reversal:' || p_tenant_id::text || ':' || p_original_record_id::text)
  );

  -- Lock the original record (prevents concurrent reads of stale data)
  SELECT * INTO v_original
  FROM public.commission_records
  WHERE id = p_original_record_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro original nao encontrado';
  END IF;
  IF v_original.record_type != 'commission' THEN
    RAISE EXCEPTION 'original_record_id deve apontar para um registro record_type=commission';
  END IF;

  -- Calculate total already reversed (after lock, sees committed data)
  SELECT COALESCE(SUM(commission_value), 0) INTO v_total_reversed
  FROM public.commission_records
  WHERE original_record_id = p_original_record_id
    AND record_type = 'reversal';

  -- Validate: new total cannot exceed original
  v_new_total := v_total_reversed + p_commission_value;
  IF ABS(v_new_total) > ABS(v_original.commission_value) THEN
    RAISE EXCEPTION 'Reversao excede comissao original. Original: %, Ja revertido: %, Novo total: %',
      v_original.commission_value, v_total_reversed, v_new_total;
  END IF;

  -- Insert reversal
  INSERT INTO public.commission_records (
    tenant_id, record_type, comanda_id, comanda_item_id, staff_id,
    gross_value, discount, net_value, received_value, commission_rate, commission_value,
    participant_share, payout_type, affects_commission,
    original_record_id, idempotency_key, event_id, event_type, status
  ) VALUES (
    p_tenant_id, 'reversal', v_original.comanda_id, v_original.comanda_item_id, v_original.staff_id,
    0, 0, 0, 0, 0, p_commission_value,
    0, 'percentage', false,
    p_original_record_id, p_idempotency_key, p_event_id, p_event_type, 'active'
  ) RETURNING id INTO v_reversal_id;

  -- Transicao de status no registro original quando o estorno for integral
  IF ABS(v_new_total) >= ABS(v_original.commission_value) THEN
    UPDATE public.commission_records
    SET status = 'reversed'
    WHERE id = p_original_record_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false,
    'reversal_id', v_reversal_id,
    'original_record_id', p_original_record_id,
    'commission_value', p_commission_value,
    'message', 'Reversao registrada com sucesso'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_commission_reversal(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_commission_reversal(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- ── 2. Backfill idempotente dos registros ja integralmente revertidos ────────
UPDATE public.commission_records o
SET status = 'reversed'
WHERE o.record_type = 'commission'
  AND o.status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.commission_records r
    WHERE r.original_record_id = o.id
      AND r.record_type = 'reversal'
      AND r.status = 'active'
    GROUP BY r.original_record_id
    HAVING ABS(SUM(r.commission_value)) >= ABS(o.commission_value)
  );

-- ── 3. Atualizar indice parcial unico para incluir status = 'active' ──────────
DROP INDEX IF EXISTS public.idx_commission_records_staff_comanda;

CREATE UNIQUE INDEX idx_commission_records_staff_comanda
  ON public.commission_records(tenant_id, staff_id, comanda_id)
  WHERE record_type = 'commission' AND status = 'active';

-- ── 4. Atualizar RPC exists_commission_record (D8 / worker) ───────────────────
CREATE OR REPLACE FUNCTION public.exists_commission_record(
  p_staff_id  UUID,
  p_comanda_id UUID,
  p_tenant_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n BIGINT;
BEGIN
  SELECT count(*) INTO v_n
  FROM public.commission_records
  WHERE tenant_id = p_tenant_id
    AND staff_id = p_staff_id
    AND comanda_id = p_comanda_id
    AND record_type = 'commission'
    AND status = 'active';
  RETURN v_n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.exists_commission_record(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exists_commission_record(UUID, UUID, UUID) TO worker_dispatcher, authenticated, service_role;

COMMENT ON FUNCTION public.create_commission_reversal(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT)
  IS 'ADR-033: Cria reversao de comissao e transiciona o registro original para status=reversed quando integral.';

COMMENT ON FUNCTION public.exists_commission_record(UUID, UUID, UUID)
  IS 'ADR-033: Idempotencia D8 filtrando record_type=commission e status=active.';

NOTIFY pgrst, 'reload schema';

COMMIT;
