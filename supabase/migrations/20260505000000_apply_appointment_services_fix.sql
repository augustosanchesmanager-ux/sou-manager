-- =====================================================
-- Combined Migration: Fix Appointment Services
-- Created: 2026-05-05
-- Purpose: Create appointment_services table, RPC, and fix RLS
-- =====================================================

BEGIN;

-- =====================================================
-- PART 1: Create appointment_services table
-- =====================================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointment_services_tenant_id ON public.appointment_services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointment_services_appointment_id ON public.appointment_services(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_services_service_id ON public.appointment_services(service_id);

-- Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_services_unique ON public.appointment_services(appointment_id, service_id) WHERE quantity = 1;

-- =====================================================
-- PART 2: Create create_appointment_with_services RPC
-- Fix: validates p_services is proper JSONB array
-- Handles both [{service_id: uuid}, ...] and [uuid, uuid] formats
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_appointment_with_services(
    p_tenant_id UUID,
    p_client_id UUID DEFAULT NULL,
    p_client_name TEXT DEFAULT NULL,
    p_client_phone TEXT DEFAULT NULL,
    p_staff_id UUID DEFAULT NULL,
    p_start_time TIMESTAMPTZ DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_services JSONB DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_current_tenant_id UUID;
    v_is_super_admin BOOLEAN := false;
    v_client_name TEXT;
    v_staff_name TEXT;
    v_services_data JSONB;
    v_service_ids UUID[];
    v_first_service_id UUID;
    v_first_service_name TEXT;
    v_total_price NUMERIC(10,2) := 0;
    v_total_duration_minutes INTEGER := 0;
    v_duration_hours NUMERIC(3,1) := 1;
    v_appointment_id UUID;
    v_service_row RECORD;
    v_sort_order INTEGER := 0;
    v_existing_appointment UUID;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuario nao autenticado'; END IF;
    IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'Tenant invalido'; END IF;

    SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
    INTO v_current_tenant_id, v_is_super_admin;

    IF NOT COALESCE(v_is_super_admin, false) AND p_tenant_id <> v_current_tenant_id THEN
        RAISE EXCEPTION 'Tenant invalido';
    END IF;

    -- Validate p_services is a proper JSONB array
    IF p_services IS NULL THEN
        RAISE EXCEPTION 'p_services nao pode ser NULL. Selecione pelo menos um servico';
    END IF;

    IF jsonb_typeof(p_services) <> 'array' THEN
        RAISE EXCEPTION 'p_services deve ser um array JSONB de servicos. Recebido tipo: %', jsonb_typeof(p_services);
    END IF;

    IF jsonb_array_length(p_services) = 0 THEN
        RAISE EXCEPTION 'Selecione pelo menos um servico';
    END IF;

    -- Handle both formats: [{service_id: uuid}, ...] and [uuid, uuid]
    v_service_ids := ARRAY(
        SELECT
            CASE
                WHEN jsonb_typeof(elem) = 'object' THEN
                    (elem->>'service_id')::uuid
                ELSE
                    elem::uuid
            END
        FROM jsonb_array_elements(p_services) AS elem
    );

    IF array_length(v_service_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'Selecione pelo menos um servico valido';
    END IF;

    IF p_staff_id IS NULL OR p_start_time IS NULL THEN
        RAISE EXCEPTION 'Profissional e horario sao obrigatorios';
    END IF;

    SELECT st.name INTO v_staff_name
    FROM public.staff st
    WHERE st.id = p_staff_id AND st.tenant_id = p_tenant_id
    AND lower(COALESCE(st.status, 'active')) = 'active'
    LIMIT 1;

    IF v_staff_name IS NULL THEN RAISE EXCEPTION 'Profissional invalido'; END IF;

    IF p_client_id IS NOT NULL THEN
        SELECT c.name INTO v_client_name
        FROM public.clients c
        WHERE c.id = p_client_id AND c.tenant_id = p_tenant_id
        LIMIT 1;
        IF v_client_name IS NULL THEN RAISE EXCEPTION 'Cliente invalido'; END IF;
    END IF;

    v_client_name := NULLIF(BTRIM(COALESCE(p_client_name, v_client_name)), '');
    IF v_client_name IS NULL THEN RAISE EXCEPTION 'Nome do cliente obrigatorio'; END IF;

    -- Idempotency check
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        SELECT id INTO v_existing_appointment
        FROM public.appointments
        WHERE tenant_id = p_tenant_id
        AND idempotency_key = p_idempotency_key
        LIMIT 1;

        IF v_existing_appointment IS NOT NULL THEN
            RETURN jsonb_build_object(
                'appointment_id', v_existing_appointment,
                'total_price', 0,
                'total_duration_minutes', 0,
                'idempotent', true
            );
        END IF;
    END IF;

    -- Calculate totals
    v_total_price := 0;
    v_total_duration_minutes := 0;
    v_sort_order := 0;

    FOR v_service_row IN
        SELECT s.id, s.name, s.price, s.duration, s.buffer,
               COALESCE(NULLIF(to_jsonb(s)->>'price', '')::numeric, 0) as unit_price,
               COALESCE(NULLIF(to_jsonb(s)->>'duration', '')::numeric, 30) as duration_minutes,
               COALESCE(NULLIF(to_jsonb(s)->>'buffer', '')::numeric, 0) as buffer_minutes
        FROM unnest(v_service_ids) as service_id
        JOIN public.services s ON s.id = service_id
        WHERE s.tenant_id = p_tenant_id
        AND COALESCE(NULLIF(to_jsonb(s)->>'active', '')::boolean, NULLIF(to_jsonb(s)->>'is_active', '')::boolean, true) = true
    LOOP
        IF v_sort_order = 0 THEN
            v_first_service_id := v_service_row.id;
            v_first_service_name := v_service_row.name;
        END IF;

        v_total_price := v_total_price + COALESCE(v_service_row.unit_price, 0);
        v_total_duration_minutes := v_total_duration_minutes + COALESCE(v_service_row.duration_minutes, 30) + COALESCE(v_service_row.buffer_minutes, 0);
        v_sort_order := v_sort_order + 1;
    END LOOP;

    IF v_first_service_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum servico valido encontrado';
    END IF;

    v_duration_hours := ROUND((GREATEST(v_total_duration_minutes, 15)::numeric / 60.0), 1);

    -- Create appointment
    INSERT INTO public.appointments (
        tenant_id, client_id, service_id, staff_id,
        client_name, service_name, staff_name,
        start_time, duration, status,
        notes, idempotency_key
    ) VALUES (
        p_tenant_id, p_client_id, v_first_service_id, p_staff_id,
        v_client_name, v_first_service_name, v_staff_name,
        p_start_time, v_duration_hours, 'confirmed',
        p_notes, p_idempotency_key
    ) RETURNING id INTO v_appointment_id;

    -- Insert all services into appointment_services
    v_sort_order := 0;
    FOR v_service_row IN
        SELECT s.id, s.name,
               COALESCE(NULLIF(to_jsonb(s)->>'price', '')::numeric, 0) as unit_price,
               COALESCE(NULLIF(to_jsonb(s)->>'duration', '')::numeric, 30) as duration_minutes,
               COALESCE(NULLIF(to_jsonb(s)->>'buffer', '')::numeric, 0) as buffer_minutes
        FROM unnest(v_service_ids) as service_id
        JOIN public.services s ON s.id = service_id
        WHERE s.tenant_id = p_tenant_id
        AND COALESCE(NULLIF(to_jsonb(s)->>'active', '')::boolean, NULLIF(to_jsonb(s)->>'is_active', '')::boolean, true) = true
    LOOP
        INSERT INTO public.appointment_services (
            tenant_id, appointment_id, service_id,
            unit_price, duration_minutes, quantity, sort_order
        ) VALUES (
            p_tenant_id, v_appointment_id, v_service_row.id,
            COALESCE(v_service_row.unit_price, 0),
            COALESCE(v_service_row.duration_minutes, 30) + COALESCE(v_service_row.buffer_minutes, 0),
            1, v_sort_order
        );
        v_sort_order := v_sort_order + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'appointment_id', v_appointment_id,
        'total_price', v_total_price,
        'total_duration_minutes', v_total_duration_minutes,
        'idempotent', false
    );
END;
$$;

-- =====================================================
-- PART 3: Fix RLS policies
-- =====================================================

ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_appointment_services" ON public.appointment_services;
DROP POLICY IF EXISTS "tenant_isolation_appointment_services_insert" ON public.appointment_services;
DROP POLICY IF EXISTS "tenant_isolation_appointment_services_update" ON public.appointment_services;
DROP POLICY IF EXISTS "tenant_isolation_appointment_services_delete" ON public.appointment_services;

CREATE POLICY "tenant_isolation_appointment_services" ON public.appointment_services
    FOR SELECT USING (public.current_is_super_admin_from_auth_uid() OR tenant_id = public.current_tenant_id_from_auth_uid());

CREATE POLICY "tenant_isolation_appointment_services_insert" ON public.appointment_services
    FOR INSERT WITH CHECK (public.current_is_super_admin_from_auth_uid() OR tenant_id = public.current_tenant_id_from_auth_uid());

CREATE POLICY "tenant_isolation_appointment_services_update" ON public.appointment_services
    FOR UPDATE USING (public.current_is_super_admin_from_auth_uid() OR tenant_id = public.current_tenant_id_from_auth_uid())
    WITH CHECK (public.current_is_super_admin_from_auth_uid() OR tenant_id = public.current_tenant_id_from_auth_uid());

CREATE POLICY "tenant_isolation_appointment_services_delete" ON public.appointment_services
    FOR DELETE USING (public.current_is_super_admin_from_auth_uid() OR tenant_id = public.current_tenant_id_from_auth_uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_services TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment_with_services TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;