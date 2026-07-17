import type { AppSlug } from '../supabase/schemas';

export type OfflineConnectionState = 'online' | 'offline';

export type OfflineQueueStatus = 'pending' | 'blocked' | 'syncing' | 'synced' | 'failed';

export type OfflineQueueActionType =
  | 'cache_refresh'
  | 'draft_note'
  | 'customer_lookup'
  | 'schedule_lookup'
  | 'service_lookup'
  | 'product_lookup'
  | string;

export interface TenantScopedOfflineRecord {
  tenant_id: string;
  app_slug: AppSlug;
}

export interface OfflineQueueItem extends TenantScopedOfflineRecord {
  id: string;
  action_type: OfflineQueueActionType;
  entity_type: string;
  entity_id?: string | null;
  status: OfflineQueueStatus;
  payload: Record<string, unknown>;
  error_message?: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  synced_at?: string | null;
}

export interface OfflineSyncLog extends Partial<TenantScopedOfflineRecord> {
  id?: number;
  level: 'info' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface OfflineCacheMeta extends TenantScopedOfflineRecord {
  key: string;
  resource: OfflineCacheResource;
  updated_at: string;
  record_count: number;
  status: 'ready' | 'partial' | 'failed';
  error_message?: string | null;
}

export type OfflineCacheResource = 'services' | 'products' | 'staff' | 'clients' | 'appointments_today';

export interface OfflineCachedRecord extends TenantScopedOfflineRecord {
  local_key: string;
  id: string;
  updated_at?: string | null;
  cached_at: string;
}

export interface OfflineCachedService extends OfflineCachedRecord {
  name: string;
  commercial_name?: string | null;
  category?: string | null;
  duration?: number | null;
  price?: number | null;
  active?: boolean | null;
}

export interface OfflineCachedProduct extends OfflineCachedRecord {
  name: string;
  commercial_name?: string | null;
  description?: string | null;
  sale_price?: number | null;
  stock_quantity?: number | null;
  minimum_stock?: number | null;
  active?: boolean | null;
}

export interface OfflineCachedStaff extends OfflineCachedRecord {
  name: string;
  role?: string | null;
  status?: string | null;
  avatar?: string | null;
}

export interface OfflineCachedClient extends OfflineCachedRecord {
  name: string;
  phone?: string | null;
  email?: string | null;
  last_visit?: string | null;
}

export interface OfflineCachedAppointment extends OfflineCachedRecord {
  client_id?: string | null;
  service_id?: string | null;
  staff_id?: string | null;
  client_name?: string | null;
  service_name?: string | null;
  staff_name?: string | null;
  start_time: string;
  status?: string | null;
}

export interface OfflineCacheSnapshot {
  tenant_id: string;
  app_slug: AppSlug;
  generated_at: string;
  counts: Record<OfflineCacheResource, number>;
  meta: OfflineCacheMeta[];
}

export interface OfflineQueueSummary {
  pending: number;
  blocked: number;
  failed: number;
  synced: number;
}
