import React, { createContext, useContext, useState, useEffect } from 'react';
import { portalApi } from '../services/portalApi';

export interface PortalClient {
    id: string;
    name: string;
    phone: string;
}

interface PortalAuthContextType {
    token: string | null;
    client: PortalClient | null;
    tenantId: string | null;
    loading: boolean;
    error: string | null;
    requestOtp: (tenantId: string, phone: string) => Promise<void>;
    verifyOtp: (tenantId: string, phone: string, code: string) => Promise<void>;
    logout: () => void;
}

const PortalAuthContext = createContext<PortalAuthContextType>({
    token: null,
    client: null,
    tenantId: null,
    loading: true,
    error: null,
    requestOtp: async () => { },
    verifyOtp: async () => { },
    logout: () => { },
});

export const usePortalAuth = () => useContext(PortalAuthContext);

export const PortalAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);
    const [client, setClient] = useState<PortalClient | null>(null);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Hydrate from localStorage
        try {
            const storedToken = localStorage.getItem('sou_manager_portal_token');
            const storedClient = localStorage.getItem('sou_manager_portal_client');
            const storedTenant = localStorage.getItem('sou_manager_portal_tenant');

            if (storedToken && storedClient && storedTenant) {
                setToken(storedToken);
                setClient(JSON.parse(storedClient));
                setTenantId(storedTenant);
            }
        } catch (e) {
            console.error('Failed to parse portal session from localStorage', e);
        } finally {
            setLoading(false);
        }
    }, []);

    const requestOtp = async (tId: string, phone: string) => {
        setError(null);
        await portalApi.requestOtp(tId, phone);
    };

    const verifyOtp = async (tId: string, phone: string, code: string) => {
        setError(null);
        try {
            const res = await portalApi.verifyOtp(tId, phone, code);
            if (res.token && res.client) {
                setToken(res.token);
                setClient(res.client);
                setTenantId(tId);
                localStorage.setItem('sou_manager_portal_token', res.token);
                localStorage.setItem('sou_manager_portal_client', JSON.stringify(res.client));
                localStorage.setItem('sou_manager_portal_tenant', tId);
            }
        } catch (e: any) {
            setError(e.message);
            throw e;
        }
    };

    const logout = () => {
        setToken(null);
        setClient(null);
        setTenantId(null);
        localStorage.removeItem('sou_manager_portal_token');
        localStorage.removeItem('sou_manager_portal_client');
        localStorage.removeItem('sou_manager_portal_tenant');
    };

    return (
        <PortalAuthContext.Provider value={{ token, client, tenantId, loading, error, requestOtp, verifyOtp, logout }}>
            {children}
        </PortalAuthContext.Provider>
    );
};
