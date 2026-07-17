import React, { createContext, useContext, useEffect, useState } from 'react';
import { type Session, type User } from '@supabase/supabase-js';
import {
    DEFAULT_APP_SLUG,
    normalizeAppSlug,
    resolveSchemaForApp,
    type AppSlug,
    type SupabaseSchemaName,
} from '../src/lib/supabase/schemas';
import { supabase } from '../services/supabaseClient';
import { useAppOptional } from '../src/context/AppContext';
import { useTenantOptional } from '../src/context/TenantContext';
import type { TenantRecord, TenantRole, UserTenantMembership } from '../src/lib/supabase/tenant';

export type AccessRole = 'superadmin' | 'manager' | 'barber' | 'receptionist' | 'unknown';

interface AuthSessionContextType {
    session: Session | null;
    user: User | null;
    resolvedTenantId: string | null;
    accessRole: AccessRole;
    canAccessSuperAdmin: boolean;
    isSuperAdmin: boolean;
    profileStatus: 'pending' | 'active' | 'suspended' | null;
    authError: string | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

export interface AuthContextType {
    session: Session | null;
    user: User | null;
    tenantId: string | null;
    tenantSlug: string | null;
    tenant: TenantRecord | null;
    tenantRole: TenantRole;
    memberships: UserTenantMembership[];
    accessRole: AccessRole;
    canAccessSuperAdmin: boolean;
    isSuperAdmin: boolean;
    profileStatus: 'pending' | 'active' | 'suspended' | null;
    authError: string | null;
    tenantError: string | null;
    loading: boolean;
    tenantLoading: boolean;
    appSlug: AppSlug;
    schema: SupabaseSchemaName;
    signOut: () => Promise<void>;
    refreshTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthSessionContextType | undefined>(undefined);

interface AccessContextResult {
    tenantId: string | null;
    accessRole: AccessRole;
    profileStatus: 'pending' | 'active' | 'suspended' | null;
    canAccessSuperAdmin: boolean;
}

const deriveAccessRole = (rawRole: string | null | undefined, isSuperAdmin: boolean): AccessRole => {
    const normalized = (rawRole || '').toLowerCase().trim();
    if (isSuperAdmin) return 'superadmin';
    if (normalized === 'manager' || normalized === 'gerente' || normalized === 'owner' || normalized === 'admin' || normalized === 'adminmanager' || normalized === 'admin_manager') return 'manager';
    if (normalized === 'barber') return 'barber';
    if (normalized === 'receptionist') return 'receptionist';
    return 'unknown';
};

const toAccessRoleFromTenantRole = (tenantRole: TenantRole): AccessRole => {
    if (tenantRole === 'superadmin') return 'superadmin';
    if (tenantRole === 'manager') return 'manager';
    if (tenantRole === 'barber') return 'barber';
    if (tenantRole === 'receptionist') return 'receptionist';
    return 'unknown';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(null);
    const [accessRole, setAccessRole] = useState<AccessRole>('unknown');
    const [canAccessSuperAdmin, setCanAccessSuperAdmin] = useState(false);
    const [profileStatus, setProfileStatus] = useState<'pending' | 'active' | 'suspended' | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchAccessContext = async (userId: string): Promise<AccessContextResult> => {
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_auth_access_context').single();
            if (!rpcError && rpcData && typeof rpcData === 'object') {
                const rpcResult = rpcData as { access_role?: unknown; is_super_admin?: unknown; profile_status?: unknown; tenant_id?: unknown };
                const role = deriveAccessRole(String(rpcResult.access_role ?? ''), Boolean(rpcResult.is_super_admin));
                const status = (rpcResult.profile_status || null) as 'pending' | 'active' | 'suspended' | null;
                const tenantId = String(rpcResult.tenant_id || null);
                return {
                    tenantId,
                    accessRole: role,
                    profileStatus: status,
                    canAccessSuperAdmin: Boolean(rpcResult.is_super_admin) || role === 'superadmin',
                };
            }
        } catch (rpcUnexpectedError) {
            console.warn('[AuthContext] RPC get_auth_access_context failed, using fallback', {
                error: rpcUnexpectedError,
                timestamp: new Date().toISOString(),
            });
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
            console.warn('[AuthContext] Fallback profiles/staff query completed', {
                error: err,
                timestamp: new Date().toISOString(),
            });
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
            setResolvedTenantId(null);
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

            try {
                const authContext = await fetchAccessContext(nextSession.user.id);
                if (!isMounted || requestId !== requestCounter) return;

                setResolvedTenantId(authContext.tenantId);
                setAccessRole(authContext.accessRole);
                setCanAccessSuperAdmin(authContext.canAccessSuperAdmin);
                setProfileStatus(authContext.profileStatus);
            } catch (err) {
                console.error('Failed to load auth session context:', err);
                if (isMounted && requestId === requestCounter) {
                    setAuthError('Nao foi possivel carregar o contexto de autenticacao. Faca login novamente.');
                }
            } finally {
                if (isMounted && requestId === requestCounter) {
                    setLoading(false);
                }
            }
        };

        supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
            void applySession(currentSession);
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

    return (
        <AuthContext.Provider
            value={{
                session,
                user,
                resolvedTenantId,
                accessRole,
                canAccessSuperAdmin,
                isSuperAdmin: canAccessSuperAdmin,
                profileStatus,
                authError,
                loading,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const authSessionContext = useContext(AuthContext);
    if (authSessionContext === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    const tenantContext = useTenantOptional();
    const appContext = useAppOptional();

    const appSlug = normalizeAppSlug(
        typeof appContext?.appSlug === 'string' ? appContext.appSlug : DEFAULT_APP_SLUG,
    );
    const schema = appContext?.schema ?? resolveSchemaForApp(appSlug);
    const tenantId = tenantContext?.tenantId ?? authSessionContext.resolvedTenantId ?? null;
    const tenantRole = tenantContext?.role ?? 'unknown';
    const mergedAccessRole =
        authSessionContext.accessRole !== 'unknown'
            ? authSessionContext.accessRole
            : toAccessRoleFromTenantRole(tenantRole);
    const tenantLoading = tenantContext?.loading ?? false;
    const loading = authSessionContext.loading || (Boolean(authSessionContext.session) && tenantLoading);
    const authError =
        authSessionContext.authError ||
        (
            !authSessionContext.canAccessSuperAdmin &&
            Boolean(authSessionContext.session) &&
            !loading &&
            !tenantId
                ? 'Nao foi possivel determinar o tenant da sessao. Faca login novamente.'
                : null
        );

    return {
        session: authSessionContext.session,
        user: authSessionContext.user,
        tenantId,
        tenantSlug: tenantContext?.tenantSlug ?? null,
        tenant: tenantContext?.tenant ?? null,
        tenantRole,
        memberships: tenantContext?.memberships ?? [],
        accessRole: mergedAccessRole,
        canAccessSuperAdmin: authSessionContext.canAccessSuperAdmin,
        isSuperAdmin: authSessionContext.isSuperAdmin,
        profileStatus: authSessionContext.profileStatus,
        authError,
        tenantError: tenantContext?.error ?? null,
        loading,
        tenantLoading,
        appSlug,
        schema,
        signOut: authSessionContext.signOut,
        refreshTenant: tenantContext?.refreshTenant ?? (async () => {}),
    };
};
