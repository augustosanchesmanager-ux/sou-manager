BEGIN;

ALTER TABLE public.comandas
ADD COLUMN IF NOT EXISTS closure_mode TEXT NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comandas_closure_mode_check'
  ) THEN
    ALTER TABLE public.comandas
    ADD CONSTRAINT comandas_closure_mode_check
    CHECK (closure_mode IN ('standard', 'legacy_membership'));
  END IF;
END;
$$;

ALTER TABLE public.comandas
ADD COLUMN IF NOT EXISTS closure_note TEXT;

ALTER TABLE public.comandas
ADD COLUMN IF NOT EXISTS financial_effect BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.comandas
ADD COLUMN IF NOT EXISTS membership_credit_effect BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.comandas
ADD COLUMN IF NOT EXISTS legacy_reference_month DATE;

ALTER TABLE public.comandas
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

UPDATE public.comandas
SET
  closure_mode = COALESCE(closure_mode, 'standard'),
  financial_effect = COALESCE(financial_effect, true),
  membership_credit_effect = COALESCE(membership_credit_effect, true)
WHERE closure_mode IS NULL
   OR financial_effect IS NULL
   OR membership_credit_effect IS NULL;

CREATE OR REPLACE FUNCTION public.bulk_close_comandas_admin(
  p_comanda_ids UUID[],
  p_tenant_id UUID DEFAULT NULL,
  p_closure_note TEXT DEFAULT NULL,
  p_legacy_reference_month DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids UUID[];
  v_updated_count INTEGER := 0;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::UUID[])
  INTO v_ids
  FROM unnest(COALESCE(p_comanda_ids, ARRAY[]::UUID[])) AS id;

  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos uma comanda para baixa administrativa';
  END IF;

  UPDATE public.comandas
  SET
    status = 'paid',
    closure_mode = 'legacy_membership',
    closure_note = NULLIF(BTRIM(p_closure_note), ''),
    financial_effect = false,
    membership_credit_effect = false,
    legacy_reference_month = p_legacy_reference_month,
    closed_at = now()
  WHERE id = ANY(v_ids)
    AND status = 'open'
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  UPDATE public.appointments
  SET status = 'completed'
  WHERE id IN (
    SELECT appointment_id
    FROM public.comandas
    WHERE id = ANY(v_ids)
      AND appointment_id IS NOT NULL
      AND status = 'paid'
      AND closure_mode = 'legacy_membership'
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  )
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    AND status <> 'completed';

  RETURN jsonb_build_object(
    'updated_count', v_updated_count,
    'closure_mode', 'legacy_membership',
    'financial_effect', false,
    'membership_credit_effect', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_close_comandas_admin(UUID[], UUID, TEXT, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
