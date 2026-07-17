BEGIN;

-- Fase 4B - Estrutura minima para baixa financeira centralizada de comandas.
-- Revisavel: nao aplicar sem aprovacao operacional.
-- Parte 1/2: campos e indices necessarios antes da RPC.

ALTER TABLE public.comandas
ADD COLUMN IF NOT EXISTS payment_date_real TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS settled_by_user_id UUID;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS source_type TEXT,
ADD COLUMN IF NOT EXISTS source_id UUID,
ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_comandas_tenant_settled_at
ON public.comandas(tenant_id, settled_at DESC)
WHERE settled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comandas_tenant_payment_date_real
ON public.comandas(tenant_id, payment_date_real DESC)
WHERE payment_date_real IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_source
ON public.transactions(tenant_id, source_type, source_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_tenant_idempotency_key
ON public.transactions(tenant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

COMMIT;
