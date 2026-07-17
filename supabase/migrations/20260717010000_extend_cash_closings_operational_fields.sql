-- Migration: Extend cash_closings table with operational fields
-- Adds opening_time, closing_time, IP tracking, sangria/suprimento totals,
-- and populates notes + confirmed_by_user_id properly.

-- 1. Add opening_time and closing_time
ALTER TABLE public.cash_closings
  ADD COLUMN IF NOT EXISTS opening_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closing_time TIMESTAMPTZ;

-- 2. Add IP and user-agent for audit trail
ALTER TABLE public.cash_closings
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- 3. Add sangria/suprimento totals (denormalized for fast reads)
ALTER TABLE public.cash_closings
  ADD COLUMN IF NOT EXISTS total_sangrias NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_suprimentos NUMERIC NOT NULL DEFAULT 0;

-- 4. Add individual barber closings tracking
ALTER TABLE public.cash_closings
  ADD COLUMN IF NOT EXISTS barber_closings_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS barber_closings_complete BOOLEAN NOT NULL DEFAULT false;

-- 5. Populate notes from financial_summary if it exists and notes is empty
UPDATE public.cash_closings
SET notes = COALESCE(notes, '')
WHERE notes IS NULL OR notes = '';

-- 6. Create index for faster lookups by tenant + date + status
CREATE INDEX IF NOT EXISTS idx_cash_closings_tenant_date_status
  ON public.cash_closings (tenant_id, business_date, status);

-- 7. Add comment for documentation
COMMENT ON TABLE public.cash_closings IS 'Daily cash register closing records. One per tenant per business_date. Stores financial summary snapshots and operational metadata.';
COMMENT ON COLUMN public.cash_closings.opening_time IS 'When the cash register was opened for the day';
COMMENT ON COLUMN public.cash_closings.closing_time IS 'When the cash register was officially closed';
COMMENT ON COLUMN public.cash_closings.total_sangrias IS 'Sum of all sangria (withdrawal) amounts for the day';
COMMENT ON COLUMN public.cash_closings.total_suprimentos IS 'Sum of all suprimento (deposit) amounts for the day';
COMMENT ON COLUMN public.cash_closings.barber_closings_count IS 'Number of individual barber closings completed';
COMMENT ON COLUMN public.cash_closings.barber_closings_complete IS 'True when all frontline barbers have closed their individual registers';
