import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';
import type { AppSlug, SupabaseSchemaName } from '../lib/supabase/schemas';
import {
  resolveTenantForUser,
  type TenantRecord,
  type TenantRole,
  type UserTenantMembership,
} from '../lib/supabase/tenant';
import { useApp } from './AppContext';

export interface TenantContextValue {
  tenant: TenantRecord | null;
  role: TenantRole;
  memberships: UserTenantMembership[];
  activeMembership: UserTenantMembership | null;
  tenantId: string | null;
  tenantSlug: string | null;
  appSlug: AppSlug;
  schema: SupabaseSchemaName;
  hasTenantAccess: boolean;
  isResolved: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  error: string | null;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const getTenantErrorMessage = (error: unknown, appSlug: AppSlug): string => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return `Nao foi possivel resolver o tenant do app ${appSlug}.`;
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appSlug, schema } = useApp();
  const [session, setSession] = useState<Session | null>(null);
  const [tenant, setTenant] = useState<TenantRecord | null>(null);
  const [role, setRole] = useState<TenantRole>('unknown');
  const [memberships, setMemberships] = useState<UserTenantMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const applySession = (nextSession: Session | null) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
    };

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshTenant = useCallback(async (): Promise<void> => {
    if (!session?.user) {
      setTenant(null);
      setRole('unknown');
      setMemberships([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resolved = await resolveTenantForUser(session.user, appSlug);
      setTenant(resolved.tenant);
      setRole(resolved.role);
      setMemberships(resolved.memberships);

      if (!resolved.tenant && resolved.role !== 'superadmin') {
        setError(`Nenhum tenant compativel com o app ${appSlug} foi encontrado para o usuario atual.`);
      }
    } catch (err) {
      console.error('Failed to resolve tenant context:', err);
      setTenant(null);
      setRole('unknown');
      setMemberships([]);
      setError(getTenantErrorMessage(err, appSlug));
    } finally {
      setLoading(false);
    }
  }, [appSlug, session?.user]);

  useEffect(() => {
    void refreshTenant();
  }, [appSlug, session?.user?.id]);

  const activeMembership = useMemo<UserTenantMembership | null>(() => {
    if (!tenant?.id) {
      return null;
    }

    return memberships.find((membership) => membership.tenantId === tenant.id) || null;
  }, [memberships, tenant?.id]);

  const hasTenantAccess = role === 'superadmin' || Boolean(tenant?.id);
  const isResolved = !loading && (!session?.user || hasTenantAccess || Boolean(error));

  const value = useMemo<TenantContextValue>(
    () => ({
      tenant,
      role,
      memberships,
      activeMembership,
      tenantId: tenant?.id ?? null,
      tenantSlug: tenant?.slug ?? null,
      appSlug,
      schema,
      hasTenantAccess,
      isResolved,
      isSuperAdmin: role === 'superadmin',
      loading,
      error,
      refreshTenant,
    }),
    [activeMembership, appSlug, error, hasTenantAccess, isResolved, loading, memberships, refreshTenant, role, schema, tenant],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = (): TenantContextValue => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }

  return context;
};

export const useTenantOptional = (): TenantContextValue | undefined => useContext(TenantContext);
