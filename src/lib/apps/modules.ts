import {
  DEFAULT_APP_SLUG,
  isAppSlug,
  type AppModuleSlug,
  type AppSlug,
} from '../supabase/schemas';
import {
  APP_BLOCKED_MODULES,
  APP_ENABLED_MODULES,
} from './moduleRegistry';

export { APP_BLOCKED_MODULES, APP_ENABLED_MODULES };
export { getFeatureForModule, MODULE_FEATURES } from './moduleRegistry';

const resolveAppSlug = (appSlug?: string | null): AppSlug =>
  isAppSlug(appSlug) ? appSlug : DEFAULT_APP_SLUG;

export const getEnabledModulesForApp = (appSlug?: string | null): readonly AppModuleSlug[] =>
  APP_ENABLED_MODULES[resolveAppSlug(appSlug)];

export const getBlockedModulesForApp = (appSlug?: string | null): readonly AppModuleSlug[] =>
  APP_BLOCKED_MODULES[resolveAppSlug(appSlug)];

export const isAppModuleEnabled = (
  appSlug: string | null | undefined,
  moduleName: AppModuleSlug,
): boolean => getEnabledModulesForApp(appSlug).includes(moduleName);
