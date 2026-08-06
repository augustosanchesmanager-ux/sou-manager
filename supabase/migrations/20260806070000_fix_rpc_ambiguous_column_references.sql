-- =====================================================
-- FIX — AMBIGUIDADE DE COLUNA EM RPCs DO CICLO DE ASSINATURA
-- Data: 2026-08-06
-- Motivo:
--   Funções com RETURNS TABLE (id, tenant_id, plan, status, ...) criam
--   parâmetros de saída que viram VARIÁVEIS PL/pgSQL com o mesmo nome das
--   colunas de public.subscriptions/public.tenants/public.invoices.
--   Referências NÃO qualificadas (ex.: "WHERE id = p_tenant_id",
--   "SET status = ...") colidem → erro em runtime:
--       ERROR: column reference "id" is ambiguous
--   Detectado nos E2E flow9 (complete_onboarding → start_trial) e flow12.
-- Escopo:
--   7 RPCs afetadas (5 da fase 6.0.4.4 + 2 pré-existentes da fase 5 usadas
--   pelo onboarding/ativação). Solução: alias + qualificação total.
--   get_due_subscriptions/record_payment_attempt/create_invoice já estão limpas.
--
-- Observação: NÃO reexecuta a migration 20260806050000 (já aplicada/registrada).
-- CREATE OR REPLACE preserva as GRANTs existentes; reafirmamos ADR-012 abaixo.
-- =====================================================

-- =====================================================
-- 1) start_trial — UPDATE em tenants (WHERE id não qualificado)
-- =====================================================
CREATE OR REPLACE FUNCTION public.start_trial(p_tenant_id uuid, p_plan text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, tenant_id uuid, plan text, status text, trial_started_at timestamp with time zone, trial_ends_at timestamp with time zone, current_period_start timestamp with time zone, current_period_end timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_status text;
  v_tenant_plan text;
  v_tenant_created timestamptz;
  v_sub_id uuid;
  v_sub_status text;
  v_trial_end timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT t.status, t.plan, t.created_at
  INTO v_tenant_status, v_tenant_plan, v_tenant_created
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  IF v_tenant_status IS NULL THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  -- Chamador: superadmin ou gestor ativo do tenant (owner/manager/admin)
  IF NOT public.current_is_tenant_manager_from_auth_uid(p_tenant_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to start trial';
  END IF;

  -- Idempotência: devolve a subscription ativa existente (se houver)
  SELECT s.id INTO v_sub_id
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
    AND s.status IN ('trialing', 'active', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    RETURN QUERY
    SELECT s.id, s.tenant_id, s.plan, s.status, s.trial_started_at, s.trial_ends_at,
           s.current_period_start, s.current_period_end
    FROM public.subscriptions s
    WHERE s.id = v_sub_id;
    RETURN;
  END IF;

  -- Status da subscription derivado do status do tenant (defensivo p/ tenants legados)
  v_sub_status := CASE
    WHEN v_tenant_status IN ('trial', 'draft') THEN 'trialing'
    WHEN v_tenant_status = 'active' THEN 'active'
    WHEN v_tenant_status = 'past_due' THEN 'past_due'
    ELSE 'trialing'
  END;

  -- Trial: 14 dias a partir do provisionamento (D3)
  v_trial_end := v_tenant_created + interval '14 days';

  INSERT INTO public.subscriptions AS sub (
    tenant_id, plan, status, trial_started_at, trial_ends_at,
    current_period_start, current_period_end
  )
  VALUES (
    p_tenant_id,
    COALESCE(NULLIF(p_plan, ''), v_tenant_plan, 'free'),
    v_sub_status,
    v_tenant_created,
    v_trial_end,
    v_tenant_created,
    v_trial_end
  )
  RETURNING sub.id INTO v_sub_id;

  -- F10: draft -> trial (nunca draft -> active direto)
  IF v_tenant_status = 'draft' THEN
    UPDATE public.tenants AS t
    SET status = 'trial', updated_at = now()
    WHERE t.id = p_tenant_id;
  END IF;

  PERFORM public.record_billing_event(
    p_tenant_id,
    'TenantTrialStarted',
    jsonb_build_object('subscription_id', v_sub_id, 'trial_ends_at', v_trial_end)
  );

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.trial_started_at, s.trial_ends_at,
         s.current_period_start, s.current_period_end
  FROM public.subscriptions s
  WHERE s.id = v_sub_id;
END;
$function$;

-- =====================================================
-- 2) activate_subscription — EXISTS + 2 UPDATEs não qualificados
-- =====================================================
CREATE OR REPLACE FUNCTION public.activate_subscription(p_tenant_id uuid)
 RETURNS TABLE(id uuid, tenant_id uuid, plan text, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sub_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_tenant_id) THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  IF NOT public.current_is_tenant_manager_from_auth_uid(p_tenant_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to activate subscription';
  END IF;

  UPDATE public.subscriptions AS s
  SET status = 'active',
      current_period_start = COALESCE(s.current_period_start, now()),
      current_period_end = COALESCE(s.current_period_end, now() + interval '1 month'),
      updated_at = now()
  WHERE s.tenant_id = p_tenant_id AND s.status = 'trialing';

  UPDATE public.tenants AS t
  SET status = 'active', updated_at = now()
  WHERE t.id = p_tenant_id AND t.status = 'trial';

  SELECT s.id INTO v_sub_id
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    PERFORM public.record_billing_event(
      p_tenant_id,
      'TenantSubscriptionActivated',
      jsonb_build_object('subscription_id', v_sub_id)
    );
  END IF;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$function$;

-- =====================================================
-- 3) cancel_subscription — EXISTS + UPDATE não qualificados
-- =====================================================
CREATE OR REPLACE FUNCTION public.cancel_subscription(
  p_tenant_id uuid
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_sub_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_tenant_id) THEN
    RAISE EXCEPTION 'Tenant not found';
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
    RAISE EXCEPTION 'Insufficient permissions to cancel subscription';
  END IF;

  -- Pedido de cancelamento: marca encerramento no fim do período contratado.
  -- NÃO altera status (acesso mantido) e NÃO altera tenants.status.
  UPDATE public.subscriptions AS s
  SET cancel_at_period_end = COALESCE(s.cancel_at_period_end, COALESCE(s.current_period_end, now())),
      updated_at = now()
  WHERE s.tenant_id = p_tenant_id AND s.status IN ('trialing', 'active', 'past_due');

  SELECT s.id INTO v_sub_id
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    PERFORM public.record_billing_event(
      p_tenant_id,
      'TenantSubscriptionCancellationRequested',
      jsonb_build_object('subscription_id', v_sub_id)
    );
  END IF;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.trial_started_at, s.trial_ends_at,
         s.current_period_start, s.current_period_end, s.cancel_at_period_end,
         s.canceled_at, s.created_at
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$function$;

-- =====================================================
-- 4) apply_subscription_transition — SELECT + 2 UPDATEs não qualificados
-- =====================================================
CREATE OR REPLACE FUNCTION public.apply_subscription_transition(
  p_subscription_id uuid,
  p_status text,
  p_current_period_start timestamptz DEFAULT NULL,
  p_current_period_end timestamptz DEFAULT NULL,
  p_canceled_at timestamptz DEFAULT NULL,
  p_clear_cancel_request boolean DEFAULT false
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end timestamptz,
  canceled_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_tenant_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT s.tenant_id INTO v_tenant_id
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = auth.uid()
        AND s.tenant_id = v_tenant_id
        AND s.status = 'active'
        AND s.role IN ('owner', 'manager', 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to apply subscription transition';
  END IF;

  UPDATE public.subscriptions AS s
  SET status = p_status,
      current_period_start = COALESCE(p_current_period_start, s.current_period_start),
      current_period_end = COALESCE(p_current_period_end, s.current_period_end),
      canceled_at = COALESCE(p_canceled_at, s.canceled_at),
      cancel_at_period_end = CASE WHEN p_clear_cancel_request THEN NULL ELSE s.cancel_at_period_end END,
      updated_at = now()
  WHERE s.id = p_subscription_id;

  -- Espelha o status do tenant (mapeamento 1:1 com o ciclo)
  v_tenant_status := CASE p_status
    WHEN 'trialing' THEN 'trial'
    WHEN 'active' THEN 'active'
    WHEN 'past_due' THEN 'past_due'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE 'active'
  END;

  UPDATE public.tenants AS t
  SET status = v_tenant_status, updated_at = now()
  WHERE t.id = v_tenant_id;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.current_period_start, s.current_period_end,
         s.cancel_at_period_end, s.canceled_at
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id;
END;
$function$;

-- =====================================================
-- 5) mark_invoice_paid — SELECT + UPDATE não qualificados
-- =====================================================
CREATE OR REPLACE FUNCTION public.mark_invoice_paid(
  p_invoice_id uuid
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  subscription_id uuid,
  status text,
  amount numeric,
  paid_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT i.tenant_id INTO v_tenant_id
  FROM public.invoices i
  WHERE i.id = p_invoice_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = auth.uid()
        AND s.tenant_id = v_tenant_id
        AND s.status = 'active'
        AND s.role IN ('owner', 'manager', 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to mark invoice paid';
  END IF;

  -- Idempotente: invoice já paga não re-escreve paid_at
  UPDATE public.invoices AS i
  SET status = 'paid',
      paid_at = COALESCE(i.paid_at, now()),
      updated_at = now()
  WHERE i.id = p_invoice_id AND i.status <> 'paid';

  RETURN QUERY
  SELECT i.id, i.tenant_id, i.subscription_id, i.status, i.amount, i.paid_at
  FROM public.invoices i
  WHERE i.id = p_invoice_id;
END;
$function$;

-- =====================================================
-- 6) get_invoice — SELECT não qualificado
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_invoice(
  p_invoice_id uuid
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  subscription_id uuid,
  status text,
  amount numeric,
  due_date timestamptz,
  billing_period_start timestamptz,
  billing_period_end timestamptz,
  paid_at timestamptz,
  idempotency_key text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT i.tenant_id INTO v_tenant_id
  FROM public.invoices i
  WHERE i.id = p_invoice_id;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF public.current_is_super_admin_from_auth_uid()
     OR v_tenant_id = public.current_tenant_id_from_auth_uid() THEN
    RETURN QUERY
    SELECT i.id, i.tenant_id, i.subscription_id, i.status, i.amount, i.due_date,
           i.billing_period_start, i.billing_period_end, i.paid_at,
           i.idempotency_key, i.created_at
    FROM public.invoices i
    WHERE i.id = p_invoice_id;
  END IF;
END;
$function$;

-- =====================================================
-- 7) get_subscription_by_id — SELECT não qualificado
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_subscription_by_id(
  p_subscription_id uuid
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT s.tenant_id INTO v_tenant_id
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF public.current_is_super_admin_from_auth_uid()
     OR v_tenant_id = public.current_tenant_id_from_auth_uid() THEN
    RETURN QUERY
    SELECT s.id, s.tenant_id, s.plan, s.status, s.trial_started_at, s.trial_ends_at,
           s.current_period_start, s.current_period_end, s.cancel_at_period_end,
           s.canceled_at, s.created_at
    FROM public.subscriptions s
    WHERE s.id = p_subscription_id;
  END IF;
END;
$function$;

-- =====================================================
-- GRANTS (ADR-012) — reafirma para as 7 funções (idempotente)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.start_trial(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_subscription(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_subscription(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_subscription_transition(uuid, text, timestamptz, timestamptz, timestamptz, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_invoice(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_subscription_by_id(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.start_trial(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_transition(uuid, text, timestamptz, timestamptz, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_by_id(uuid) TO authenticated;
