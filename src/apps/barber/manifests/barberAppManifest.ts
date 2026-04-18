import type { AppModuleSlug } from '../../../lib/supabase/schemas';

export interface BarberRouteDefinition {
  path: string;
  feature: string;
  module: AppModuleSlug;
  ownership: 'app-specific' | 'shared-entry';
}

export interface BarberAppManifest {
  slug: 'barber';
  label: string;
  defaultEntrypoint: string;
  runtimeOwner: 'platform-core';
  routeOwner: 'apps/barber';
  supportedModules: readonly AppModuleSlug[];
  routes: readonly BarberRouteDefinition[];
}

export const barberAppManifest: BarberAppManifest = {
  slug: 'barber',
  label: 'SMG Barber',
  defaultEntrypoint: '/dashboard',
  runtimeOwner: 'platform-core',
  routeOwner: 'apps/barber',
  supportedModules: [
    'dashboard',
    'checkout',
    'comandas',
    'schedule',
    'clients',
    'orders',
    'products',
    'services',
    'suppliers',
    'operations',
    'smart_return',
    'reports',
    'performance',
    'financial',
    'expenses',
    'receipts',
    'payroll',
    'commissions',
    'team',
    'categories',
    'support',
    'settings',
    'kiosk_admin',
    'business_intelligence',
    'promotions',
    'strategic_dashboard',
    'cashflow',
    'chef_club',
    'notifications',
  ],
  routes: [
    { path: '/dashboard', feature: 'Dashboard', module: 'dashboard', ownership: 'shared-entry' },
    { path: '/checkout/:id?', feature: 'Checkout', module: 'checkout', ownership: 'app-specific' },
    { path: '/comandas', feature: 'Comandas', module: 'comandas', ownership: 'app-specific' },
    { path: '/schedule', feature: 'Schedule', module: 'schedule', ownership: 'app-specific' },
    { path: '/clients', feature: 'Clients', module: 'clients', ownership: 'app-specific' },
    { path: '/orders', feature: 'Orders', module: 'orders', ownership: 'app-specific' },
    { path: '/orders/:id', feature: 'Order Details', module: 'orders', ownership: 'app-specific' },
    { path: '/products', feature: 'Products', module: 'products', ownership: 'app-specific' },
    { path: '/services', feature: 'Services', module: 'services', ownership: 'app-specific' },
    { path: '/suppliers', feature: 'Suppliers', module: 'suppliers', ownership: 'app-specific' },
    { path: '/operations', feature: 'Operations', module: 'operations', ownership: 'app-specific' },
    { path: '/smart-return', feature: 'Smart Return', module: 'smart_return', ownership: 'app-specific' },
    { path: '/reports', feature: 'Reports', module: 'reports', ownership: 'app-specific' },
    { path: '/performance', feature: 'Performance', module: 'performance', ownership: 'app-specific' },
    { path: '/financial', feature: 'Financial', module: 'financial', ownership: 'app-specific' },
    { path: '/expenses', feature: 'Expenses', module: 'expenses', ownership: 'app-specific' },
    { path: '/receipts', feature: 'Receipts', module: 'receipts', ownership: 'app-specific' },
    { path: '/payroll', feature: 'Payroll', module: 'payroll', ownership: 'app-specific' },
    { path: '/commissions', feature: 'Commissions', module: 'commissions', ownership: 'app-specific' },
    { path: '/team', feature: 'Team', module: 'team', ownership: 'app-specific' },
    { path: '/categories', feature: 'Categories', module: 'categories', ownership: 'app-specific' },
    { path: '/support', feature: 'Support', module: 'support', ownership: 'app-specific' },
    { path: '/settings', feature: 'Settings', module: 'settings', ownership: 'app-specific' },
    { path: '/kiosk-admin', feature: 'Kiosk Admin', module: 'kiosk_admin', ownership: 'app-specific' },
    { path: '/bi', feature: 'Business Intelligence', module: 'business_intelligence', ownership: 'app-specific' },
    { path: '/promotions', feature: 'Promotions', module: 'promotions', ownership: 'app-specific' },
    { path: '/strategic-dashboard', feature: 'Strategic Dashboard', module: 'strategic_dashboard', ownership: 'app-specific' },
    { path: '/cashflow', feature: 'Cashflow', module: 'cashflow', ownership: 'app-specific' },
    { path: '/chef-club-plans', feature: 'Chef Club Plans', module: 'chef_club', ownership: 'app-specific' },
    { path: '/chef-club-subscriptions', feature: 'Chef Club Subscriptions', module: 'chef_club', ownership: 'app-specific' },
    { path: '/chef-club-subscriptions/new', feature: 'New Chef Club Subscription', module: 'chef_club', ownership: 'app-specific' },
  ],
} as const;
