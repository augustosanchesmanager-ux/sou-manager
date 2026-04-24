export const APP_SLUGS = ['barber', 'auto', 'club'] as const;

export type AppSlug = (typeof APP_SLUGS)[number];
export type SharedSchemaName = 'public';
export type AppSchemaName = AppSlug;
export type SupabaseSchemaName = SharedSchemaName | AppSchemaName;
export type AppModuleSlug =
  | 'checkout'
  | 'orders'
  | 'products'
  | 'clients'
  | 'schedule'
  | 'schedule_blocks'
  | 'services'
  | 'comandas'
  | 'cashflow'
  | 'suppliers'
  | 'chef_club'
  | 'notifications'
  | 'kiosk';

export const SHARED_SCHEMA: SharedSchemaName = 'public';
export const DEFAULT_APP_SLUG: AppSlug = 'barber';
export const SUPABASE_SCHEMAS = [SHARED_SCHEMA, ...APP_SLUGS] as const;

export const APP_SCHEMA_MAP: Record<AppSlug, AppSchemaName> = {
  barber: 'barber',
  auto: 'auto',
  club: 'club',
};

export const CORE_PUBLIC_TABLES = new Set<string>([
  'apps',
  'audit_logs',
  'notifications',
  'otp_requests',
  'portal_sessions',
  'profiles',
  'service_execution_participants',
  'staff',
  'support_tickets',
  'tenant_addons',
  'tenants',
  'ticket_messages',
  'user_tenants',
]);

export const DOMAIN_TABLES = new Set<string>([
  'appointments',
  'clients',
  'comanda_items',
  'comandas',
  'customer_credits',
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
  'services',
  'suppliers',
  'transactions',
]);

export const TENANT_GUARDED_TABLES = new Set<string>([
  'appointments',
  'clients',
  'comanda_items',
  'comandas',
  'customer_credits',
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
]);

const normalizeBooleanEnv = (value: string | undefined): boolean =>
  value === '1' || value?.toLowerCase() === 'true';

export const isMultiSchemaEnabled = (): boolean =>
  normalizeBooleanEnv(import.meta.env.VITE_SUPABASE_MULTI_SCHEMA_ENABLED);

export const isAppSlug = (value: string | null | undefined): value is AppSlug =>
  Boolean(value && APP_SLUGS.includes(value as AppSlug));

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

export const getSchemaForTable = (
  table: string,
  appSlug: AppSlug,
): SupabaseSchemaName => {
  if (CORE_PUBLIC_TABLES.has(table)) {
    return SHARED_SCHEMA;
  }

  return resolveSchemaForApp(appSlug);
};

export const isTenantGuardedTable = (table: string): boolean =>
  TENANT_GUARDED_TABLES.has(table);

export const isSharedTable = (table: string): boolean => CORE_PUBLIC_TABLES.has(table);

export const isDomainTable = (table: string): boolean => DOMAIN_TABLES.has(table);

export const ensureAppSupportsModule = (
  appSlug: string | null | undefined,
  moduleName: AppModuleSlug | string,
  allowedApps: readonly AppSlug[],
): AppSlug => {
  const resolvedAppSlug = assertAppSlug(
    appSlug,
    `Cannot access module "${moduleName}" because the app slug is invalid.`,
  );

  if (!allowedApps.includes(resolvedAppSlug)) {
    throw new Error(
      `Module "${moduleName}" is not available for app "${resolvedAppSlug}". Allowed apps: ${allowedApps.join(', ')}.`,
    );
  }

  return resolvedAppSlug;
};
