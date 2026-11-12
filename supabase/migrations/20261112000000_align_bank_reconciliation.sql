-- 20261112000000_align_bank_reconciliation.sql
-- Alinha schema e RPCs de conciliação bancária (ADR-037) ao contrato do frontend,
-- mantendo isolamento multi-tenant (SECURITY DEFINER + search_path + tenant check).

BEGIN;

-- 1. Evoluir tabela bank_statements
ALTER TABLE public.bank_statements
    ADD COLUMN IF NOT EXISTS file_format TEXT,
    ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS closing_balance NUMERIC(12, 2);

ALTER TABLE public.bank_statements
    ALTER COLUMN period_start DROP NOT NULL,
    ALTER COLUMN period_end DROP NOT NULL;

-- 2. Adequar colunas de bank_statement_transactions ao frontend
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bank_statement_transactions'
          AND column_name = 'matched_transaction_id'
    ) THEN
        ALTER TABLE public.bank_statement_transactions
            RENAME COLUMN matched_transaction_id TO reconciled_transaction_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bank_statement_transactions'
          AND column_name = 'memo'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bank_statement_transactions'
          AND column_name = 'description'
    ) THEN
        ALTER TABLE public.bank_statement_transactions
            RENAME COLUMN memo TO description;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bank_statement_transactions'
          AND column_name = 'posted_at'
    ) THEN
        ALTER TABLE public.bank_statement_transactions
            RENAME COLUMN posted_at TO transaction_date;
    END IF;
END;
$$;

ALTER TABLE public.bank_statement_transactions
    ADD COLUMN IF NOT EXISTS transaction_type TEXT,
    ADD COLUMN IF NOT EXISTS memo TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Substituir RPC: import_bank_statement_transactions
DROP FUNCTION IF EXISTS public.import_bank_statement_transactions(UUID, UUID, UUID, JSONB);

CREATE OR REPLACE FUNCTION public.import_bank_statement_transactions(
    p_tenant_id UUID,
    p_bank_account_id UUID,
    p_filename TEXT,
    p_file_format TEXT,
    p_transactions JSONB,
    p_opening_balance NUMERIC DEFAULT NULL,
    p_closing_balance NUMERIC DEFAULT NULL,
    p_period_start DATE DEFAULT NULL,
    p_period_end DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_statement_id UUID;
    v_inserted_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
    v_tx JSONB;
    v_fitid TEXT;
    v_tx_date DATE;
    v_amount NUMERIC;
    v_description TEXT;
    v_memo TEXT;
    v_tx_type TEXT;
    v_exists BOOLEAN;
BEGIN
    IF p_tenant_id IS NULL OR NOT (
        p_tenant_id = public.current_tenant_id_from_auth_uid()
        OR public.current_is_super_admin_from_auth_uid()
    ) THEN
        RAISE EXCEPTION 'Acesso não autorizado para o tenant especificado.' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.bank_statements (
        tenant_id,
        bank_account_id,
        filename,
        file_format,
        opening_balance,
        closing_balance,
        period_start,
        period_end,
        imported_by
    ) VALUES (
        p_tenant_id,
        p_bank_account_id,
        p_filename,
        p_file_format,
        p_opening_balance,
        p_closing_balance,
        p_period_start,
        p_period_end,
        auth.uid()
    )
    RETURNING id INTO v_statement_id;

    FOR v_tx IN SELECT * FROM jsonb_array_elements(COALESCE(p_transactions, '[]'::JSONB))
    LOOP
        v_fitid := COALESCE(NULLIF(BTRIM(v_tx->>'fitid'), ''), NULLIF(BTRIM(v_tx->>'fit_id'), ''));
        v_tx_date := COALESCE(
            NULLIF(BTRIM(v_tx->>'transaction_date'), '')::DATE,
            NULLIF(BTRIM(v_tx->>'posted_at'), '')::DATE
        );
        v_amount := (v_tx->>'amount')::NUMERIC;
        v_description := COALESCE(NULLIF(v_tx->>'description', ''), v_tx->>'memo', '');
        v_memo := v_tx->>'memo';
        v_tx_type := COALESCE(NULLIF(v_tx->>'transaction_type', ''), CASE WHEN v_amount >= 0 THEN 'credit' ELSE 'debit' END);

        IF v_fitid IS NULL OR v_tx_date IS NULL OR v_amount IS NULL THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        SELECT EXISTS (
            SELECT 1
            FROM public.bank_statement_transactions
            WHERE tenant_id = p_tenant_id
              AND bank_account_id = p_bank_account_id
              AND (
                  fitid = v_fitid
                  OR (
                      amount = v_amount
                      AND transaction_date = v_tx_date
                      AND description = v_description
                  )
              )
        ) INTO v_exists;

        IF v_exists THEN
            v_skipped_count := v_skipped_count + 1;
        ELSE
            INSERT INTO public.bank_statement_transactions (
                tenant_id,
                statement_id,
                bank_account_id,
                fitid,
                transaction_date,
                amount,
                description,
                memo,
                transaction_type,
                status
            ) VALUES (
                p_tenant_id,
                v_statement_id,
                p_bank_account_id,
                v_fitid,
                v_tx_date,
                v_amount,
                v_description,
                v_memo,
                v_tx_type,
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

    UPDATE public.bank_statements
    SET transactions_count = v_inserted_count
    WHERE id = v_statement_id
      AND tenant_id = p_tenant_id;

    RETURN jsonb_build_object(
        'statement_id', v_statement_id,
        'inserted_count', v_inserted_count,
        'duplicates_skipped', v_skipped_count
    );
END;
$$;

REVOKE ALL ON FUNCTION public.import_bank_statement_transactions(UUID, UUID, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_bank_statement_transactions(UUID, UUID, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, DATE, DATE) TO authenticated;

-- 4. Substituir RPC: reconcile_bank_transaction
DROP FUNCTION IF EXISTS public.reconcile_bank_transaction(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.reconcile_bank_transaction(
    p_tenant_id UUID,
    p_statement_tx_id UUID,
    p_system_tx_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
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
    SET status = 'reconciled',
        reconciled_transaction_id = p_system_tx_id,
        notes = COALESCE(p_notes, notes),
        reconciled_by = auth.uid(),
        reconciled_at = now()
    WHERE id = p_statement_tx_id
      AND tenant_id = p_tenant_id
      AND status = 'pending';

    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_bank_transaction(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_bank_transaction(UUID, UUID, UUID, TEXT) TO authenticated;

-- 5. Substituir RPC: unreconcile_bank_transaction
DROP FUNCTION IF EXISTS public.unreconcile_bank_transaction(UUID, UUID);

CREATE OR REPLACE FUNCTION public.unreconcile_bank_transaction(
    p_tenant_id UUID,
    p_statement_tx_id UUID
)
RETURNS BOOLEAN
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
    SET status = 'pending',
        reconciled_transaction_id = NULL,
        reconciled_by = NULL,
        reconciled_at = NULL,
        notes = NULL
    WHERE id = p_statement_tx_id
      AND tenant_id = p_tenant_id
      AND status = 'reconciled';

    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.unreconcile_bank_transaction(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unreconcile_bank_transaction(UUID, UUID) TO authenticated;

COMMIT;
