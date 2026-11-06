/**
 * Tipos de Conectores e Integrações Core (Subfase 8.5)
 * Referência: ADR-040 (ACCEPTED)
 */

export type IntegrationCategory = 'payment_gateway' | 'fiscal_erp' | 'crm_marketing';

export type IntegrationAuthType = 'api_key' | 'oauth2' | 'webhook_secret';

export type TenantIntegrationStatus = 'active' | 'error' | 'disabled';

export type SyncDirection = 'inbound' | 'outbound';

export type SyncStatus = 'success' | 'failed' | 'ignored';

export interface IntegrationProvider {
  id: string;
  slug: string;
  name: string;
  category: IntegrationCategory;
  auth_type: IntegrationAuthType;
  logo_url?: string | null;
  description: string;
  settings_schema: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantIntegration {
  id: string;
  tenant_id: string;
  provider_id: string;
  status: TenantIntegrationStatus;
  encrypted_credentials?: Record<string, unknown>;
  settings: Record<string, unknown>;
  last_synced_at?: string | null;
  last_error_message?: string | null;
  created_at: string;
  updated_at: string;
  provider?: IntegrationProvider | null;
}

export interface IntegrationSyncLog {
  id: string;
  tenant_id: string;
  integration_id: string;
  event_type: string;
  direction: SyncDirection;
  status: SyncStatus;
  external_ref_id?: string | null;
  duration_ms: number;
  details: Record<string, unknown>;
  error_message?: string | null;
  created_at: string;
}

export interface ConfigureIntegrationInput {
  tenantId: string;
  providerId: string;
  credentials?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface RecordSyncLogInput {
  tenantId: string;
  integrationId: string;
  eventType: string;
  direction: SyncDirection;
  status: SyncStatus;
  externalRefId?: string | null;
  durationMs?: number;
  details?: Record<string, unknown>;
  errorMessage?: string | null;
}
