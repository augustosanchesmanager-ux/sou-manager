-- Adicionar coluna method para compatibilidade
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS method VARCHAR(50);

-- Copiar valores existentes
UPDATE public.transactions SET method = payment_method WHERE method IS NULL;

-- Verificar colunas atuais
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'transactions' AND table_schema = 'public';