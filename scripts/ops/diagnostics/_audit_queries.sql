-- ============================================================================
-- AUDITORIA COMPLETA DO BANCO DE DADOS — PÓS-MIGRATION 20260715
-- Execute este script no Supabase SQL Editor e salve o resultado
-- ============================================================================

-- ============================================================================
-- 1. TABLES COM RLS HABILITADO vs NÃO HABILITADO
-- ============================================================================
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity DESC, tablename;

-- ============================================================================
-- 2. TODAS AS POLICIES POR TABELA E OPERAÇÃO
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS operacao,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- 3. POLICIES AGRUPADAS POR TABELA (resumo executivo)
-- ============================================================================
SELECT
  tablename,
  COUNT(*) AS total_policies,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') AS select_policies,
  COUNT(*) FILTER (WHERE cmd = 'INSERT') AS insert_policies,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') AS update_policies,
  COUNT(*) FILTER (WHERE cmd = 'DELETE') AS delete_policies,
  COUNT(*) FILTER (WHERE cmd = 'ALL') AS all_policies,
  STRING_AGG(DISTINCT policyname, ', ' ORDER BY policyname) AS policy_names
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- 4. FUNÇÕES SQL UTILIZADAS PELAS POLICIES
-- ============================================================================
SELECT
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  p.prosecdef AS is_security_definer,
  l.lanname AS language,
  obj_description(p.oid) AS description
FROM pg_proc p
JOIN pg_language l ON p.prolang = l.oid
WHERE p.pronamespace = 'public'::regnamespace
  AND p.prokind = 'f'
ORDER BY p.proname;

-- ============================================================================
-- 5. DETALHES DAS FUNÇÕES DE RLS (código-fonte)
-- ============================================================================
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.prokind = 'f'
  AND p.proname IN (
    'get_current_tenant_id',
    'current_tenant_id_from_auth_uid',
    'current_is_super_admin_from_auth_uid',
    'is_super_admin',
    'get_auth_access_context',
    'set_tenant_id_from_profile',
    'handle_new_manager_profile'
  )
ORDER BY p.proname;

-- ============================================================================
-- 6. TRIGGERS ATIVOS
-- ============================================================================
SELECT
  event_object_table AS tabela,
  trigger_name AS nome_trigger,
  event_manipulation AS operacao,
  action_timing AS timing,
  action_orientation AS orientacao,
  action_statement AS acao
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 7. TRIGGER FUNCTIONS (código-fonte)
-- ============================================================================
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc p
JOIN pg_trigger t ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
ORDER BY p.proname;

-- ============================================================================
-- 8. FOREIGN KEYS
-- ============================================================================
SELECT
  tc.table_name AS tabela_origem,
  kcu.column_name AS coluna_origem,
  ccu.table_name AS tabela_destino,
  ccu.column_name AS coluna_destino,
  tc.constraint_name AS nome_constraint,
  rc.delete_rule AS on_delete,
  rc.update_rule AS on_update
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
  AND tc.table_schema = ccu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 9. ÍNDICES
-- ============================================================================
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;

-- ============================================================================
-- 10. COLUNAS tenant_id E SEUS ÍNDICES
-- ============================================================================
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  CASE WHEN i.indexname IS NOT NULL THEN 'SIM' ELSE 'NAO' END AS tem_indice
FROM information_schema.columns c
LEFT JOIN pg_indexes i
  ON i.tablename = c.table_name
  AND i.indexdef LIKE '%' || c.column_name || '%'
  AND i.schemaname = 'public'
WHERE c.table_schema = 'public'
  AND c.column_name = 'tenant_id'
ORDER BY c.table_name;

-- ============================================================================
-- 11. TABELAS COM tenant_id MAS SEM RLS
-- ============================================================================
SELECT
  c.table_name
FROM information_schema.columns c
LEFT JOIN pg_tables t
  ON t.tablename = c.table_name
  AND t.schemaname = 'public'
WHERE c.table_schema = 'public'
  AND c.column_name = 'tenant_id'
  AND (t.rowsecurity = false OR t.rowsecurity IS NULL)
ORDER BY c.table_name;

-- ============================================================================
-- 12. DIAGNÓSTICO: Funções chamadas nas policies vs funções existentes
-- ============================================================================
SELECT
  tablename,
  policyname,
  qual AS using_expr,
  with_check AS check_expr,
  CASE
    WHEN qual LIKE '%current_tenant_id_from_auth_uid%' THEN 'MODERNO'
    WHEN qual LIKE '%get_current_tenant_id%' THEN 'LEGADO'
    WHEN qual LIKE '%current_setting%' THEN 'SESSAO (PERIGOSO)'
    WHEN qual LIKE '%is_super_admin%' THEN 'JWT-MONITORING'
    WHEN qual LIKE '%(true)%' THEN 'ABERTO (SEM ISOLAMENTO)'
    ELSE 'OUTRO'
  END AS classificacao
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY
  CASE
    WHEN qual LIKE '%current_setting%' THEN 1
    WHEN qual LIKE '%(true)%' THEN 2
    WHEN qual LIKE '%get_current_tenant_id%' THEN 3
    ELSE 4
  END,
  tablename,
  policyname;

-- ============================================================================
-- 13. RESUMO DE SEGURANÇA POR CLASSIFICAÇÃO
-- ============================================================================
SELECT
  CASE
    WHEN qual LIKE '%current_tenant_id_from_auth_uid%' THEN '✅ MODERNO'
    WHEN qual LIKE '%get_current_tenant_id%' THEN '⚠️ LEGADO'
    WHEN qual LIKE '%current_setting%' THEN '🔴 SESSAO (BROKEN)'
    WHEN qual LIKE '%is_super_admin%' THEN '🔵 JWT-MONITORING'
    WHEN qual LIKE '%(true)%' THEN '🔴 ABERTO'
    ELSE '⚪ OUTRO'
  END AS classificacao,
  COUNT(*) AS total_policies,
  STRING_AGG(DISTINCT tablename, ', ' ORDER BY tablename) AS tabelas
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY 1
ORDER BY 1;

-- ============================================================================
-- 14. TABELAS SEM POLICIES (RLS habilitado mas vazio)
-- ============================================================================
SELECT
  t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public'
    AND p.tablename = t.tablename
  )
ORDER BY t.tablename;

-- ============================================================================
-- 15. TABELAS NO DOMAIN_TABLES DO CODIGO vs REALIDADE DO BANCO
-- (comparar manualmente com schemas.ts)
-- ============================================================================
SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename AND p.schemaname = 'public') AS num_policies,
  EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_name = t.tablename AND c.column_name = 'tenant_id') AS tem_tenant_id
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY t.tablename;
