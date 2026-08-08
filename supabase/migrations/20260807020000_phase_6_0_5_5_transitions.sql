-- =====================================================
-- PHASE 6.0.5.5 — TRANSIÇÕES RPCs (change_tenant_plan)
-- Decisões do PO aprovadas em 2026-08-07 (D-6.0.5.5-1..5):
--   D-6.0.5.5-1: Gate "Schema Freeze Candidate" obrigatório (§3 entry audit);
--                reexecutado no fechamento -> SCHEMA FREEZE = YES
--   D-6.0.5.5-2: Escopo = transições de plano (upgrade/downgrade) +
--                TenantSubscriptionUpdated + correção Admin.tsx:856 +
--                banner de estado + UpgradePrompt + depreciação featureAvailability
--   D-6.0.5.5-3: tenants.plan deixa de ser escrito por UI -> espelho de
--                subscriptions.plan (single writer, ADR-013 §3.1)
--   D-6.0.5.5-4: Hardening M7/M11/M12 + E2E flow11 ADIADOS (backlog pós-v1.5)
--   D-6.0.5.5-5: Sem novas tabelas, colunas, FKs ou policies — somente a RPC
--                change_tenant_plan (único objeto de schema novo)
--
-- ÚNICO objeto novo (GATE Q5/Q6 = SIM, 1 RPC): change_tenant_plan.
-- Sem tabelas (Q1 NO), colunas (Q2 NO), FKs (Q3 NO), policies (Q4 NO) e
-- assinaturas de RPCs existentes intocadas (Q7: mudança semântica de contrato
-- de escrita — tenants.plan passa a ser espelho, não schema).
--
-- NOTA DE DESVIO (assinatura): a entry audit §2.2 propôs
-- `change_tenant_plan(p_subscription_id uuid, p_plan text)`. A implementação
-- usa `p_tenant_id` para manter consistência com as RPCs irmãs
-- (`start_trial(p_tenant_id, p_plan)`, `activate_subscription(p_tenant_id)`,
-- `cancel_subscription(p_tenant_id)`) e com a API pública congelada
-- `changePlan(tenantId, plan, reason?)` (§2.4). A subscription ativa é
-- resolvida internamente (padrão activate/cancel). Grants ADR-012 mantidos.
--
-- Padrões: aditivo e retrocompatível; idempotente (aplica 2x sem erro);
-- SECURITY DEFINER; persistência fina (regra de negócio no Application Service);
-- escrita de tenants.plan UNICAMENTE aqui (single writer, ADR-013 §3.1).
-- =====================================================

-- =====================================================
-- 1) change_tenant_plan — upgrade/downgrade transacional
--    subscriptions.plan + espelho tenants.plan (mesmo UPDATE transacional)
-- =====================================================
CREATE OR REPLACE FUNCTION public.change_tenant_plan(
  p_tenant_id uuid,
  p_plan text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_plan text;
  v_prev_plan text;
  v_sub_id uuid;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_tenant_id) THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  -- D-6.0.5.5-2: mudança de plano é operação manual/superadmin (sem gateway).
  -- Fail-fast (D-6.0.5.4-4): superadmin obrigatório — nenhum fallback silencioso.
  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'Insufficient permissions: superadmin required to change tenant plan';
  END IF;

  -- Valida p_plan contra o CHECK oficial (free/pro/premium) ANTES de gravar
  IF p_plan IS NULL OR p_plan NOT IN ('free', 'pro', 'premium') THEN
    RAISE EXCEPTION 'Invalid plan: %', p_plan;
  END IF;

  -- Subscription ativa (trialing/active/past_due — 1 por tenant) ou, em último
  -- caso, a mais recente não cancelada. Mesma resolução de activate/cancel.
  SELECT s.id, s.plan, s.status
    INTO v_sub_id, v_prev_plan, v_status
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
    AND s.status IN ('trialing', 'active', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    SELECT s.id, s.plan, s.status
      INTO v_sub_id, v_prev_plan, v_status
    FROM public.subscriptions s
    WHERE s.tenant_id = p_tenant_id
      AND s.status <> 'cancelled'
    ORDER BY s.created_at DESC
    LIMIT 1;
  END IF;

  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION 'No subscription found for tenant %', p_tenant_id;
  END IF;

  -- Idempotente: mesmo plano = no-op (retorna a linha atual, sem evento)
  IF v_prev_plan = p_plan THEN
    RETURN QUERY
    SELECT s.id, s.tenant_id, s.plan, s.status, s.updated_at
    FROM public.subscriptions s
    WHERE s.id = v_sub_id;
    RETURN;
  END IF;

  -- Espelho transacional (D-6.0.5.5-3): subscriptions.plan é a fonte;
  -- tenants.plan é o espelho, gravado no MESMO UPDATE transacional.
  UPDATE public.subscriptions AS s
  SET plan = p_plan, updated_at = now()
  WHERE s.id = v_sub_id;

  UPDATE public.tenants AS t
  SET plan = p_plan, updated_at = now()
  WHERE t.id = p_tenant_id;

  PERFORM public.record_billing_event(
    p_tenant_id,
    'TenantPlanChanged',
    jsonb_build_object(
      'subscription_id', v_sub_id,
      'previous_plan', v_prev_plan,
      'new_plan', p_plan,
      'reason', p_reason
    )
  );

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.updated_at
  FROM public.subscriptions s
  WHERE s.id = v_sub_id;
END;
$function$;

-- =====================================================
-- 2) GRANTS (ADR-012) — REVOKE PUBLIC + GRANT authenticated
--    (a restrição superadmin vive DENTRO da função — padrão 6.0.5.4)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.change_tenant_plan(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_tenant_plan(uuid, text, text) TO authenticated;
