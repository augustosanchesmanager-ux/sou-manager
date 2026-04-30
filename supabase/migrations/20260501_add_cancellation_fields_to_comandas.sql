BEGIN;

ALTER TABLE public.comandas
ADD COLUMN IF NOT EXISTS cancellation_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hidden_from_financial BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_comandas_hidden_from_financial ON public.comandas(hidden_from_financial) WHERE hidden_from_financial = true;
CREATE INDEX IF NOT EXISTS idx_comandas_cancellation_type ON public.comandas(cancellation_type) WHERE cancellation_type IS NOT NULL;

COMMIT;