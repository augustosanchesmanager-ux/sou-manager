-- =====================================================
-- P0.3-C: Cancelar Cobrança ≠ Dar Baixa
-- Migration 1: Adicionar colunas de cancelamento em customer_subscription_receivables
-- =====================================================

BEGIN;

-- Adicionar colunas de cancelamento
ALTER TABLE public.customer_subscription_receivables
ADD COLUMN IF NOT EXISTS previous_status TEXT,
ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
ADD COLUMN IF NOT EXISTS cancel_observation TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by UUID,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Comentários nas colunas
COMMENT ON COLUMN public.customer_subscription_receivables.previous_status IS 'Status anterior ao cancelamento';
COMMENT ON COLUMN public.customer_subscription_receivables.cancel_reason IS 'Motivo do cancelamento (obrigatório)';
COMMENT ON COLUMN public.customer_subscription_receivables.cancel_observation IS 'Observação complementar do cancelamento';
COMMENT ON COLUMN public.customer_subscription_receivables.cancelled_by IS 'UUID do operador que realizou o cancelamento';
COMMENT ON COLUMN public.customer_subscription_receivables.cancelled_at IS 'Timestamp do cancelamento efetivo';

COMMIT;
