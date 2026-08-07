-- =====================================================
-- PHASE 6.0.5.2 — MODELAGEM DE PLANS (D-6.0.5-5)
-- Catálogo persistido: plans + features + plan_features
--
-- Autorização: escopo aprovado pelo PO em 2026-08-06
--   (PHASE_6_0_5_2_ENTRY_AUDIT §6) com acréscimo obrigatório do
--   contrato único `PlanCatalog` (ver ADR-013 §3.1/§4.11).
--
-- Fonte congelada do seed:
--   - Matriz por plano: `PLAN_FEATURES` (free 14 / pro 15 / premium 20),
--     6.0.5.1 certificada (commit 622a891)
--   - Catálogo de flags (nome/descrição/dependências): FEATURE_FLAGS_MODEL §3
--   - Limites: domain/billing/limits.ts (free=1 / pro=5 / premium=∞)
--
-- Decisões:
--   - FK TEXT por slug (nunca INT id) — mantém compatibilidade total com
--     RPCs/triggers/consumidores existentes (aditivo, sem quebra).
--   - `plan_features` carrega exclusivamente `FeatureKey` (20 flags);
--     `AppModuleSlug` (rota/UI, 21) é taxonomia distinta e NÃO entra aqui
--     (DIV-A da entry audit).
--   - Flags free `team`/`finance` = "habilitada com limite" (DIV-B): a flag
--     entra em `plan_features`, o limite em `plans.limits.max_staff`.
--   - `plans.price_cents` é PLACEHOLDER 0 — preços comerciais são decisão
--     do PO (preços reais só com gateway, futuro). Nenhuma leitura depende
--     de price_cents hoje.
--
-- Padrões: idempotente (IF NOT EXISTS / ON CONFLICT DO NOTHING /
-- DROP CONSTRAINT IF EXISTS); RLS tenant + superadmin bypass; grants
-- SELECT p/ authenticated e FULL p/ service_role (escrita via BillingService).
-- Sem migration runner: aplicada via Supabase CLI / dashboard.
-- =====================================================

-- =====================================================
-- 1) TABELAS
-- =====================================================

-- 1.1 plans — catálogo de planos (slug TEXT PK, nunca INT id)
CREATE TABLE IF NOT EXISTS public.plans (
  slug        text PRIMARY KEY,
  name        text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  limits      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plans_status_check CHECK (status IN ('active', 'archived'))
);

COMMENT ON COLUMN public.plans.price_cents IS
  'PLACEHOLDER 0 — preços comerciais definidos pelo PO (gateway futuro).';

-- 1.2 features — catálogo único de flags (FeatureKey, 20)
CREATE TABLE IF NOT EXISTS public.features (
  key          text PRIMARY KEY,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  category     text NOT NULL,
  dependencies text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT features_category_check CHECK (category IN ('core', 'financial', 'engagement', 'integration', 'admin'))
);

-- 1.3 plan_features — matriz F8: o plano conhece as flags (Regra 2)
CREATE TABLE IF NOT EXISTS public.plan_features (
  plan_slug  text NOT NULL REFERENCES public.plans(slug) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.features(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_slug, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_plan_features_feature
  ON public.plan_features (feature_key);

-- =====================================================
-- 2) SEED IDEMPOTENTE (ON CONFLICT DO NOTHING — re-run não duplica)
-- =====================================================

-- 2.1 plans (limites refletem domain/billing/limits.ts: free=1 / pro=5 / premium=∞)
INSERT INTO public.plans (slug, name, price_cents, limits, status) VALUES
  ('free',    'Free',    0, '{"max_staff": 1}'::jsonb,   'active'),
  ('pro',     'Pro',     0, '{"max_staff": 5}'::jsonb,   'active'),
  ('premium', 'Premium', 0, '{"max_staff": null}'::jsonb, 'active')
ON CONFLICT (slug) DO NOTHING;

-- 2.2 features — catálogo único (FEATURE_FLAGS_MODEL §3; só FeatureKey)
INSERT INTO public.features (key, name, description, category, dependencies) VALUES
  ('appointments', 'Agenda',                        'Agenda de agendamentos',               'core',       '{}'),
  ('pos',          'PDV',                           'PDV / Comandas / Checkout',            'core',       '{}'),
  ('clients',      'Clientes',                      'Cadastro de clientes',                 'core',       '{}'),
  ('services',     'Serviços',                      'Cadastro de serviços',                 'core',       '{}'),
  ('products',     'Produtos',                      'Cadastro de produtos',                 'core',       '{}'),
  ('team',         'Equipe',                        'Gestão de equipe',                     'core',       '{}'),
  ('dashboard',    'Dashboard',                     'Dashboard',                            'core',       '{appointments}'),
  ('finance',      'Financeiro',                    'Módulo financeiro',                    'financial',  '{pos}'),
  ('cash_closing', 'Fechamento de caixa',           'Fechamento de caixa',                  'financial',  '{finance}'),
  ('commissions',  'Comissões',                     'Comissões',                            'financial',  '{finance}'),
  ('receivables',  'Contas a receber',              'Contas a receber',                     'financial',  '{finance}'),
  ('expenses',     'Contas a pagar',                'Contas a pagar',                       'financial',  '{finance}'),
  ('chef_club',    'Club dos Chefes',               'Club dos Chefes (assinaturas)',        'engagement', '{clients}'),
  ('vouchers',     'Vales-presente',                'Vales-presente',                       'engagement', '{clients}'),
  ('promotions',   'Promoções',                     'Promoções',                            'engagement', '{}'),
  ('api',          'API REST',                      'API REST externa',                     'integration','{}'),
  ('whatsapp',     'WhatsApp',                      'Notificações WhatsApp',                'integration','{}'),
  ('marketplace',  'Marketplace',                   'Marketplace de fornecedores',          'integration','{products}'),
  ('multi_unit',   'Múltiplas unidades',            'Múltiplas unidades',                   'admin',      '{}'),
  ('bi',           'Business Intelligence',         'Business Intelligence',                'admin',      '{finance}')
ON CONFLICT (key) DO NOTHING;

-- 2.3 plan_features — matriz F8 congelada (PLAN_FEATURES: free 14 / pro 15 / premium 20)
-- Cada plano lista seu conjunto COMPLETO de flags ("o plano conhece as flags",
-- Regra 2) — espelho exato de PLAN_FEATURES, verificado por teste de regressão.
INSERT INTO public.plan_features (plan_slug, feature_key) VALUES
  -- free (14) — D-6.0.5-3: sem Chef Club, sem módulos Premium
  ('free', 'appointments'), ('free', 'pos'), ('free', 'clients'),
  ('free', 'services'), ('free', 'products'), ('free', 'team'),
  ('free', 'dashboard'), ('free', 'finance'), ('free', 'cash_closing'),
  ('free', 'commissions'), ('free', 'receivables'), ('free', 'expenses'),
  ('free', 'vouchers'), ('free', 'promotions'),
  -- pro (15) = free + chef_club
  ('pro', 'appointments'), ('pro', 'pos'), ('pro', 'clients'),
  ('pro', 'services'), ('pro', 'products'), ('pro', 'team'),
  ('pro', 'dashboard'), ('pro', 'finance'), ('pro', 'cash_closing'),
  ('pro', 'commissions'), ('pro', 'receivables'), ('pro', 'expenses'),
  ('pro', 'vouchers'), ('pro', 'promotions'), ('pro', 'chef_club'),
  -- premium (20) = pro + integrações e multi-unidade
  ('premium', 'appointments'), ('premium', 'pos'), ('premium', 'clients'),
  ('premium', 'services'), ('premium', 'products'), ('premium', 'team'),
  ('premium', 'dashboard'), ('premium', 'finance'), ('premium', 'cash_closing'),
  ('premium', 'commissions'), ('premium', 'receivables'), ('premium', 'expenses'),
  ('premium', 'vouchers'), ('premium', 'promotions'), ('premium', 'chef_club'),
  ('premium', 'bi'), ('premium', 'api'), ('premium', 'whatsapp'),
  ('premium', 'marketplace'), ('premium', 'multi_unit')
ON CONFLICT (plan_slug, feature_key) DO NOTHING;

-- =====================================================
-- 3) FK ADITIVA tenants.plan / subscriptions.plan → plans(slug)
--    (substitui os CHECKs; "fim dos slugs soltos")
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenants_plan_fkey'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_plan_fkey
      FOREIGN KEY (plan) REFERENCES public.plans(slug);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_plan_fkey'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_plan_fkey
      FOREIGN KEY (plan) REFERENCES public.plans(slug);
  END IF;
END;
$$;

-- CHECKs removidos (a FK garante os mesmos valores — free/pro/premium)
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- =====================================================
-- 4) RLS (catálogo de leitura global p/ authenticated; escrita só superadmin)
-- =====================================================

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'plans' AND policyname = 'plans_select_catalog') THEN
    CREATE POLICY "plans_select_catalog" ON public.plans FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'plans' AND policyname = 'plans_write_superadmin') THEN
    CREATE POLICY "plans_write_superadmin" ON public.plans FOR ALL
      USING (public.current_is_super_admin_from_auth_uid())
      WITH CHECK (public.current_is_super_admin_from_auth_uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'features' AND policyname = 'features_select_catalog') THEN
    CREATE POLICY "features_select_catalog" ON public.features FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'features' AND policyname = 'features_write_superadmin') THEN
    CREATE POLICY "features_write_superadmin" ON public.features FOR ALL
      USING (public.current_is_super_admin_from_auth_uid())
      WITH CHECK (public.current_is_super_admin_from_auth_uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'plan_features' AND policyname = 'plan_features_select_catalog') THEN
    CREATE POLICY "plan_features_select_catalog" ON public.plan_features FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'plan_features' AND policyname = 'plan_features_write_superadmin') THEN
    CREATE POLICY "plan_features_write_superadmin" ON public.plan_features FOR ALL
      USING (public.current_is_super_admin_from_auth_uid())
      WITH CHECK (public.current_is_super_admin_from_auth_uid());
  END IF;
END;
$$;

-- =====================================================
-- 5) GRANTS (leitura p/ authenticated; escrita via BillingService)
-- =====================================================

GRANT SELECT ON public.plans, public.features, public.plan_features TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans, public.features, public.plan_features TO service_role;
