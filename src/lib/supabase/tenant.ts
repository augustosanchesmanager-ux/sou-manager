import type { User } from '@supabase/supabase-js';
import { getSharedClient } from './client';
import {
  type AppSlug,
  DEFAULT_APP_SLUG,
  assertAppSlug,
  assertSupabaseSchemaName,
  isAppSlug,
  isTenantGuardedTable,
  type SupabaseSchemaName,
} from './schemas';

export type TenantRole =
  | 'superadmin'
  | 'manager'
  | 'barber'
  | 'receptionist'
  | 'staff'
  | 'unknown';

export interface TenantRecord {
  id: string;
  name: string;
  slug: string | null;
  app_slug: AppSlug;
  active: boolean | null;
  created_at?: string | null;
}

export interface UserTenantMembership {
  tenantId: string;
  role: TenantRole;
  isPrimary: boolean;
  tenant: TenantRecord | null;
}

export interface ResolvedTenantState {
  memberships: UserTenantMembership[];
  tenant: TenantRecord | null;
  role: TenantRole;
}

export interface RequiredTenantContextInput {
  tenantId: string | null | undefined;
  appSlug: string | null | undefined;
  schema: string | null | undefined;
  table?: string;
  operation?: string;
}

export interface RequiredTenantContext {
  tenantId: string;
  appSlug: AppSlug;
  schema: SupabaseSchemaName;
}

interface MembershipRow {
  tenant_id: string;
  role: string | null;
  is_primary: boolean | null;
}

interface ProfileLikeRow {
  tenant_id: string | null;
  role: string | null;
}

const normalizeRole = (role: string | null | undefined): TenantRole => {
  const normalized = (role || '').trim().toLowerCase();

  if (normalized === 'superadmin' || normalized === 'super admin') return 'superadmin';
  if (normalized === 'manager' || normalized === 'gerente' || normalized === 'owner' || normalized === 'admin') return 'manager';
  if (normalized === 'barber') return 'barber';
  if (normalized === 'receptionist') return 'receptionist';
  if (normalized === 'staff') return 'staff';
  return 'unknown';
};

const isMissingRelationError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as { code?: string; message?: string };
  return (
    record.code === '42P01' ||
    record.code === 'PGRST205' ||
    /user_tenants/i.test(record.message || '')
  );
};

const fetchTenantsByIds = async (tenantIds: string[]): Promise<Record<string, TenantRecord>> => {
  if (tenantIds.length === 0) {
    return {};
  }

  const { data, error } = await getSharedClient()
    .from('tenants')
    .select('id, name, slug, app_slug, active, created_at')
    .in('id', tenantIds);

  if (error) {
    throw error;
  }

  return (data || []).reduce<Record<string, TenantRecord>>((acc, tenant) => {
    acc[tenant.id] = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug ?? null,
      app_slug: isAppSlug(tenant.app_slug) ? tenant.app_slug : DEFAULT_APP_SLUG,
      active: tenant.active ?? null,
      created_at: tenant.created_at ?? null,
    };
    return acc;
  }, {});
};

const fetchMembershipsFromUserTenants = async (
  userId: string,
): Promise<UserTenantMembership[]> => {
  const { data, error } = await getSharedClient()
    .from('user_tenants')
    .select('tenant_id, role, is_primary')
    .eq('user_id', userId);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }

    throw error;
  }

  const rows = (data || []) as MembershipRow[];
  const tenantIds = Array.from(new Set(rows.map((row) => row.tenant_id).filter(Boolean)));
  const tenantsById = await fetchTenantsByIds(tenantIds);

  return rows.map((row) => ({
    tenantId: row.tenant_id,
    role: normalizeRole(row.role),
    isPrimary: Boolean(row.is_primary),
    tenant: tenantsById[row.tenant_id] || null,
  }));
};

const fetchLegacyTenantState = async (userId: string): Promise<ResolvedTenantState> => {
  const sharedClient = getSharedClient();

  const [{ data: profileData, error: profileError }, { data: staffData, error: staffError }] =
    await Promise.all([
      sharedClient
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', userId)
        .maybeSingle(),
      sharedClient
        .from('staff')
        .select('tenant_id, role')
        .eq('id', userId)
        .maybeSingle(),
    ]);

  if (profileError) {
    throw profileError;
  }

  if (staffError) {
    throw staffError;
  }

  const profileRow = profileData as ProfileLikeRow | null;
  const staffRow = staffData as ProfileLikeRow | null;
  const tenantId = profileRow?.tenant_id || staffRow?.tenant_id || null;

  if (!tenantId) {
    return {
      memberships: [],
      tenant: null,
      role: normalizeRole(profileRow?.role || staffRow?.role),
    };
  }

  const tenantsById = await fetchTenantsByIds([tenantId]);
  const tenant = tenantsById[tenantId] || null;
  const role = normalizeRole(profileRow?.role || staffRow?.role);

  return {
    memberships: [
      {
        tenantId,
        role,
        isPrimary: true,
        tenant,
      },
    ],
    tenant,
    role,
  };
};

const selectMembershipForApp = (
  memberships: UserTenantMembership[],
  appSlug: AppSlug,
): UserTenantMembership | null => {
  const directMatch = memberships.find((membership) => membership.tenant?.app_slug === appSlug);
  if (directMatch) {
    return directMatch;
  }

  if (appSlug === DEFAULT_APP_SLUG) {
    const barberFallback = memberships.find(
      (membership) => !membership.tenant?.app_slug || membership.tenant.app_slug === DEFAULT_APP_SLUG,
    );

    if (barberFallback) {
      return barberFallback;
    }
  }

  return null;
};

const selectPrimaryMembership = (
  memberships: UserTenantMembership[],
): UserTenantMembership | null => {
  const primaryMembership = memberships.find((membership) => membership.isPrimary && membership.tenant);
  if (primaryMembership) {
    return primaryMembership;
  }

  return memberships.find((membership) => membership.tenant) || memberships[0] || null;
};

export const resolveTenantForUser = async (
  user: User,
  appSlug: AppSlug,
): Promise<ResolvedTenantState> => {
  const memberships = await fetchMembershipsFromUserTenants(user.id);
  if (memberships.length > 0) {
    const selectedMembership = selectMembershipForApp(memberships, appSlug);
    return {
      memberships,
      tenant: selectedMembership?.tenant || null,
      role: selectedMembership?.role || 'unknown',
    };
  }

  return fetchLegacyTenantState(user.id);
};

export const resolvePrimaryAppForUser = async (user: User): Promise<AppSlug> => {
  const memberships = await fetchMembershipsFromUserTenants(user.id);
  if (memberships.length > 0) {
    return selectPrimaryMembership(memberships)?.tenant?.app_slug || DEFAULT_APP_SLUG;
  }

  const legacyState = await fetchLegacyTenantState(user.id);
  return legacyState.tenant?.app_slug || DEFAULT_APP_SLUG;
};

export const requireTenantId = (
  tenantId: string | null | undefined,
  operation = 'business operation',
): string => {
  const normalizedTenantId = tenantId?.trim();
  if (!normalizedTenantId) {
    throw new Error(`Missing tenant context for ${operation}.`);
  }

  return normalizedTenantId;
};

export const requireTenantContext = ({
  tenantId,
  appSlug,
  schema,
  table,
  operation,
}: RequiredTenantContextInput): RequiredTenantContext => {
  const resolvedAppSlug = assertAppSlug(
    appSlug,
    `Cannot resolve tenant context for ${operation || table || 'business operation'}.`,
  );
  const resolvedSchema = assertSupabaseSchemaName(
    schema,
    `Cannot resolve schema context for ${operation || table || 'business operation'}.`,
  );
  const requiresTenant = table ? isTenantGuardedTable(table) : true;

  return {
    tenantId: requiresTenant
      ? requireTenantId(tenantId, operation || table || 'business operation')
      : tenantId?.trim() || '',
    appSlug: resolvedAppSlug,
    schema: resolvedSchema,
  };
};
