import type { AppModuleSlug, AppSlug } from '../../lib/supabase/schemas';

export interface AppModuleDefinition {
  slug: AppSlug;
  label: string;
  enabled: boolean;
  enabledModules: readonly AppModuleSlug[];
  blockedModules: readonly AppModuleSlug[];
}

export const esteticaModule: AppModuleDefinition = {
  slug: 'estetica',
  label: 'Estetica',
  enabled: true,
  enabledModules: [
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
    'financial',
    'reports',
    'settings',
    'suppliers',
    'team',
    'notifications',
  ],
  blockedModules: [
    'commissions',
    'chef_club',
    'feedback',
    'portal',
    'kiosk',
  ],
};
