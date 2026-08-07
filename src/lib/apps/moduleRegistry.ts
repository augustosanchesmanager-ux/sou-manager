import type { AppModuleSlug, AppSlug } from '../../../domain/shared/app';
import type { FeatureKey } from '../../../domain/billing/featureKey';

export const APP_ENABLED_MODULES: Record<AppSlug, readonly AppModuleSlug[]> = {
  barber: [
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
    'commissions',
    'chef_club',
    'feedback',
    'portal',
    'notifications',
    'kiosk',
  ],
  auto: [],
  club: [],
  estetica: [
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
};

export const APP_BLOCKED_MODULES: Record<AppSlug, readonly AppModuleSlug[]> = {
  barber: [],
  auto: [
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
    'commissions',
    'chef_club',
    'feedback',
    'portal',
    'notifications',
    'kiosk',
  ],
  club: [
    'checkout',
    'orders',
    'products',
    'schedule',
    'schedule_blocks',
    'services',
    'comandas',
    'cashflow',
    'reports',
    'suppliers',
    'team',
    'commissions',
    'feedback',
    'portal',
    'kiosk',
  ],
  estetica: [
    'commissions',
    'chef_club',
    'feedback',
    'portal',
    'kiosk',
  ],
};

const KNOWN_APP_MODULES = new Set<AppModuleSlug>(
  Object.values(APP_ENABLED_MODULES).flat(),
);

export const isKnownAppModule = (moduleName: string): moduleName is AppModuleSlug =>
  KNOWN_APP_MODULES.has(moduleName as AppModuleSlug);

export const getAppSlugsEnabledForModule = (moduleName: AppModuleSlug): readonly AppSlug[] =>
  (Object.entries(APP_ENABLED_MODULES) as Array<[AppSlug, readonly AppModuleSlug[]]>)
    .filter(([, modules]) => modules.includes(moduleName))
    .map(([appSlug]) => appSlug);

// ─── Gate de plano (6.0.5.3) ──────────────────────────────────────
// Mapa módulo de UI → FeatureKey do licenciamento. O Sidebar só exibe um
// módulo quando `isAppModuleEnabled` (app) E `can(feature)` (plano/override).
// Módulos sem feature correspondente não são gated por plano.
export const MODULE_FEATURES: Partial<Record<AppModuleSlug, FeatureKey>> = {
  financial: 'finance',
  cashflow: 'finance',
  commissions: 'commissions',
  chef_club: 'chef_club',
};

export const getFeatureForModule = (moduleName: AppModuleSlug): FeatureKey | null =>
  MODULE_FEATURES[moduleName] ?? null;
