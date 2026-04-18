import { APP_MODULE_SLUGS, resolveSchemaForApp } from '../../lib/supabase/schemas';
import type { AppModuleDefinition } from '../types';

export const barberModule: AppModuleDefinition = {
  slug: 'barber',
  label: 'Barber',
  defaultSchema: resolveSchemaForApp('barber'),
  enabled: true,
  requiresTenant: true,
  supportedModules: APP_MODULE_SLUGS,
};
