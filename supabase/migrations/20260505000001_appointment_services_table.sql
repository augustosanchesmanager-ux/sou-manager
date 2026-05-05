-- =====================================================
-- Migration: appointment_services - Multiple services per appointment
-- Created: 2026-05-05
-- Purpose: Allow selecting multiple services when creating an appointment
-- =====================================================

BEGIN;

-- 1. Create the appointment_services table
CREATE TABLE IF NOT EXISTS public.appointment_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    quantity INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointment_services_tenant_id ON public.appointment_services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointment_services_appointment_id ON public.appointment_services(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_services_service_id ON public.appointment_services(service_id);

-- Unique constraint to prevent duplicate service in same appointment
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_services_unique ON public.appointment_services(appointment_id, service_id) WHERE quantity = 1;

-- 3. Enable RLS
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if any
DROP POLICY IF EXISTS "tenant_isolation_appointment_services" ON public.appointment_services;
DROP POLICY IF EXISTS "tenant_isolation_appointment_services_insert" ON public.appointment_services;
DROP POLICY IF EXISTS "tenant_isolation_appointment_services_update" ON public.appointment_services;
DROP POLICY IF EXISTS "tenant_isolation_appointment_services_delete" ON public.appointment_services;

-- 5. RLS Policies for tenant isolation
CREATE POLICY "tenant_isolation_appointment_services" ON public.appointment_services
    FOR SELECT USING (public.current_is_super_admin_from_auth_uid() OR tenant_id = public.current_tenant_id_from_auth_uid());

CREATE POLICY "tenant_isolation_appointment_services_insert" ON public.appointment_services
    FOR INSERT WITH CHECK (public.current_is_super_admin_from_auth_uid() OR tenant_id = public.current_tenant_id_from_auth_uid());

CREATE POLICY "tenant_isolation_appointment_services_update" ON public.appointment_services
    FOR UPDATE USING (public.current_is_super_admin_from_auth_uid() OR tenant_id = public.current_tenant_id_from_auth_uid())
    WITH CHECK (public.current_is_super_admin_from_auth_uid() OR tenant_id = public.current_tenant_id_from_auth_uid());

CREATE POLICY "tenant_isolation_appointment_services_delete" ON public.appointment_services
    FOR DELETE USING (public.current_is_super_admin_from_auth_uid() OR tenant_id = public.current_tenant_id_from_auth_uid());

-- 6. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_services TO authenticated;

COMMIT;