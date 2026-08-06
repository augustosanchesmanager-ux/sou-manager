-- =====================================================
-- PHASE 6.0.4.4 — BILLING ENGINE (cancel_at_period_end + transições finas)
-- Aprovado pelo PO em 2026-08-06:
--   D-A: Cancelamento = cancel_at_period_end (acesso mantido até o fim do período;
--        TenantSubscriptionCancelled SOMENTE na efetivação pelo engine)
--   D-C: Invoice apenas para planos pagos (amount=0 placeholder, status=issued);
--        free/trial NUNCA emitem invoice; idempotência via (tenant_id, idempotency_key)
--   D-D: trial->active permanece manual (RPC activate_subscription, superadmin)
--
-- RETROCOMPATIBILIDADE (pedido do PO):
--   - subscriptions já canceladas continuam canceladas (nenhuma linha é alterada)
--   - subscriptions ativas continuam ativas
--   - cancel_at_period_end nasce NULLABLE (sem default destrutivo)
--   - cancel_subscription() é reescrita para SEMÂNTICA DE PEDIDO (não efetivação):
--       active/trialing/past_due
--         ↓ cancel_subscription()
--       cancel_at_period_end = current_period_end (status NÃO muda; acesso mantido)
--         ↓ engine.runCycle(asOf)  [BillingService, fora do banco]
--       cancelled (canceled_at = asOf; tenants.status = cancelled)
--
-- Arquitetura (aprovada):
--   - Engine TS (domain/billing) é a ÚNICA fonte de verdade das regras de ciclo
--   - O banco NÃO contém regra de negócio complexa — apenas persistência fina:
--       * cancel_subscription  (pedido de cancelamento — mantém acesso)
--       * apply_subscription_transition (transição de status computada pelo engine)
--       * create_invoice       (INSERT idempotente via UNIQUE tenant_id+idempotency_key)
--       * mark_invoice_paid    (pagamento manual confirmado — sem gateway)
--       * record_payment_attempt (append-only em payment_attempts)
--   - Padrões: SECURITY DEFINER + auth.uid() + RLS tenant/superadmin + ADR-012 (REVOKE/GRANT)
-- =====================================================

-- =====================================================
-- 1) COLUNA cancel_at_period_end (nullable, retrocompatível)
-- =====================================================

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end timestamptz;

-- =====================================================
-- 2) cancel_subscription — SEMÂNTICA DE PEDIDO (D-A)
-- =====================================================

-- Assinatura de retorno muda (11 colunas, shape completo de subscriptions,
-- consistente com start_trial/activate_subscription/get_subscription) — o
-- CREATE OR REPLACE não permite alterar OUT params, por isso o DROP prévio.
-- DROP é seguro: subscriptions está vazia na aplicação e a semântica antiga
-- (cancelamento imediato) é substituída pela de pedido nesta mesma migration.
DROP FUNCTION IF EXISTS public.cancel_subscription(uuid);

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

  -- Pedido de cancelamento: marca encerramento no fim do período contratado.
  -- NÃO altera status (acesso mantido) e NÃO altera tenants.status.
  UPDATE public.subscriptions
  SET cancel_at_period_end = COALESCE(cancel_at_period_end, COALESCE(current_period_end, now())),
      updated_at = now()
  WHERE tenant_id = p_tenant_id AND status IN ('trialing', 'active', 'past_due');

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
-- 3) RPCs FINAS de persistência (engine TS decide, banco persiste)
-- =====================================================

-- 3.1 apply_subscription_transition
-- Transição de status/janela computada pelo BillingEngine (fonte da verdade).
-- Também espelha tenants.status (mapeamento 1:1 status -> tenant_status).
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

  SELECT tenant_id INTO v_tenant_id
  FROM public.subscriptions
  WHERE id = p_subscription_id;

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

  UPDATE public.subscriptions
  SET status = p_status,
      current_period_start = COALESCE(p_current_period_start, current_period_start),
      current_period_end = COALESCE(p_current_period_end, current_period_end),
      canceled_at = COALESCE(p_canceled_at, canceled_at),
      cancel_at_period_end = CASE WHEN p_clear_cancel_request THEN NULL ELSE cancel_at_period_end END,
      updated_at = now()
  WHERE id = p_subscription_id;

  -- Espelha o status do tenant (mapeamento 1:1 com o ciclo)
  v_tenant_status := CASE p_status
    WHEN 'trialing' THEN 'trial'
    WHEN 'active' THEN 'active'
    WHEN 'past_due' THEN 'past_due'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE 'active'
  END;

  UPDATE public.tenants
  SET status = v_tenant_status, updated_at = now()
  WHERE id = v_tenant_id;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.current_period_start, s.current_period_end,
         s.cancel_at_period_end, s.canceled_at
  FROM public.subscriptions s
  WHERE s.id = p_subscription_id;
END;
$function$;

-- 3.2 create_invoice — INSERT idempotente (UNIQUE tenant_id + idempotency_key)
-- Retorna a invoice existente quando a chave já foi usada (evita duplicação no runCycle).
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

  -- Idempotência: mesma chave (tenant_id, idempotency_key) → devolve a existente
  INSERT INTO public.invoices (
    subscription_id, tenant_id, status, amount, due_date,
    billing_period_start, billing_period_end, idempotency_key
  )
  VALUES (
    p_subscription_id, p_tenant_id, 'issued', p_amount, p_due_date,
    p_billing_period_start, p_billing_period_end, p_idempotency_key
  )
  ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;

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

-- 3.3 mark_invoice_paid — pagamento manual confirmado (sem gateway)
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

  SELECT tenant_id INTO v_tenant_id
  FROM public.invoices
  WHERE id = p_invoice_id;

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
  UPDATE public.invoices
  SET status = 'paid',
      paid_at = COALESCE(paid_at, now()),
      updated_at = now()
  WHERE id = p_invoice_id AND status <> 'paid';

  RETURN QUERY
  SELECT i.id, i.tenant_id, i.subscription_id, i.status, i.amount, i.paid_at
  FROM public.invoices i
  WHERE i.id = p_invoice_id;
END;
$function$;

-- 3.4 get_invoice — leitura por id (escopo por papel)
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

  SELECT tenant_id INTO v_tenant_id
  FROM public.invoices
  WHERE id = p_invoice_id;

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

-- 3.5 get_subscription_by_id — leitura por id (escopo por papel)
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

  SELECT tenant_id INTO v_tenant_id
  FROM public.subscriptions
  WHERE id = p_subscription_id;

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

-- 3.6 record_payment_attempt — append-only em payment_attempts
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

  INSERT INTO public.payment_attempts (invoice_id, tenant_id, status, provider, error)
  VALUES (p_invoice_id, p_tenant_id, p_status, p_provider, p_error)
  RETURNING id INTO v_attempt_id;

  RETURN QUERY
  SELECT a.id, a.invoice_id, a.tenant_id, a.status, a.provider, a.error, a.attempted_at
  FROM public.payment_attempts a
  WHERE a.id = v_attempt_id;
END;
$function$;

-- 3.7 get_due_subscriptions — candidatas a processamento (runCycle)
-- Escopo por papel: superadmin vê todas; gestor vê apenas o próprio tenant.
-- É UMA LEITURA (persistência) — a decisão de transição é do engine TS.
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
           s.canceled_at, s.created_at
    FROM public.subscriptions s
    WHERE s.status <> 'cancelled'
      AND (
        (s.trial_ends_at IS NOT NULL AND s.trial_ends_at <= p_as_of)
        OR (s.current_period_end IS NOT NULL AND s.current_period_end <= p_as_of)
        OR (s.cancel_at_period_end IS NOT NULL AND s.cancel_at_period_end <= p_as_of)
      );
  ELSE
    RETURN QUERY
    SELECT s.id, s.tenant_id, s.plan, s.status, s.trial_started_at, s.trial_ends_at,
           s.current_period_start, s.current_period_end, s.cancel_at_period_end,
           s.canceled_at, s.created_at
    FROM public.subscriptions s
    WHERE s.tenant_id = public.current_tenant_id_from_auth_uid()
      AND s.status <> 'cancelled'
      AND (
        (s.trial_ends_at IS NOT NULL AND s.trial_ends_at <= p_as_of)
        OR (s.current_period_end IS NOT NULL AND s.current_period_end <= p_as_of)
        OR (s.cancel_at_period_end IS NOT NULL AND s.cancel_at_period_end <= p_as_of)
      );
  END IF;
END;
$function$;

-- =====================================================
-- GRANTS (ADR-012)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.get_subscription_by_id(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_due_subscriptions(timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_invoice(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_subscription(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_subscription_transition(uuid, text, timestamptz, timestamptz, timestamptz, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_invoice(uuid, uuid, numeric, timestamptz, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_payment_attempt(uuid, uuid, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_subscription_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_due_subscriptions(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_transition(uuid, text, timestamptz, timestamptz, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice(uuid, uuid, numeric, timestamptz, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_attempt(uuid, uuid, text, text, text) TO authenticated;
