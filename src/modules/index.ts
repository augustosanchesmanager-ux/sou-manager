import { autoModule } from './auto';
import { barberModule } from './barber';
import { clubModule } from './club';
import type { AppModuleSlug, AppSlug } from '../lib/supabase/schemas';
import type { AppModuleDefinition } from './types';

export const APP_MODULES = {
  auto: autoModule,
  barber: barberModule,
  club: clubModule,
} as const;

export const getAppModuleDefinition = (appSlug: AppSlug): AppModuleDefinition =>
  APP_MODULES[appSlug];

export const getSupportedModulesForApp = (appSlug: AppSlug): readonly AppModuleSlug[] =>
  getAppModuleDefinition(appSlug).supportedModules;

export const appModuleSupports = (appSlug: AppSlug, moduleSlug: AppModuleSlug): boolean =>
  getSupportedModulesForApp(appSlug).includes(moduleSlug);
