import type { ReactElement } from 'react';
import type { AppModuleSlug } from '@/src/lib/supabase/schemas';

export type LayoutRouteGuard = 'none' | 'manager' | 'superadmin';
export type RouteOwnership = 'app-specific' | 'shared-entry';

export interface AppLayoutRouteDefinition {
  path: string;
  feature: string;
  module: AppModuleSlug;
  guard: LayoutRouteGuard;
  ownership: RouteOwnership;
  element: ReactElement;
}

export interface AppLegacyLayoutRouteDefinition {
  path: string;
  feature: string;
  guard: LayoutRouteGuard;
  ownership: RouteOwnership;
  transitionalReason: string;
  element: ReactElement;
}

export interface AppStandaloneRouteDefinition {
  path: string;
  feature: string;
  ownership: RouteOwnership;
  element: ReactElement;
}

export interface AppGuardedStandaloneRouteDefinition extends AppStandaloneRouteDefinition {
  guard: LayoutRouteGuard;
}
