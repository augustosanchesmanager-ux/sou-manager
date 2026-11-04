-- Migration: 20261104003500_add_combo_fields_to_services.sql
-- Fase 7.1: Combos Inteligentes & Serviços Casados
-- Adiciona colunas para composição de combos, serviços inclusos e descontos de pacote.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_combo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS combo_service_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS combo_discount_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS combo_discount_type TEXT DEFAULT 'fixed';

COMMENT ON COLUMN public.services.is_combo IS 'Indica se o serviço é um combo/pacote composto por múltiplos procedimentos';
COMMENT ON COLUMN public.services.combo_service_ids IS 'Lista de IDs dos serviços que compõem este combo';
COMMENT ON COLUMN public.services.combo_discount_amount IS 'Valor ou percentual de desconto promocional aplicado sobre o combo';
COMMENT ON COLUMN public.services.combo_discount_type IS 'Tipo do desconto: fixed (valor em R$) ou percentage (percentual %)';
