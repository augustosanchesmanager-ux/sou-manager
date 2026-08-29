-- M1: attended_at + attended_at_source em public.appointments
-- G1 aprovado (A1, 29/08/2026) · ADR-020 · Arquitetura: ADITIVA
-- Ancoragem canônica de "quando o atendimento efetivamente ocorreu",
-- separada de paid_at / scheduled_at (ADR-017).

BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS attended_at_source TEXT NULL;

COMMENT ON COLUMN public.appointments.attended_at IS
  'Timestamp do atendimento efetivamente realizado. Preenchido somente por RPC operacional autorizada (ADR-020 D-1). Nunca pela finance_settle_comanda.';

COMMENT ON COLUMN public.appointments.attended_at_source IS
  'Classe de evidência do atendimento: NULL=fluxo real; backfill_evidence=prova real; inferred_from_payment=derivado marcado (somente com revisão humana e flag explícita).';

NOTIFY pgrst, 'reload schema';

COMMIT;