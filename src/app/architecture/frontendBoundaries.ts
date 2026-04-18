export type FrontendZone = 'core' | 'shared' | 'app';

export interface FrontendBoundaryDefinition {
  zone: FrontendZone;
  path: string;
  purpose: string;
  ownsAuthority?: boolean;
}

export const FRONTEND_BOUNDARIES: readonly FrontendBoundaryDefinition[] = [
  {
    zone: 'core',
    path: 'src/app/core',
    purpose: 'Runtime authority, app resolution, tenant resolution, routing and access control.',
    ownsAuthority: true,
  },
  {
    zone: 'shared',
    path: 'src/app/shared',
    purpose: 'Reusable UI, hooks, services and helpers that never decide app, tenant or schema.',
    ownsAuthority: false,
  },
  {
    zone: 'app',
    path: 'src/apps/barber',
    purpose: 'Barber-specific modules, routes, pages and manifests.',
    ownsAuthority: false,
  },
] as const;

export const FRONTEND_BOUNDARY_RULES: readonly string[] = [
  'core is the only frontend zone allowed to centralize runtime authority for app, tenant, schema and module access',
  'shared can be reused across apps, but must never interpret app, tenant, schema or role exceptions on its own',
  'app-specific code may consume authority, but must not recreate authority locally',
  'barber is an application boundary, not the structural center of the platform',
];
