BEGIN;

-- Schema drift fix:
-- Finance RPCs expect these columns in public.comandas.
-- They exist in remote Supabase, but were missing from local migrations.
-- This migration aligns local migrations with the remote schema without affecting existing remote data.

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_date_real TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settled_by_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closure_mode TEXT,
  ADD COLUMN IF NOT EXISTS financial_effect BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS membership_credit_effect BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closure_note TEXT;

CREATE INDEX IF NOT EXISTS idx_comandas_tenant_payment_date_real
ON public.comandas(tenant_id, payment_date_real DESC)
WHERE payment_date_real IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comandas_tenant_settled_at
ON public.comandas(tenant_id, settled_at DESC)
WHERE settled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comandas_tenant_closed_at
ON public.comandas(tenant_id, closed_at DESC)
WHERE closed_at IS NOT NULL;

COMMENT ON COLUMN public.comandas.payment_method IS
  'Payment method used when comanda is financially settled. Added to align local migrations with remote schema.';

COMMENT ON COLUMN public.comandas.payment_date_real IS
  'Real payment date used for financial settlement. Added to align local migrations with remote schema.';

COMMENT ON COLUMN public.comandas.settled_at IS
  'Timestamp when comanda was financially settled. Added to align local migrations with remote schema.';

COMMENT ON COLUMN public.comandas.settled_by_user_id IS
  'User who settled the comanda financially. Added to align local migrations with remote schema.';

COMMENT ON COLUMN public.comandas.closed_at IS
  'Timestamp used to close comanda operationally/financially. Added to align local migrations with remote schema.';

COMMENT ON COLUMN public.comandas.closure_mode IS
  'Closure mode for financial/zero-close workflows. Added to align local migrations with remote schema.';

COMMENT ON COLUMN public.comandas.financial_effect IS
  'Whether the comanda closure has financial effect. Added to align local migrations with remote schema.';

COMMENT ON COLUMN public.comandas.membership_credit_effect IS
  'Whether the comanda closure consumed membership/club credits. Added to align local migrations with remote schema.';

COMMENT ON COLUMN public.comandas.closure_note IS
  'Audit note for closure/zero-close workflows. Added to align local migrations with remote schema.';

NOTIFY pgrst, 'reload schema';

COMMIT;
