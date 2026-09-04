-- =====================================================
-- P0.3-C: Cancelar Cobrança ≠ Dar Baixa
-- Migration 2: Criar tabela de auditoria de cancelamento
-- =====================================================

BEGIN;

-- Criar tabela de auditoria
CREATE TABLE IF NOT EXISTS public.receivable_cancel_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id UUID NOT NULL REFERENCES public.customer_subscription_receivables(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.customer_subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL DEFAULT 'cancelled',
  cancel_reason TEXT NOT NULL,
  cancel_observation TEXT,
  cancelled_by UUID NOT NULL,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cancel_audit_receivable ON public.receivable_cancel_audit(receivable_id);
CREATE INDEX IF NOT EXISTS idx_cancel_audit_subscription ON public.receivable_cancel_audit(subscription_id);
CREATE INDEX IF NOT EXISTS idx_cancel_audit_tenant ON public.receivable_cancel_audit(tenant_id, cancelled_at);

-- RLS
ALTER TABLE public.receivable_cancel_audit ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por tenant
CREATE POLICY receivable_cancel_audit_tenant_isolation
ON public.receivable_cancel_audit
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- Grants
REVOKE ALL ON TABLE public.receivable_cancel_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.receivable_cancel_audit TO authenticated;

-- Comentários
COMMENT ON TABLE public.receivable_cancel_audit IS 'Registro de auditoria de cancelamento de recebíveis do Club dos Chefes';
COMMENT ON COLUMN public.receivable_cancel_audit.receivable_id IS 'ID do recebível cancelado';
COMMENT ON COLUMN public.receivable_cancel_audit.subscription_id IS 'ID da assinatura relacionada';
COMMENT ON COLUMN public.receivable_cancel_audit.tenant_id IS 'ID do tenant (multi-tenancy)';
COMMENT ON COLUMN public.receivable_cancel_audit.amount IS 'Valor original do recebível';
COMMENT ON COLUMN public.receivable_cancel_audit.previous_status IS 'Status antes do cancelamento';
COMMENT ON COLUMN public.receivable_cancel_audit.new_status IS 'Novo status (sempre cancelled)';
COMMENT ON COLUMN public.receivable_cancel_audit.cancel_reason IS 'Motivo do cancelamento';
COMMENT ON COLUMN public.receivable_cancel_audit.cancel_observation IS 'Observação complementar';
COMMENT ON COLUMN public.receivable_cancel_audit.cancelled_by IS 'UUID do operador';
COMMENT ON COLUMN public.receivable_cancel_audit.cancelled_at IS 'Timestamp do cancelamento';

COMMIT;
