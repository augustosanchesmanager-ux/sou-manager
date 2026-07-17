import type { AppSlug } from '../supabase/schemas';
import { canUseIndexedDb, offlineDb } from './offlineDb';
import type {
  OfflineQueueActionType,
  OfflineQueueItem,
  OfflineQueueStatus,
  OfflineQueueSummary,
  OfflineSyncLog,
} from './offlineTypes';

const BLOCKED_ACTION_PATTERNS = [
  'payment',
  'settle',
  'settlement',
  'finance',
  'financial',
  'transaction',
  'comanda_close',
  'close_comanda',
  'zero_close',
  'commission',
  'chef_club_credit',
  'cash_closing',
  'stock_movement',
];

const createOfflineId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const isOfflineActionBlockedForPhaseOne = (actionType: string): boolean => {
  const normalized = actionType.toLowerCase();
  return BLOCKED_ACTION_PATTERNS.some((pattern) => normalized.includes(pattern));
};

export const addOfflineSyncLog = async (log: Omit<OfflineSyncLog, 'created_at'> & { created_at?: string }) => {
  if (!canUseIndexedDb()) return;

  await offlineDb.syncLogs.add({
    ...log,
    created_at: log.created_at || new Date().toISOString(),
  });
};

export const enqueueOfflineAction = async (params: {
  tenantId: string;
  appSlug: AppSlug;
  actionType: OfflineQueueActionType;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<OfflineQueueItem> => {
  const now = new Date().toISOString();
  const isBlocked = isOfflineActionBlockedForPhaseOne(params.actionType);
  const item: OfflineQueueItem = {
    id: createOfflineId('offline-queue'),
    tenant_id: params.tenantId,
    app_slug: params.appSlug,
    action_type: params.actionType,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    status: isBlocked ? 'blocked' : 'pending',
    payload: params.payload || {},
    error_message: isBlocked
      ? 'Acao bloqueada na Fase 1: pagamentos, fechamento financeiro, comissoes e estoque real ainda nao sincronizam offline.'
      : null,
    retry_count: 0,
    created_at: now,
    updated_at: now,
    synced_at: null,
  };

  if (!canUseIndexedDb()) {
    return item;
  }

  await offlineDb.offlineQueue.add(item);
  await addOfflineSyncLog({
    tenant_id: params.tenantId,
    app_slug: params.appSlug,
    level: isBlocked ? 'warning' : 'info',
    message: isBlocked ? 'Acao offline bloqueada pela Fase 1.' : 'Acao offline registrada na fila local.',
    details: { actionType: params.actionType, entityType: params.entityType, entityId: params.entityId ?? null },
  });

  return item;
};

export const listOfflineQueueItems = async (tenantId: string): Promise<OfflineQueueItem[]> => {
  if (!canUseIndexedDb()) return [];

  return offlineDb.offlineQueue
    .where('tenant_id')
    .equals(tenantId)
    .reverse()
    .sortBy('created_at');
};

export const listOfflineSyncLogs = async (tenantId: string, limit = 50): Promise<OfflineSyncLog[]> => {
  if (!canUseIndexedDb()) return [];

  const logs = await offlineDb.syncLogs
    .where('tenant_id')
    .equals(tenantId)
    .reverse()
    .sortBy('created_at');

  return logs.slice(0, limit);
};

export const updateOfflineQueueItemStatus = async (
  id: string,
  status: OfflineQueueStatus,
  errorMessage?: string | null,
): Promise<void> => {
  if (!canUseIndexedDb()) return;

  await offlineDb.offlineQueue.update(id, {
    status,
    error_message: errorMessage ?? null,
    updated_at: new Date().toISOString(),
    synced_at: status === 'synced' ? new Date().toISOString() : null,
  });
};

export const getOfflineQueueSummary = async (tenantId: string): Promise<OfflineQueueSummary> => {
  const items = await listOfflineQueueItems(tenantId);

  return items.reduce<OfflineQueueSummary>(
    (summary, item) => ({
      ...summary,
      [item.status]: item.status in summary ? summary[item.status as keyof OfflineQueueSummary] + 1 : undefined,
    }),
    { pending: 0, blocked: 0, failed: 0, synced: 0 },
  );
};
