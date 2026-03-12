
-- =====================================================
-- FIX: Replace all inline subquery RLS policies with 
-- get_current_tenant_id() (SECURITY DEFINER function)
-- to prevent recursive RLS evaluation on profiles table
-- =====================================================

-- 1) Fix profiles table: Remove the recursive "Superadmins can view all profiles" policy
-- and replace with a non-recursive version
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON public.profiles;

-- Recreate superadmin policy using auth.uid() metadata instead of recursive query
CREATE POLICY "Superadmins can view all profiles" ON public.profiles
  FOR SELECT
  USING (
    (role IN ('Super Admin', 'superadmin'))
    OR (id = auth.uid())
  );

-- Fix tenant_isolation_profiles_select to avoid recursion
DROP POLICY IF EXISTS "tenant_isolation_profiles_select" ON public.profiles;
CREATE POLICY "tenant_isolation_profiles_select" ON public.profiles
  FOR SELECT
  USING (id = auth.uid() OR tenant_id = get_current_tenant_id());

-- 2) Fix appointments
DROP POLICY IF EXISTS "tenant_isolation_appointments" ON public.appointments;
CREATE POLICY "tenant_isolation_appointments" ON public.appointments
  FOR ALL USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_appointments_insert" ON public.appointments;
CREATE POLICY "tenant_isolation_appointments_insert" ON public.appointments
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- 3) Fix audit_logs
DROP POLICY IF EXISTS "Managers can view tenant audit logs" ON public.audit_logs;
CREATE POLICY "Managers can view tenant audit logs" ON public.audit_logs
  FOR SELECT USING (tenant_id = get_current_tenant_id());

-- 4) Fix clients
DROP POLICY IF EXISTS "tenant_isolation_clients" ON public.clients;
CREATE POLICY "tenant_isolation_clients" ON public.clients
  FOR ALL USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_clients_insert" ON public.clients;
CREATE POLICY "tenant_isolation_clients_insert" ON public.clients
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- 5) Fix comanda_items
DROP POLICY IF EXISTS "tenant_isolation_comanda_items" ON public.comanda_items;
CREATE POLICY "tenant_isolation_comanda_items" ON public.comanda_items
  FOR ALL USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_comanda_items_insert" ON public.comanda_items;
CREATE POLICY "tenant_isolation_comanda_items_insert" ON public.comanda_items
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- 6) Fix comandas
DROP POLICY IF EXISTS "tenant_isolation_comandas" ON public.comandas;
CREATE POLICY "tenant_isolation_comandas" ON public.comandas
  FOR ALL USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_comandas_insert" ON public.comandas;
CREATE POLICY "tenant_isolation_comandas_insert" ON public.comandas
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- 7) Fix notifications
DROP POLICY IF EXISTS "tenant isolation notifications" ON public.notifications;
CREATE POLICY "tenant isolation notifications" ON public.notifications
  FOR ALL USING (tenant_id = get_current_tenant_id());

-- 8) Fix products
DROP POLICY IF EXISTS "tenant isolation products" ON public.products;
CREATE POLICY "tenant isolation products" ON public.products
  FOR ALL USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_products_insert" ON public.products;
CREATE POLICY "tenant_isolation_products_insert" ON public.products
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- 9) Fix promotions
DROP POLICY IF EXISTS "tenant_isolation_promotions" ON public.promotions;
CREATE POLICY "tenant_isolation_promotions" ON public.promotions
  FOR ALL USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_promotions_insert" ON public.promotions;
CREATE POLICY "tenant_isolation_promotions_insert" ON public.promotions
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- 10) Fix purchase_orders
DROP POLICY IF EXISTS "tenant isolation purchase_orders" ON public.purchase_orders;
CREATE POLICY "tenant isolation purchase_orders" ON public.purchase_orders
  FOR ALL USING (tenant_id = get_current_tenant_id());

-- 11) Fix services
DROP POLICY IF EXISTS "tenant_isolation_services" ON public.services;
CREATE POLICY "tenant_isolation_services" ON public.services
  FOR ALL USING (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_services_insert" ON public.services;
CREATE POLICY "tenant_isolation_services_insert" ON public.services
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- 12) Fix suppliers
DROP POLICY IF EXISTS "tenant isolation suppliers" ON public.suppliers;
CREATE POLICY "tenant isolation suppliers" ON public.suppliers
  FOR ALL USING (tenant_id = get_current_tenant_id());

-- 13) Fix support_tickets
DROP POLICY IF EXISTS "tenant_ticket_isolation" ON public.support_tickets;
CREATE POLICY "tenant_ticket_isolation" ON public.support_tickets
  FOR ALL USING (tenant_id = get_current_tenant_id() OR user_id = auth.uid());

-- 14) Fix tenants
DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;
CREATE POLICY "Users can view their tenant" ON public.tenants
  FOR SELECT USING (id = get_current_tenant_id());
;
