BEGIN;

-- Fase 5B - Estrutura auditavel para estornos, reversoes e devolucoes.
-- Revisavel: nao aplicar sem aprovacao operacional.

CREATE TABLE IF NOT EXISTS public.financial_reversals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  original_transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  reversal_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  source_type TEXT,
  source_id UUID,
  reversal_type TEXT NOT NULL CHECK (
    reversal_type IN (
      'wrong_settlement',
      'full_refund',
      'partial_refund',
      'duplicate_charge',
      'administrative_cancellation',
      'financial_review'
    )
  ),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason_type TEXT NOT NULL,
  reason_note TEXT NOT NULL,
  refund_method TEXT,
  idempotency_key TEXT,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_reversals_tenant_idempotency
ON public.financial_reversals(tenant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_reversals_original
ON public.financial_reversals(tenant_id, original_transaction_id);

CREATE INDEX IF NOT EXISTS idx_financial_reversals_reversal
ON public.financial_reversals(tenant_id, reversal_transaction_id)
WHERE reversal_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_reversals_source
ON public.financial_reversals(tenant_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_financial_reversals_created_at
ON public.financial_reversals(tenant_id, created_at DESC);

ALTER TABLE public.financial_reversals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_reversals_select_by_tenant_or_superadmin"
ON public.financial_reversals;

CREATE POLICY "financial_reversals_select_by_tenant_or_superadmin"
ON public.financial_reversals
FOR SELECT
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

COMMENT ON TABLE public.financial_reversals IS
  'Auditoria de estornos, reversoes e devolucoes financeiras. A aplicacao real depende de RPC transacional.';

COMMIT;
