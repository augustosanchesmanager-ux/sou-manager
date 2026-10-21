-- ============================================================================
-- Migration: 20261021100000_f10_payment_terminals_and_rates.sql
-- Frente F-10: PDV Avançado — Cadastro de Maquininhas e Snapshot Contábil
-- ADR-036: Cadastro de Maquininhas de Cartão e Snapshot Contábil de Taxas
-- ============================================================================

BEGIN;

-- 1. Tabela payment_terminals (Maquininhas / Terminais de Pagamento)
CREATE TABLE IF NOT EXISTS public.payment_terminals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  acquirer    TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Tabela payment_terminal_rates (Taxas por Modalidade e Prazo)
CREATE TABLE IF NOT EXISTS public.payment_terminal_rates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  terminal_id       UUID NOT NULL REFERENCES public.payment_terminals(id) ON DELETE CASCADE,
  method            TEXT NOT NULL CHECK (method IN ('debit', 'credit_sight', 'credit_installment', 'pix')),
  installments_min  INTEGER NOT NULL DEFAULT 1 CHECK (installments_min >= 1),
  installments_max  INTEGER NOT NULL DEFAULT 1 CHECK (installments_max >= installments_min),
  rate_percentage   NUMERIC(6,3) NOT NULL DEFAULT 0.000 CHECK (rate_percentage >= 0),
  fixed_fee         NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (fixed_fee >= 0),
  settlement_days   INTEGER NOT NULL DEFAULT 1 CHECK (settlement_days >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Colunas de Snapshot Contábil Imutável em comanda_payments
ALTER TABLE public.comanda_payments
  ADD COLUMN IF NOT EXISTS terminal_id UUID REFERENCES public.payment_terminals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_percentage NUMERIC(6,3) NULL,
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(10,2) NULL,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(10,2) NULL,
  ADD COLUMN IF NOT EXISTS estimated_settlement_date DATE NULL;

-- 4. Índices de Otimização e Unicidade
CREATE INDEX IF NOT EXISTS idx_payment_terminals_tenant
  ON public.payment_terminals(tenant_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_terminals_default
  ON public.payment_terminals(tenant_id)
  WHERE is_default = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_payment_terminal_rates_terminal
  ON public.payment_terminal_rates(tenant_id, terminal_id);

CREATE INDEX IF NOT EXISTS idx_comanda_payments_terminal
  ON public.comanda_payments(tenant_id, terminal_id);

-- 5. Row-Level Security (RLS v2) em payment_terminals
ALTER TABLE public.payment_terminals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_terminals_select_tenant" ON public.payment_terminals;
CREATE POLICY "payment_terminals_select_tenant" ON public.payment_terminals
  FOR SELECT USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "payment_terminals_insert_tenant" ON public.payment_terminals;
CREATE POLICY "payment_terminals_insert_tenant" ON public.payment_terminals
  FOR INSERT WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "payment_terminals_update_tenant" ON public.payment_terminals;
CREATE POLICY "payment_terminals_update_tenant" ON public.payment_terminals
  FOR UPDATE USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  ) WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "payment_terminals_delete_tenant" ON public.payment_terminals;
CREATE POLICY "payment_terminals_delete_tenant" ON public.payment_terminals
  FOR DELETE USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

-- 6. Row-Level Security (RLS v2) em payment_terminal_rates
ALTER TABLE public.payment_terminal_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_terminal_rates_select_tenant" ON public.payment_terminal_rates;
CREATE POLICY "payment_terminal_rates_select_tenant" ON public.payment_terminal_rates
  FOR SELECT USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "payment_terminal_rates_insert_tenant" ON public.payment_terminal_rates;
CREATE POLICY "payment_terminal_rates_insert_tenant" ON public.payment_terminal_rates
  FOR INSERT WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "payment_terminal_rates_update_tenant" ON public.payment_terminal_rates;
CREATE POLICY "payment_terminal_rates_update_tenant" ON public.payment_terminal_rates
  FOR UPDATE USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  ) WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

DROP POLICY IF EXISTS "payment_terminal_rates_delete_tenant" ON public.payment_terminal_rates;
CREATE POLICY "payment_terminal_rates_delete_tenant" ON public.payment_terminal_rates
  FOR DELETE USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

-- 7. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_terminals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_terminal_rates TO authenticated;
GRANT ALL ON public.payment_terminals TO service_role;
GRANT ALL ON public.payment_terminal_rates TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
