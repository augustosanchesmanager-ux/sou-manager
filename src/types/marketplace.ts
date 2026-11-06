/**
 * Tipos do Ecossistema de Marketplace & Extensões (Subfase 8.4)
 * Referência: ADR-041 (ACCEPTED)
 */

export type MarketplaceExtensionCategory =
  | 'hardware'
  | 'communication'
  | 'fiscal'
  | 'analytics'
  | 'marketing'
  | 'other';

export type MarketplaceExtensionPricingType = 'free' | 'subscription' | 'one_time';

export type MarketplaceExtensionStatus = 'draft' | 'under_review' | 'published' | 'deprecated';

export type TenantExtensionStatus = 'active' | 'suspended' | 'uninstalled';

export interface MarketplaceExtension {
  id: string;
  slug: string;
  name: string;
  headline: string;
  description: string;
  developer_name: string;
  developer_email: string;
  developer_url?: string | null;
  category: MarketplaceExtensionCategory;
  icon_url?: string | null;
  banner_url?: string | null;
  version: string;
  pricing_type: MarketplaceExtensionPricingType;
  price_cents: number;
  required_scopes: string[];
  webhook_events: string[];
  status: MarketplaceExtensionStatus;
  rating_avg: number;
  install_count: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantExtension {
  id: string;
  tenant_id: string;
  extension_id: string;
  status: TenantExtensionStatus;
  granted_scopes: string[];
  settings: Record<string, unknown>;
  installed_at: string;
  uninstalled_at?: string | null;
  created_at: string;
  updated_at: string;
  // Opcional: junção com os metadados da extensão
  extension?: MarketplaceExtension | null;
}

export interface ExtensionReview {
  id: string;
  extension_id: string;
  tenant_id: string;
  user_id: string;
  rating: number; // 1 a 5
  comment?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ExtensionWithInstallation extends MarketplaceExtension {
  is_installed: boolean;
  installation?: TenantExtension | null;
}

export interface ListExtensionsOptions {
  category?: MarketplaceExtensionCategory | string;
  search?: string;
  status?: MarketplaceExtensionStatus | string;
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface InstallExtensionResult {
  success: boolean;
  tenant_id: string;
  extension_id: string;
  status: TenantExtensionStatus;
  granted_scopes: string[];
  installed_at: string;
}
