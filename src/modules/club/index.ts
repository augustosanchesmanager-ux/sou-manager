import { resolveSchemaForApp } from '../../lib/supabase/schemas';
import type { AppModuleDefinition } from '../types';

export const clubModule: AppModuleDefinition = {
  slug: 'club',
  label: 'Club',
  defaultSchema: resolveSchemaForApp('club'),
  enabled: false,
  requiresTenant: true,
  supportedModules: ['notifications'],
};
