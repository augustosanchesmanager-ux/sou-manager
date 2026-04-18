import { resolveSchemaForApp } from '../../lib/supabase/schemas';
import type { AppModuleDefinition } from '../types';

export const autoModule: AppModuleDefinition = {
  slug: 'auto',
  label: 'Auto',
  defaultSchema: resolveSchemaForApp('auto'),
  enabled: false,
  requiresTenant: true,
  supportedModules: ['notifications'],
};
