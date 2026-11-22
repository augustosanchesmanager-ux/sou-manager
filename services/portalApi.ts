import { supabase } from './supabaseClient';

export interface PortalAuthResponse {
    message?: string;
    token?: string;
    valid?: boolean;
    client?: {
        id: string;
        name: string;
        phone: string;
    };
    error?: string;
    code?: string;
    cleanPhone?: string;
}

export const portalApi = {
    /**
     * Request an OTP for a given phone number and tenant.
     * @param tenantId The tenant's UUID
     * @param phone The user's phone number
     */
    requestOtp: async (tenantId: string, phone: string): Promise<PortalAuthResponse> => {
        try {
            const { data, error } = await supabase.functions.invoke('portal-auth', {
                body: { action: 'request_otp', tenantId, phone }
            });

            if (error) throw error;
            return data as PortalAuthResponse;
        } catch (e: any) {
            console.error('Portal API (requestOtp) Error:', e);
            if (e.context?.response) {
                const responseBody = await e.context.response.json();
                throw new Error(responseBody?.error || 'Erro ao comunicar com o servidor.');
            }
            throw new Error(e.message || 'Erro inesperado.');
        }
    },

    /**
     * Verify the sent OTP and get a JWT session token.
     * @param tenantId The tenant's UUID
     * @param phone The user's phone number
     * @param code The 6-digit OTP code
     */
    verifyOtp: async (tenantId: string, phone: string, code: string): Promise<PortalAuthResponse> => {
        try {
            const { data, error } = await supabase.functions.invoke('portal-auth', {
                body: { action: 'verify_otp', tenantId, phone, code }
            });

            if (error) throw error;
            return data as PortalAuthResponse;
        } catch (e: any) {
            console.error('Portal API (verifyOtp) Error:', e);
            if (e.context?.response) {
                const responseBody = await e.context.response.json();
                throw new Error(responseBody?.error || 'Erro ao validar o código.');
            }
            throw new Error(e.message || 'Erro inesperado.');
        }
    },

    /**
     * Validate portal session token in backend before sensitive operations.
     */
    validateSession: async (tenantId: string, clientId: string, token: string): Promise<PortalAuthResponse> => {
        try {
            const { data, error } = await supabase.functions.invoke('portal-auth', {
                body: { action: 'validate_session', tenantId, clientId, token }
            });

            if (error) throw error;
            return data as PortalAuthResponse;
        } catch (e: any) {
            console.error('Portal API (validateSession) Error:', e);
            if (e.context?.response) {
                const responseBody = await e.context.response.json();
                throw new Error(responseBody?.error || 'Sessão inválida.');
            }
            throw new Error(e.message || 'Erro inesperado.');
        }
    },

    // Future portal APIs can be added here
    getTenantBySlug: async (slug: string) => {
        const { data } = await supabase
            .from('tenants')
            .select('id, name, slug')
            .eq('slug', slug)
            .single();
        return data;
    },

    getClientPortalAddon: async (tenantId: string) => {
        const { data } = await supabase
            .from('tenant_addons')
            .select('status, limits')
            .eq('tenant_id', tenantId)
            .eq('addon_key', 'CLIENT_PORTAL')
            .single();
        return data;
    },

    enableClientPortalAddon: async (tenantId: string, hasExisting: boolean) => {
        const limits = { theme: 'default', reschedule_window_hours: 2, cancellation_window_hours: 2 };
        if (hasExisting) {
            await supabase
                .from('tenant_addons')
                .update({ status: 'enabled', activated_at: new Date().toISOString() })
                .eq('tenant_id', tenantId)
                .eq('addon_key', 'CLIENT_PORTAL');
        } else {
            await supabase.from('tenant_addons').insert({
                tenant_id: tenantId,
                addon_key: 'CLIENT_PORTAL',
                status: 'enabled',
                activated_at: new Date().toISOString(),
                limits,
            });
        }
    },

    disableClientPortalAddon: async (tenantId: string) => {
        await supabase
            .from('tenant_addons')
            .update({ status: 'disabled' })
            .eq('tenant_id', tenantId)
            .eq('addon_key', 'CLIENT_PORTAL');
    },

    updateClientPortalLimits: async (
        tenantId: string,
        limits: { theme: string; reschedule_window_hours: number; cancellation_window_hours: number },
    ) => {
        await supabase
            .from('tenant_addons')
            .update({ limits })
            .eq('tenant_id', tenantId)
            .eq('addon_key', 'CLIENT_PORTAL');
    },

    listActiveServicesAndStaff: async (tenantId: string) => {
        const [svcRes, bbrRes] = await Promise.all([
            supabase
                .from('services')
                .select('id, name, price, duration_minutes')
                .eq('tenant_id', tenantId)
                .eq('is_active', true)
                .order('name'),
            supabase.rpc('kiosk_get_staff', { p_tenant_identifier: tenantId }),
        ]);
        return { services: svcRes.data || [], staff: bbrRes.data || [] };
    },

    listBookedAppointmentRanges: async (
        tenantId: string,
        startIso: string,
        endIso: string,
        staffId?: string | null,
    ) => {
        let query = supabase
            .from('appointments')
            .select('start_time, end_time')
            .eq('tenant_id', tenantId)
            .gte('start_time', startIso)
            .lte('start_time', endIso)
            .in('status', ['confirmed', 'pending']);

        if (staffId && staffId !== 'any') {
            query = query.eq('staff_id', staffId);
        }

        const { data } = await query;
        return data || [];
    },

    createPortalAppointment: async (payload: {
        tenant_id: string;
        client_id: string;
        staff_id: string | null;
        service_id: string;
        start_time: string;
        end_time: string;
        notes?: string;
    }) => {
        await supabase.from('appointments').insert({
            ...payload,
            status: 'pending',
            source: 'client_portal',
            channel: 'home_portal',
            notes: payload.notes || 'Agendado via Portal do Cliente',
        });
    },

    getUpcomingClientAppointment: async (tenantId: string, clientId: string, nowIso: string) => {
        const { data } = await supabase
            .from('appointments')
            .select('id, start_time, end_time, status, service:services(name, price), staff:staff(name)')
            .eq('tenant_id', tenantId)
            .eq('client_id', clientId)
            .in('status', ['pending', 'confirmed'])
            .gte('start_time', nowIso)
            .order('start_time', { ascending: true })
            .limit(1)
            .single();
        return data;
    },

    listPastClientAppointments: async (tenantId: string, clientId: string, nowIso: string) => {
        const { data } = await supabase
            .from('appointments')
            .select('id, start_time, status, service:services(name), staff:staff(name)')
            .eq('tenant_id', tenantId)
            .eq('client_id', clientId)
            .lt('start_time', nowIso)
            .order('start_time', { ascending: false })
            .limit(5);
        return data || [];
    },

    cancelClientAppointment: async (appointmentId: string, tenantId: string, clientId: string) => {
        await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', appointmentId)
            .eq('tenant_id', tenantId)
            .eq('client_id', clientId);
    },

    submitBarberFeedback: async (payload: {
        tenant_id: string;
        client_id: string;
        barber_id: string | null;
        rating: number;
        comment: string;
    }) => {
        await supabase.from('feedback_barber').insert({
            ...payload,
            source_channel: 'app',
        });
    },
};
