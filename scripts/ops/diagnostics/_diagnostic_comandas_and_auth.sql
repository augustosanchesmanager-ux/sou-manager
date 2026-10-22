-- ============================================================
-- DIAGNÓSTICO: Comandas sub-queries + Employee creation
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Triggers no auth.users (causa provável do erro "Database error creating new user")
SELECT
  t.tgname AS trigger_name,
  t.tgenabled AS enabled,
  pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 2. Todas as funções de trigger que referenciam auth.users
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
WHERE p.proname LIKE '%user%' OR p.proname LIKE '%auth%'
  AND EXISTS (
    SELECT 1 FROM pg_depend d
    WHERE d.objid = p.oid AND d.deptype = 'n'
  )
  AND pg_get_functiondef(p.oid) LIKE '%auth.users%'
ORDER BY p.proname;

-- 3. RLS atual nas tabelas de comandas
SELECT
  schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('comandas', 'comanda_items', 'appointments', 'transactions')
ORDER BY tablename, policyname;

-- 4. Verificar se RLS está habilitado em transactions
SELECT
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname IN ('comandas', 'comanda_items', 'appointments', 'transactions', 'financial_reversals')
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY relname;

-- 5. Verificar a função current_tenant_id_from_auth_uid
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'current_tenant_id_from_auth_uid'
  AND n.nspname = 'public';

-- 6. Verificar a função current_is_super_admin_from_auth_uid
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'current_is_super_admin_from_auth_uid'
  AND n.nspname = 'public';

-- 7. Listar TODAS as triggers em auth schema
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  t.tgenabled AS enabled,
  pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth'
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- 8. Verificar se existem triggers BEFORE INSERT / AFTER INSERT no auth.users
-- que possam estar causando o erro "Database error creating new user"
SELECT
  t.tgname AS trigger_name,
  CASE t.tgtype & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
  CASE t.tgtype & 4 WHEN 4 THEN 'INSERT' WHEN 12 THEN 'INSERT OR UPDATE' ELSE 'OTHER' END AS event,
  pg_get_triggerdef(t.oid) AS full_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 9. Verificar a estrutura da tabela comanda_items
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'comanda_items'
ORDER BY ordinal_position;

-- 10. Verificar a estrutura da tabela transactions
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'transactions'
ORDER BY ordinal_position;

-- 11. Verificar constraints na tabela profiles (role CHECK constraint)
SELECT
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON con.conrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
  AND con.contype = 'c';

-- 12. Testar a função current_tenant_id_from_auth_uid para o usuário logado
-- (Execute enquanto estiver autenticado)
SELECT public.current_tenant_id_from_auth_uid() AS my_tenant_id;
