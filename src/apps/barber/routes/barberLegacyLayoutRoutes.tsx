import SupabaseMonitoring from '@/pages/SupabaseMonitoring';
import PortalAdmin from '@/pages/portal/PortalAdmin';
import type { AppLegacyLayoutRouteDefinition, LayoutRouteGuard } from '@/src/app/core/routing/types';

const defineBarberLegacyLayoutRoute = (
  path: string,
  feature: string,
  guard: LayoutRouteGuard,
  element: AppLegacyLayoutRouteDefinition['element'],
  transitionalReason = 'Route still belongs to barber runtime but is outside the typed module manifest during Fase 2.',
): AppLegacyLayoutRouteDefinition => ({
  path,
  feature,
  guard,
  ownership: 'app-specific',
  transitionalReason,
  element,
});

export const barberLegacyLayoutRoutes: readonly AppLegacyLayoutRouteDefinition[] = [
  defineBarberLegacyLayoutRoute(
    '/admin/supabase-monitoring',
    'Supabase Monitoring',
    'manager',
    <SupabaseMonitoring />,
    'Route is being kept out of the barber module manifest because it is a future platform-admin capability, not a standard barber module.',
  ),
  defineBarberLegacyLayoutRoute(
    '/portal-admin',
    'Portal Admin',
    'manager',
    <PortalAdmin />,
    'Route is being kept out of the barber module manifest because it likely belongs to a future platform-admin capability, not a standard barber module.',
  ),
] as const;
