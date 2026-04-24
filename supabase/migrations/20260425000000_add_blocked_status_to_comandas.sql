-- Add 'blocked' status to comandas
ALTER TABLE public.comandas DROP CONSTRAINT IF EXISTS comandas_status_check;

ALTER TABLE public.comandas ADD CONSTRAINT comandas_status_check
  CHECK (status IN ('blocked', 'open', 'paid', 'cancelled'));