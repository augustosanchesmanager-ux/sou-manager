BEGIN;

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  payment_method TEXT,
  date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  status TEXT DEFAULT 'completed'::text,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  method VARCHAR,
  notes TEXT,
  due_day INTEGER,
  source_type TEXT,
  source_id UUID,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date
ON public.transactions(tenant_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_type
ON public.transactions(tenant_id, type);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_type_date
ON public.transactions(tenant_id, type, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant_source
ON public.transactions(tenant_id, source_type, source_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_tenant_idempotency_key
ON public.transactions(tenant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

COMMIT;