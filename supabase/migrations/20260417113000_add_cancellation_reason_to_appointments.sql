ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

COMMENT ON COLUMN public.appointments.cancellation_reason IS
  'Motivo do cancelamento do agendamento. Usado para diferenciar erro de cadastro de cancelamentos operacionais.';
