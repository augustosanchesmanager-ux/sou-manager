-- Migration: Garantir colunas Chef Club na tabela comandas
-- Data: 2026-04-17

-- Verificar e adicionar colunas Chef Club
DO $$
BEGIN
    -- Adicionar chef_club_original_total se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comandas' AND column_name = 'chef_club_original_total'
    ) THEN
        ALTER TABLE public.comandas ADD COLUMN chef_club_original_total NUMERIC(10,2);
    END IF;

    -- Adicionar chef_club_savings_total se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comandas' AND column_name = 'chef_club_savings_total'
    ) THEN
        ALTER TABLE public.comandas ADD COLUMN chef_club_savings_total NUMERIC(10,2);
    END IF;

    -- Adicionar chef_club_summary se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comandas' AND column_name = 'chef_club_summary'
    ) THEN
        ALTER TABLE public.comandas ADD COLUMN chef_club_summary JSONB;
    END IF;
END $$;

-- Forçar atualização do schema cache do PostgREST
NOTIFY pgrst, 'reload schema';