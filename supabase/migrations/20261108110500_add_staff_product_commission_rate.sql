-- ============================================================================
-- Migration: Add product_commission_rate to public.staff
-- Date: 2026-11-08
-- Description: Permite configurar comissão específica sobre produtos por profissional.
--              Por padrão, 0 (ninguém comissiona sobre produtos na barbearia por default).
-- ============================================================================

ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS product_commission_rate INTEGER DEFAULT 0;

COMMENT ON COLUMN public.staff.product_commission_rate IS
  'Alíquota percentual de comissão sobre produtos (0 a 100). Default 0 (sem comissão em produtos).';
