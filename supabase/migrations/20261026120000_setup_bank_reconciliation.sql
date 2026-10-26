-- 20261026120000_setup_bank_reconciliation.sql
-- SMG Barber: Frente 4 — Conciliação Bancária Inteligente (ADR-037)
-- Tabelas com RLS v2 e RPCs de conciliação idempotente

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABELA: bank_accounts (Contas Bancárias do Tenant)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bank_code TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    agency TEXT NULL,
    account_number TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings', 'payment')),
    initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    color TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant
    ON public.bank_accounts (tenant_id, is_active);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_tenant_all"
    ON public.bank_accounts FOR ALL
    USING (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid())
    WITH CHECK (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA: bank_statements (Histórico de Extratos Importados)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    transactions_count INTEGER NOT NULL DEFAULT 0,
    imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_statements_tenant_account
    ON public.bank_statements (tenant_id, bank_account_id, created_at);

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_statements_tenant_all"
    ON public.bank_statements FOR ALL
    USING (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid())
    WITH CHECK (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABELA: bank_statement_transactions (Transações Individuais do Extrato)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_statement_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    statement_id UUID REFERENCES public.bank_statements(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    fitid TEXT NOT NULL,
    posted_at DATE NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    memo TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled', 'ignored')),
    matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    reconciled_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_bank_statement_tx_fitid UNIQUE (tenant_id, bank_account_id, fitid)
);

CREATE INDEX IF NOT EXISTS idx_bank_statement_tx_tenant_status
    ON public.bank_statement_transactions (tenant_id, bank_account_id, status, posted_at);

ALTER TABLE public.bank_statement_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_statement_tx_tenant_all"
    ON public.bank_statement_transactions FOR ALL
    USING (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid())
    WITH CHECK (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: import_bank_statement_transactions (Inserção Atômica Idempotente)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.import_bank_statement_transactions(
    p_tenant_id UUID,
    p_bank_account_id UUID,
    p_statement_id UUID,
    p_transactions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_item JSONB;
    v_fitid TEXT;
    v_posted_at DATE;
    v_amount NUMERIC;
    v_memo TEXT;
    v_inserted_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
BEGIN
    -- Validação de isolamento do tenant
    IF p_tenant_id IS NULL OR NOT (
        p_tenant_id = public.current_tenant_id_from_auth_uid() 
        OR public.current_is_super_admin_from_auth_uid()
    ) THEN
        RAISE EXCEPTION 'Acesso não autorizado para o tenant especificado.' USING ERRCODE = '42501';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_transactions)
    LOOP
        v_fitid := v_item->>'fitid';
        v_posted_at := (v_item->>'posted_at')::DATE;
        v_amount := (v_item->>'amount')::NUMERIC;
        v_memo := COALESCE(v_item->>'memo', '');

        IF v_fitid IS NOT NULL AND v_posted_at IS NOT NULL AND v_amount IS NOT NULL THEN
            INSERT INTO public.bank_statement_transactions (
                tenant_id,
                statement_id,
                bank_account_id,
                fitid,
                posted_at,
                amount,
                memo,
                status
            ) VALUES (
                p_tenant_id,
                p_statement_id,
                p_bank_account_id,
                v_fitid,
                v_posted_at,
                v_amount,
                v_memo,
                'pending'
            )
            ON CONFLICT (tenant_id, bank_account_id, fitid) DO NOTHING;

            IF FOUND THEN
                v_inserted_count := v_inserted_count + 1;
            ELSE
                v_skipped_count := v_skipped_count + 1;
            END IF;
        END IF;
    END LOOP;

    -- Atualiza total no statement
    IF p_statement_id IS NOT NULL THEN
        UPDATE public.bank_statements
        SET transactions_count = transactions_count + v_inserted_count
        WHERE id = p_statement_id AND tenant_id = p_tenant_id;
    END IF;

    RETURN jsonb_build_object(
        'inserted', v_inserted_count,
        'skipped_duplicates', v_skipped_count
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: reconcile_bank_transaction (Vinculação Atômica)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reconcile_bank_transaction(
    p_tenant_id UUID,
    p_bank_statement_tx_id UUID,
    p_transaction_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_tenant_id IS NULL OR NOT (
        p_tenant_id = public.current_tenant_id_from_auth_uid() 
        OR public.current_is_super_admin_from_auth_uid()
    ) THEN
        RAISE EXCEPTION 'Acesso não autorizado para o tenant especificado.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.bank_statement_transactions
    SET matched_transaction_id = p_transaction_id,
        status = 'reconciled',
        reconciled_at = now()
    WHERE id = p_bank_statement_tx_id
      AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transação do extrato não encontrada para o tenant.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: unreconcile_bank_transaction (Desfazimento de Vínculo)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unreconcile_bank_transaction(
    p_tenant_id UUID,
    p_bank_statement_tx_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_tenant_id IS NULL OR NOT (
        p_tenant_id = public.current_tenant_id_from_auth_uid() 
        OR public.current_is_super_admin_from_auth_uid()
    ) THEN
        RAISE EXCEPTION 'Acesso não autorizado para o tenant especificado.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.bank_statement_transactions
    SET matched_transaction_id = NULL,
        status = 'pending',
        reconciled_at = NULL
    WHERE id = p_bank_statement_tx_id
      AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transação do extrato não encontrada para o tenant.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;
