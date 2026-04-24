-- Add cancellation audit fields to appointments
-- These fields help track WHO cancelled and WHEN for accountability

-- Add columns safely (ignore if already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN cancelled_at TIMESTAMPTZ;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'cancelled_by_user_id'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN cancelled_by_user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.appointments.cancelled_at IS 'Timestamp when the appointment was cancelled';
COMMENT ON COLUMN public.appointments.cancelled_by_user_id IS 'User who cancelled the appointment (for audit)';

-- Update existing cancelled appointments to set cancelled_at
UPDATE public.appointments 
SET cancelled_at = start_time 
WHERE status = 'cancelled' AND cancelled_at IS NULL;

-- Create indexes (ignore if already exists)
CREATE INDEX IF NOT EXISTS idx_appointments_cancellation_reason 
ON public.appointments(cancellation_reason) 
WHERE cancellation_reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_cancelled_at 
ON public.appointments(cancelled_at) 
WHERE cancelled_at IS NOT NULL;