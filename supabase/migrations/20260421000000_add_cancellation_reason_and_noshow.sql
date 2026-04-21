-- Add cancellation_reason column and no_show status to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT '';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT NULL;

-- Update the status constraint to include no_show and in_progress
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'));