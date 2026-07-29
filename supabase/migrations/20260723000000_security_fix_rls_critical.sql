-- ============================================================
-- SECURITY FIX: Fase 3.3.1 — RLS Critical Issues
-- 
-- Fixes:
-- 1. Add superadmin bypass to cash_closings, barber_closings, cash_closing_events
-- 2. Replace legacy get_current_tenant_id() with current_tenant_id_from_auth_uid()
--    in role_permissions and tenants policies
-- ============================================================

-- ─── 1. Cash Closing Tables: Add superadmin bypass ─────────────

-- cash_closings
DROP POLICY IF EXISTS "Users can manage own tenant cash closings" ON public.cash_closings;
CREATE POLICY "tenant_isolation_cash_closings" ON public.cash_closings
    FOR ALL TO authenticated
    USING (
        current_is_super_admin_from_auth_uid()
        OR tenant_id = current_tenant_id_from_auth_uid()
    )
    WITH CHECK (
        current_is_super_admin_from_auth_uid()
        OR tenant_id = current_tenant_id_from_auth_uid()
    );

-- barber_closings
DROP POLICY IF EXISTS "barber_closings_tenant_isolation" ON public.barber_closings;
CREATE POLICY "barber_closings_tenant_isolation" ON public.barber_closings
    FOR ALL TO authenticated
    USING (
        current_is_super_admin_from_auth_uid()
        OR tenant_id = current_tenant_id_from_auth_uid()
    )
    WITH CHECK (
        current_is_super_admin_from_auth_uid()
        OR tenant_id = current_tenant_id_from_auth_uid()
    );

-- cash_closing_events
DROP POLICY IF EXISTS "cash_closing_events_tenant_isolation" ON public.cash_closing_events;
CREATE POLICY "cash_closing_events_tenant_isolation" ON public.cash_closing_events
    FOR ALL TO authenticated
    USING (
        current_is_super_admin_from_auth_uid()
        OR tenant_id = current_tenant_id_from_auth_uid()
    )
    WITH CHECK (
        current_is_super_admin_from_auth_uid()
        OR tenant_id = current_tenant_id_from_auth_uid()
    );

-- ─── 2. Replace legacy get_current_tenant_id() ────────────────

-- tenants table
DROP POLICY IF EXISTS "Users can view their tenant" ON public.tenants;
CREATE POLICY "tenant_isolation_tenants_select" ON public.tenants
    FOR SELECT TO authenticated
    USING (
        current_is_super_admin_from_auth_uid()
        OR id = current_tenant_id_from_auth_uid()
    );

-- role_permissions table
DROP POLICY IF EXISTS "Managers can view role_permissions" ON public.role_permissions;
CREATE POLICY "Managers can view role_permissions" ON public.role_permissions
    FOR SELECT TO authenticated
    USING (
        current_is_super_admin_from_auth_uid()
        OR tenant_id = current_tenant_id_from_auth_uid()
    );

DROP POLICY IF EXISTS "Managers can manage role_permissions" ON public.role_permissions;
CREATE POLICY "Managers can manage role_permissions" ON public.role_permissions
    FOR ALL TO authenticated
    USING (
        current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = current_tenant_id_from_auth_uid()
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND profiles.tenant_id = role_permissions.tenant_id
                AND profiles.role IN ('admin', 'manager')
            )
        )
    )
    WITH CHECK (
        current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = current_tenant_id_from_auth_uid()
            AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid()
                AND profiles.tenant_id = role_permissions.tenant_id
                AND profiles.role IN ('admin', 'manager')
            )
        )
    );
