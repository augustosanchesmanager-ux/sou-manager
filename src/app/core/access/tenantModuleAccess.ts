import type { AppModuleSlug, AppSlug } from '@/src/lib/supabase/schemas';

export interface TenantModulePolicy {
  mode: 'allowlist';
  tenantSlugs: readonly string[];
  description: string;
}

export interface TenantModuleAccessInput {
  moduleSlug: AppModuleSlug;
  appSlug: AppSlug;
  tenantSlug: string | null | undefined;
}

export interface TenantModuleAccessResult {
  enabled: boolean;
  policy: TenantModulePolicy | null;
  reason:
    | 'module-not-restricted'
    | 'tenant-allowlisted'
    | 'tenant-not-allowlisted'
    | 'tenant-context-required';
}

export const TENANT_ENABLED_MODULE_POLICIES: Partial<Record<AppModuleSlug, TenantModulePolicy>> = {
  chef_club: {
    mode: 'allowlist',
    tenantSlugs: ['sanchez-barber'],
    description: 'Chef Club is currently enabled only for the Sanchez Barber tenant inside the barber app.',
  },
};

const normalizeTenantSlug = (tenantSlug: string | null | undefined): string =>
  tenantSlug?.trim().toLowerCase() || '';

export const getTenantModulePolicy = (
  moduleSlug: AppModuleSlug,
): TenantModulePolicy | null => TENANT_ENABLED_MODULE_POLICIES[moduleSlug] || null;

export const resolveTenantModuleAccess = ({
  moduleSlug,
  tenantSlug,
}: TenantModuleAccessInput): TenantModuleAccessResult => {
  const policy = getTenantModulePolicy(moduleSlug);

  if (!policy) {
    return {
      enabled: true,
      policy: null,
      reason: 'module-not-restricted',
    };
  }

  const normalizedTenantSlug = normalizeTenantSlug(tenantSlug);
  if (!normalizedTenantSlug) {
    return {
      enabled: false,
      policy,
      reason: 'tenant-context-required',
    };
  }

  const enabled = policy.tenantSlugs.includes(normalizedTenantSlug);
  return {
    enabled,
    policy,
    reason: enabled ? 'tenant-allowlisted' : 'tenant-not-allowlisted',
  };
};

export const ensureTenantModuleAccess = (
  input: TenantModuleAccessInput,
  operation = 'business operation',
): TenantModuleAccessResult => {
  const access = resolveTenantModuleAccess(input);
  if (access.enabled) {
    return access;
  }

  if (access.reason === 'tenant-context-required') {
    throw new Error(
      `Module "${input.moduleSlug}" requires a resolved tenant context before ${operation}.`,
    );
  }

  throw new Error(
    `Module "${input.moduleSlug}" is not enabled for tenant "${input.tenantSlug || 'unknown'}" in app "${input.appSlug}".`,
  );
};
