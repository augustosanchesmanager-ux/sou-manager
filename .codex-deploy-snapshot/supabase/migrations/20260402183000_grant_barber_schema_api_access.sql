BEGIN;

-- ============================================================
-- Fase de estabilizacao pos-rollback
-- Objetivo:
--   - Permitir que a API do Supabase acesse o schema barber
--   - Sem religar a flag multi-schema
--   - Sem alterar dados
--
-- Contexto do incidente:
--   - Ao ativar VITE_SUPABASE_MULTI_SCHEMA_ENABLED=true em producao,
--     o frontend passou a consultar o schema barber.
--   - O schema nao estava exposto inicialmente via API (erro 406).
--   - Depois da exposicao, ainda faltavam grants no schema/tabelas (erro 403).
--
-- Esta migration prepara apenas as permissoes da API.
-- Nao copia dados, nao altera RPCs e nao mexe em auth.
-- ============================================================

GRANT USAGE ON SCHEMA barber TO authenticated;
GRANT USAGE ON SCHEMA barber TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA barber TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA barber TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA barber TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA barber TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA barber
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA barber
GRANT ALL PRIVILEGES ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA barber
GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA barber
GRANT USAGE, SELECT ON SEQUENCES TO service_role;

COMMIT;
