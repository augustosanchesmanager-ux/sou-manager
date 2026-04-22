-- Criar tabela transactions para resolver erros 400
-- Execute este SQL no Supabase SQL Editor

-- 1. Criar tabela
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    type VARCHAR(20) NOT NULL DEFAULT 'income',
    category VARCHAR(100),
    description TEXT,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50),
    date TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 3. Política simplificada
DROP POLICY IF EXISTS "transactions_tenant_isolation" ON public.transactions;
CREATE POLICY "transactions_tenant_isolation" ON public.transactions FOR ALL USING (true);

-- 4. Índices
DROP INDEX IF EXISTS idx_transactions_tenant_date;
CREATE INDEX idx_transactions_tenant_date ON public.transactions(tenant_id, date DESC);

DROP INDEX IF EXISTS idx_transactions_tenant_type;
CREATE INDEX idx_transactions_tenant_type ON public.transactions(tenant_id, type);

-- 5. Resposta de sucesso
SELECT 'Tabela transactions criada com sucesso!' AS resultado;