-- =====================================================
-- PHASE 6.0.5.3 — FEATURE FLAGS ENFORCEMENT (D-6.0.5.3-1..6)
-- Tabela runtime `feature_flags` + RPC `tenant_has_feature`
--   + guarda nas RPCs do domínio `receivables`
--   + `invite_team_member` lendo `plans.limits.max_staff`
--
-- Autorização: Entry Audit 6.0.5.3 aprovada pelo PO em 2026-08-07
--   (PHASE_6_0_5_3_ENTRY_AUDIT §6/§8 + D-6.0.5.3-1..6).
--
-- Fonte de autoridade: ADR-013 §2.4/§3.1/§4.11 + FEATURE_FLAGS_MODEL §4/§6.
--
-- Decisões aplicadas:
--   - D-6.0.5.3-1: escopo delimitado (enforcement + resolução de planos).
--   - D-6.0.5.3-3: aplicada via MIGRATION_EXCEPTION (com 06030000 e 06090000).
--   - D-6.0.5.3-4: RPCs protegidas = fechamento de caixa, comissões,
--     receivables, expenses (checkout FORA). Entre os domínios protegidos,
--     APENAS `receivables` possui RPCs executáveis (cash_closing/commissions/
--     expenses são escritos via repositórios). Guarda aplicada nas 3 RPCs
--     de recebíveis chamadas pelo frontend; demais domínios = UI + futuro RLS
--     (desvio documentado como DIV-6 na entry audit).
--   - D-6.0.5.3-6: leitura de flags SOMENTE via RPC `tenant_has_feature`
--     (nenhum SELECT autenticado em feature_flags — sem policy/grant SELECT
--     p/ autenticados via RLS; escrita exclusiva superadmin/service_role).
--   - Fim dos SQL hardcoded de limite (invite_team_member free=1/pro=5) →
--     leitura de plans.limits.max_staff (NULL = ilimitado/premium).
--
-- Padrões: idempotente (IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT);
-- grants ADR-012 (REVOKE PUBLIC + GRANT authenticated/service_role);
-- SECURITY DEFINER com SET search_path.
-- Sem migration runner: aplicada via Supabase CLI / dashboard.
-- =====================================================

-- =====================================================
-- 1) TABELA RUNTIME `feature_flags` (override tenant × feature)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_key  text NOT NULL REFERENCES public.features(key) ON DELETE CASCADE,
  override     boolean NOT NULL,
  reason       text NOT NULL DEFAULT '',
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, feature_key)
);

COMMENT ON TABLE public.feature_flags IS
  'Override runtime tenant x feature (excecao por tenant — suporte/promocao/degustacao). Leitura autenticada SOMENTE via RPC tenant_has_feature (D-6.0.5.3-6); escrita exclusiva superadmin/service_role. Suspensao/arquivamento nao persistem rows — derivados do estado efetivo.';

CREATE INDEX IF NOT EXISTS idx_feature_flags_feature
  ON public.feature_flags (feature_key);

-- =====================================================
-- 2) RLS — escrita superadmin; SEM policy de leitura p/ autenticados
-- =====================================================

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feature_flags'
      AND policyname = 'feature_flags_superadmin_all'
  ) THEN
    CREATE POLICY "feature_flags_superadmin_all" ON public.feature_flags FOR ALL
      USING (public.current_is_super_admin_from_auth_uid())
      WITH CHECK (public.current_is_super_admin_from_auth_uid());
  END IF;
END;
$$;

-- =====================================================
-- 3) GRANTS
-- =====================================================

-- Leitura de flags NUNCA por SELECT autenticado (D-6.0.5.3-6):
-- sem GRANT SELECT p/ authenticated + sem policy SELECT → RLS bloqueia.
GRANT INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO service_role;

-- =====================================================
-- 4) RPC `tenant_has_feature` (única RPC nova desta subfase)
-- =====================================================

-- Ordem de resolução (D-6.0.5.3-4/§2.2):
--   1) auth.uid() presente (ADR-012) — sem sessão → false (fail-closed)
--   2) tenant suspended/archived → false (derivado do estado efetivo)
--   3) row em feature_flags → override vence
--   4) senão → membership na matriz plan_features (plano do tenant)
-- Tenant inexistente ou feature inexistente → false (fail-closed).
CREATE OR REPLACE FUNCTION public.tenant_has_feature(
  p_tenant_id uuid,
  p_feature text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT
      CASE
        WHEN t.status IN ('suspended', 'archived') THEN false
        WHEN ff.feature_key IS NOT NULL THEN ff.override
        ELSE EXISTS (
          SELECT 1
          FROM public.plan_features pf
          WHERE pf.plan_slug = t.plan
            AND pf.feature_key = p_feature
        )
      END
    FROM public.tenants t
    LEFT JOIN public.feature_flags ff
      ON ff.tenant_id = t.id
     AND ff.feature_key = p_feature
    WHERE t.id = p_tenant_id
      AND auth.uid() IS NOT NULL
  ), false);
$$;

REVOKE ALL ON FUNCTION public.tenant_has_feature(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_has_feature(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_has_feature(uuid, text) TO service_role;

-- =====================================================
-- 5) GUARDA `tenant_has_feature` nas RPCs de receivables
--    (domínio protegido D-6.0.5.3-4; guarda aditiva, regra de negócio preservada)
-- =====================================================

-- 5.1 generate_club_receivables
CREATE OR REPLACE FUNCTION public.generate_club_receivables(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_target_tenant_id UUID;
  v_subscription RECORD;
  v_count INTEGER := 0;
BEGIN
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  v_target_tenant_id := COALESCE(p_tenant_id, v_auth_tenant_id);

  IF v_target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant obrigatório';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_target_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  -- [GUARD 6.0.5.3] Feature Flag `receivables` (D-6.0.5.3-4)
  IF NOT COALESCE(v_is_super_admin, false)
     AND NOT public.tenant_has_feature(v_target_tenant_id, 'receivables') THEN
    RAISE EXCEPTION 'Modulo Contas a Receber nao disponivel no plano atual. Faca upgrade para continuar.';
  END IF;

  FOR v_subscription IN
    SELECT cs.id
    FROM public.customer_subscriptions cs
    WHERE cs.tenant_id = v_target_tenant_id
      AND cs.status IN ('active', 'past_due')
  LOOP
    PERFORM public.ensure_club_receivable_for_cycle(v_subscription.id);
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.customer_subscription_receivables
  SET status = 'overdue', updated_at = now()
  WHERE tenant_id = v_target_tenant_id
    AND status = 'pending'
    AND due_date < current_date;

  RETURN v_count;
END;
$$;

-- 5.2 refresh_club_receivable_statuses
CREATE OR REPLACE FUNCTION public.refresh_club_receivable_statuses(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_target_tenant_id UUID;
  v_count INTEGER;
BEGIN
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  v_target_tenant_id := COALESCE(p_tenant_id, v_auth_tenant_id);

  IF v_target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant obrigatório';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_target_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  -- [GUARD 6.0.5.3] Feature Flag `receivables` (D-6.0.5.3-4)
  IF NOT COALESCE(v_is_super_admin, false)
     AND NOT public.tenant_has_feature(v_target_tenant_id, 'receivables') THEN
    RAISE EXCEPTION 'Modulo Contas a Receber nao disponivel no plano atual. Faca upgrade para continuar.';
  END IF;

  UPDATE public.customer_subscription_receivables
  SET status = 'overdue', updated_at = now()
  WHERE tenant_id = v_target_tenant_id
    AND status = 'pending'
    AND due_date < current_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 5.3 pay_club_receivable
CREATE OR REPLACE FUNCTION public.pay_club_receivable(
  p_receivable_id UUID,
  p_payment_method TEXT,
  p_paid_at TIMESTAMPTZ,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_receivable public.customer_subscription_receivables%ROWTYPE;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_customer public.clients%ROWTYPE;
  v_plan public.customer_plans%ROWTYPE;
  v_transaction public.transactions%ROWTYPE;
  v_service_balance_map JSONB;
  v_total_credits INTEGER;
  v_next_cycle_start TIMESTAMPTZ;
  v_next_cycle_end TIMESTAMPTZ;
BEGIN
  IF p_receivable_id IS NULL THEN
    RAISE EXCEPTION 'Recebimento obrigatório';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_payment_method, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Forma de pagamento obrigatória';
  END IF;

  IF p_paid_at IS NULL THEN
    RAISE EXCEPTION 'Data de pagamento obrigatória';
  END IF;

  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT *
  INTO v_receivable
  FROM public.customer_subscription_receivables
  WHERE id = p_receivable_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento não encontrado';
  END IF;

  IF NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_receivable.tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  -- [GUARD 6.0.5.3] Feature Flag `receivables` (D-6.0.5.3-4)
  IF NOT COALESCE(v_is_super_admin, false)
     AND NOT public.tenant_has_feature(v_receivable.tenant_id, 'receivables') THEN
    RAISE EXCEPTION 'Modulo Contas a Receber nao disponivel no plano atual. Faca upgrade para continuar.';
  END IF;

  IF v_receivable.status NOT IN ('pending', 'overdue') THEN
    RAISE EXCEPTION 'Recebimento não está pendente ou atrasado';
  END IF;

  IF v_receivable.transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Recebimento já possui lançamento financeiro';
  END IF;

  SELECT *
  INTO v_subscription
  FROM public.customer_subscriptions
  WHERE id = v_receivable.subscription_id
    AND tenant_id = v_receivable.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada para o recebimento';
  END IF;

  IF v_subscription.client_id IS DISTINCT FROM v_receivable.customer_id THEN
    RAISE EXCEPTION 'Cliente do recebimento não confere com a assinatura';
  END IF;

  IF v_subscription.plan_id IS DISTINCT FROM v_receivable.plan_id THEN
    RAISE EXCEPTION 'Plano do recebimento não confere com a assinatura';
  END IF;

  SELECT *
  INTO v_customer
  FROM public.clients
  WHERE id = v_receivable.customer_id
    AND tenant_id = v_receivable.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado para o recebimento';
  END IF;

  SELECT *
  INTO v_plan
  FROM public.customer_plans
  WHERE id = v_receivable.plan_id
    AND tenant_id = v_receivable.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado para o recebimento';
  END IF;

  SELECT service_balance_map, total_credits
  INTO v_service_balance_map, v_total_credits
  FROM public.build_chef_club_service_balance_map(v_receivable.plan_id);

  IF v_total_credits <= 0 OR jsonb_array_length(COALESCE(v_service_balance_map, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Plano sem créditos por serviço configurados';
  END IF;

  INSERT INTO public.transactions (
    tenant_id,
    user_id,
    type,
    category,
    description,
    amount,
    payment_method,
    date,
    status,
    notes
  )
  VALUES (
    v_receivable.tenant_id,
    v_auth_uid,
    'income',
    'Receita recorrente Clube do Chefe',
    'Mensalidade Clube do Chefe - ' || COALESCE(v_plan.name, 'Plano') || ' - Cliente: ' || COALESCE(v_customer.name, 'Cliente'),
    v_receivable.amount,
    p_payment_method,
    p_paid_at,
    'paid',
    p_notes
  )
  RETURNING * INTO v_transaction;

  INSERT INTO public.customer_credits (
    tenant_id,
    client_id,
    subscription_id,
    available_credits,
    used_credits,
    service_balance_map,
    period_start,
    period_end
  )
  VALUES (
    v_receivable.tenant_id,
    v_receivable.customer_id,
    v_receivable.subscription_id,
    v_total_credits,
    0,
    v_service_balance_map,
    v_receivable.billing_cycle_start,
    v_receivable.billing_cycle_end
  )
  ON CONFLICT (subscription_id) DO UPDATE
  SET
    tenant_id = EXCLUDED.tenant_id,
    client_id = EXCLUDED.client_id,
    available_credits = EXCLUDED.available_credits,
    used_credits = EXCLUDED.used_credits,
    service_balance_map = EXCLUDED.service_balance_map,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    updated_at = now();

  UPDATE public.customer_subscription_receivables
  SET
    status = 'paid',
    payment_method = p_payment_method,
    paid_at = p_paid_at,
    paid_by = v_auth_uid,
    transaction_id = v_transaction.id,
    notes = NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    updated_at = now()
  WHERE id = v_receivable.id
    AND transaction_id IS NULL
    AND status IN ('pending', 'overdue')
  RETURNING * INTO v_receivable;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento já foi baixado por outra operação';
  END IF;

  UPDATE public.customer_subscriptions
  SET
    status = 'active',
    cycle_start = v_receivable.billing_cycle_start,
    cycle_end = v_receivable.billing_cycle_end,
    next_billing_date = v_receivable.billing_cycle_end::DATE,
    updated_at = now()
  WHERE id = v_receivable.subscription_id;

  v_next_cycle_start := v_receivable.billing_cycle_end;
  v_next_cycle_end := v_receivable.billing_cycle_end + interval '1 month';

  PERFORM public.ensure_club_receivable_for_cycle(
    v_receivable.subscription_id,
    v_next_cycle_start,
    v_next_cycle_end,
    v_next_cycle_start::DATE
  );

  RETURN jsonb_build_object(
    'receivable', to_jsonb(v_receivable),
    'transaction', to_jsonb(v_transaction),
    'credits', (
      SELECT to_jsonb(cc)
      FROM public.customer_credits cc
      WHERE cc.subscription_id = v_receivable.subscription_id
      LIMIT 1
    )
  );
END;
$$;

-- Grants reaplicados (CREATE OR REPLACE mantém, reafirmamos por idempotência)
REVOKE ALL ON FUNCTION public.generate_club_receivables(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_club_receivables(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.refresh_club_receivable_statuses(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_club_receivable_statuses(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.pay_club_receivable(UUID, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pay_club_receivable(UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

-- =====================================================
-- 6) `invite_team_member` — fim dos SQL hardcoded de limite
--    (leitura de plans.limits.max_staff; NULL = ilimitado/premium)
-- =====================================================

CREATE OR REPLACE FUNCTION public.invite_team_member(
  p_tenant_id uuid,
  p_email text,
  p_role text
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  email text,
  role text,
  token text,
  status text,
  expires_at timestamptz,
  invited_by uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_normalized_email text;
  v_plan text;
  v_max_staff integer;
  v_active_staff int;
  v_pending_invites int;
  v_total int;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Chamador deve ser gestor do tenant (owner/manager/admin) ou superadmin
  IF NOT public.current_is_tenant_manager_from_auth_uid(p_tenant_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to invite team members';
  END IF;

  -- D2: apenas Barber + Receptionist sao convidaveis
  v_role := lower(trim(p_role));
  IF v_role NOT IN ('barber', 'receptionist') THEN
    RAISE EXCEPTION 'Invalid invite role. Allowed: barber, receptionist';
  END IF;

  v_normalized_email := lower(trim(p_email));
  IF v_normalized_email = '' OR v_normalized_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;

  -- Nao pode convidar quem ja e staff do tenant
  IF EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.tenant_id = p_tenant_id
      AND lower(trim(s.email)) = v_normalized_email
  ) THEN
    RAISE EXCEPTION 'This email is already a team member';
  END IF;

  -- Nao pode haver convite pendente para o mesmo email+tenant (constraint parcial)
  -- (a UNIQUE parcial ja impede; aqui garantimos mensagem amigavel)

  -- D3: limite por plano (Free=1, Pro=5, Premium=ilimitado) contando staff ativos + invites pendentes
  -- (6.0.5.3: leitura de plans.limits.max_staff — fim dos literais hardcoded, D-6.0.5.3)
  SELECT t.plan INTO v_plan FROM public.tenants t WHERE t.id = p_tenant_id;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  -- max_staff NULL (JSON null em plans.limits) = ilimitado (Premium)
  SELECT (pl.limits ->> 'max_staff')::integer INTO v_max_staff
  FROM public.plans pl
  WHERE pl.slug = v_plan;

  SELECT count(*) INTO v_active_staff
  FROM public.staff s
  WHERE s.tenant_id = p_tenant_id AND s.status = 'active';

  SELECT count(*) INTO v_pending_invites
  FROM public.team_invitations i
  WHERE i.tenant_id = p_tenant_id AND i.status = 'pending';

  v_total := v_active_staff + v_pending_invites;

  IF v_max_staff IS NOT NULL AND v_total >= v_max_staff THEN
    RAISE EXCEPTION 'Team limit reached: the current plan allows % professionals. Please upgrade your plan.', v_max_staff;
  END IF;

  RETURN QUERY
  INSERT INTO public.team_invitations AS inv (tenant_id, email, role, token, status, invited_by)
  VALUES (
    p_tenant_id,
    v_normalized_email,
    v_role,
    encode(extensions.gen_random_bytes(24), 'hex'),
    'pending',
    auth.uid()
  )
  RETURNING
    inv.id, inv.tenant_id, inv.email, inv.role, inv.token, inv.status, inv.expires_at, inv.invited_by, inv.created_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.invite_team_member(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_team_member(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_team_member(uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
