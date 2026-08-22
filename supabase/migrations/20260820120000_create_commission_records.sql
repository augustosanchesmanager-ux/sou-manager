-- ============================================================
-- 20260820120000_create_commission_records.sql
-- TD-001 B3.4-C: Per-comanda commission persistence.
--
-- Design:
--   - Append-only: no UPDATE or DELETE policies
--   - Partial unique index: 1 original commission per staff+comanda
--   - Idempotency index: prevents duplicate event processing
--   - RPC with pg_advisory_xact_lock for concurrent reversal protection
-- ============================================================

BEGIN;

-- ENUM for record type
DO $$ BEGIN
  CREATE TYPE public.commission_record_type AS ENUM ('commission', 'reversal');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Main table
CREATE TABLE IF NOT EXISTS public.commission_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Record type discriminator
  record_type       public.commission_record_type NOT NULL DEFAULT 'commission',

  -- Source reference
  comanda_id        UUID NOT NULL,
  comanda_item_id   UUID,

  -- Professional
  staff_id          UUID NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,

  -- Financial values
  gross_value       NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_value         NUMERIC(12,2) NOT NULL DEFAULT 0,
  received_value    NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_rate   NUMERIC(5,4) NOT NULL DEFAULT 0,
  commission_value  NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Participant (shared execution)
  participant_share    NUMERIC(5,4) NOT NULL DEFAULT 1.0,
  payout_type          VARCHAR(20) NOT NULL DEFAULT 'percentage',
  affects_commission   BOOLEAN NOT NULL DEFAULT TRUE,

  -- Reversal reference (self-referential FK)
  original_record_id   UUID REFERENCES public.commission_records(id) ON DELETE RESTRICT,

  -- Idempotency + audit trail
  idempotency_key   VARCHAR(255) NOT NULL,
  event_id          VARCHAR(255),
  event_type        VARCHAR(50),

  -- Status
  status            VARCHAR(20) NOT NULL DEFAULT 'active',

  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Partial Unique Index: 1 original commission per staff+comanda ──
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_records_staff_comanda
  ON public.commission_records(tenant_id, staff_id, comanda_id)
  WHERE record_type = 'commission';

-- ── Idempotency Index: prevents duplicate event processing ──
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_records_idempotency
  ON public.commission_records(tenant_id, idempotency_key);

-- ── Query Indexes ──
CREATE INDEX IF NOT EXISTS idx_commission_records_comanda
  ON public.commission_records(tenant_id, comanda_id);

CREATE INDEX IF NOT EXISTS idx_commission_records_staff
  ON public.commission_records(tenant_id, staff_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_commission_records_original_lookup
  ON public.commission_records(tenant_id, original_record_id)
  WHERE record_type = 'reversal';

CREATE INDEX IF NOT EXISTS idx_commission_records_created
  ON public.commission_records(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_commission_records_event
  ON public.commission_records(tenant_id, event_id)
  WHERE event_id IS NOT NULL;

-- ── RLS ──
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;

-- Superadmin bypass
DROP POLICY IF EXISTS commission_records_superadmin_all ON public.commission_records;
CREATE POLICY commission_records_superadmin_all
  ON public.commission_records
  FOR ALL
  USING (current_is_super_admin_from_auth_uid())
  WITH CHECK (current_is_super_admin_from_auth_uid());

-- Tenant isolation
DROP POLICY IF EXISTS commission_records_tenant_isolation ON public.commission_records;
CREATE POLICY commission_records_tenant_isolation
  ON public.commission_records
  FOR ALL
  USING (tenant_id = current_tenant_id_from_auth_uid())
  WITH CHECK (tenant_id = current_tenant_id_from_auth_uid());

-- ── RPC: create_commission_reversal ──
-- Thread-safe reversal with advisory lock + FOR UPDATE
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

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false,
    'reversal_id', v_reversal_id,
    'original_record_id', p_original_record_id,
    'commission_value', p_commission_value,
    'message', 'Reversao registrada com sucesso'
  );
END;
$$;

-- Revoke public access, grant authenticated only
REVOKE ALL ON FUNCTION public.create_commission_reversal(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_commission_reversal(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ── Comments ──
COMMENT ON TABLE public.commission_records IS
  'TD-001 B3.4-C: Per-comanda commission persistence. Append-only. Stores both original commissions and reversals.';
COMMENT ON COLUMN public.commission_records.record_type IS
  'commission = original commission record; reversal = reversal movement (negative value)';
COMMENT ON COLUMN public.commission_records.original_record_id IS
  'FK to the commission record being reversed. NULL for original commissions.';
COMMENT ON COLUMN public.commission_records.idempotency_key IS
  'Unique key per event+staff to prevent duplicate processing. Format: {eventId}_{staffId}';
COMMENT ON COLUMN public.commission_records.commission_value IS
  'Commission amount. Positive for commissions, negative for reversals.';

COMMIT;
