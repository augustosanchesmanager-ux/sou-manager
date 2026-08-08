-- =====================================================
-- FIX — create_invoice / record_payment_attempt: AMBIGUIDADE DE COLUNA
-- Data: 2026-08-08
-- Motivo:
--   A migration 20260806070000 corrigiu 7 RPCs mas declarou
--   "create_invoice/record_payment_attempt já estão limpas" — afirmação INCORRETA.
--   Validação empírica em PostgreSQL real (PG16, docker, suite S1–S16) reproduziu:
--     • create_invoice:       ERROR: column reference "tenant_id" is ambiguous
--                             (ON CONFLICT (tenant_id, idempotency_key) — tenant_id
--                             é OUT param de RETURNS TABLE)
--     • record_payment_attempt: ERROR: column reference "id" is ambiguous
--                             (RETURNING id — id é OUT param de RETURNS TABLE)
--   Ambas quebravam em RUNTIME, em qualquer caminho de sucesso (P0 do runCycle/
--   faturamento). Não há alteração de regra de negócio, contrato ou escopo.
-- Escopo: 2 funções (última definição em 20260806050000). Solução:
--   • create_invoice:         ON CONFLICT DO NOTHING (o conflito target não aceita
--                             qualificação por alias; a única unique constraint de
--                             negócio em invoices é a idempotência — PK é gen_random_uuid).
--   • record_payment_attempt: alias "a" no INSERT + RETURNING a.id (desambiguação).
-- Idempotente: CREATE OR REPLACE (aplica 2x sem erro); GRANTs reafirmadas (ADR-012).
-- =====================================================

-- =====================================================
-- 1) create_invoice — ON CONFLICT DO NOTHING (idempotência por chave preservada)
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_invoice(
  p_subscription_id uuid,
  p_tenant_id uuid,
  p_amount numeric,
  p_due_date timestamptz,
  p_billing_period_start timestamptz,
  p_billing_period_end timestamptz,
  p_idempotency_key text
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  subscription_id uuid,
  status text,
  amount numeric,
  due_date timestamptz,
  billing_period_start timestamptz,
  billing_period_end timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_invoice_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = auth.uid()
        AND s.tenant_id = p_tenant_id
        AND s.status = 'active'
        AND s.role IN ('owner', 'manager', 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to create invoice';
  END IF;

  -- Idempotência: mesma chave (tenant_id, idempotency_key) → devolve a existente.
  -- ON CONFLICT DO NOTHING: o target (tenant_id, idempotency_key) colide com os
  -- OUT params de RETURNS TABLE (ambiguidade em runtime); a única unique de negócio
  -- é a idempotência, então DO NOTHING sem target preserva o comportamento.
  INSERT INTO public.invoices (
    subscription_id, tenant_id, status, amount, due_date,
    billing_period_start, billing_period_end, idempotency_key
  )
  VALUES (
    p_subscription_id, p_tenant_id, 'issued', p_amount, p_due_date,
    p_billing_period_start, p_billing_period_end, p_idempotency_key
  )
  ON CONFLICT DO NOTHING;

  SELECT i.id INTO v_invoice_id
  FROM public.invoices i
  WHERE i.tenant_id = p_tenant_id AND i.idempotency_key = p_idempotency_key
  ORDER BY i.created_at DESC
  LIMIT 1;

  RETURN QUERY
  SELECT i.id, i.tenant_id, i.subscription_id, i.status, i.amount, i.due_date,
         i.billing_period_start, i.billing_period_end
  FROM public.invoices i
  WHERE i.id = v_invoice_id;
END;
$function$;

-- =====================================================
-- 2) record_payment_attempt — INSERT com alias + RETURNING a.id
-- =====================================================
CREATE OR REPLACE FUNCTION public.record_payment_attempt(
  p_invoice_id uuid,
  p_tenant_id uuid,
  p_status text,
  p_provider text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  invoice_id uuid,
  tenant_id uuid,
  status text,
  provider text,
  error text,
  attempted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_attempt_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = auth.uid()
        AND s.tenant_id = p_tenant_id
        AND s.status = 'active'
        AND s.role IN ('owner', 'manager', 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to record payment attempt';
  END IF;

  -- Alias "a" desambigua o RETURNING (id é OUT param de RETURNS TABLE)
  INSERT INTO public.payment_attempts AS a (invoice_id, tenant_id, status, provider, error)
  VALUES (p_invoice_id, p_tenant_id, p_status, p_provider, p_error)
  RETURNING a.id INTO v_attempt_id;

  RETURN QUERY
  SELECT a.id, a.invoice_id, a.tenant_id, a.status, a.provider, a.error, a.attempted_at
  FROM public.payment_attempts a
  WHERE a.id = v_attempt_id;
END;
$function$;

-- =====================================================
-- GRANTS (ADR-012) — reafirma para as 2 funções (idempotente)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.create_invoice(uuid, uuid, numeric, timestamptz, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_payment_attempt(uuid, uuid, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_invoice(uuid, uuid, numeric, timestamptz, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_attempt(uuid, uuid, text, text, text) TO authenticated;
