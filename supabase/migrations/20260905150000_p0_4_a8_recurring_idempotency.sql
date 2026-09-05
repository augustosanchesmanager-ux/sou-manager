-- ============================================================================
-- P0.4-A8 — Idempotência da Criação de Recurring Bill
-- Adds idempotency_key column + UNIQUE constraint + RPC
-- ============================================================================

-- 1. Add column (DEFAULT for backfill)
ALTER TABLE public.recurring_bills
  ADD COLUMN idempotency_key UUID DEFAULT gen_random_uuid();

-- 2. Make NOT NULL (backfill complete via DEFAULT)
ALTER TABLE public.recurring_bills
  ALTER COLUMN idempotency_key SET NOT NULL;

-- 3. Remove DEFAULT (future inserts require key)
ALTER TABLE public.recurring_bills
  ALTER COLUMN idempotency_key DROP DEFAULT;

-- 4. UNIQUE constraint
CREATE UNIQUE INDEX idx_recurring_bills_idempotency_key
  ON public.recurring_bills (tenant_id, idempotency_key);

-- 5. RPC: create_recurring_bill — idempotent via idempotency_key
CREATE OR REPLACE FUNCTION public.create_recurring_bill(
  p_name TEXT,
  p_amount NUMERIC,
  p_due_day INTEGER,
  p_idempotency_key UUID,
  p_category TEXT DEFAULT 'Outros',
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

  SELECT * INTO v_existing
  FROM public.recurring_bills
  WHERE tenant_id = v_tenant_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.name != p_name
       OR v_existing.amount != p_amount
       OR v_existing.due_day != p_due_day
       OR COALESCE(v_existing.category, '') != COALESCE(p_category, '') THEN
      RAISE EXCEPTION 'CONFLICT: idempotency_key ja existe com payload diferente';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'id', v_existing.id,
      'created', false,
      'message', 'Recorrência já existe para esta chave de idempotência'
    );
  END IF;

  BEGIN
    INSERT INTO public.recurring_bills (
      tenant_id, name, amount, due_day, category, notes,
      is_active, idempotency_key, created_by
    ) VALUES (
      v_tenant_id, p_name, p_amount, p_due_day, p_category, p_notes,
      true, p_idempotency_key, auth.uid()
    )
    RETURNING * INTO v_result;

    RETURN jsonb_build_object(
      'success', true,
      'id', v_result.id,
      'created', true
    );
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_existing
      FROM public.recurring_bills
      WHERE tenant_id = v_tenant_id
        AND idempotency_key = p_idempotency_key;

      RETURN jsonb_build_object(
        'success', true,
        'id', v_existing.id,
        'created', false,
        'message', 'Recorrência já existe (concorrência)'
      );
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_recurring_bill(
  TEXT, NUMERIC, INTEGER, UUID, TEXT, TEXT
) TO authenticated;
