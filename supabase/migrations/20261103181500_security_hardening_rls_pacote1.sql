-- =============================================================================
-- Migration: 20261103181500_security_hardening_rls_pacote1.sql
-- Pacote 1 de Segurança: Ativação de RLS, Blindagem Financeira e Menor Privilégio
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BLOCO 1: Ativação de RLS em schemas secundários (club e platform)
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS club.customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS club.customer_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_club_subscriptions ON club.customer_subscriptions;
CREATE POLICY tenant_isolation_club_subscriptions ON club.customer_subscriptions
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid())
  WITH CHECK (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid());

DROP POLICY IF EXISTS tenant_isolation_club_credits ON club.customer_credits;
CREATE POLICY tenant_isolation_club_credits ON club.customer_credits
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid())
  WITH CHECK (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid());

-- Tabelas do schema platform (acesso restrito a superadmin)
ALTER TABLE IF EXISTS platform.platform_user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform.platform_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform.platform_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform.platform_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform.platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform.platform_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform.platform_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform.platform_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform.platform_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform.platform_api_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform.platform_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform.platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform.platform_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform.platform_jobs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'platform'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS platform_superadmin_all ON platform.%I', t);
    EXECUTE format('CREATE POLICY platform_superadmin_all ON platform.%I FOR ALL TO authenticated USING (public.current_is_super_admin_from_auth_uid()) WITH CHECK (public.current_is_super_admin_from_auth_uid())', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- BLOCO 2: Fechamento de brechas públicas em portal_sessions
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can insert portal sessions upon auth" ON public.portal_sessions;
DROP POLICY IF EXISTS "Public can select portal sessions for validation" ON public.portal_sessions;
DROP POLICY IF EXISTS "Public can update active portal sessions" ON public.portal_sessions;

-- Apenas gestores do tenant ou superadmin podem consultar/auditar sessões diretamente
DROP POLICY IF EXISTS "portal_sessions_manager_select" ON public.portal_sessions;
CREATE POLICY "portal_sessions_manager_select" ON public.portal_sessions
  FOR SELECT TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid() OR
    (tenant_id = public.current_tenant_id_from_auth_uid() AND public.current_is_manager_from_auth_uid(tenant_id))
  );

-- -----------------------------------------------------------------------------
-- BLOCO 3: Isolamento estrito de tenant em event_store, outbox_items e processed_operations
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS event_store_tenant_insert ON public.event_store;
CREATE POLICY event_store_tenant_insert ON public.event_store
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id_from_auth_uid() OR
    public.current_is_super_admin_from_auth_uid()
  );

DROP POLICY IF EXISTS outbox_items_tenant_insert ON public.outbox_items;
CREATE POLICY outbox_items_tenant_insert ON public.outbox_items
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id_from_auth_uid() OR
    public.current_is_super_admin_from_auth_uid()
  );

DROP POLICY IF EXISTS processed_operations_tenant_insert ON public.processed_operations;
CREATE POLICY processed_operations_tenant_insert ON public.processed_operations
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id_from_auth_uid() OR
    public.current_is_super_admin_from_auth_uid()
  );

-- -----------------------------------------------------------------------------
-- BLOCO 4: Blindagem das tabelas financeiras e de saldos (Menor Privilégio)
-- -----------------------------------------------------------------------------

-- 4.1. transactions (Livro-Razão)
DROP POLICY IF EXISTS tenant_isolation_transactions_v2 ON public.transactions;

CREATE POLICY transactions_tenant_select ON public.transactions
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid());

CREATE POLICY transactions_manager_mutation ON public.transactions
  FOR ALL TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid() OR
    (tenant_id = public.current_tenant_id_from_auth_uid() AND public.current_is_manager_from_auth_uid(tenant_id))
  )
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid() OR
    (tenant_id = public.current_tenant_id_from_auth_uid() AND public.current_is_manager_from_auth_uid(tenant_id))
  );

-- 4.2. accounts_payable (Contas a Pagar)
DROP POLICY IF EXISTS tenant_isolation_accounts_payable ON public.accounts_payable;

CREATE POLICY accounts_payable_tenant_select ON public.accounts_payable
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid());

CREATE POLICY accounts_payable_manager_mutation ON public.accounts_payable
  FOR ALL TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid() OR
    (tenant_id = public.current_tenant_id_from_auth_uid() AND public.current_is_manager_from_auth_uid(tenant_id))
  )
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid() OR
    (tenant_id = public.current_tenant_id_from_auth_uid() AND public.current_is_manager_from_auth_uid(tenant_id))
  );

-- 4.3. customer_credits (Créditos de Clube)
DROP POLICY IF EXISTS customer_credits_tenant_isolation ON public.customer_credits;
DROP POLICY IF EXISTS customer_credits_tenant_isolation_v2 ON public.customer_credits;

CREATE POLICY customer_credits_tenant_select ON public.customer_credits
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid());

CREATE POLICY customer_credits_manager_mutation ON public.customer_credits
  FOR ALL TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid() OR
    (tenant_id = public.current_tenant_id_from_auth_uid() AND public.current_is_manager_from_auth_uid(tenant_id))
  )
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid() OR
    (tenant_id = public.current_tenant_id_from_auth_uid() AND public.current_is_manager_from_auth_uid(tenant_id))
  );

-- 4.4. customer_subscriptions (Assinaturas de Clube)
DROP POLICY IF EXISTS customer_subscriptions_tenant_isolation ON public.customer_subscriptions;

CREATE POLICY customer_subscriptions_tenant_select ON public.customer_subscriptions
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id_from_auth_uid() OR public.current_is_super_admin_from_auth_uid());

CREATE POLICY customer_subscriptions_manager_mutation ON public.customer_subscriptions
  FOR ALL TO authenticated
  USING (
    public.current_is_super_admin_from_auth_uid() OR
    (tenant_id = public.current_tenant_id_from_auth_uid() AND public.current_is_manager_from_auth_uid(tenant_id))
  )
  WITH CHECK (
    public.current_is_super_admin_from_auth_uid() OR
    (tenant_id = public.current_tenant_id_from_auth_uid() AND public.current_is_manager_from_auth_uid(tenant_id))
  );
