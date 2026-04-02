import type { AppSlug } from '../../lib/supabase/schemas';

export interface AppModuleDefinition {
  slug: AppSlug;
  label: string;
  enabled: boolean;
}

export const barberModule: AppModuleDefinition = {
  slug: 'barber',
  label: 'Barber',
  enabled: true,
};
