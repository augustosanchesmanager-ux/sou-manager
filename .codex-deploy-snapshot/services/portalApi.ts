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
};
