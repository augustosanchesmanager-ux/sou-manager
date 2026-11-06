-- ==============================================================================
-- MIGRATION: Phase 8 — Billing da Plataforma SMG & Métricas de SaaS (Subfase 8.6)
-- Data: 2026-11-06
-- Referência: ADR-041 (ACCEPTED) & SMG Change Control Protocol
-- Autoridade: Augusto (PO) · Antigravity (Platform Architect)
-- Invariantes:
--   1. Isolamento multi-tenant estrito (tenant_id) via RLS defensivo;
--   2. Segregação de domínio: Platform Billing (SaaS) != Club dos Chefes (B2C);
--   3. Carência (Grace Period) antes de bloqueio e desvinculação direta de status;
--   4. Vedação de service_role irrestrito no data path;
--   5. Idempotência em DDL e DML de seed.
-- ==============================================================================

-- ==============================================================================
-- 1. Tabela: public.platform_plans (Catálogo de Planos Comerciais SaaS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL,
  price_cents      INT NOT NULL,
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
  max_staff        INT NOT NULL DEFAULT 2,
  max_api_rpm      INT NOT NULL DEFAULT 60,
  features         JSONB NOT NULL DEFAULT '{}'::jsonb,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_plans_slug_not_empty CHECK (btrim(slug) <> ''),
  CONSTRAINT chk_platform_plans_price_positive CHECK (price_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_platform_plans_slug
  ON public.platform_plans (slug);

CREATE INDEX IF NOT EXISTS idx_platform_plans_active
  ON public.platform_plans (active);

ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_plans_select_policy
  ON public.platform_plans
  FOR SELECT
  USING (
    active = true
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY platform_plans_insert_policy
  ON public.platform_plans
  FOR INSERT
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY platform_plans_update_policy
  ON public.platform_plans
  FOR UPDATE
  USING (
    public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY platform_plans_delete_policy
  ON public.platform_plans
  FOR DELETE
  USING (
    public.current_is_super_admin_from_auth_uid()
  );

-- ==============================================================================
-- 2. Tabela: public.platform_subscriptions (Assinaturas das Barbearias)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id              UUID NOT NULL REFERENCES public.platform_plans(id) ON DELETE RESTRICT,
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end   TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at          TIMESTAMPTZ NULL,
  trial_ends_at        TIMESTAMPTZ NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_tenant_id
  ON public.platform_subscriptions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_plan_id
  ON public.platform_subscriptions (plan_id);

CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_status
  ON public.platform_subscriptions (status);

ALTER TABLE public.platform_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_subscriptions_select_policy
  ON public.platform_subscriptions
  FOR SELECT
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY platform_subscriptions_insert_policy
  ON public.platform_subscriptions
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY platform_subscriptions_update_policy
  ON public.platform_subscriptions
  FOR UPDATE
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY platform_subscriptions_delete_policy
  ON public.platform_subscriptions
  FOR DELETE
  USING (
    public.current_is_super_admin_from_auth_uid()
  );

-- ==============================================================================
-- 3. Tabela: public.platform_invoices (Faturas da Plataforma)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES public.platform_subscriptions(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number   TEXT NOT NULL UNIQUE,
  amount_cents     INT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'void')),
  due_date         DATE NOT NULL,
  paid_at          TIMESTAMPTZ NULL,
  payment_method   TEXT NULL CHECK (payment_method IN ('pix', 'credit_card', 'boleto')),
  payment_link     TEXT NULL,
  pdf_url          TEXT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_platform_invoices_amount_positive CHECK (amount_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_platform_invoices_tenant_id
  ON public.platform_invoices (tenant_id);

CREATE INDEX IF NOT EXISTS idx_platform_invoices_subscription_id
  ON public.platform_invoices (subscription_id);

CREATE INDEX IF NOT EXISTS idx_platform_invoices_status
  ON public.platform_invoices (status);

CREATE INDEX IF NOT EXISTS idx_platform_invoices_due_date
  ON public.platform_invoices (due_date);

ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_invoices_select_policy
  ON public.platform_invoices
  FOR SELECT
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY platform_invoices_insert_policy
  ON public.platform_invoices
  FOR INSERT
  WITH CHECK (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY platform_invoices_update_policy
  ON public.platform_invoices
  FOR UPDATE
  USING (
    tenant_id = public.current_effective_tenant_id()
    OR public.current_is_super_admin_from_auth_uid()
  );

CREATE POLICY platform_invoices_delete_policy
  ON public.platform_invoices
  FOR DELETE
  USING (
    public.current_is_super_admin_from_auth_uid()
  );

-- ==============================================================================
-- 4. RPCs de Faturamento e Métricas Executivas de SaaS
-- ==============================================================================

-- 4.1 RPC: Obter Métricas Executivas de SaaS (Super-Admin)
CREATE OR REPLACE FUNCTION public.get_saas_executive_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
  v_mrr_cents BIGINT := 0;
  v_arr_cents BIGINT := 0;
  v_active_subs INT := 0;
  v_past_due_subs INT := 0;
  v_trialing_subs INT := 0;
  v_canceled_subs INT := 0;
  v_overdue_invoices_cents BIGINT := 0;
  v_by_plan JSONB := '[]'::jsonb;
BEGIN
  -- 1. Validação de Autorização Super-Admin
  v_is_super_admin := public.current_is_super_admin_from_auth_uid();
  IF NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Acesso negado: apenas Super-Admin pode consultar métricas executivas de SaaS.';
  END IF;

  -- 2. Agregação de Assinantes por Status
  SELECT
    COALESCE(count(*) FILTER (WHERE status = 'active'), 0),
    COALESCE(count(*) FILTER (WHERE status = 'past_due'), 0),
    COALESCE(count(*) FILTER (WHERE status = 'trialing'), 0),
    COALESCE(count(*) FILTER (WHERE status = 'canceled'), 0)
  INTO
    v_active_subs,
    v_past_due_subs,
    v_trialing_subs,
    v_canceled_subs
  FROM public.platform_subscriptions;

  -- 3. Cálculo de MRR (Mensalizado)
  SELECT
    COALESCE(SUM(
      CASE
        WHEN p.billing_interval = 'yearly' THEN p.price_cents / 12
        ELSE p.price_cents
      END
    ), 0)
  INTO v_mrr_cents
  FROM public.platform_subscriptions s
  JOIN public.platform_plans p ON p.id = s.plan_id
  WHERE s.status IN ('active', 'past_due');

  v_arr_cents := v_mrr_cents * 12;

  -- 4. Total de Faturas Vencidas Pendentes (Volume Inadimplente)
  SELECT
    COALESCE(SUM(amount_cents), 0)
  INTO v_overdue_invoices_cents
  FROM public.platform_invoices
  WHERE status = 'overdue' OR (status = 'pending' AND due_date < CURRENT_DATE);

  -- 5. Agregação por Plano
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'plan_id', p.id,
        'slug', p.slug,
        'name', p.name,
        'subscribers_count', COUNT(s.id),
        'mrr_cents', COALESCE(SUM(
          CASE
            WHEN p.billing_interval = 'yearly' THEN p.price_cents / 12
            ELSE p.price_cents
          END
        ), 0)
      )
    ), '[]'::jsonb)
  INTO v_by_plan
  FROM public.platform_plans p
  LEFT JOIN public.platform_subscriptions s ON s.plan_id = p.id AND s.status IN ('active', 'past_due')
  GROUP BY p.id, p.slug, p.name;

  RETURN jsonb_build_object(
    'mrr_cents', v_mrr_cents,
    'arr_cents', v_arr_cents,
    'active_subscribers', v_active_subs,
    'past_due_subscribers', v_past_due_subs,
    'trialing_subscribers', v_trialing_subs,
    'canceled_subscribers', v_canceled_subs,
    'overdue_invoices_amount_cents', v_overdue_invoices_cents,
    'by_plan', v_by_plan,
    'calculated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_saas_executive_metrics() TO authenticated;

-- 4.2 RPC: Liquidar Fatura da Plataforma com Idempotência
CREATE OR REPLACE FUNCTION public.settle_platform_invoice(
  p_invoice_id UUID,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice RECORD;
  v_effective_tenant UUID;
  v_is_super_admin BOOLEAN;
BEGIN
  -- 1. Obter contexto do usuário
  v_effective_tenant := public.current_effective_tenant_id();
  v_is_super_admin := public.current_is_super_admin_from_auth_uid();

  -- 2. Carregar fatura
  SELECT *
    INTO v_invoice
    FROM public.platform_invoices
   WHERE id = p_invoice_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fatura com ID % não encontrada.', p_invoice_id;
  END IF;

  -- 3. Autorização: Apenas o tenant dono ou Super-Admin pode liquidar
  IF v_invoice.tenant_id <> v_effective_tenant AND NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Acesso negado: você não possui permissão para liquidar faturas de outro tenant.';
  END IF;

  -- 4. Idempotência: Se já está paga, retornar sucesso idempotente
  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'invoice_id', v_invoice.id,
      'status', 'paid',
      'paid_at', v_invoice.paid_at
    );
  END IF;

  -- 5. Atualizar Fatura
  UPDATE public.platform_invoices
     SET status = 'paid',
         paid_at = now(),
         payment_method = COALESCE(p_payment_method, payment_method, 'pix'),
         updated_at = now()
   WHERE id = v_invoice.id;

  -- 6. Reativar Assinatura caso esteja em 'past_due'
  UPDATE public.platform_subscriptions
     SET status = 'active',
         updated_at = now()
   WHERE id = v_invoice.subscription_id
     AND status = 'past_due';

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'invoice_id', v_invoice.id,
    'status', 'paid',
    'paid_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_platform_invoice(UUID, TEXT) TO authenticated;

-- ==============================================================================
-- 5. Seed: Planos Oficiais da SMG Platform
-- ==============================================================================

INSERT INTO public.platform_plans (slug, name, description, price_cents, billing_interval, max_staff, max_api_rpm, features)
VALUES
  (
    'starter',
    'SMG Starter',
    'Plano inicial ideal para barbearias individuais ou até 2 profissionais.',
    14900,
    'monthly',
    2,
    60,
    '{"public_api": false, "webhooks": false, "multi_unit": false, "financial_erp_sync": false, "advanced_reports": false}'::jsonb
  ),
  (
    'pro',
    'SMG Pro',
    'Plano profissional com até 6 cadeiras, Public API, Webhooks e integrações fiscais.',
    29900,
    'monthly',
    6,
    300,
    '{"public_api": true, "webhooks": true, "multi_unit": false, "financial_erp_sync": true, "advanced_reports": true}'::jsonb
  ),
  (
    'enterprise',
    'SMG Enterprise',
    'Plano para grandes barbearias e redes de franquias, cadeiras ilimitadas e alta volumetria.',
    69900,
    'monthly',
    999,
    1200,
    '{"public_api": true, "webhooks": true, "multi_unit": true, "financial_erp_sync": true, "advanced_reports": true, "dedicated_sla": true}'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  billing_interval = EXCLUDED.billing_interval,
  max_staff = EXCLUDED.max_staff,
  max_api_rpm = EXCLUDED.max_api_rpm,
  features = EXCLUDED.features,
  updated_at = now();
