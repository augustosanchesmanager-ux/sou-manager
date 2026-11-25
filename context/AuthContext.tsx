import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type Session, type User } from '@supabase/supabase-js';
import {
    DEFAULT_APP_SLUG,
    normalizeAppSlug,
    resolveSchemaForApp,
    type AppSlug,
    type SupabaseSchemaName,
} from '../src/lib/supabase/schemas';
import { clearFeatureFlagsCache } from '../src/lib/billing/featureFlagsCache';
import { supabase } from '../services/supabaseClient';
import { extractSupabaseError } from '../src/lib/supabase/errors';
import { useAppOptional } from '../src/context/AppContext';
import { useTenantOptional } from '../src/context/TenantContext';
import type { TenantRecord, TenantRole, UserTenantMembership } from '../src/lib/supabase/tenant';
import { AuthSessionContext } from '../src/context/authContextBase';

export type AccessRole = 'superadmin' | 'manager' | 'barber' | 'receptionist' | 'unknown';

export const isManagerAccessRole = (role: AccessRole): boolean =>
    role === 'manager' || role === 'superadmin';

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
    refreshAccessContext: () => Promise<void>;
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
    refreshAccessContext: () => Promise<void>;
}

const AuthContext = createContext<AuthSessionContextType | undefined>(undefined);

/**
 * [SMG][AUTH][F-01] Classificação de falha de autorização.
 *
 * - `unauthenticated` (401 / PGRST301): identidade ausente ou inválida. Terminal:
 *   não deve haver fallback e a sessão local deve ser encerrada.
 * - `forbidden` (403 / 42501): identidade válida sem permissão. Terminal (corta os
 *   fallbacks), mas NUNCA encerra a sessão — usuário legítimo em onboarding/invite
 *   não pode ser expulso.
 * - `none`: falha transitória ou ausente → caminho normal (inclui fallbacks).
 */
export type AuthFailureKind = 'none' | 'unauthenticated' | 'forbidden';

interface AuthErrorLike {
    status?: number | null;
    code?: string | null;
}

export const classifyAuthFailure = (error: AuthErrorLike | null | undefined): AuthFailureKind => {
    const status = typeof error?.status === 'number' ? error.status : null;
    const code = typeof error?.code === 'string' ? error.code : null;

    if (status === 401 || code === 'PGRST301') return 'unauthenticated';
    if (status === 403 || code === '42501') return 'forbidden';
    return 'none';
};

/** Folga (segundos) para considerar um token "quase expirado" como não utilizável. */
export const SESSION_EXPIRY_SKEW_SECONDS = 30;

/**
 * [SMG][AUTH][F-01] Trava de sessão: a RPC protegida só pode ser chamada com um
 * access token presente e fora da janela de expiração. Token expirado enquanto a
 * aba estava inativa deve passar pelo auto-refresh, nunca por `signOut()`.
 */
export const isSessionUsableForAccessContext = (params: {
    hasSession: boolean;
    hasAccessToken: boolean;
    expiresAt?: number | null;
    nowMs?: number;
    skewSeconds?: number;
}): boolean => {
    if (!params.hasSession || !params.hasAccessToken) return false;
    if (typeof params.expiresAt !== 'number' || !Number.isFinite(params.expiresAt)) return true;

    const nowMs = typeof params.nowMs === 'number' ? params.nowMs : Date.now();
    const skewMs = (params.skewSeconds ?? SESSION_EXPIRY_SKEW_SECONDS) * 1000;
    return params.expiresAt * 1000 - skewMs > nowMs;
};

interface AccessContextResult {
    tenantId: string | null;
    accessRole: AccessRole;
    profileStatus: 'pending' | 'active' | 'suspended' | null;
    canAccessSuperAdmin: boolean;
    failure: AuthFailureKind;
}

const EMPTY_ACCESS_CONTEXT: AccessContextResult = {
    tenantId: null,
    accessRole: 'unknown',
    profileStatus: null,
    canAccessSuperAdmin: false,
    failure: 'none',
};

export interface SessionTransitionAction {
    type: 'SIGN_OUT' | 'SILENT_REFRESH' | 'COLD_BOOT_OR_USER_SWITCH';
    shouldSetLoading: boolean;
    shouldFetchAccessContext: boolean;
}

export const decideSessionTransition = (params: {
    initialLoadDone: boolean;
    activeUserId: string | null;
    nextUserId: string | null;
    event?: string;
}): SessionTransitionAction => {
    if (!params.nextUserId || params.event === 'SIGNED_OUT') {
        return {
            type: 'SIGN_OUT',
            shouldSetLoading: false,
            shouldFetchAccessContext: false,
        };
    }

    const isSameUser = params.initialLoadDone && params.activeUserId === params.nextUserId;

    if (isSameUser) {
        return {
            type: 'SILENT_REFRESH',
            shouldSetLoading: false,
            shouldFetchAccessContext: params.event !== 'TOKEN_REFRESHED',
        };
    }

    return {
        type: 'COLD_BOOT_OR_USER_SWITCH',
        shouldSetLoading: true,
        shouldFetchAccessContext: true,
    };
};

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

    // [SMG][AUTH][F-01] Single-flight por access token: evita a dupla chamada da
    // carga fria (getSession + INITIAL_SESSION) e absorve eventos repetidos.
    const inFlightAccessContextRef = useRef<{ token: string; promise: Promise<AccessContextResult> } | null>(null);
    // Circuit breaker: token que já falhou de forma terminal não é re-tentado.
    const terminalFailureRef = useRef<{ token: string; kind: Exclude<AuthFailureKind, 'none'> } | null>(null);
    // Garante no máximo um encerramento de sessão por token (sem loop de signOut).
    const signOutIssuedForTokenRef = useRef<string | null>(null);

    const runAccessContextFetch = async (userId: string): Promise<AccessContextResult> => {
        let rpcFailure: AuthFailureKind = 'none';

        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_auth_access_context').single();
            if (!rpcError && rpcData && typeof rpcData === 'object') {
                const rpcResult = rpcData as { access_role?: unknown; is_super_admin?: unknown; profile_status?: unknown; tenant_id?: unknown };
                const role = deriveAccessRole(String(rpcResult.access_role ?? ''), Boolean(rpcResult.is_super_admin));
                const status = (rpcResult.profile_status || null) as 'pending' | 'active' | 'suspended' | null;
                const tenantId = rpcResult.tenant_id ? String(rpcResult.tenant_id) : null;
                return {
                    tenantId,
                    accessRole: role,
                    profileStatus: status,
                    canAccessSuperAdmin: Boolean(rpcResult.is_super_admin) || role === 'superadmin',
                    failure: 'none',
                };
            }

            if (rpcError) {
                rpcFailure = classifyAuthFailure(extractSupabaseError(rpcError));
                if (rpcFailure !== 'none') {
                    // Falha de autorização é terminal: não amplificar com fallbacks
                    // (profiles/staff também responderiam 401/403).
                    console.warn('[AuthContext] RPC get_auth_access_context rejected by authorization', {
                        failure: rpcFailure,
                        timestamp: new Date().toISOString(),
                    });
                    return { ...EMPTY_ACCESS_CONTEXT, failure: rpcFailure };
                }
            }
        } catch (rpcUnexpectedError) {
            rpcFailure = classifyAuthFailure(extractSupabaseError(rpcUnexpectedError));
            if (rpcFailure !== 'none') {
                return { ...EMPTY_ACCESS_CONTEXT, failure: rpcFailure };
            }
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
                // SEC-10: Fallback em caso de falha da RPC NUNCA concede privilégio de superadmin
                const canSuperAdmin = false;
                return {
                    tenantId: profileData.tenant_id,
                    accessRole: role === 'superadmin' ? 'unknown' : role,
                    profileStatus: (profileData.status as 'pending' | 'active' | 'suspended' | null) || 'pending',
                    canAccessSuperAdmin: false,
                    failure: 'none',
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
                    failure: 'none',
                };
            }
        } catch (err) {
            console.warn('[AuthContext] Fallback profiles/staff query completed', {
                error: err,
                timestamp: new Date().toISOString(),
            });
        }

        return { ...EMPTY_ACCESS_CONTEXT, failure: rpcFailure };
    };

    const fetchAccessContext = async (currentSession: Session | null): Promise<AccessContextResult> => {
        const userId = currentSession?.user?.id ?? null;
        if (!userId) {
            // Trava de sessão: sem usuário autenticado a RPC protegida nunca é chamada.
            return { ...EMPTY_ACCESS_CONTEXT };
        }

        let token = currentSession?.access_token ?? '';

        if (!isSessionUsableForAccessContext({
            hasSession: Boolean(currentSession?.user),
            hasAccessToken: Boolean(token),
            expiresAt: currentSession?.expires_at ?? null,
        })) {
            // Token ausente/expirado (ex.: aba inativa): tenta o auto-refresh antes de
            // qualquer decisão destrutiva. Refresh falho => sem chamada e sem signOut
            // (o supabase-js emite SIGNED_OUT por conta própria).
            const { data: refreshed } = await supabase.auth.getSession();
            const refreshedSession = refreshed.session;
            if (!isSessionUsableForAccessContext({
                hasSession: Boolean(refreshedSession?.user),
                hasAccessToken: Boolean(refreshedSession?.access_token),
                expiresAt: refreshedSession?.expires_at ?? null,
            })) {
                return { ...EMPTY_ACCESS_CONTEXT };
            }
            token = refreshedSession!.access_token;
        }

        const inFlight = inFlightAccessContextRef.current;
        if (inFlight && inFlight.token === token) {
            return inFlight.promise;
        }

        const terminalFailure = terminalFailureRef.current;
        if (terminalFailure && terminalFailure.token === token) {
            return { ...EMPTY_ACCESS_CONTEXT, failure: terminalFailure.kind };
        }

        const promise = (async (): Promise<AccessContextResult> => {
            const result = await runAccessContextFetch(userId);

            if (result.failure === 'none') {
                terminalFailureRef.current = null;
                signOutIssuedForTokenRef.current = null;
                return result;
            }

            terminalFailureRef.current = { token, kind: result.failure };

            if (result.failure === 'unauthenticated' && signOutIssuedForTokenRef.current !== token) {
                // 401 = identidade inválida/ausente: encerra a sessão local uma única vez.
                // scope 'local' garante limpeza mesmo com token já rejeitado no servidor.
                signOutIssuedForTokenRef.current = token;
                void supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
            }

            return result;
        })().finally(() => {
            // Erros transitórios liberam nova tentativa; o circuit breaker cobre os terminais.
            if (inFlightAccessContextRef.current?.token === token) {
                inFlightAccessContextRef.current = null;
            }
        });

        inFlightAccessContextRef.current = { token, promise };
        return promise;
    };

    useEffect(() => {
        let isMounted = true;
        let requestCounter = 0;
        let initialLoadDone = false;
        let activeUserId: string | null = null;

        const clearAuthState = () => {
            activeUserId = null;
            // [SMG][AUTH][F-01] Reset obrigatório do single-flight/circuit breaker no logout.
            inFlightAccessContextRef.current = null;
            terminalFailureRef.current = null;
            setResolvedTenantId(null);
            setAccessRole('unknown');
            setCanAccessSuperAdmin(false);
            setProfileStatus(null);
            setAuthError(null);
        };

        const applySession = async (nextSession: Session | null, event?: string) => {
            const requestId = ++requestCounter;
            if (!isMounted) return;

            const nextUser = nextSession?.user ?? null;
            const nextUserId = nextUser?.id ?? null;

            const transition = decideSessionTransition({
                initialLoadDone,
                activeUserId,
                nextUserId,
                event,
            });

            if (transition.type === 'SIGN_OUT') {
                setSession(null);
                setUser(null);
                clearAuthState();
                initialLoadDone = true;
                setLoading(false);
                return;
            }

            setSession(nextSession);
            setUser(nextUser);

            if (transition.type === 'SILENT_REFRESH') {
                // Background silent refresh: never flip loading to true (avoids unmounting active routes)
                if (!transition.shouldFetchAccessContext) {
                    return;
                }

                try {
                    const authContext = await fetchAccessContext(nextSession);
                    if (!isMounted || requestId !== requestCounter) return;

                    setResolvedTenantId(authContext.tenantId);
                    setAccessRole(authContext.accessRole);
                    setCanAccessSuperAdmin(authContext.canAccessSuperAdmin);
                    setProfileStatus(authContext.profileStatus);
                } catch (err) {
                    console.warn('[AuthContext] Background access context refresh failed (retaining current state):', err);
                }
                return;
            }

            // Cold boot or distinct user login: full blocking authorization load
            setLoading(true);
            setAuthError(null);

            try {
                const authContext = await fetchAccessContext(nextSession);
                if (!isMounted || requestId !== requestCounter) return;

                activeUserId = nextUserId;
                setResolvedTenantId(authContext.tenantId);
                setAccessRole(authContext.accessRole);
                setCanAccessSuperAdmin(authContext.canAccessSuperAdmin);
                setProfileStatus(authContext.profileStatus);

                // Auto-detecção de convite pendente para usuário recém-autenticado sem tenant/perfil.
                // Nunca em falha terminal de autorização: 401/403 não devem gerar outra RPC protegida.
                if (authContext.failure === 'none' && !authContext.tenantId && authContext.accessRole === 'unknown') {
                    try {
                        const { data: inviteToken } = await supabase.rpc('get_my_pending_invite_token');
                        if (inviteToken && typeof window !== 'undefined' && !window.location.hash.includes('/accept-invite/')) {
                            window.location.hash = `#/accept-invite/${inviteToken}`;
                        }
                    } catch (e) {
                        console.warn('[AuthContext] Failed to check pending invite token:', e);
                    }
                }
            } catch (err) {
                console.error('Failed to load auth session context:', err);
                if (isMounted && requestId === requestCounter) {
                    setAuthError('Não foi possível carregar o contexto de autenticação. Faça login novamente.');
                }
            } finally {
                if (isMounted && requestId === requestCounter) {
                    initialLoadDone = true;
                    setLoading(false);
                }
            }
        };

        supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
            void applySession(currentSession, 'INITIAL_SESSION');
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
            void applySession(nextSession, event);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signOut = useCallback(async () => {
        try {
            await supabase.auth.signOut();
        } finally {
            inFlightAccessContextRef.current = null;
            terminalFailureRef.current = null;
            signOutIssuedForTokenRef.current = null;
            clearFeatureFlagsCache();
            setSession(null);
            setUser(null);
            setResolvedTenantId(null);
            setAccessRole('unknown');
            setCanAccessSuperAdmin(false);
            setProfileStatus(null);
            setAuthError(null);
            setLoading(false);
        }
    }, []);

    // Re-resolve o contexto de acesso para o usuário atual.
    // Usado após o provisionamento do tenant (ex: fluxo de registro) para
    // garantir que resolvedTenantId/accessRole/profileStatus estejam frescos
    // antes da navegação — evita o authError sintético "tenant não identificado".
    const refreshAccessContext = useCallback(async (): Promise<void> => {
        if (!session) return;
        try {
            const authContext = await fetchAccessContext(session);
            setResolvedTenantId(authContext.tenantId);
            setAccessRole(authContext.accessRole);
            setCanAccessSuperAdmin(authContext.canAccessSuperAdmin);
            setProfileStatus(authContext.profileStatus);
        } catch (err) {
            console.error('Failed to refresh auth session context:', err);
        }
    }, [session]);

    const authSessionValue = useMemo(
        () => ({ session, user }),
        [session, user],
    );

    const authContextValue = useMemo<AuthSessionContextType>(
        () => ({
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
            refreshAccessContext,
        }),
        [
            accessRole,
            authError,
            canAccessSuperAdmin,
            loading,
            profileStatus,
            refreshAccessContext,
            resolvedTenantId,
            session,
            signOut,
            user,
        ],
    );

    return (
        <AuthSessionContext.Provider value={authSessionValue}>
            <AuthContext.Provider value={authContextValue}>
                {children}
            </AuthContext.Provider>
        </AuthSessionContext.Provider>
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
    // Usuário recém-cadastrado com confirmação de e-mail: tem sessão mas ainda
    // NÃO provisionou o tenant (o provisionamento roda no primeiro login após a
    // confirmação). Nesse estado o authError sintético "tenant não identificado"
    // não deve disparar — o ProtectedRoute redireciona para /onboarding/provision.
    const pendingRegistration = Boolean(
        authSessionContext.session?.user?.user_metadata?.shop_name && !tenantId,
    );
    const authError =
        authSessionContext.authError ||
        (
            !pendingRegistration &&
            !authSessionContext.canAccessSuperAdmin &&
            Boolean(authSessionContext.session) &&
            !loading &&
            !tenantId
                ? 'Não foi possível determinar o tenant da sessão. Faça login novamente.'
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
        refreshAccessContext: authSessionContext.refreshAccessContext,
    };
};
