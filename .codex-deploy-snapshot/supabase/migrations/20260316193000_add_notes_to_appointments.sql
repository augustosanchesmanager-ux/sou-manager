ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS notes TEXT;
