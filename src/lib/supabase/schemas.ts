export const APP_SLUGS = ['barber', 'auto', 'club'] as const;

export type AppSlug = (typeof APP_SLUGS)[number];
export type SharedSchemaName = 'public';
export type AppSchemaName = AppSlug;
export type SupabaseSchemaName = SharedSchemaName | AppSchemaName;

export const APP_MODULE_SLUGS = [
  'dashboard',
  'checkout',
  'orders',
  'products',
  'clients',
  'schedule',
  'schedule_blocks',
  'services',
  'comandas',
  'cashflow',
  'suppliers',
  'operations',
  'smart_return',
  'reports',
  'performance',
  'financial',
  'expenses',
  'receipts',
  'payroll',
  'commissions',
  'team',
  'categories',
  'support',
  'settings',
  'kiosk_admin',
  'business_intelligence',
  'promotions',
  'strategic_dashboard',
  'chef_club',
  'notifications',
  'kiosk',
] as const;

export type AppModuleSlug = (typeof APP_MODULE_SLUGS)[number];
export type TableClassification = 'shared' | 'domain' | 'unknown';

export interface TableAccessProfile {
  table: string;
  classification: TableClassification;
  requiresTenant: boolean;
  schema: SupabaseSchemaName;
}

export const SHARED_SCHEMA: SharedSchemaName = 'public';
export const DEFAULT_APP_SLUG: AppSlug = 'barber';
export const SUPABASE_SCHEMAS = [SHARED_SCHEMA, ...APP_SLUGS] as const;

export const APP_SCHEMA_MAP: Record<AppSlug, AppSchemaName> = {
  barber: 'barber',
  auto: 'auto',
  club: 'club',
};

// Shared tables live in `public` because they belong to platform identity,
// tenancy, support, or cross-app services.
export const CORE_PUBLIC_TABLE_NAMES = [
  'apps',
  'audit_logs',
  'notifications',
  'otp_requests',
  'portal_sessions',
  'profiles',
  'staff',
  'support_tickets',
  'tenant_addons',
  'tenants',
  'ticket_messages',
  'user_tenants',
] as const;

// Domain tables belong to operational business data and should live under
// the app schema (`barber`, `auto`, `club`) once the app is active there.
export const DOMAIN_TABLE_NAMES = [
  'appointments',
  'clients',
  'comanda_items',
  'comandas',
  'customer_benefit_consumptions',
  'customer_credits',
  'customer_plan_benefits',
  'customer_plans',
  'customer_subscriptions',
  'feedback_barber',
  'feedback_shop',
  'kiosk_devices',
  'kiosk_sessions',
  'products',
  'promotions',
  'purchase_orders',
  'schedule_blocks',
  'service_execution_participants',
  'services',
  'suppliers',
  'transactions',
] as const;

// Tenant-guarded tables require an explicit tenant context, even when they
// remain in the shared schema for compatibility reasons.
export const TENANT_GUARDED_TABLE_NAMES = [
  'appointments',
  'clients',
  'comanda_items',
  'comandas',
  'customer_benefit_consumptions',
  'customer_credits',
  'customer_plan_benefits',
  'customer_plans',
  'customer_subscriptions',
  'feedback_barber',
  'feedback_shop',
  'kiosk_sessions',
  'notifications',
  'otp_requests',
  'portal_sessions',
  'products',
  'promotions',
  'purchase_orders',
  'schedule_blocks',
  'service_execution_participants',
  'services',
  'staff',
  'suppliers',
  'support_tickets',
  'tenant_addons',
  'transactions',
] as const;

export const MODULE_ALLOWED_APPS: Record<AppModuleSlug, readonly AppSlug[]> = {
  dashboard: ['barber'],
  cashflow: ['barber'],
  chef_club: ['barber'],
  checkout: ['barber'],
  clients: ['barber'],
  comandas: ['barber'],
  kiosk: ['barber'],
  notifications: ['barber', 'auto', 'club'],
  orders: ['barber'],
  products: ['barber'],
  schedule: ['barber'],
  schedule_blocks: ['barber'],
  smart_return: ['barber'],
  reports: ['barber'],
  performance: ['barber'],
  financial: ['barber'],
  expenses: ['barber'],
  receipts: ['barber'],
  payroll: ['barber'],
  commissions: ['barber'],
  team: ['barber'],
  categories: ['barber'],
  support: ['barber'],
  settings: ['barber'],
  kiosk_admin: ['barber'],
  business_intelligence: ['barber'],
  promotions: ['barber'],
  strategic_dashboard: ['barber'],
  services: ['barber'],
  suppliers: ['barber'],
  operations: ['barber'],
};

export const CORE_PUBLIC_TABLES = new Set<string>(CORE_PUBLIC_TABLE_NAMES);
export const DOMAIN_TABLES = new Set<string>(DOMAIN_TABLE_NAMES);
export const TENANT_GUARDED_TABLES = new Set<string>(TENANT_GUARDED_TABLE_NAMES);

const normalizeBooleanEnv = (value: string | undefined): boolean =>
  value === '1' || value?.toLowerCase() === 'true';

const normalizeLookupValue = (value: string | null | undefined): string => value?.trim().toLowerCase() || '';

export const normalizeTableName = (table: string | null | undefined): string =>
  normalizeLookupValue(table);

export const isMultiSchemaEnabled = (): boolean =>
  normalizeBooleanEnv(import.meta.env.VITE_SUPABASE_MULTI_SCHEMA_ENABLED);

export const isAppSlug = (value: string | null | undefined): value is AppSlug =>
  Boolean(value && APP_SLUGS.includes(value as AppSlug));

export const isAppModuleSlug = (value: string | null | undefined): value is AppModuleSlug =>
  Boolean(value && APP_MODULE_SLUGS.includes(value as AppModuleSlug));

export const isSupabaseSchemaName = (
  value: string | null | undefined,
): value is SupabaseSchemaName => Boolean(value && SUPABASE_SCHEMAS.includes(value as SupabaseSchemaName));

export const normalizeAppSlug = (value: string | null | undefined): AppSlug =>
  isAppSlug(value) ? value : DEFAULT_APP_SLUG;

export const assertAppSlug = (
  value: string | null | undefined,
  errorContext = 'Invalid app slug.',
): AppSlug => {
  if (!isAppSlug(value)) {
    throw new Error(`${errorContext} Received "${value ?? 'null'}".`);
  }

  return value;
};

export const assertAppModuleSlug = (
  value: string | null | undefined,
  errorContext = 'Invalid module slug.',
): AppModuleSlug => {
  if (!isAppModuleSlug(value)) {
    throw new Error(`${errorContext} Received "${value ?? 'null'}".`);
  }

  return value;
};

export const assertSupabaseSchemaName = (
  value: string | null | undefined,
  errorContext = 'Invalid Supabase schema.',
): SupabaseSchemaName => {
  if (!isSupabaseSchemaName(value)) {
    throw new Error(`${errorContext} Received "${value ?? 'null'}".`);
  }

  return value;
};

export const resolveSchemaForApp = (appSlug: AppSlug): SupabaseSchemaName => {
  if (appSlug === 'barber' && !isMultiSchemaEnabled()) {
    return SHARED_SCHEMA;
  }

  return APP_SCHEMA_MAP[appSlug];
};

export const isTenantGuardedTable = (table: string): boolean =>
  TENANT_GUARDED_TABLES.has(normalizeTableName(table));

export const isSharedTable = (table: string): boolean => CORE_PUBLIC_TABLES.has(normalizeTableName(table));

export const isDomainTable = (table: string): boolean => DOMAIN_TABLES.has(normalizeTableName(table));

export const getAllowedAppsForModule = (
  moduleName: AppModuleSlug | string,
): readonly AppSlug[] => {
  const normalizedModuleName = normalizeLookupValue(moduleName);
  if (!isAppModuleSlug(normalizedModuleName)) {
    return [];
  }

  return MODULE_ALLOWED_APPS[normalizedModuleName];
};

export const appSupportsModule = (
  appSlug: AppSlug,
  moduleName: AppModuleSlug | string,
): boolean => getAllowedAppsForModule(moduleName).includes(appSlug);

export const getSchemaForTable = (
  table: string,
  appSlug: AppSlug,
): SupabaseSchemaName => {
  const normalizedTable = normalizeTableName(table);
  if (CORE_PUBLIC_TABLES.has(normalizedTable)) {
    return SHARED_SCHEMA;
  }

  return resolveSchemaForApp(appSlug);
};

export const getTableAccessProfile = (
  table: string,
  appSlug: AppSlug,
): TableAccessProfile => {
  const normalizedTable = normalizeTableName(table);
  const classification: TableClassification = isSharedTable(normalizedTable)
    ? 'shared'
    : isDomainTable(normalizedTable)
      ? 'domain'
      : 'unknown';

  return {
    table: normalizedTable,
    classification,
    requiresTenant: isTenantGuardedTable(normalizedTable),
    schema: getSchemaForTable(normalizedTable, appSlug),
  };
};

export const ensureAppSupportsModule = (
  appSlug: string | null | undefined,
  moduleName: AppModuleSlug | string,
  allowedApps?: readonly AppSlug[],
): AppSlug => {
  const resolvedAppSlug = assertAppSlug(
    appSlug,
    `Cannot access module "${moduleName}" because the app slug is invalid.`,
  );
  const resolvedAllowedApps = allowedApps || getAllowedAppsForModule(moduleName);

  if (resolvedAllowedApps.length === 0) {
    throw new Error(`Module "${moduleName}" is not registered in the SMG module registry.`);
  }

  if (!resolvedAllowedApps.includes(resolvedAppSlug)) {
    throw new Error(
      `Module "${moduleName}" is not available for app "${resolvedAppSlug}". Allowed apps: ${resolvedAllowedApps.join(', ')}.`,
    );
  }

  return resolvedAppSlug;
};
