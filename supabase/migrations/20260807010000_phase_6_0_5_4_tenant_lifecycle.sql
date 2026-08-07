-- =====================================================
-- PHASE 6.0.5.4 — TENANT LIFECYCLE SERVICE + suspended ADITIVO
-- Decisões do PO aprovadas em 2026-08-07 (D-6.0.5.4-1..5):
--   D-6.0.5.4-1: Escopo = máquina de suspensão/reativação do contrato
--   D-6.0.5.4-2: Reativação de suspended = markPaid OU RPC manual
--                reactivate_subscription; NUNCA via runCycle (ciclo não reativa)
--   D-6.0.5.4-3: archived NÃO entra no CHECK de subscriptions (D-6.0.5-7)
--   D-6.0.5.4-4: Fail-fast — status desconhecido -> RAISE EXCEPTION
--                (fim do ELSE -> active, DIV-1)
--   D-6.0.5.4-5: grace_ends_at persistido na transição para past_due
--                (engine grava current_period_end + GRACE_PERIOD_DAYS) e
--                limpo ao sair de past_due/suspended
--
-- Ordem de execução (rollback-friendly):
--   1) CHECK aditivo com 'suspended' (sem 'archived' — D-6.0.5-7)
--   2) Coluna grace_ends_at + backfill de linhas past_due legadas (R6)
--   3) apply_subscription_transition reescrita (map explícito + ELSE RAISE
--      + p_grace_ends_at; OUT params novos -> DROP + CREATE)
--   4) get_due_subscriptions ampliada (devolve grace_ends_at e inclui
--      candidatas past_due com grace expirado)
--   5) RPCs manuais suspend_subscription / reactivate_subscription
--      (superadmin, D-6.0.5-4; matriz ADR-013 §5.2)
--   6) GRANTS ADR-012 (DROP + CREATE limpa grants -> reafirma)
--
-- Padrões: aditivo e retrocompatível; idempotente (aplica 2x sem erro);
-- persistência fina (regra de ciclo permanece no BillingEngine TS).
-- =====================================================

-- =====================================================
-- 1) CHECK ADITIVO — subscriptions.status aceita 'suspended'
-- =====================================================

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trialing', 'active', 'past_due', 'suspended', 'cancelled'));

-- =====================================================
-- 2) COLUNA grace_ends_at + backfill (D-6.0.5.4-5 / R6)
--    grace = janela temporal, NUNCA status (ADR-013 §4.3)
-- =====================================================

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS grace_ends_at timestamptz;

-- Backfill idempotente: linhas past_due legadas sem grace_ends_at recebem
-- current_period_end + 5 dias (fim da janela = momento em que past_due começou).
UPDATE public.subscriptions
SET grace_ends_at = COALESCE(current_period_end, now()) + interval '5 days',
    updated_at = now()
WHERE status = 'past_due' AND grace_ends_at IS NULL;

-- =====================================================
-- 3) apply_subscription_transition — persistência fina, map explícito, fail-fast
-- =====================================================

-- OUT params mudam (adiciona grace_ends_at) -> DROP prévio (padrão 6.0.4.4).
DROP FUNCTION IF EXISTS public.apply_subscription_transition(uuid, text, timestamptz, timestamptz, timestamptz, boolean);

CREATE OR REPLACE FUNCTION public.apply_subscription_transition(
  p_subscription_id uuid,
  p_status text,
  p_current_period_start timestamptz DEFAULT NULL,
  p_current_period_end timestamptz DEFAULT NULL,
  p_canceled_at timestamptz DEFAULT NULL,
  p_clear_cancel_request boolean DEFAULT false,
  p_grace_ends_at timestamptz DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end timestamptz,
  canceled_at timestamptz,
  grace_ends_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_tenant_status public.tenant_status;
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

  -- D-6.0.5.4-4: map explícito e completo. Desconhecido -> erro (fim do ELSE -> active).
  IF p_status = 'trialing' THEN
    v_tenant_status := 'trial';
  ELSIF p_status = 'active' THEN
    v_tenant_status := 'active';
  ELSIF p_status = 'past_due' THEN
    v_tenant_status := 'past_due';
  ELSIF p_status = 'suspended' THEN
    v_tenant_status := 'suspended';
  ELSIF p_status = 'cancelled' THEN
    v_tenant_status := 'cancelled';
  ELSE
    RAISE EXCEPTION 'Invalid subscription status: %', p_status;
  END IF;

  UPDATE public.subscriptions AS s
  SET status = p_status,
      current_period_start = COALESCE(p_current_period_start, s.current_period_start),
      current_period_end = COALESCE(p_current_period_end, s.current_period_end),
      canceled_at = COALESCE(p_canceled_at, s.canceled_at),
      cancel_at_period_end = CASE WHEN p_clear_cancel_request THEN NULL ELSE s.cancel_at_period_end END,
      -- D-6.0.5.4-5: grace_ends_at recebe SEMPRE o valor explícito (NULL limpa).
      grace_ends_at = p_grace_ends_at,
      updated_at = now()
  WHERE s.id = p_subscription_id;

  -- Espelha o status do tenant (mapeamento 1:1, Single Writer via Transition Executor)
  UPDATE public.tenants AS t
  SET status = v_tenant_status, updated_at = now()
  WHERE t.id = v_tenant_id;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.current_period_start, s.current_period_end,
         s.cancel_at_period_end, s.canceled_at, s.grace_ends_at
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id;
END;
$function$;

-- =====================================================
-- 4) get_due_subscriptions — candidatas do runCycle (leitura fina)
--    Devolve grace_ends_at e inclui past_due com grace expirado.
-- =====================================================

DROP FUNCTION IF EXISTS public.get_due_subscriptions(timestamptz);

CREATE OR REPLACE FUNCTION public.get_due_subscriptions(
  p_as_of timestamptz
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
  grace_ends_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.current_is_super_admin_from_auth_uid() THEN
    RETURN QUERY
    SELECT s.id, s.tenant_id, s.plan, s.status, s.trial_started_at, s.trial_ends_at,
           s.current_period_start, s.current_period_end, s.cancel_at_period_end,
           s.canceled_at, s.grace_ends_at, s.created_at
    FROM public.subscriptions s
    WHERE s.status <> 'cancelled'
      AND (
        (s.trial_ends_at IS NOT NULL AND s.trial_ends_at <= p_as_of)
        OR (s.current_period_end IS NOT NULL AND s.current_period_end <= p_as_of)
        OR (s.cancel_at_period_end IS NOT NULL AND s.cancel_at_period_end <= p_as_of)
        OR (s.status = 'past_due' AND s.grace_ends_at IS NOT NULL AND s.grace_ends_at <= p_as_of)
      );
  ELSE
    RETURN QUERY
    SELECT s.id, s.tenant_id, s.plan, s.status, s.trial_started_at, s.trial_ends_at,
           s.current_period_start, s.current_period_end, s.cancel_at_period_end,
           s.canceled_at, s.grace_ends_at, s.created_at
    FROM public.subscriptions s
    WHERE s.tenant_id = public.current_tenant_id_from_auth_uid()
      AND s.status <> 'cancelled'
      AND (
        (s.trial_ends_at IS NOT NULL AND s.trial_ends_at <= p_as_of)
        OR (s.current_period_end IS NOT NULL AND s.current_period_end <= p_as_of)
        OR (s.cancel_at_period_end IS NOT NULL AND s.cancel_at_period_end <= p_as_of)
        OR (s.status = 'past_due' AND s.grace_ends_at IS NOT NULL AND s.grace_ends_at <= p_as_of)
      );
  END IF;
END;
$function$;

-- =====================================================
-- 5) RPCs MANUAIS — suspensão/reativação (superadmin, D-6.0.5-4)
--    Matriz congelada ADR-013 §5.2: past_due -> suspended -> active/cancelled.
--    Idempotentes; transição fora da matriz -> fail-fast.
-- =====================================================

-- 5.1 suspend_subscription — past_due -> suspended (retirada manual de acesso)
CREATE OR REPLACE FUNCTION public.suspend_subscription(
  p_subscription_id uuid
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text,
  grace_ends_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'Insufficient permissions: superadmin required to suspend subscription';
  END IF;

  SELECT s.tenant_id, s.status INTO v_tenant_id, v_status
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Idempotente quando já suspensa
  IF v_status = 'suspended' THEN
    RETURN QUERY
    SELECT s.id, s.tenant_id, s.plan, s.status, s.grace_ends_at, s.updated_at
    FROM public.subscriptions s
    WHERE s.id = p_subscription_id;
    RETURN;
  END IF;

  IF v_status <> 'past_due' THEN
    RAISE EXCEPTION 'Invalid transition: cannot suspend subscription in status %', v_status;
  END IF;

  UPDATE public.subscriptions AS s
  SET status = 'suspended', grace_ends_at = NULL, updated_at = now()
  WHERE s.id = p_subscription_id;

  UPDATE public.tenants AS t
  SET status = 'suspended', updated_at = now()
  WHERE t.id = v_tenant_id;

  PERFORM public.record_billing_event(
    v_tenant_id,
    'TenantSubscriptionSuspended',
    jsonb_build_object('subscription_id', p_subscription_id)
  );

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.grace_ends_at, s.updated_at
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id;
END;
$function$;

-- 5.2 reactivate_subscription — suspended -> active (D-6.0.5.4-2)
CREATE OR REPLACE FUNCTION public.reactivate_subscription(
  p_subscription_id uuid
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text,
  grace_ends_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'Insufficient permissions: superadmin required to reactivate subscription';
  END IF;

  SELECT s.tenant_id, s.status INTO v_tenant_id, v_status
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Idempotente quando já ativa
  IF v_status = 'active' THEN
    RETURN QUERY
    SELECT s.id, s.tenant_id, s.plan, s.status, s.grace_ends_at, s.updated_at
    FROM public.subscriptions s
    WHERE s.id = p_subscription_id;
    RETURN;
  END IF;

  IF v_status <> 'suspended' THEN
    RAISE EXCEPTION 'Invalid transition: cannot reactivate subscription in status %', v_status;
  END IF;

  UPDATE public.subscriptions AS s
  SET status = 'active', grace_ends_at = NULL, updated_at = now()
  WHERE s.id = p_subscription_id;

  UPDATE public.tenants AS t
  SET status = 'active', updated_at = now()
  WHERE t.id = v_tenant_id;

  PERFORM public.record_billing_event(
    v_tenant_id,
    'TenantSubscriptionReactivated',
    jsonb_build_object('subscription_id', p_subscription_id)
  );

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.grace_ends_at, s.updated_at
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id;
END;
$function$;

-- =====================================================
-- 6) GRANTS (ADR-012) — DROP + CREATE limpa grants; reafirma
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.apply_subscription_transition(uuid, text, timestamptz, timestamptz, timestamptz, boolean, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_due_subscriptions(timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.suspend_subscription(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reactivate_subscription(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.apply_subscription_transition(uuid, text, timestamptz, timestamptz, timestamptz, boolean, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_due_subscriptions(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_subscription(uuid) TO authenticated;
