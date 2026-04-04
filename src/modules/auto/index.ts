import type { AppSlug } from '../../lib/supabase/schemas';

export interface AppModuleDefinition {
  slug: AppSlug;
  label: string;
  enabled: boolean;
}

export const autoModule: AppModuleDefinition = {
  slug: 'auto',
  label: 'Auto',
  enabled: false,
};
