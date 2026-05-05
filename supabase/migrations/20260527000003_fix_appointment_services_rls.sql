BEGIN;

DROP POLICY IF EXISTS "tenant_isolation_appointment_services" ON public.appointment_services;
DROP POLICY IF EXISTS "tenant_isolation_appointment_services_insert" ON public.appointment_services;
DROP POLICY IF EXISTS "tenant_isolation_appointment_services_update" ON public.appointment_services;
DROP POLICY IF EXISTS "tenant_isolation_appointment_services_delete" ON public.appointment_services;

ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

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

NOTIFY pgrst, 'reload schema';
COMMIT;