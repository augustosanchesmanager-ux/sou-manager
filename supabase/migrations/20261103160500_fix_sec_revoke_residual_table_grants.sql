-- ============================================================================
-- Migration: 20261103160500_fix_sec_revoke_residual_table_grants.sql
-- Issue #225 / F1.1 & F1.2: Alinhamento de Menor Privilégio em Grants de Tabela
--
-- Revoga permissões residuais concedidas a nível de tabela que excedem as políticas
-- de Row Level Security (RLS) ativas:
--
-- 1. public.service_execution_participants:
--    A migration 20260418100000 concedeu SELECT, INSERT, UPDATE, DELETE para 'anon'.
--    A migration 20260715010000 revogou apenas INSERT.
--    Revoga completamente quaisquer privilégios residuais de 'anon' nesta tabela.
--
-- 2. public.feature_flags:
--    A migration 20260807000000 concedeu INSERT, UPDATE, DELETE para 'authenticated'.
--    As políticas de escrita de feature_flags são exclusivas para 'superadmin'.
--    Revoga INSERT, UPDATE e DELETE de 'authenticated' e 'PUBLIC', mantendo apenas SELECT.
-- ============================================================================

-- 1. service_execution_participants: revoga qualquer acesso do papel 'anon'
REVOKE ALL ON TABLE public.service_execution_participants FROM anon;

-- 2. feature_flags: revoga permissões de mutação de 'authenticated' e 'PUBLIC'
REVOKE INSERT, UPDATE, DELETE ON TABLE public.feature_flags FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.feature_flags FROM PUBLIC;

-- Assegura menor privilégio: apenas leitura para authenticated
GRANT SELECT ON TABLE public.feature_flags TO authenticated;
