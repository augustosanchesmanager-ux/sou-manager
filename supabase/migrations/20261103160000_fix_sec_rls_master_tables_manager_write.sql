-- ============================================================================
-- Migration: 20261103160000_fix_sec_rls_master_tables_manager_write.sql
-- Issue #223 / F2.1: Mutações diretas via Supabase REST API em tabelas mestres
--                    sem validação de papel gerencial
--
-- Alinha as políticas de RLS de escrita (INSERT, UPDATE, DELETE) com os gates
-- de rota do frontend (ManagerRoute). Apenas gestores (owner, admin, manager, gerente)
-- ou superadmin podem inserir, alterar ou excluir registros em tabelas de catálogo/mestres:
--   - public.services
--   - public.products
--   - public.suppliers
--   - public.payment_terminals
--
-- A leitura (SELECT) permanece permitida a todos os membros autenticados do tenant
-- para operacionalização de agenda, comandas, estoque e PDV.
-- ============================================================================

-- 1. Assegurar helper canônico de verificação de papel gerencial
CREATE OR REPLACE FUNCTION public.current_is_manager_from_auth_uid(
    p_tenant_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_tenants ut
        WHERE ut.user_id = auth.uid()
          AND ut.tenant_id = p_tenant_id
          AND LOWER(BTRIM(COALESCE(ut.role, ''))) IN
              ('owner', 'admin', 'manager', 'gerente')
    )
    OR (
        public.current_tenant_id_from_auth_uid() = p_tenant_id
        AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND LOWER(BTRIM(COALESCE(p.role, ''))) IN
                  ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
        )
    );
$$;

REVOKE ALL ON FUNCTION public.current_is_manager_from_auth_uid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_is_manager_from_auth_uid(UUID) TO authenticated;

-- ============================================================================
-- 2. Tabela: public.services
-- ============================================================================
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_services" ON public.services;
DROP POLICY IF EXISTS "tenant_isolation_services_insert" ON public.services;
DROP POLICY IF EXISTS "services_tenant_isolation" ON public.services;
DROP POLICY IF EXISTS "services_select_tenant" ON public.services;
DROP POLICY IF EXISTS "services_insert_manager" ON public.services;
DROP POLICY IF EXISTS "services_update_manager" ON public.services;
DROP POLICY IF EXISTS "services_delete_manager" ON public.services;

-- Leitura: Qualquer membro autenticado do mesmo tenant (ou superadmin)
CREATE POLICY "services_select_tenant" ON public.services
    FOR SELECT TO authenticated
    USING (
        public.current_is_super_admin_from_auth_uid()
        OR tenant_id = public.current_tenant_id_from_auth_uid()
    );

-- Escrita: Apenas gestores do tenant ou superadmin
CREATE POLICY "services_insert_manager" ON public.services
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

CREATE POLICY "services_update_manager" ON public.services
    FOR UPDATE TO authenticated
    USING (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    )
    WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

CREATE POLICY "services_delete_manager" ON public.services
    FOR DELETE TO authenticated
    USING (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

-- ============================================================================
-- 3. Tabela: public.products
-- ============================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant isolation products" ON public.products;
DROP POLICY IF EXISTS "tenant_isolation_products_insert" ON public.products;
DROP POLICY IF EXISTS "products_select_tenant" ON public.products;
DROP POLICY IF EXISTS "products_insert_manager" ON public.products;
DROP POLICY IF EXISTS "products_update_manager" ON public.products;
DROP POLICY IF EXISTS "products_delete_manager" ON public.products;

-- Leitura: Qualquer membro autenticado do mesmo tenant (ou superadmin)
CREATE POLICY "products_select_tenant" ON public.products
    FOR SELECT TO authenticated
    USING (
        public.current_is_super_admin_from_auth_uid()
        OR tenant_id = public.current_tenant_id_from_auth_uid()
    );

-- Escrita: Apenas gestores do tenant ou superadmin
CREATE POLICY "products_insert_manager" ON public.products
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

CREATE POLICY "products_update_manager" ON public.products
    FOR UPDATE TO authenticated
    USING (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    )
    WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

CREATE POLICY "products_delete_manager" ON public.products
    FOR DELETE TO authenticated
    USING (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

-- ============================================================================
-- 4. Tabela: public.suppliers
-- ============================================================================
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant isolation suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_select_tenant" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_insert_manager" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update_manager" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_delete_manager" ON public.suppliers;

CREATE POLICY "suppliers_select_tenant" ON public.suppliers
    FOR SELECT TO authenticated
    USING (
        public.current_is_super_admin_from_auth_uid()
        OR tenant_id = public.current_tenant_id_from_auth_uid()
    );

CREATE POLICY "suppliers_insert_manager" ON public.suppliers
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

CREATE POLICY "suppliers_update_manager" ON public.suppliers
    FOR UPDATE TO authenticated
    USING (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    )
    WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

CREATE POLICY "suppliers_delete_manager" ON public.suppliers
    FOR DELETE TO authenticated
    USING (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

-- ============================================================================
-- 5. Tabela: public.payment_terminals
-- ============================================================================
ALTER TABLE public.payment_terminals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_terminals_insert_tenant" ON public.payment_terminals;
DROP POLICY IF EXISTS "payment_terminals_update_tenant" ON public.payment_terminals;
DROP POLICY IF EXISTS "payment_terminals_delete_tenant" ON public.payment_terminals;
DROP POLICY IF EXISTS "payment_terminals_insert_manager" ON public.payment_terminals;
DROP POLICY IF EXISTS "payment_terminals_update_manager" ON public.payment_terminals;
DROP POLICY IF EXISTS "payment_terminals_delete_manager" ON public.payment_terminals;

CREATE POLICY "payment_terminals_insert_manager" ON public.payment_terminals
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

CREATE POLICY "payment_terminals_update_manager" ON public.payment_terminals
    FOR UPDATE TO authenticated
    USING (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    )
    WITH CHECK (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );

CREATE POLICY "payment_terminals_delete_manager" ON public.payment_terminals
    FOR DELETE TO authenticated
    USING (
        public.current_is_super_admin_from_auth_uid()
        OR (
            tenant_id = public.current_tenant_id_from_auth_uid()
            AND public.current_is_manager_from_auth_uid(tenant_id)
        )
    );
