-- Migration: update_pay_account_payable_method
-- Frente 4.1: Registra payment_method e data de pagamento na baixa de despesas

BEGIN;

-- 1. Remove a assinatura antiga de 1 argumento para evitar ambiguidade no Postgres
DROP FUNCTION IF EXISTS public.pay_account_payable(UUID);

-- 2. Recria a RPC com p_payment_method e p_paid_at
CREATE OR REPLACE FUNCTION public.pay_account_payable(
  p_ap_id UUID,
  p_payment_method TEXT DEFAULT 'Não informado',
  p_paid_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ap RECORD;
  v_transaction RECORD;
  v_tenant_id UUID;
  v_effective_paid_at TIMESTAMPTZ;
  v_effective_payment_method TEXT;
BEGIN
  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não identificado';
  END IF;

  v_effective_paid_at := COALESCE(p_paid_at, now());
  v_effective_payment_method := COALESCE(NULLIF(btrim(p_payment_method), ''), 'Não informado');

  SELECT * INTO v_ap
  FROM public.accounts_payable
  WHERE id = p_ap_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  -- I5: Cancelled é terminal
  IF v_ap.status = 'cancelled' THEN
    RAISE EXCEPTION 'Conta cancelada não pode ser paga';
  END IF;

  -- I4: Paid é terminal — idempotência (duplo clique)
  IF v_ap.status = 'paid' THEN
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

  -- Criar transaction vinculada com payment_method e date
  INSERT INTO public.transactions (
    tenant_id, type, amount, description, category, date, status, payment_method, account_payable_id
  ) VALUES (
    v_tenant_id, 'expense', v_ap.amount, '[AP] ' || v_ap.name, v_ap.category,
    v_effective_paid_at, 'paid', v_effective_payment_method, v_ap.id
  ) RETURNING * INTO v_transaction;

  -- Vincular e atualizar accounts_payable
  UPDATE public.accounts_payable
  SET status = 'paid',
      paid_at = v_effective_paid_at,
      paid_by = auth.uid(),
      transaction_id = v_transaction.id,
      updated_at = now()
  WHERE id = p_ap_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction.id,
    'amount', v_ap.amount
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pay_account_payable(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_account_payable(UUID, TEXT, TIMESTAMPTZ) TO authenticated;

COMMIT;
