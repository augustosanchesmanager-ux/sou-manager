-- ============================================================================
-- P0.4-A7 — Idempotência da Criação de Conta a Pagar
-- Adds idempotency_key column + UNIQUE constraint + RPC
-- ============================================================================

-- 1. Adicionar coluna (DEFAULT serve como backfill automático)
ALTER TABLE public.accounts_payable
  ADD COLUMN idempotency_key UUID DEFAULT gen_random_uuid();

-- 2. Tornar NOT NULL (backfill já ocorreu via DEFAULT)
ALTER TABLE public.accounts_payable
  ALTER COLUMN idempotency_key SET NOT NULL;

-- 3. Remover DEFAULT (INSERT futuro sem key FALHA no banco)
ALTER TABLE public.accounts_payable
  ALTER COLUMN idempotency_key DROP DEFAULT;

-- 4. UNIQUE constraint
CREATE UNIQUE INDEX idx_accounts_payable_idempotency_key
  ON public.accounts_payable (tenant_id, idempotency_key);

-- 5. RPC: create_one_time_account_payable — idempotente via idempotency_key
CREATE OR REPLACE FUNCTION public.create_one_time_account_payable(
  p_name TEXT,
  p_amount NUMERIC,
  p_due_date DATE,
  p_idempotency_key UUID,
  p_category TEXT DEFAULT 'outros',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_existing RECORD;
  v_result RECORD;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'idempotency_key e obrigatorio';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant nao identificado';
  END IF;

  -- Buscar existente
  SELECT * INTO v_existing
  FROM public.accounts_payable
  WHERE tenant_id = v_tenant_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    -- Verificar conflito de payload
    IF v_existing.name != p_name
       OR v_existing.amount != p_amount
       OR v_existing.due_date != p_due_date
       OR v_existing.category != p_category THEN
      RAISE EXCEPTION 'CONFLICT: idempotency_key ja existe com payload diferente';
    END IF;

    -- Mesma key + mesmo payload -> idempotente
    RETURN jsonb_build_object(
      'success', true,
      'id', v_existing.id,
      'created', false,
      'message', 'Conta ja existe para esta chave de idempotencia'
    );
  END IF;

  -- Inserir (UNIQUE constraint catches race condition)
  BEGIN
    INSERT INTO public.accounts_payable (
      tenant_id, recurring_bill_id, name, amount, due_date,
      competence_month, competence_year, category, notes,
      status, created_by, idempotency_key
    ) VALUES (
      v_tenant_id, NULL, p_name, p_amount, p_due_date,
      EXTRACT(MONTH FROM p_due_date)::INTEGER,
      EXTRACT(YEAR FROM p_due_date)::INTEGER,
      p_category, p_notes,
      'pending', auth.uid(), p_idempotency_key
    )
    RETURNING * INTO v_result;

    RETURN jsonb_build_object(
      'success', true,
      'id', v_result.id,
      'created', true
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Race condition: outra request inseriu entre SELECT e INSERT
      SELECT * INTO v_existing
      FROM public.accounts_payable
      WHERE tenant_id = v_tenant_id
        AND idempotency_key = p_idempotency_key;

      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing.id,
        'created', false,
        'message', 'Conta ja existe (concorrencia)'
      );
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_one_time_account_payable(
  TEXT, NUMERIC, DATE, UUID, TEXT, TEXT
) TO authenticated;
