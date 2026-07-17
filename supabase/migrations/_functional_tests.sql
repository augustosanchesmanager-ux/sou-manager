-- ============================================================================
-- TESTES FUNCIONAIS PÓS-MIGRATION — 2026-07-15
-- Execute NO SQL EDITOR do Supabase como SERVICE_ROLE ou autenticado
-- ============================================================================

-- ============================================================================
-- TESTE 1: Verificar que RLS está habilitado em transactions
-- ============================================================================
SELECT
  'TESTE 1: RLS transactions' AS teste,
  rowsecurity AS resultado,
  CASE WHEN rowsecurity = true THEN '✅ PASS' ELSE '❌ FAIL' END AS status
FROM pg_tables
WHERE tablename = 'transactions' AND schemaname = 'public';

-- ============================================================================
-- TESTE 2: Verificar que a política de transactions existe
-- ============================================================================
SELECT
  'TESTE 2: Policy transactions' AS teste,
  policyname,
  cmd AS operacao,
  qual AS using_expr,
  CASE WHEN qual LIKE '%current_tenant_id_from_auth_uid%' THEN '✅ PASS' ELSE '❌ FAIL' END AS status
FROM pg_policies
WHERE tablename = 'transactions' AND schemaname = 'public';

-- ============================================================================
-- TESTE 3: Verificar que comandas usa current_tenant_id_from_auth_uid
-- ============================================================================
SELECT
  'TESTE 3: Policy comandas' AS teste,
  policyname,
  cmd AS operacao,
  CASE WHEN qual LIKE '%current_tenant_id_from_auth_uid%' THEN '✅ PASS' ELSE '❌ FAIL: usa função legada' END AS status
FROM pg_policies
WHERE tablename = 'comandas' AND schemaname = 'public';

-- ============================================================================
-- TESTE 4: Verificar que comanda_items usa current_tenant_id_from_auth_uid
-- ============================================================================
SELECT
  'TESTE 4: Policy comanda_items' AS teste,
  policyname,
  cmd AS operacao,
  CASE WHEN qual LIKE '%current_tenant_id_from_auth_uid%' THEN '✅ PASS' ELSE '❌ FAIL: usa função legada' END AS status
FROM pg_policies
WHERE tablename = 'comanda_items' AND schemaname = 'public';

-- ============================================================================
-- TESTE 5: Garantir que profiles.status existe
-- ============================================================================
SELECT
  'TESTE 5: profiles.status existe' AS teste,
  column_name,
  data_type,
  column_default,
  '✅ PASS' AS status
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'status'
  AND table_schema = 'public';

-- ============================================================================
-- TESTE 6: Verificar função current_tenant_id_from_auth_uid existe
-- ============================================================================
SELECT
  'TESTE 6: Função current_tenant_id_from_auth_uid' AS teste,
  p.proname,
  p.prosecdef AS security_definer,
  CASE WHEN p.proname IS NOT NULL THEN '✅ PASS' ELSE '❌ FAIL' END AS status
FROM pg_proc p
WHERE p.proname = 'current_tenant_id_from_auth_uid'
  AND p.pronamespace = 'public'::regnamespace;

-- ============================================================================
-- TESTE 7: Verificar função current_is_super_admin_from_auth_uid existe
-- ============================================================================
SELECT
  'TESTE 7: Função current_is_super_admin_from_auth_uid' AS teste,
  p.proname,
  p.prosecdef AS security_definer,
  CASE WHEN p.proname IS NOT NULL THEN '✅ PASS' ELSE '❌ FAIL' END AS status
FROM pg_proc p
WHERE p.proname = 'current_is_super_admin_from_auth_uid'
  AND p.pronamespace = 'public'::regnamespace;

-- ============================================================================
-- TESTE 8: Listar tabelas SEM RLS que têm tenant_id (vulnerabilidade)
-- ============================================================================
SELECT
  'TESTE 8: Tabelas com tenant_id SEM RLS' AS teste,
  c.table_name,
  '❌ VULNERÁVEL' AS status
FROM information_schema.columns c
LEFT JOIN pg_tables t ON t.tablename = c.table_name AND t.schemaname = 'public'
WHERE c.table_schema = 'public'
  AND c.column_name = 'tenant_id'
  AND (t.rowsecurity = false OR t.rowsecurity IS NULL);

-- ============================================================================
-- TESTE 9: Listar policies com USING (true) — sem isolamento
-- ============================================================================
SELECT
  'TESTE 9: Policies USING(true) - sem isolamento' AS teste,
  tablename,
  policyname,
  cmd,
  '🔴 SEM ISOLAMENTO' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = '(true)';

-- ============================================================================
-- TESTE 10: Listar policies usando current_setting (broken)
-- ============================================================================
SELECT
  'TESTE 10: Policies com current_setting (broken)' AS teste,
  tablename,
  policyname,
  cmd,
  qual,
  '🔴 BROKEN' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual LIKE '%current_setting%' OR with_check LIKE '%current_setting%');

-- ============================================================================
-- TESTE 11: Todas as tabelas com RLS e seus counts de policies
-- ============================================================================
SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename AND p.schemaname = 'public') AS total_policies,
  CASE
    WHEN t.rowsecurity = false THEN '❌ SEM RLS'
    WHEN (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename AND p.schemaname = 'public') = 0 THEN '⚠️ RLS SEM POLICIES'
    ELSE '✅ OK'
  END AS status
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY
  CASE
    WHEN t.rowsecurity = false THEN 0
    WHEN (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename AND p.schemaname = 'public') = 0 THEN 1
    ELSE 2
  END,
  t.tablename;

-- ============================================================================
-- TESTE 12: Resumo executivo da auditoria
-- ============================================================================
SELECT
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') AS total_tabelas,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true) AS com_rls,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false) AS sem_rls,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS total_policies,
  (SELECT COUNT(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prokind = 'f') AS total_funcoes,
  (SELECT COUNT(*) FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND NOT t.tgisinternal) AS total_triggers,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') AS total_indices,
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public') AS total_foreign_keys;
