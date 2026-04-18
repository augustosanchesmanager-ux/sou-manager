import type { AppModuleSlug, AppSlug, SupabaseSchemaName } from '../lib/supabase/schemas';

export interface AppModuleDefinition {
  slug: AppSlug;
  label: string;
  enabled: boolean;
  supportedModules: readonly AppModuleSlug[];
  defaultSchema: SupabaseSchemaName;
  requiresTenant: boolean;
}
