/**
 * [SMG][DOMAIN][SHARED] App Definition
 *
 * Fonte única da verdade para AppSlug e AppModuleSlug.
 * Todo o domínio importa daqui.
 * Infraestrutura (schemas.ts) re-exporta para manter compatibilidade.
 */

export const APP_SLUGS = ['barber', 'auto', 'club', 'estetica'] as const;

export type AppSlug = (typeof APP_SLUGS)[number];

export const DEFAULT_APP_SLUG: AppSlug = 'barber';

export type AppModuleSlug =
  | 'dashboard'
  | 'checkout'
  | 'orders'
  | 'products'
  | 'clients'
  | 'schedule'
  | 'schedule_blocks'
  | 'services'
  | 'comandas'
  | 'cashflow'
  | 'financial'
  | 'reports'
  | 'settings'
  | 'suppliers'
  | 'team'
  | 'commissions'
  | 'chef_club'
  | 'feedback'
  | 'portal'
  | 'notifications'
  | 'kiosk';
