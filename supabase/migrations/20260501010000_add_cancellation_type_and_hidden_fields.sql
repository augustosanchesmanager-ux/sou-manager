BEGIN;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS cancellation_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hidden_from_schedule BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_hidden_from_schedule ON public.appointments(hidden_from_schedule) WHERE hidden_from_schedule = true;

CREATE INDEX IF NOT EXISTS idx_appointments_cancellation_type ON public.appointments(cancellation_type) WHERE cancellation_type IS NOT NULL;

COMMIT;