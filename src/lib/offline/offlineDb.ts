import Dexie, { type Table } from 'dexie';
import type {
  OfflineCachedAppointment,
  OfflineCachedClient,
  OfflineCachedProduct,
  OfflineCachedService,
  OfflineCachedStaff,
  OfflineCacheMeta,
  OfflineQueueItem,
  OfflineSyncLog,
} from './offlineTypes';

class SouManagerOfflineDb extends Dexie {
  offlineQueue!: Table<OfflineQueueItem, string>;
  syncLogs!: Table<OfflineSyncLog, number>;
  cacheMeta!: Table<OfflineCacheMeta, string>;
  cachedServices!: Table<OfflineCachedService, string>;
  cachedProducts!: Table<OfflineCachedProduct, string>;
  cachedStaff!: Table<OfflineCachedStaff, string>;
  cachedClients!: Table<OfflineCachedClient, string>;
  cachedAppointmentsToday!: Table<OfflineCachedAppointment, string>;

  constructor() {
    super('soumanager.offline.safe-counter.v1');

    this.version(1).stores({
      offlineQueue: 'id, tenant_id, app_slug, status, action_type, entity_type, created_at, updated_at',
      syncLogs: '++id, tenant_id, app_slug, level, created_at',
      cacheMeta: 'key, tenant_id, app_slug, resource, updated_at, status',
      cachedServices: 'local_key, tenant_id, app_slug, id, name, cached_at',
      cachedProducts: 'local_key, tenant_id, app_slug, id, name, cached_at',
      cachedStaff: 'local_key, tenant_id, app_slug, id, name, cached_at',
      cachedClients: 'local_key, tenant_id, app_slug, id, name, cached_at',
      cachedAppointmentsToday: 'local_key, tenant_id, app_slug, id, start_time, status, cached_at',
    });
  }
}

export const offlineDb = new SouManagerOfflineDb();

export const buildOfflineLocalKey = (tenantId: string, id: string): string => `${tenantId}:${id}`;

export const buildOfflineMetaKey = (tenantId: string, resource: string): string => `${tenantId}:${resource}`;

export const canUseIndexedDb = (): boolean =>
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
