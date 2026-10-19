-- Migration: 20261019144500_fix_recurring_accounts_payable_idempotency.sql
-- Description: Restaura DEFAULT gen_random_uuid() em accounts_payable.idempotency_key
--              e atualiza create_accounts_payable_from_recurring para incluir idempotency_key
--              e garantir idempotencia estrita com search_path seguro e revogacao publica.

BEGIN;

-- 1. Restaura DEFAULT gen_random_uuid() para evitar violacao de NOT NULL em insercoes sem chave explicita
ALTER TABLE public.accounts_payable
  ALTER COLUMN idempotency_key SET DEFAULT gen_random_uuid();

-- 2. Atualiza a RPC create_accounts_payable_from_recurring
CREATE OR REPLACE FUNCTION public.create_accounts_payable_from_recurring(
  p_recurring_bill_id UUID,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
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

  -- Calcular vencimento (dia 28 como limite seguro de meses menores)
  v_due_date := make_date(p_year, p_month, LEAST(v_bill.due_day, 28));

  -- Insert com idempotency_key gerada (I1)
  INSERT INTO public.accounts_payable (
    tenant_id, recurring_bill_id, name, amount, due_date,
    competence_month, competence_year, category, created_by, idempotency_key
  ) VALUES (
    v_tenant_id, p_recurring_bill_id, v_bill.name, v_bill.amount, v_due_date,
    p_month, p_year, v_bill.category, auth.uid(), gen_random_uuid()
  );

  RETURN jsonb_build_object('success', true, 'created', true);
EXCEPTION
  WHEN unique_violation THEN
    -- Invariante I1: Ja existe ocorrencia para esta recorrencia + mes + ano
    RETURN jsonb_build_object(
      'success', true,
      'created', false,
      'message', 'Ocorrência já existe para esta competência'
    );
END;
$$;

-- 3. Blindagem de permissoes
REVOKE EXECUTE ON FUNCTION public.create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER) TO authenticated;

COMMIT;
