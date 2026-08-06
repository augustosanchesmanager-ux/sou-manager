-- =====================================================
-- PHASE 6.0.4.2 — BILLING (TENANT LIFECYCLE)
-- Decisões do PO aprovadas em 2026-08-06:
--   D1: Normalizar plano elite -> premium (único slug oficial)
--   D3: Trial = 14 dias a partir do provisionamento (tenants.created_at),
--       5 dias de grace period antes da suspensão
--   D4: tenants.plan permanece slug TEXT (free/pro/premium); tabela plans só na 6.0.5
--
-- Ordem de execução (rollback-friendly):
--   1) Normalização elite -> premium
--   2) Tabelas de Billing (subscriptions, invoices, billing_events, payment_attempts)
--   3) RPCs SECURITY DEFINER (start_trial / activate_subscription / cancel_subscription / get_subscription)
--
-- Padrões: RLS tenant + superadmin bypass; escritas apenas via RPC SECURITY DEFINER;
-- idempotência (IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS).
-- Eventos de domínio são publicados pelos Application Services (6.0.4.4); as RPCs
-- registram apenas a trilha operacional em billing_events.
-- =====================================================

-- =====================================================
-- 1) NORMALIZAÇÃO elite -> premium (D1)
-- =====================================================

-- 1.1 Migração de dados (idempotente — no-op quando não há 'elite')
UPDATE public.tenants
SET plan = 'premium', updated_at = now()
WHERE plan = 'elite';

-- 1.2 Recria o CHECK com o slug oficial
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_plan_check
  CHECK (plan IN ('free', 'pro', 'premium'));

-- =====================================================
-- 2) TABELAS DE BILLING
-- =====================================================

-- 2.1 subscriptions (1 tenant = 1 subscription ativa)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'trialing',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'pro', 'premium')),
  CONSTRAINT subscriptions_status_check CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled'))
);

-- 1 subscription ativa por tenant (SUBSCRIPTION_MODEL.md:117)
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_active_tenant_uidx
  ON public.subscriptions (tenant_id) WHERE status IN ('trialing', 'active', 'past_due');

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_status
  ON public.subscriptions (tenant_id, status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'subscriptions_select_tenant') THEN
    CREATE POLICY "subscriptions_select_tenant" ON public.subscriptions FOR SELECT
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
  END IF;
END;
$$;

-- 2.2 invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'issued',
  amount numeric(12, 2) NOT NULL DEFAULT 0,
  due_date timestamptz NOT NULL,
  paid_at timestamptz,
  billing_period_start timestamptz,
  billing_period_end timestamptz,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'failed', 'void'))
);

-- Idempotência de faturamento (padrão processed_operations): UNIQUE (tenant_id, idempotency_key)
CREATE UNIQUE INDEX IF NOT EXISTS invoices_idempotency_uidx
  ON public.invoices (tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status ON public.invoices (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON public.invoices (subscription_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'invoices_select_tenant') THEN
    CREATE POLICY "invoices_select_tenant" ON public.invoices FOR SELECT
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
  END IF;
END;
$$;

-- 2.3 billing_events (trilha operacional; publicação oficial no event_store via Application Service)
CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_tenant_created
  ON public.billing_events (tenant_id, created_at);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'billing_events' AND policyname = 'billing_events_select_tenant') THEN
    CREATE POLICY "billing_events_select_tenant" ON public.billing_events FOR SELECT
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
  END IF;
END;
$$;

-- 2.4 payment_attempts (append-only; provider real só com gateway futuro)
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  provider text,
  error text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_attempts_status_check CHECK (status IN ('pending', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_invoice ON public.payment_attempts (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_tenant_status ON public.payment_attempts (tenant_id, status);

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_attempts' AND policyname = 'payment_attempts_select_tenant') THEN
    CREATE POLICY "payment_attempts_select_tenant" ON public.payment_attempts FOR SELECT
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
  END IF;
END;
$$;

-- =====================================================
-- 3) RPCS (SECURITY DEFINER, idempotentes)
-- =====================================================

-- Helper interno: registra trilha operacional de billing (não substitui event_store)
CREATE OR REPLACE FUNCTION public.record_billing_event(
  p_tenant_id uuid,
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.billing_events (tenant_id, event_type, payload)
  VALUES (p_tenant_id, p_event_type, p_payload);
END;
$function$;

-- 3.1 start_trial — cria subscription trialing e transiciona draft -> trial (F10)
-- Trial = 14 dias contado do provisionamento (tenants.created_at). Idempotente.
CREATE OR REPLACE FUNCTION public.start_trial(
  p_tenant_id uuid,
  p_plan text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

  SELECT status, plan, created_at
  INTO v_tenant_status, v_tenant_plan, v_tenant_created
  FROM public.tenants
  WHERE id = p_tenant_id;

  IF v_tenant_status IS NULL THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  -- Chamador: superadmin ou gestor ativo do tenant (owner/manager/admin)
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

  INSERT INTO public.subscriptions (
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
  RETURNING id INTO v_sub_id;

  -- F10: draft -> trial (nunca draft -> active direto)
  IF v_tenant_status = 'draft' THEN
    UPDATE public.tenants
    SET status = 'trial', updated_at = now()
    WHERE id = p_tenant_id;
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

-- 3.2 activate_subscription — trialing -> active (sem gateway; manual/superadmin na 6.0.4)
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
SET search_path = 'public'
AS $function$
DECLARE
  v_sub_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
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
    RAISE EXCEPTION 'Insufficient permissions to activate subscription';
  END IF;

  UPDATE public.subscriptions
  SET status = 'active',
      current_period_start = COALESCE(current_period_start, now()),
      current_period_end = COALESCE(current_period_end, now() + interval '1 month'),
      updated_at = now()
  WHERE tenant_id = p_tenant_id AND status = 'trialing';

  UPDATE public.tenants
  SET status = 'active', updated_at = now()
  WHERE id = p_tenant_id AND status = 'trial';

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

-- 3.3 cancel_subscription — trialing/active/past_due -> cancelled
CREATE OR REPLACE FUNCTION public.cancel_subscription(
  p_tenant_id uuid
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text,
  canceled_at timestamptz
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

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
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

  UPDATE public.subscriptions
  SET status = 'cancelled', canceled_at = now(), updated_at = now()
  WHERE tenant_id = p_tenant_id AND status IN ('trialing', 'active', 'past_due');

  UPDATE public.tenants
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_tenant_id;

  SELECT s.id INTO v_sub_id
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    PERFORM public.record_billing_event(
      p_tenant_id,
      'TenantSubscriptionCancelled',
      jsonb_build_object('subscription_id', v_sub_id)
    );
  END IF;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.canceled_at
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$function$;

-- 3.4 get_subscription — leitura para a UI (tenant resolvido do chamador)
CREATE OR REPLACE FUNCTION public.get_subscription()
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
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

  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.trial_started_at, s.trial_ends_at,
         s.current_period_start, s.current_period_end, s.canceled_at, s.created_at
  FROM public.subscriptions s
  WHERE s.tenant_id = v_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$function$;

-- =====================================================
-- GRANTS
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.record_billing_event(uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_trial(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_subscription(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_subscription(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_subscription() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_billing_event(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_trial(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription() TO authenticated;
