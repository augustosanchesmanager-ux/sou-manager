-- ============================================================================
-- Migration: 20261124182000_security_fix_gtm001_stack_a_assisted_billing.sql
-- Issue: #380 (P0-05 | GTM-001) — ADR-055
-- Scope:
--   1. Port RLS / GRANT / RPC hardening (#376 / PR #407) to canonical Stack A
--      (plans, features, plan_features, subscriptions, invoices,
--      billing_events, payment_attempts).
--   2. Restrict administrative mutations (activate_subscription,
--      mark_invoice_paid, record_billing_event) exclusively to SuperAdmin.
--   3. Create atomic SECURITY DEFINER RPC `activate_assisted_plan_upgrade`
--      for DEC-01 assisted upgrade + manual invoice settlement.
--   4. Mark `platform_plans`, `platform_subscriptions`, `platform_invoices`
--      as deprecated (Phase 1) WITHOUT dropping tables.
-- Note: Applied ONLY after PO review and explicit production authorization.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Stack A RLS & Least-Privilege GRANT Hardening (Mandate 1)
-- ============================================================================

ALTER TABLE IF EXISTS public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.plans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.plans TO anon, authenticated;

REVOKE ALL ON TABLE public.features FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.features TO authenticated;

REVOKE ALL ON TABLE public.plan_features FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.plan_features TO authenticated;

REVOKE ALL ON TABLE public.subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.subscriptions TO authenticated;

REVOKE ALL ON TABLE public.invoices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.invoices TO authenticated;

REVOKE ALL ON TABLE public.billing_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.billing_events TO authenticated;

REVOKE ALL ON TABLE public.payment_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.payment_attempts TO authenticated;

-- Tighten operational SELECT policies explicitly TO authenticated
DROP POLICY IF EXISTS "subscriptions_select_tenant" ON public.subscriptions;
CREATE POLICY "subscriptions_select_tenant"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
          AND s.role IN ('owner', 'manager', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "invoices_select_tenant" ON public.invoices;
CREATE POLICY "invoices_select_tenant"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
          AND s.role IN ('owner', 'manager', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "billing_events_select_tenant" ON public.billing_events;
CREATE POLICY "billing_events_select_tenant"
  ON public.billing_events
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
          AND s.role IN ('owner', 'manager', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "payment_attempts_select_tenant" ON public.payment_attempts;
CREATE POLICY "payment_attempts_select_tenant"
  ON public.payment_attempts
  FOR SELECT
  TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
          AND s.role IN ('owner', 'manager', 'admin')
      )
    )
  );

-- ============================================================================
-- 2. Harden Legacy Stack A Write RPCs (SuperAdmin Only)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_billing_event(
  p_tenant_id uuid,
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'Insufficient permissions to record billing event';
  END IF;

  INSERT INTO public.billing_events (tenant_id, event_type, payload)
  VALUES (p_tenant_id, p_event_type, COALESCE(p_payload, '{}'::jsonb));
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_tenant_id uuid
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_sub_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'Insufficient permissions to activate subscription';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_tenant_id) THEN
    RAISE EXCEPTION 'Tenant not found';
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
    INSERT INTO public.billing_events (tenant_id, event_type, payload)
    VALUES (
      p_tenant_id,
      'TenantSubscriptionActivated',
      jsonb_build_object('subscription_id', v_sub_id, 'actor_id', auth.uid())
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
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'Insufficient permissions to mark invoice paid';
  END IF;

  SELECT i.tenant_id INTO v_tenant_id
  FROM public.invoices i
  WHERE i.id = p_invoice_id
  FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  UPDATE public.invoices AS i
  SET status = 'paid',
      paid_at = COALESCE(i.paid_at, now()),
      updated_at = now()
  WHERE i.id = p_invoice_id AND i.status <> 'paid';

  INSERT INTO public.billing_events (tenant_id, event_type, payload)
  VALUES (
    v_tenant_id,
    'InvoiceMarkedPaidManually',
    jsonb_build_object('invoice_id', p_invoice_id, 'actor_id', auth.uid())
  );

  RETURN QUERY
  SELECT i.id, i.tenant_id, i.subscription_id, i.status, i.amount, i.paid_at
  FROM public.invoices i
  WHERE i.id = p_invoice_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_billing_event(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.activate_subscription(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_billing_event(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid(uuid) TO authenticated;

-- ============================================================================
-- 3. Atomic RPC for Assisted Plan Upgrade & Manual Settlement (Mandate 2)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.activate_assisted_plan_upgrade(
  p_tenant_id uuid,
  p_target_plan text,
  p_invoice_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_payment_method text DEFAULT 'assisted',
  p_period_months integer DEFAULT 1,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_now timestamptz := now();
  v_period_end timestamptz;
  v_plan_record RECORD;
  v_tenant_record RECORD;
  v_sub_id uuid;
  v_invoice_id uuid;
  v_effective_amount numeric(12, 2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'Insufficient permissions: superadmin required for assisted plan upgrade';
  END IF;

  IF p_period_months IS NULL OR p_period_months < 1 OR p_period_months > 36 THEN
    RAISE EXCEPTION 'Invalid period_months: must be between 1 and 36';
  END IF;

  SELECT p.slug, p.price_cents, p.status
    INTO v_plan_record
    FROM public.plans p
   WHERE p.slug = p_target_plan
     AND p.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target plan "%" not found or inactive in Stack A catalog', p_target_plan;
  END IF;

  -- Lock tenant row to prevent concurrent split-brain updates
  SELECT t.id, t.plan, t.status
    INTO v_tenant_record
    FROM public.tenants t
   WHERE t.id = p_tenant_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
  END IF;

  v_period_end := v_now + make_interval(months => p_period_months);
  v_effective_amount := COALESCE(p_amount, ROUND((v_plan_record.price_cents::numeric / 100.0), 2));

  -- Lock active subscription if one exists; otherwise insert a new active subscription
  SELECT s.id
    INTO v_sub_id
    FROM public.subscriptions s
   WHERE s.tenant_id = p_tenant_id
     AND s.status IN ('trialing', 'active', 'past_due')
   ORDER BY s.created_at DESC
   LIMIT 1
     FOR UPDATE;

  IF v_sub_id IS NOT NULL THEN
    UPDATE public.subscriptions
       SET plan = p_target_plan,
           status = 'active',
           current_period_start = v_now,
           current_period_end = v_period_end,
           canceled_at = NULL,
           updated_at = v_now
     WHERE id = v_sub_id;
  ELSE
    INSERT INTO public.subscriptions (
      tenant_id,
      plan,
      status,
      current_period_start,
      current_period_end
    )
    VALUES (
      p_tenant_id,
      p_target_plan,
      'active',
      v_now,
      v_period_end
    )
    RETURNING id INTO v_sub_id;
  END IF;

  -- Settle explicit invoice or record idempotent manual settlement invoice
  IF p_invoice_id IS NOT NULL THEN
    SELECT i.id
      INTO v_invoice_id
      FROM public.invoices i
     WHERE i.id = p_invoice_id
       AND i.tenant_id = p_tenant_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice % not found for tenant %', p_invoice_id, p_tenant_id;
    END IF;

    UPDATE public.invoices
       SET status = 'paid',
           paid_at = COALESCE(paid_at, v_now),
           subscription_id = COALESCE(subscription_id, v_sub_id),
           updated_at = v_now
     WHERE id = v_invoice_id;
  ELSE
    IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
      INSERT INTO public.invoices (
        subscription_id,
        tenant_id,
        status,
        amount,
        due_date,
        paid_at,
        billing_period_start,
        billing_period_end,
        idempotency_key
      )
      VALUES (
        v_sub_id,
        p_tenant_id,
        'paid',
        v_effective_amount,
        v_now,
        v_now,
        v_now,
        v_period_end,
        btrim(p_idempotency_key)
      )
      ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
      RETURNING id INTO v_invoice_id;

      IF v_invoice_id IS NULL THEN
        SELECT i.id
          INTO v_invoice_id
          FROM public.invoices i
         WHERE i.tenant_id = p_tenant_id
           AND i.idempotency_key = btrim(p_idempotency_key)
         LIMIT 1;
      END IF;
    ELSE
      INSERT INTO public.invoices (
        subscription_id,
        tenant_id,
        status,
        amount,
        due_date,
        paid_at,
        billing_period_start,
        billing_period_end
      )
      VALUES (
        v_sub_id,
        p_tenant_id,
        'paid',
        v_effective_amount,
        v_now,
        v_now,
        v_now,
        v_period_end
      )
      RETURNING id INTO v_invoice_id;
    END IF;
  END IF;

  -- Mirror authoritative plan & active status on tenants atomically
  UPDATE public.tenants
     SET plan = p_target_plan,
         status = 'active',
         updated_at = v_now
   WHERE id = p_tenant_id;

  -- Audit trail in billing_events
  INSERT INTO public.billing_events (tenant_id, event_type, payload)
  VALUES (
    p_tenant_id,
    'AssistedPlanUpgradeActivated',
    jsonb_build_object(
      'actor_id', auth.uid(),
      'previous_plan', v_tenant_record.plan,
      'previous_status', v_tenant_record.status,
      'target_plan', p_target_plan,
      'subscription_id', v_sub_id,
      'invoice_id', v_invoice_id,
      'amount', v_effective_amount,
      'payment_method', COALESCE(NULLIF(btrim(p_payment_method), ''), 'assisted'),
      'period_months', p_period_months,
      'period_end', v_period_end
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'plan', p_target_plan,
    'status', 'active',
    'subscription_id', v_sub_id,
    'invoice_id', v_invoice_id,
    'period_start', v_now,
    'period_end', v_period_end
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.activate_assisted_plan_upgrade(uuid, text, uuid, numeric, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_assisted_plan_upgrade(uuid, text, uuid, numeric, text, integer, text) TO authenticated;

-- ============================================================================
-- 4. Phased Deprecation of Stack B platform_* Tables (Mandate 3 — NO DROP)
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.platform_plans') IS NOT NULL THEN
    COMMENT ON TABLE public.platform_plans IS
      '@deprecated ADR-055 (Fase 1): Stack A (public.plans) é a fonte única de verdade. Sem novas escritas; DROP apenas na Fase 2.';
  END IF;

  IF to_regclass('public.platform_subscriptions') IS NOT NULL THEN
    COMMENT ON TABLE public.platform_subscriptions IS
      '@deprecated ADR-055 (Fase 1): Stack A (public.subscriptions) é a fonte única de verdade. Sem novas escritas; DROP apenas na Fase 2.';
  END IF;

  IF to_regclass('public.platform_invoices') IS NOT NULL THEN
    COMMENT ON TABLE public.platform_invoices IS
      '@deprecated ADR-055 (Fase 1): Stack A (public.invoices) é a fonte única de verdade. Sem novas escritas; DROP apenas na Fase 2.';
  END IF;
END;
$$;

COMMIT;
