-- ============================================================================
-- ONDA 2 DISCOVERY: Mapeamento de search_path e Índices Redundantes
-- ============================================================================

-- 1. LISTAR FUNÇÕES SECURITY DEFINER SEM SEARCH_PATH FIXADO
-- Estas são as funções que o linter do Supabase marca como vulneráveis
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    proconfig as config
FROM pg_proc p 
JOIN pg_namespace n ON n.oid = p.pronamespace 
WHERE n.nspname = 'public' 
  AND p.prosecdef = true 
  AND (p.proconfig IS NULL OR NOT (p.proconfig @> ARRAY['search_path=public'::text]));

-- 2. LISTAR ÍNDICES REDUNDANTES (_l_idx_*)
-- Índices que começam com _l_idx_ costumam ser resíduos de migrações ou automações redundantes
SELECT 
    schemaname, 
    relname as table_name, 
    indexrelname as index_name 
FROM pg_stat_user_indexes 
WHERE (relname = 'appointments' OR relname = 'comandas') 
  AND indexrelname LIKE '_l_idx_%';
