-- Migration: Add service execution participants for shared service execution
-- Created: 2026-04-18
-- Purpose: Allow multiple professionals per service item without duplicating revenue

-- 1. Create the new table
CREATE TABLE IF NOT EXISTS public.service_execution_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comanda_item_id UUID REFERENCES public.comanda_items(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'assistant' CHECK (role IN ('primary', 'assistant', 'co_executor')),
    payout_type TEXT NOT NULL DEFAULT 'percentage' CHECK (payout_type IN ('percentage', 'fixed')),
    payout_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    affects_revenue BOOLEAN NOT NULL DEFAULT false,
    affects_commission BOOLEAN NOT NULL DEFAULT true,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add tenant_id column to comanda_items if not exists (for legacy support)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comanda_items' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.comanda_items ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.service_execution_participants ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for tenant isolation
DROP POLICY IF EXISTS "tenant_isolation_service_execution_participants" ON public.service_execution_participants;
CREATE POLICY "tenant_isolation_service_execution_participants" ON public.service_execution_participants
    FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS "tenant_isolation_service_execution_participants_insert" ON public.service_execution_participants;
CREATE POLICY "tenant_isolation_service_execution_participants_insert" ON public.service_execution_participants
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS "tenant_isolation_service_execution_participants_update" ON public.service_execution_participants;
CREATE POLICY "tenant_isolation_service_execution_participants_update" ON public.service_execution_participants
    FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS "tenant_isolation_service_execution_participants_delete" ON public.service_execution_participants;
CREATE POLICY "tenant_isolation_service_execution_participants_delete" ON public.service_execution_participants
    FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_execution_participants_comanda_item ON public.service_execution_participants(comanda_item_id);
CREATE INDEX IF NOT EXISTS idx_service_execution_participants_professional ON public.service_execution_participants(professional_id);
CREATE INDEX IF NOT EXISTS idx_service_execution_participants_tenant ON public.service_execution_participants(tenant_id);

-- 6. Migration function: Backfill existing comanda_items with primary participants
-- This creates a primary participant for each comanda_item that has a staff_id
CREATE OR REPLACE FUNCTION backfill_service_execution_participants()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item_record RECORD;
    commission_rate_val NUMERIC;
    tenant_uuid_val UUID;
BEGIN
    FOR item_record IN 
        SELECT ci.id, ci.staff_id, ci.tenant_id
        FROM public.comanda_items ci
        WHERE ci.staff_id IS NOT NULL
        AND ci.tenant_id IS NOT NULL
    LOOP
        -- Check if participant already exists
        IF NOT EXISTS (
            SELECT 1 FROM public.service_execution_participants
            WHERE comanda_item_id = item_record.id
            AND role = 'primary'
        ) THEN
            -- Get commission rate from staff
            SELECT COALESCE(s.commission_rate, 40), s.tenant_id
            INTO commission_rate_val, tenant_uuid_val
            FROM public.staff s
            WHERE s.id = item_record.staff_id;
            
            INSERT INTO public.service_execution_participants (
                comanda_item_id,
                professional_id,
                role,
                payout_type,
                payout_value,
                affects_revenue,
                affects_commission,
                tenant_id
            ) VALUES (
                item_record.id,
                item_record.staff_id,
                'primary',
                'percentage',
                COALESCE(commission_rate_val, 40),
                true,
                true,
                COALESCE(tenant_uuid_val, item_record.tenant_id)
            );
        END IF;
    END LOOP;
END $$;

-- 7. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_execution_participants TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION backfill_service_execution_participants() TO anon, authenticated, service_role;