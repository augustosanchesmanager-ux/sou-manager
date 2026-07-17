import { supabase } from '../../../services/supabaseClient';
import type { PermissionRole, PermissionState } from './types';

const DEMO_STORAGE_KEY = 'soumanager.local.demo.permissions';

const isLocalBrowserHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
};

const hasSupabaseEnv = Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
);

const isDemoMode = (): boolean => !hasSupabaseEnv && isLocalBrowserHost();

const readDemoPermissions = (tenantId: string, role: PermissionRole): Record<string, boolean> => {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
  if (!raw) return {};
  try {
    const all = JSON.parse(raw) as Record<string, Record<string, boolean>>;
    return all[`${tenantId}:${role}`] || {};
  } catch {
    return {};
  }
};

const writeDemoPermissions = (tenantId: string, role: PermissionRole, permissions: Record<string, boolean>): void => {
  if (typeof window === 'undefined') return;
  const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
  const all = raw ? (JSON.parse(raw) as Record<string, Record<string, boolean>>) : {};
  all[`${tenantId}:${role}`] = permissions;
  window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(all));
};

export async function fetchRolePermissions(
  tenantId: string,
  role: PermissionRole
): Promise<Record<string, boolean>> {
  if (isDemoMode()) {
    return readDemoPermissions(tenantId, role);
  }

  const { data, error } = await supabase.rpc('get_role_permissions', {
    p_tenant_id: tenantId,
    p_role: role,
  });

  if (error) {
    console.error('Error fetching role permissions:', error);
    return {};
  }

  const result: Record<string, boolean> = {};
  if (Array.isArray(data)) {
    for (const row of data) {
      result[row.permission_key] = row.enabled;
    }
  }
  return result;
}

export async function saveRolePermissions(
  tenantId: string,
  role: PermissionRole,
  permissions: Record<string, boolean>
): Promise<void> {
  if (isDemoMode()) {
    writeDemoPermissions(tenantId, role, permissions);
    return;
  }

  const payload = Object.entries(permissions).map(([permission_key, enabled]) => ({
    permission_key,
    enabled,
  }));

  const { error } = await supabase.rpc('upsert_role_permissions', {
    p_tenant_id: tenantId,
    p_role: role,
    p_permissions: payload,
  });

  if (error) {
    console.error('Error saving role permissions:', error);
    throw error;
  }
}

export async function resetRolePermissions(
  tenantId: string,
  role: PermissionRole
): Promise<void> {
  if (isDemoMode()) {
    writeDemoPermissions(tenantId, role, {});
    return;
  }

  const { error } = await supabase.rpc('reset_role_permissions_to_default', {
    p_tenant_id: tenantId,
    p_role: role,
  });

  if (error) {
    console.error('Error resetting role permissions:', error);
    throw error;
  }
}

export type { PermissionState };
