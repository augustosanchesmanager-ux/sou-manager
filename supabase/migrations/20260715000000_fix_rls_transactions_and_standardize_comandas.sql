BEGIN;

-- ============================================================================
-- Migration: fix_rls_transactions_and_standardize_comandas
-- Date: 2026-07-15
-- Description:
--   1. Habilita RLS na tabela transactions (criada sem ENABLE ROW LEVEL
--      SECURITY) e cria política de isolamento por tenant.
--   2. Padroniza RLS de comandas e comanda_items para usar
--      current_tenant_id_from_auth_uid() em vez de get_current_tenant_id(),
--      que só verifica a tabela profiles. Isso garante que funcionários
--      criados via Edge Function (que existem apenas em staff) possam
--      ler comandas e itens.
--   3. Garante que a coluna status existe em profiles (usada por
--      get_auth_access_context mas sem migração explícita).
-- ============================================================================

-- 1) Fix transactions: habilitar RLS + criar política
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_transactions" ON public.transactions;
CREATE POLICY "tenant_isolation_transactions"
ON public.transactions
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);

-- 2) Fix comandas: substituir get_current_tenant_id() por current_tenant_id_from_auth_uid()
DROP POLICY IF EXISTS "tenant_isolation_comandas" ON public.comandas;
CREATE POLICY "tenant_isolation_comandas"
ON public.comandas
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

-- 3) Fix comanda_items: substituir get_current_tenant_id() por current_tenant_id_from_auth_uid()
DROP POLICY IF EXISTS "tenant_isolation_comanda_items" ON public.comanda_items;
CREATE POLICY "tenant_isolation_comanda_items"
ON public.comanda_items
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

-- 4) Garantir que profiles.status existe
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 5) PostgREST cache reload
NOTIFY pgrst, 'reload schema';

COMMIT;
