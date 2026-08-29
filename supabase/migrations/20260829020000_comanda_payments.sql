-- M3: public.comanda_payments
-- G1 aprovado (A1, 29/08/2026) · ADR-018 D-2 · Arquitetura: ADITIVA (tabela nova)
-- Modelo explícito e auditável de pagamentos por comanda.
-- Padrões: RLS v2 (superadmin bypass + tenant isolation), idempotência UNIQUE
-- parcial (mesmo padrão de public.transactions), append-only (sem DELETE policy).

BEGIN;

CREATE TABLE IF NOT EXISTS public.comanda_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id),
  comanda_id      UUID NOT NULL REFERENCES public.comandas(id),
  payment_type    public.payment_type NOT NULL,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method  TEXT,
  actor_id        UUID REFERENCES auth.users(id),
  motivo          TEXT,
  reversed_at     TIMESTAMPTZ NULL,
  idempotency_key TEXT,
  created_at      TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_comanda_payments_comanda
  ON public.comanda_payments(comanda_id, created_at);

CREATE INDEX IF NOT EXISTS idx_comanda_payments_tenant
  ON public.comanda_payments(tenant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comanda_payments_tenant_idem
  ON public.comanda_payments(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.comanda_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comanda_payments_select_v2" ON public.comanda_payments;
CREATE POLICY "comanda_payments_select_v2" ON public.comanda_payments
  FOR SELECT USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "comanda_payments_insert_v2" ON public.comanda_payments;
CREATE POLICY "comanda_payments_insert_v2" ON public.comanda_payments
  FOR INSERT WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

-- Sem UPDATE/DELETE policies: reversão é marcada via RPC (reversed_at em G2),
-- preservando o histórico (append-only) para auditoria (ADR-018).

NOTIFY pgrst, 'reload schema';

COMMIT;