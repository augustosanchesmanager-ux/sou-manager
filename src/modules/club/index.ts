import type { AppSlug } from '../../lib/supabase/schemas';

export interface AppModuleDefinition {
  slug: AppSlug;
  label: string;
  enabled: boolean;
}

export const clubModule: AppModuleDefinition = {
  slug: 'club',
  label: 'Club dos Chefes',
  enabled: false,
};
