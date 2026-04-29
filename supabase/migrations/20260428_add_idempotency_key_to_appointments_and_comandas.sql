BEGIN;

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE public.comandas ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_appointments_idempotency_key ON public.appointments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comandas_idempotency_key ON public.comandas(idempotency_key) WHERE idempotency_key IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
