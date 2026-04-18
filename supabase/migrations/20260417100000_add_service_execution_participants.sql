-- Migration: Adicionar suporte a múltiplos profissionais por item de serviço
-- Data: 2026-04-17
-- Objetivo: Permitir execução compartilhada sem duplicar faturamento

-- 1. Adicionar campo para identificar item que gera receita principal
ALTER TABLE public.comanda_items 
ADD COLUMN IF NOT EXISTS is_primary_revenue BOOLEAN DEFAULT true;

-- 2. Criar tabela de participantes de execução
CREATE TABLE IF NOT EXISTS public.service_execution_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_item_id UUID NOT NULL REFERENCES public.comanda_items(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id),
  role TEXT NOT NULL DEFAULT 'assistant' CHECK (role IN ('primary', 'assistant', 'co_executor')),
  payout_type TEXT NOT NULL DEFAULT 'percentage' CHECK (payout_type IN ('percentage', 'fixed')),
  payout_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  payout_amount_calculated NUMERIC(10,2),
  affects_revenue BOOLEAN NOT NULL DEFAULT true,
  affects_commission BOOLEAN NOT NULL DEFAULT true,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Habilitar RLS
ALTER TABLE public.service_execution_participants ENABLE ROW LEVEL SECURITY;

-- 4. Policies de acesso (similar às outras tabelas do domínio)
CREATE POLICY "Allow full access to service_execution_participants" 
ON public.service_execution_participants FOR ALL 
USING (true) WITH CHECK (true);

-- 5. Indices para performance
CREATE INDEX idx_service_execution_participants_comanda_item 
ON public.service_execution_participants(comanda_item_id);

CREATE INDEX idx_service_execution_participants_staff 
ON public.service_execution_participants(staff_id);

CREATE INDEX idx_service_execution_participants_tenant 
ON public.service_execution_participants(tenant_id);

-- 6. Trigger para auto-preencher tenant_id (copiado de outras tabelas)
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_context()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tenant_id := COALESCE(NEW.tenant_id, public.get_current_tenant_id());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_tenant_id_service_execution_participants
BEFORE INSERT OR UPDATE ON public.service_execution_participants
FOR EACH ROW
EXECUTE FUNCTION public.set_tenant_id_from_context();