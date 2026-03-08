import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

type AccessRole = 'superadmin' | 'manager' | 'barber' | 'receptionist' | 'unknown';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    tenantId: string | null;
    accessRole: AccessRole;
    canAccessSuperAdmin: boolean;
    isSuperAdmin: boolean;
    profileStatus: 'pending' | 'active' | 'suspended' | null;
    authError: string | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AccessContextResult {
    tenantId: string | null;
    accessRole: AccessRole;
    profileStatus: 'pending' | 'active' | 'suspended' | null;
    canAccessSuperAdmin: boolean;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [accessRole, setAccessRole] = useState<AccessRole>('unknown');
    const [canAccessSuperAdmin, setCanAccessSuperAdmin] = useState(false);
    const [profileStatus, setProfileStatus] = useState<'pending' | 'active' | 'suspended' | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const deriveAccessRole = (rawRole: string | null | undefined, isSuperAdmin: boolean): AccessRole => {
        const normalized = (rawRole || '').toLowerCase().trim();
        if (isSuperAdmin) return 'superadmin';
        if (normalized === 'manager' || normalized === 'gerente' || normalized === 'owner' || normalized === 'admin') return 'manager';
        if (normalized === 'barber') return 'barber';
        if (normalized === 'receptionist') return 'receptionist';
        return 'unknown';
    };

    const fetchAccessContext = async (userId: string): Promise<AccessContextResult> => {
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_auth_access_context').single();
            if (!rpcError && rpcData) {
                const role = deriveAccessRole(rpcData.access_role, Boolean(rpcData.is_super_admin));
                const status = (rpcData.profile_status || null) as 'pending' | 'active' | 'suspended' | null;
                const resolvedTenantId = rpcData.tenant_id || null;
                return {
                    tenantId: resolvedTenantId,
                    accessRole: role,
                    profileStatus: status,
                    canAccessSuperAdmin: Boolean(rpcData.is_super_admin) || role === 'superadmin',
                };
            }
        } catch (rpcUnexpectedError) {
            console.error('RPC get_auth_access_context failed:', rpcUnexpectedError);
        }

        try {
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('tenant_id, status, role')
                .eq('id', userId)
                .single();

            if (profileData && !profileError) {
                const role = deriveAccessRole(profileData.role, false);
                const canSuperAdmin = role === 'superadmin';
                return {
                    tenantId: canSuperAdmin ? null : profileData.tenant_id,
                    accessRole: role,
                    profileStatus: (profileData.status as 'pending' | 'active' | 'suspended' | null) || (canSuperAdmin ? 'active' : 'pending'),
                    canAccessSuperAdmin: canSuperAdmin,
                };
            }

            const { data: staffData, error: staffError } = await supabase
                .from('staff')
                .select('tenant_id, status, role')
                .eq('id', userId)
                .single();

            if (staffData && !staffError) {
                const role = deriveAccessRole(staffData.role, false);
                return {
                    tenantId: staffData.tenant_id,
                    accessRole: role === 'unknown' ? 'barber' : role,
                    profileStatus: (staffData.status as 'pending' | 'active' | 'suspended' | null) || 'active',
                    canAccessSuperAdmin: false,
                };
            }
        } catch (err) {
            console.error('Error fetching auth context:', err);
        }

        return {
            tenantId: null,
            accessRole: 'unknown',
            profileStatus: null,
            canAccessSuperAdmin: false,
        };
    };

    useEffect(() => {
        let isMounted = true;
        let requestCounter = 0;

        const clearAuthState = () => {
            setTenantId(null);
            setAccessRole('unknown');
            setCanAccessSuperAdmin(false);
            setProfileStatus(null);
            setAuthError(null);
        };

        const applySession = async (nextSession: Session | null) => {
            const requestId = ++requestCounter;
            if (!isMounted) return;

            setSession(nextSession);
            setUser(nextSession?.user ?? null);

            if (!nextSession?.user) {
                clearAuthState();
                setLoading(false);
                return;
            }

            setLoading(true);
            setAuthError(null);

            const authContext = await fetchAccessContext(nextSession.user.id);
            if (!isMounted || requestId !== requestCounter) return;

            setTenantId(authContext.tenantId);
            setAccessRole(authContext.accessRole);
            setCanAccessSuperAdmin(authContext.canAccessSuperAdmin);
            setProfileStatus(authContext.profileStatus);

            if (!authContext.canAccessSuperAdmin && !authContext.tenantId) {
                setAuthError('Nao foi possivel determinar o tenant da sessao. Faca login novamente.');
            }

            if (
                !authContext.canAccessSuperAdmin &&
                authContext.accessRole !== 'unknown' &&
                authContext.profileStatus == null
            ) {
                setAuthError('Nao foi possivel carregar o status do perfil. Faca login novamente.');
            }

            if (isMounted && requestId === requestCounter) {
                setLoading(false);
            }
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            void applySession(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            void applySession(nextSession);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const isSuperAdmin = canAccessSuperAdmin;

    return (
        <AuthContext.Provider
            value={{
                session,
                user,
                tenantId,
                accessRole,
                canAccessSuperAdmin,
                isSuperAdmin,
                profileStatus,
                authError,
                loading,
                signOut
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
