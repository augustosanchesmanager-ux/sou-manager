import type { Table } from 'dexie';
import type { AppSlug } from '../supabase/schemas';
import { getClientForTable } from '../supabase/client';
import { buildOfflineLocalKey, buildOfflineMetaKey, canUseIndexedDb, offlineDb } from './offlineDb';
import { addOfflineSyncLog } from './offlineQueue';
import type {
  OfflineCachedAppointment,
  OfflineCachedClient,
  OfflineCachedProduct,
  OfflineCachedRecord,
  OfflineCachedService,
  OfflineCachedStaff,
  OfflineCacheMeta,
  OfflineCacheResource,
  OfflineCacheSnapshot,
} from './offlineTypes';

type OfflineResourceResult = {
  resource: OfflineCacheResource;
  count: number;
  status: 'ready' | 'failed';
  error?: string;
};

type SupabaseRow = Record<string, unknown>;

const getString = (row: SupabaseRow, key: string): string | null => {
  const value = row[key];
  return typeof value === 'string' ? value : null;
};

const getNumber = (row: SupabaseRow, key: string): number | null => {
  const value = row[key];
  return typeof value === 'number' ? value : null;
};

const getBoolean = (row: SupabaseRow, key: string): boolean | null => {
  const value = row[key];
  return typeof value === 'boolean' ? value : null;
};

const toBaseCachedRecord = (
  row: SupabaseRow,
  tenantId: string,
  appSlug: AppSlug,
  cachedAt: string,
): OfflineCachedRecord | null => {
  const id = getString(row, 'id');
  if (!id) return null;

  return {
    local_key: buildOfflineLocalKey(tenantId, id),
    id,
    tenant_id: tenantId,
    app_slug: appSlug,
    updated_at: getString(row, 'updated_at'),
    cached_at: cachedAt,
  };
};

const replaceTenantCache = async <T extends OfflineCachedRecord>(
  table: Table<T, string>,
  tenantId: string,
  records: T[],
): Promise<void> => {
  await table.where('tenant_id').equals(tenantId).delete();
  if (records.length > 0) {
    await table.bulkPut(records);
  }
};

const upsertCacheMeta = async (
  tenantId: string,
  appSlug: AppSlug,
  resource: OfflineCacheResource,
  count: number,
  status: OfflineCacheMeta['status'],
  errorMessage?: string | null,
): Promise<void> => {
  await offlineDb.cacheMeta.put({
    key: buildOfflineMetaKey(tenantId, resource),
    tenant_id: tenantId,
    app_slug: appSlug,
    resource,
    updated_at: new Date().toISOString(),
    record_count: count,
    status,
    error_message: errorMessage ?? null,
  });
};

const loadRows = async (
  tableName: 'services' | 'products' | 'staff' | 'clients' | 'appointments',
  tenantId: string,
  appSlug: AppSlug,
  configure: (query: any) => any,
): Promise<SupabaseRow[]> => {
  const client = getClientForTable(tableName, appSlug);
  const query = configure(client.from(tableName).select('*').eq('tenant_id', tenantId));
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? (data as SupabaseRow[]) : [];
};

const cacheServices = async (tenantId: string, appSlug: AppSlug, cachedAt: string): Promise<number> => {
  const rows = await loadRows('services', tenantId, appSlug, (query) => query.order('name'));
  const records = rows
    .map((row): OfflineCachedService | null => {
      const base = toBaseCachedRecord(row, tenantId, appSlug, cachedAt);
      const name = getString(row, 'name');
      if (!base || !name) return null;

      return {
        ...base,
        name,
        commercial_name: getString(row, 'commercial_name'),
        category: getString(row, 'category'),
        duration: getNumber(row, 'duration') ?? getNumber(row, 'duration_minutes'),
        price: getNumber(row, 'price'),
        active: getBoolean(row, 'active') ?? getBoolean(row, 'is_active'),
      };
    })
    .filter((record): record is OfflineCachedService => Boolean(record));

  await replaceTenantCache(offlineDb.cachedServices, tenantId, records);
  return records.length;
};

const cacheProducts = async (tenantId: string, appSlug: AppSlug, cachedAt: string): Promise<number> => {
  const rows = await loadRows('products', tenantId, appSlug, (query) => query.order('name'));
  const records = rows
    .map((row): OfflineCachedProduct | null => {
      const base = toBaseCachedRecord(row, tenantId, appSlug, cachedAt);
      const name = getString(row, 'name');
      if (!base || !name) return null;

      return {
        ...base,
        name,
        commercial_name: getString(row, 'commercial_name'),
        description: getString(row, 'description'),
        sale_price: getNumber(row, 'sale_price'),
        stock_quantity: getNumber(row, 'stock_quantity'),
        minimum_stock: getNumber(row, 'minimum_stock'),
        active: getBoolean(row, 'active'),
      };
    })
    .filter((record): record is OfflineCachedProduct => Boolean(record));

  await replaceTenantCache(offlineDb.cachedProducts, tenantId, records);
  return records.length;
};

const cacheStaff = async (tenantId: string, appSlug: AppSlug, cachedAt: string): Promise<number> => {
  const rows = await loadRows('staff', tenantId, appSlug, (query) => query.eq('status', 'active').order('name'));
  const records = rows
    .map((row): OfflineCachedStaff | null => {
      const base = toBaseCachedRecord(row, tenantId, appSlug, cachedAt);
      const name = getString(row, 'name');
      if (!base || !name) return null;

      return {
        ...base,
        name,
        role: getString(row, 'role'),
        status: getString(row, 'status'),
        avatar: getString(row, 'avatar'),
      };
    })
    .filter((record): record is OfflineCachedStaff => Boolean(record));

  await replaceTenantCache(offlineDb.cachedStaff, tenantId, records);
  return records.length;
};

const cacheClients = async (tenantId: string, appSlug: AppSlug, cachedAt: string): Promise<number> => {
  const rows = await loadRows('clients', tenantId, appSlug, (query) => query.order('name').limit(80));
  const records = rows
    .map((row): OfflineCachedClient | null => {
      const base = toBaseCachedRecord(row, tenantId, appSlug, cachedAt);
      const name = getString(row, 'name');
      if (!base || !name) return null;

      return {
        ...base,
        name,
        phone: getString(row, 'phone'),
        email: getString(row, 'email'),
        last_visit: getString(row, 'last_visit'),
      };
    })
    .filter((record): record is OfflineCachedClient => Boolean(record));

  await replaceTenantCache(offlineDb.cachedClients, tenantId, records);
  return records.length;
};

const cacheTodayAppointments = async (tenantId: string, appSlug: AppSlug, cachedAt: string): Promise<number> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const rows = await loadRows('appointments', tenantId, appSlug, (query) =>
    query.gte('start_time', today.toISOString()).lt('start_time', tomorrow.toISOString()).order('start_time'),
  );

  const records = rows
    .map((row): OfflineCachedAppointment | null => {
      const base = toBaseCachedRecord(row, tenantId, appSlug, cachedAt);
      const startTime = getString(row, 'start_time');
      if (!base || !startTime) return null;

      return {
        ...base,
        client_id: getString(row, 'client_id'),
        service_id: getString(row, 'service_id'),
        staff_id: getString(row, 'staff_id'),
        client_name: getString(row, 'client_name'),
        service_name: getString(row, 'service_name'),
        staff_name: getString(row, 'staff_name'),
        start_time: startTime,
        status: getString(row, 'status'),
      };
    })
    .filter((record): record is OfflineCachedAppointment => Boolean(record));

  await replaceTenantCache(offlineDb.cachedAppointmentsToday, tenantId, records);
  return records.length;
};

export const refreshOfflineEssentialCache = async (
  tenantId: string,
  appSlug: AppSlug,
): Promise<OfflineResourceResult[]> => {
  if (!canUseIndexedDb()) {
    return [
      {
        resource: 'services',
        count: 0,
        status: 'failed',
        error: 'IndexedDB indisponivel neste navegador.',
      },
    ];
  }

  const cachedAt = new Date().toISOString();
  const loaders: Array<[OfflineCacheResource, () => Promise<number>]> = [
    ['services', () => cacheServices(tenantId, appSlug, cachedAt)],
    ['products', () => cacheProducts(tenantId, appSlug, cachedAt)],
    ['staff', () => cacheStaff(tenantId, appSlug, cachedAt)],
    ['clients', () => cacheClients(tenantId, appSlug, cachedAt)],
    ['appointments_today', () => cacheTodayAppointments(tenantId, appSlug, cachedAt)],
  ];

  const results: OfflineResourceResult[] = [];

  for (const [resource, loader] of loaders) {
    try {
      const count = await loader();
      await upsertCacheMeta(tenantId, appSlug, resource, count, 'ready');
      results.push({ resource, count, status: 'ready' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Falha desconhecida ao atualizar cache.';
      await upsertCacheMeta(tenantId, appSlug, resource, 0, 'failed', errorMessage);
      await addOfflineSyncLog({
        tenant_id: tenantId,
        app_slug: appSlug,
        level: 'warning',
        message: `Cache offline nao atualizado para ${resource}.`,
        details: { error: errorMessage },
      });
      results.push({ resource, count: 0, status: 'failed', error: errorMessage });
    }
  }

  await addOfflineSyncLog({
    tenant_id: tenantId,
    app_slug: appSlug,
    level: results.some((result) => result.status === 'failed') ? 'warning' : 'info',
    message: 'Atualizacao do cache essencial offline concluida.',
    details: { results },
  });

  return results;
};

export const readOfflineCacheSnapshot = async (
  tenantId: string,
  appSlug: AppSlug,
): Promise<OfflineCacheSnapshot> => {
  const generatedAt = new Date().toISOString();

  if (!canUseIndexedDb()) {
    return {
      tenant_id: tenantId,
      app_slug: appSlug,
      generated_at: generatedAt,
      counts: {
        services: 0,
        products: 0,
        staff: 0,
        clients: 0,
        appointments_today: 0,
      },
      meta: [],
    };
  }

  const [services, products, staff, clients, appointmentsToday, meta] = await Promise.all([
    offlineDb.cachedServices.where('tenant_id').equals(tenantId).count(),
    offlineDb.cachedProducts.where('tenant_id').equals(tenantId).count(),
    offlineDb.cachedStaff.where('tenant_id').equals(tenantId).count(),
    offlineDb.cachedClients.where('tenant_id').equals(tenantId).count(),
    offlineDb.cachedAppointmentsToday.where('tenant_id').equals(tenantId).count(),
    offlineDb.cacheMeta.where('tenant_id').equals(tenantId).toArray(),
  ]);

  return {
    tenant_id: tenantId,
    app_slug: appSlug,
    generated_at: generatedAt,
    counts: {
      services,
      products,
      staff,
      clients,
      appointments_today: appointmentsToday,
    },
    meta,
  };
};
