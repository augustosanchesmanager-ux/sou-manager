import PortalLanding from '@/pages/portal/PortalLanding';
import PortalLogin from '@/pages/portal/PortalLogin';
import PortalApp from '@/pages/portal/PortalApp';
import PortalSchedule from '@/pages/portal/PortalSchedule';
import KioskPage from '@/pages/kiosk/KioskPage';
import KioskClientPage from '@/pages/kiosk/KioskClientPage';
import { PortalAuthProvider } from '@/components/PortalAuthProvider';
import type { AppStandaloneRouteDefinition } from '@/src/app/core/routing/types';

const defineBarberPublicRoute = (
  path: string,
  feature: string,
  element: AppStandaloneRouteDefinition['element'],
): AppStandaloneRouteDefinition => ({
  path,
  feature,
  ownership: 'app-specific',
  element,
});

export const barberPublicRoutes: readonly AppStandaloneRouteDefinition[] = [
  defineBarberPublicRoute('/kiosk/:tenantSlug', 'Public Kiosk', <KioskPage />),
  defineBarberPublicRoute('/kiosk/:tenantSlug/client', 'Public Kiosk Client', <KioskClientPage />),
  defineBarberPublicRoute('/c/:tenantSlug', 'Portal Landing', <PortalLanding />),
  defineBarberPublicRoute('/c/:tenantSlug/login', 'Portal Login', <PortalAuthProvider><PortalLogin /></PortalAuthProvider>),
  defineBarberPublicRoute('/c/:tenantSlug/app', 'Portal App', <PortalAuthProvider><PortalApp /></PortalAuthProvider>),
  defineBarberPublicRoute('/c/:tenantSlug/app/schedule', 'Portal Schedule', <PortalAuthProvider><PortalSchedule /></PortalAuthProvider>),
] as const;
