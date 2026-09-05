-- ============================================================================
-- P0.4 — Contas a Pagar
-- Tables: recurring_bills, accounts_payable
-- Alterations: transactions (add account_payable_id FK)
-- RPCs: pay_account_payable, cancel_account_payable, create_accounts_payable_from_recurring
-- RLS: tenant isolation on all new tables
-- ============================================================================

-- 1. recurring_bills — Regra Recorrente
CREATE TABLE public.recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  category TEXT NOT NULL DEFAULT 'outros',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_bills_tenant ON public.recurring_bills(tenant_id);
CREATE INDEX idx_recurring_bills_tenant_active ON public.recurring_bills(tenant_id, is_active) WHERE is_active = true;

ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_recurring_bills"
ON public.recurring_bills
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

-- 2. accounts_payable — Obrigação Mensal
CREATE TABLE public.accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  recurring_bill_id UUID REFERENCES public.recurring_bills(id),
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  competence_month INTEGER NOT NULL CHECK (competence_month BETWEEN 1 AND 12),
  competence_year INTEGER NOT NULL CHECK (competence_year BETWEEN 2020 AND 2099),
  category TEXT NOT NULL DEFAULT 'outros',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  paid_by UUID REFERENCES auth.users(id),
  transaction_id UUID REFERENCES public.transactions(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- I1: Invariante de banco — uma ocorrência por competência por recorrência
  UNIQUE (recurring_bill_id, competence_month, competence_year)
);

CREATE INDEX idx_accounts_payable_tenant ON public.accounts_payable(tenant_id);
CREATE INDEX idx_accounts_payable_tenant_status ON public.accounts_payable(tenant_id, status);
CREATE INDEX idx_accounts_payable_tenant_due_date ON public.accounts_payable(tenant_id, due_date);
CREATE INDEX idx_accounts_payable_tenant_competence ON public.accounts_payable(tenant_id, competence_year, competence_month);
CREATE INDEX idx_accounts_payable_recurring ON public.accounts_payable(recurring_bill_id) WHERE recurring_bill_id IS NOT NULL;

ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_accounts_payable"
ON public.accounts_payable
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

-- 3. Alteração em transactions — FK para accounts_payable
ALTER TABLE public.transactions
  ADD COLUMN account_payable_id UUID REFERENCES public.accounts_payable(id);

CREATE INDEX idx_transactions_account_payable
  ON public.transactions(account_payable_id)
  WHERE account_payable_id IS NOT NULL;

-- I2: Constraint de idempotência — uma transaction por account_payable
CREATE UNIQUE INDEX idx_transactions_account_payable_unique
  ON public.transactions(account_payable_id)
  WHERE account_payable_id IS NOT NULL;

-- 4. RPC: pay_account_payable — I2 (idempotente), I3 (atômica)
CREATE OR REPLACE FUNCTION public.pay_account_payable(ap_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ap RECORD;
  v_transaction RECORD;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não identificado';
  END IF;

  -- Buscar AP com lock (previne concorrência)
  SELECT * INTO v_ap
  FROM public.accounts_payable
  WHERE id = ap_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  -- I5: Cancelled é terminal — não pode pagar
  IF v_ap.status = 'cancelled' THEN
    RAISE EXCEPTION 'Conta cancelada não pode ser paga';
  END IF;

  -- I4: Paid é terminal — idempotência (duplo clique)
  IF v_ap.status = 'paid' THEN
    -- Já paga — retornar transaction existente (idempotente)
    RETURN jsonb_build_object(
      'success', true,
      'transaction_id', v_ap.transaction_id,
      'amount', v_ap.amount,
      'message', 'Conta já estava paga'
    );
  END IF;

  IF v_ap.status != 'pending' THEN
    RAISE EXCEPTION 'Conta não está pendente (status: %)', v_ap.status;
  END IF;

  -- Criar transaction (unique index garante idempotência no banco)
  INSERT INTO public.transactions (
    tenant_id, type, amount, description, category, date, status, account_payable_id
  ) VALUES (
    v_tenant_id, 'expense', v_ap.amount, '[AP] ' || v_ap.name, v_ap.category,
    now(), 'paid', v_ap.id
  ) RETURNING * INTO v_transaction;

  -- Vincular
  UPDATE public.accounts_payable
  SET status = 'paid',
      paid_at = now(),
      paid_by = auth.uid(),
      transaction_id = v_transaction.id,
      updated_at = now()
  WHERE id = ap_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction.id,
    'amount', v_ap.amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_account_payable(UUID) TO authenticated;

-- 5. RPC: cancel_account_payable
CREATE OR REPLACE FUNCTION public.cancel_account_payable(ap_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ap RECORD;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não identificado';
  END IF;

  SELECT * INTO v_ap
  FROM public.accounts_payable
  WHERE id = ap_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  -- I4: Paid é terminal — não pode cancelar
  IF v_ap.status = 'paid' THEN
    RAISE EXCEPTION 'Conta paga não pode ser cancelada — use estorno';
  END IF;

  -- I5: Cancelled é terminal — idempotência
  IF v_ap.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Conta já estava cancelada');
  END IF;

  IF v_ap.status != 'pending' THEN
    RAISE EXCEPTION 'Só é possível cancelar contas pendentes';
  END IF;

  UPDATE public.accounts_payable
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      updated_at = now()
  WHERE id = ap_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_account_payable(UUID) TO authenticated;

-- 6. RPC: create_accounts_payable_from_recurring — I1 (idempotente via UNIQUE)
CREATE OR REPLACE FUNCTION public.create_accounts_payable_from_recurring(
  p_recurring_bill_id UUID,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill RECORD;
  v_tenant_id UUID;
  v_due_date DATE;
BEGIN
  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não identificado';
  END IF;

  SELECT * INTO v_bill
  FROM public.recurring_bills
  WHERE id = p_recurring_bill_id AND tenant_id = v_tenant_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recorrência não encontrada ou inativa';
  END IF;

  -- Calcular vencimento (dia 28 como limite seguro)
  v_due_date := make_date(p_year, p_month, LEAST(v_bill.due_day, 28));

  -- Insert direto — UNIQUE constraint (I1) garante idempotência
  -- Em caso de duplicata, vai抛出 erro natural do banco
  INSERT INTO public.accounts_payable (
    tenant_id, recurring_bill_id, name, amount, due_date,
    competence_month, competence_year, category, created_by
  ) VALUES (
    v_tenant_id, p_recurring_bill_id, v_bill.name, v_bill.amount, v_due_date,
    p_month, p_year, v_bill.category, auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'created', true);
EXCEPTION
  WHEN unique_violation THEN
    -- I1: Já existe — retornar existente (idempotente)
    RETURN jsonb_build_object('success', true, 'created', false, 'message', 'Ocorrência já existe para esta competência');
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER) TO authenticated;
