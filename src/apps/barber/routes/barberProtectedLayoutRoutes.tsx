import Dashboard from '@/pages/Dashboard';
import Checkout from '@/pages/Checkout';
import Comandas from '@/pages/Comandas';
import Schedule from '@/pages/Schedule';
import Clients from '@/pages/Clients';
import Orders from '@/pages/Orders';
import OrderDetails from '@/pages/OrderDetails';
import Cashflow from '@/pages/Cashflow';
import SmartReturn from '@/pages/SmartReturn';
import Operations from '@/pages/Operations';
import Reports from '@/pages/Reports';
import Performance from '@/pages/Performance';
import Financial from '@/pages/Financial';
import Expenses from '@/pages/Expenses';
import Receipts from '@/pages/Receipts';
import Payroll from '@/pages/Payroll';
import Commissions from '@/pages/Commissions';
import Team from '@/pages/Team';
import Categories from '@/pages/Categories';
import Support from '@/pages/Support';
import Settings from '@/pages/Settings';
import KioskAdmin from '@/pages/KioskAdmin';
import BusinessIntelligence from '@/pages/BusinessIntelligence';
import Promotions from '@/pages/Promotions';
import StrategicDashboard from '@/pages/StrategicDashboard';
import type { AppLayoutRouteDefinition, LayoutRouteGuard } from '@/src/app/core/routing/types';
import {
  ChefClubPlansPage,
  ChefClubSubscriptionNewPage,
  ChefClubSubscriptionsPage,
  ProductsPage,
  ServicesPage,
  SuppliersPage,
} from '../pages';
import { barberAppManifest } from '../manifests';

const manifestRoutesByPath = new Map(
  barberAppManifest.routes.map((route) => [route.path, route] as const),
);

const defineBarberProtectedRoute = (
  path: string,
  guard: LayoutRouteGuard,
  element: AppLayoutRouteDefinition['element'],
): AppLayoutRouteDefinition => {
  const manifestRoute = manifestRoutesByPath.get(path);

  if (!manifestRoute) {
    throw new Error(`Barber route "${path}" must be declared in barberAppManifest`);
  }

  return {
    path,
    feature: manifestRoute.feature,
    module: manifestRoute.module,
    ownership: manifestRoute.ownership,
    guard,
    element,
  };
};

export const barberProtectedLayoutRoutes: readonly AppLayoutRouteDefinition[] = [
  defineBarberProtectedRoute('/dashboard', 'none', <Dashboard />),
  defineBarberProtectedRoute('/checkout/:id?', 'none', <Checkout />),
  defineBarberProtectedRoute('/comandas', 'none', <Comandas />),
  defineBarberProtectedRoute('/schedule', 'none', <Schedule />),
  defineBarberProtectedRoute('/clients', 'manager', <Clients />),
  defineBarberProtectedRoute('/orders', 'manager', <Orders />),
  defineBarberProtectedRoute('/orders/:id', 'manager', <OrderDetails />),
  defineBarberProtectedRoute('/products', 'manager', <ProductsPage />),
  defineBarberProtectedRoute('/services', 'manager', <ServicesPage />),
  defineBarberProtectedRoute('/suppliers', 'manager', <SuppliersPage />),
  defineBarberProtectedRoute('/operations', 'manager', <Operations />),
  defineBarberProtectedRoute('/smart-return', 'manager', <SmartReturn />),
  defineBarberProtectedRoute('/reports', 'manager', <Reports />),
  defineBarberProtectedRoute('/performance', 'manager', <Performance />),
  defineBarberProtectedRoute('/financial', 'manager', <Financial />),
  defineBarberProtectedRoute('/expenses', 'manager', <Expenses />),
  defineBarberProtectedRoute('/receipts', 'manager', <Receipts />),
  defineBarberProtectedRoute('/payroll', 'manager', <Payroll />),
  defineBarberProtectedRoute('/commissions', 'manager', <Commissions />),
  defineBarberProtectedRoute('/team', 'manager', <Team />),
  defineBarberProtectedRoute('/categories', 'manager', <Categories />),
  defineBarberProtectedRoute('/support', 'none', <Support />),
  defineBarberProtectedRoute('/settings', 'manager', <Settings />),
  defineBarberProtectedRoute('/kiosk-admin', 'manager', <KioskAdmin />),
  defineBarberProtectedRoute('/bi', 'manager', <BusinessIntelligence />),
  defineBarberProtectedRoute('/promotions', 'manager', <Promotions />),
  defineBarberProtectedRoute('/strategic-dashboard', 'none', <StrategicDashboard />),
  defineBarberProtectedRoute('/cashflow', 'manager', <Cashflow />),
  defineBarberProtectedRoute('/chef-club-plans', 'manager', <ChefClubPlansPage />),
  defineBarberProtectedRoute('/chef-club-subscriptions', 'manager', <ChefClubSubscriptionsPage />),
  defineBarberProtectedRoute('/chef-club-subscriptions/new', 'manager', <ChefClubSubscriptionNewPage />),
] as const;
