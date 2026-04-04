export {
    getActiveAppContext,
    getClientForTable,
    getSchemaClient,
    getScopedClient,
    getSharedClient,
    setActiveAppContext,
    supabase,
} from '../src/lib/supabase/client';
export {
    APP_SCHEMA_MAP,
    CORE_PUBLIC_TABLES,
    DEFAULT_APP_SLUG,
    DOMAIN_TABLES,
    SHARED_SCHEMA,
    assertAppSlug,
    assertSupabaseSchemaName,
    ensureAppSupportsModule,
    isDomainTable,
    isSharedTable,
    isTenantGuardedTable,
    resolveSchemaForApp,
} from '../src/lib/supabase/schemas';
export type {
    AppModuleSlug,
    AppSchemaName,
    AppSlug,
    SharedSchemaName,
    SupabaseSchemaName,
} from '../src/lib/supabase/schemas';
export {
    requireTenantContext,
    requireTenantId,
} from '../src/lib/supabase/tenant';
export type {
    RequiredTenantContext,
    RequiredTenantContextInput,
} from '../src/lib/supabase/tenant';
