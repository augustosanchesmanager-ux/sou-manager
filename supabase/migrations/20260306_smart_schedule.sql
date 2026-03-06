-- Up Migration
-- Adiciona o tempo de buffer (em minutos) nos serviços
ALTER TABLE services ADD COLUMN IF NOT EXISTS buffer integer DEFAULT 0;

-- Adiciona especialidades (IDs de serviços ou categorias) para os profissionais
ALTER TABLE staff ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}';

-- Atualiza a tabela appointments caso o status seja um CHECK ou ENUM
-- Como não temos a definição exata inicial:
-- Se status for text com check constraint:
DO $$
BEGIN
    -- Vamos garantir que os novos status sejam válidos. Se houver constraint, a gente dropa e recria.
    -- Buscando nome de CHECK constraints na coluna status:
    DECLARE
        c_name text;
    BEGIN
        SELECT conname INTO c_name
        FROM pg_constraint
        WHERE conrelid = 'public.appointments'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%status%';

        IF c_name IS NOT NULL THEN
            EXECUTE 'ALTER TABLE public.appointments DROP CONSTRAINT ' || quote_ident(c_name);
            EXECUTE 'ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check CHECK (status IN (''scheduled'', ''confirmed'', ''in_progress'', ''completed'', ''cancelled'', ''no_show'', ''pending''))';
        END IF;
    END;
END $$;
