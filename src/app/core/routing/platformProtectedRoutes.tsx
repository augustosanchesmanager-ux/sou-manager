import SystemSelector from '@/pages/SystemSelector';
import RoleSelection from '@/pages/onboarding/RoleSelection';
import ShopSetup from '@/pages/onboarding/ShopSetup';
import ProfessionalSetup from '@/pages/onboarding/ProfessionalSetup';
import type { AppStandaloneRouteDefinition } from './types';

const definePlatformProtectedRoute = (
  path: string,
  feature: string,
  element: AppStandaloneRouteDefinition['element'],
): AppStandaloneRouteDefinition => ({
  path,
  feature,
  ownership: 'shared-entry',
  element,
});

export const platformProtectedRoutes: readonly AppStandaloneRouteDefinition[] = [
  definePlatformProtectedRoute('/select-system', 'System Selector', <SystemSelector />),
  definePlatformProtectedRoute('/onboarding/role', 'Role Selection', <RoleSelection />),
  definePlatformProtectedRoute('/onboarding/shop-setup', 'Shop Setup', <ShopSetup />),
  definePlatformProtectedRoute('/onboarding/professional-setup', 'Professional Setup', <ProfessionalSetup />),
] as const;
