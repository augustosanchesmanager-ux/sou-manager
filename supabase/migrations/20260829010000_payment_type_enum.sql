-- M2: ENUM public.payment_type
-- G1 aprovado (A1, 29/08/2026) · ADR-018 D-1 · Arquitetura: ADITIVA
-- Tipo imutável e persistente para classificar pagamento (antecipado/na data/posterior/parcial/final).
-- Nunca derivado por datas (Pagamento ≠ Atendimento ≠ Comissão).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type') THEN
    CREATE TYPE public.payment_type AS ENUM
      ('anticipado', 'no_atendimento', 'posterior', 'parcial', 'final');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;