BEGIN;

-- ============================================================================
-- Migration: fix_rls_legacy_and_kiosk_policies
-- Date: 2026-07-15
-- Description:
--   1. Corrige 8 policies LEGADAS que usam get_current_tenant_id() — substitui
--      por current_tenant_id_from_auth_uid() com bypass de superadmin.
--   2. Corrige 5 policies de kiosk/participants que usam USING (true) — substitui
--      por isolamento de tenant com superadmin bypass.
--   3. Corrige service_execution_participants que usa current_setting() broken —
--      substitui por current_tenant_id_from_auth_uid().
--   4. Remove policies duplicadas em transactions — mantém apenas ALL com superadmin.
--   5. Revoga permissão de INSERT para anon em service_execution_participants.
-- ============================================================================

-- ============================================================================
-- 1. CORRIGIR POLICIES LEGADAS (get_current_tenant_id → current_tenant_id_from_auth_uid)
-- ============================================================================

-- 1.1 audit_logs
DROP POLICY IF EXISTS "Managers can view tenant audit logs" ON public.audit_logs;
CREATE POLICY "Managers can view tenant audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- 1.2 products
DROP POLICY IF EXISTS "tenant isolation products" ON public.products;
CREATE POLICY "tenant_isolation_products_v2"
ON public.products
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

DROP POLICY IF EXISTS "tenant_isolation_products_insert" ON public.products;
CREATE POLICY "tenant_isolation_products_insert_v2"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- 1.3 profiles
DROP POLICY IF EXISTS "tenant_isolation_profiles_select" ON public.profiles;
CREATE POLICY "tenant_isolation_profiles_select_v2"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR id = auth.uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

DROP POLICY IF EXISTS "tenant_isolation_profiles_insert" ON public.profiles;
CREATE POLICY "tenant_isolation_profiles_insert_v2"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

DROP POLICY IF EXISTS "tenant_isolation_profiles_update" ON public.profiles;
CREATE POLICY "tenant_isolation_profiles_update_v2"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR id = auth.uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR id = auth.uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- 1.4 promotions
DROP POLICY IF EXISTS "tenant_isolation_promotions" ON public.promotions;
CREATE POLICY "tenant_isolation_promotions_v2"
ON public.promotions
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

DROP POLICY IF EXISTS "tenant_isolation_promotions_insert" ON public.promotions;
CREATE POLICY "tenant_isolation_promotions_insert_v2"
ON public.promotions
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- 1.5 purchase_orders
DROP POLICY IF EXISTS "tenant isolation purchase_orders" ON public.purchase_orders;
CREATE POLICY "tenant_isolation_purchase_orders_v2"
ON public.purchase_orders
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- 1.6 services
DROP POLICY IF EXISTS "tenant_isolation_services" ON public.services;
CREATE POLICY "tenant_isolation_services_v2"
ON public.services
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

DROP POLICY IF EXISTS "tenant_isolation_services_insert" ON public.services;
CREATE POLICY "tenant_isolation_services_insert_v2"
ON public.services
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- 1.7 suppliers
DROP POLICY IF EXISTS "tenant isolation suppliers" ON public.suppliers;
CREATE POLICY "tenant_isolation_suppliers_v2"
ON public.suppliers
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- 1.8 support_tickets
DROP POLICY IF EXISTS "tenant_ticket_isolation" ON public.support_tickets;
CREATE POLICY "tenant_ticket_isolation_v2"
ON public.support_tickets
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
  OR user_id = auth.uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- ============================================================================
-- 2. CORRIGIR POLICIES DE KIOSK (USING true → tenant_id com superadmin)
-- ============================================================================

-- 2.1 kiosk_devices
DROP POLICY IF EXISTS "kiosk_devices_all" ON public.kiosk_devices;
CREATE POLICY "kiosk_devices_tenant_isolation"
ON public.kiosk_devices
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- 2.2 kiosk_sessions
DROP POLICY IF EXISTS "kiosk_sessions_all" ON public.kiosk_sessions;
CREATE POLICY "kiosk_sessions_tenant_isolation"
ON public.kiosk_sessions
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- 2.3 feedback_barber
DROP POLICY IF EXISTS "feedback_barber_all" ON public.feedback_barber;
CREATE POLICY "feedback_barber_tenant_isolation"
ON public.feedback_barber
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- 2.4 feedback_shop
DROP POLICY IF EXISTS "feedback_shop_all" ON public.feedback_shop;
CREATE POLICY "feedback_shop_tenant_isolation"
ON public.feedback_shop
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- ============================================================================
-- 3. CORRIGIR service_execution_participants (current_setting → correta)
-- ============================================================================

-- 3.1 Remover policy aberta duplicada
DROP POLICY IF EXISTS "Allow full access to service_execution_participants" ON public.service_execution_participants;

-- 3.2 Substituir policies broken por corretas
DROP POLICY IF EXISTS "tenant_isolation_service_execution_participants" ON public.service_execution_participants;
CREATE POLICY "tenant_isolation_service_execution_participants_v2"
ON public.service_execution_participants
FOR SELECT
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

DROP POLICY IF EXISTS "tenant_isolation_service_execution_participants_insert" ON public.service_execution_participants;
CREATE POLICY "tenant_isolation_service_execution_participants_insert_v2"
ON public.service_execution_participants
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

DROP POLICY IF EXISTS "tenant_isolation_service_execution_participants_update" ON public.service_execution_participants;
CREATE POLICY "tenant_isolation_service_execution_participants_update_v2"
ON public.service_execution_participants
FOR UPDATE
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

DROP POLICY IF EXISTS "tenant_isolation_service_execution_participants_delete" ON public.service_execution_participants;
CREATE POLICY "tenant_isolation_service_execution_participants_delete_v2"
ON public.service_execution_participants
FOR DELETE
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- 3.3 Revogar permissão INSERT de anon (só authenticated deve criar)
REVOKE INSERT ON public.service_execution_participants FROM anon;

-- ============================================================================
-- 4. REMOVER POLICIES DUPLICADAS EM transactions
-- ============================================================================

-- Manter apenas tenant_isolation_transactions (ALL com superadmin bypass)
-- Remover as policies individuais duplicadas
DROP POLICY IF EXISTS "transactions_tenant_isolation" ON public.transactions;
DROP POLICY IF EXISTS "Tenant can read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Tenant can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Tenant can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Tenant can delete transactions" ON public.transactions;

-- Recriar a policy ALL correta (caso tenha sido removida acidentalmente)
DROP POLICY IF EXISTS "tenant_isolation_transactions" ON public.transactions;
CREATE POLICY "tenant_isolation_transactions_v2"
ON public.transactions
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- ============================================================================
-- 5. RECARGA DO CACHE DO POSTGREST
-- ============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
