-- Migration: Adicionar colunas Chef Club na tabela comandas
-- Data: 2026-04-17

-- Verificar se as colunas já existem e adicionar se necessário
ALTER TABLE public.comandas 
ADD COLUMN IF NOT EXISTS chef_club_original_total NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS chef_club_savings_total NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS chef_club_summary JSONB;

-- Verificar se o índice existe e criar se necessário
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'comandas' AND indexname = 'idx_comandas_tenant_status'
    ) THEN
        CREATE INDEX idx_comandas_tenant_status ON public.comandas(tenant_id, status);
    END IF;
END $$;