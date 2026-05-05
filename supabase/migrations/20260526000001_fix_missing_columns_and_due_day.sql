BEGIN;

-- Add missing columns to transactions table
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Add missing columns to service_execution_participants table
ALTER TABLE public.service_execution_participants ADD COLUMN IF NOT EXISTS affects_revenue BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.service_execution_participants ADD COLUMN IF NOT EXISTS affects_commission BOOLEAN NOT NULL DEFAULT true;

-- Add due_day column for recurring bills feature
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS due_day INTEGER DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
COMMIT;