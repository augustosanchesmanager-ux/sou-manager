import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AppSlug } from '../lib/supabase/schemas';
import {
  resolveTenantForUser,
  type TenantRecord,
  type TenantRole,
  type UserTenantMembership,
} from '../lib/supabase/tenant';
import { useApp } from './AppContext';
import { useAuth } from '../../context/AuthContext';

export interface TenantContextValue {
  tenant: TenantRecord | null;
  role: TenantRole;
  memberships: UserTenantMembership[];
  tenantId: string | null;
  tenantSlug: string | null;
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
  const { appSlug } = useApp();
  const { session: authSession } = useAuth();
  const [tenant, setTenant] = useState<TenantRecord | null>(null);
  const [role, setRole] = useState<TenantRole>('unknown');
  const [memberships, setMemberships] = useState<UserTenantMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTenant = async (): Promise<void> => {
    if (!authSession?.user) {
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
      const resolved = await resolveTenantForUser(authSession.user, appSlug);
      setTenant(resolved.tenant);
      setRole(resolved.role);
      setMemberships(resolved.memberships);

      if (!resolved.tenant && resolved.role !== 'superadmin') {
        setError(`Nenhum tenant compativel com o app ${appSlug} foi encontrado para o usuario atual.`);
      }
    } catch (err) {
      console.warn('[TenantContext] Failed to resolve tenant context', {
        error: err,
        appSlug,
        userId: authSession?.user?.id,
        timestamp: new Date().toISOString(),
      });
      setTenant(null);
      setRole('unknown');
      setMemberships([]);
      setError(getTenantErrorMessage(err, appSlug));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshTenant();
  }, [appSlug, authSession?.user?.id]);

  const value = useMemo<TenantContextValue>(
    () => ({
      tenant,
      role,
      memberships,
      tenantId: tenant?.id ?? null,
      tenantSlug: tenant?.slug ?? null,
      loading,
      error,
      refreshTenant,
    }),
    [error, loading, memberships, role, tenant],
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
