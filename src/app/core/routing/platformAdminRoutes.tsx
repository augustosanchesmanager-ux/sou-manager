import Admin from '@/pages/Admin';
import SuperAdmin from '@/pages/SuperAdmin';
import { platformAdminRouteDomains } from '../admin/platformAdminCapabilities';
import type { AppGuardedStandaloneRouteDefinition } from './types';

const definePlatformAdminRoute = (
  path: string,
  feature: string,
  guard: AppGuardedStandaloneRouteDefinition['guard'],
  element: AppGuardedStandaloneRouteDefinition['element'],
): AppGuardedStandaloneRouteDefinition => ({
  path,
  feature,
  guard,
  ownership: 'shared-entry',
  element,
});

export const platformAdminRoutes: readonly AppGuardedStandaloneRouteDefinition[] = [
  definePlatformAdminRoute('/admin', platformAdminRouteDomains.admin.feature, 'superadmin', <Admin />),
  definePlatformAdminRoute('/superadmin', platformAdminRouteDomains.superadmin.feature, 'superadmin', <SuperAdmin />),
] as const;
