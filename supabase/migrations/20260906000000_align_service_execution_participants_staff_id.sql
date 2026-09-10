-- Migration: Align service_execution_participants with production schema (staff_id)
-- P1.3 Production Gate — Opção A (PO 2026-09-06): produção usa staff_id;
-- repo/staging usavam professional_id (drift por alteração fora do fluxo de
-- migrations). Adiciona a coluna staff_id defensiva: no-op em produção,
-- backfill apenas onde a coluna legada professional_id existe.

-- 1. staff_id espelhando produção
ALTER TABLE public.service_execution_participants
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE;

-- 2. Backfill guardado (apenas em ambientes com a coluna legada professional_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'service_execution_participants'
       AND column_name = 'professional_id'
  ) THEN
    UPDATE public.service_execution_participants
       SET staff_id = professional_id
     WHERE staff_id IS NULL AND professional_id IS NOT NULL;
  END IF;
END $$;

-- 3. Índice espelhando produção
CREATE INDEX IF NOT EXISTS idx_service_execution_participants_staff
  ON public.service_execution_participants(staff_id);