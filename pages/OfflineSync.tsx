import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../src/hooks/useOnlineStatus';
import {
  readOfflineCacheSnapshot,
  refreshOfflineEssentialCache,
} from '../src/lib/offline/offlineCache';
import {
  getOfflineQueueSummary,
  listOfflineQueueItems,
  listOfflineSyncLogs,
} from '../src/lib/offline/offlineQueue';
import type {
  OfflineCacheResource,
  OfflineCacheSnapshot,
  OfflineQueueItem,
  OfflineQueueSummary,
  OfflineSyncLog,
} from '../src/lib/offline/offlineTypes';

const resourceLabels: Record<OfflineCacheResource, string> = {
  services: 'Servicos',
  products: 'Produtos',
  staff: 'Profissionais',
  clients: 'Clientes recentes',
  appointments_today: 'Agenda do dia',
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const emptySummary: OfflineQueueSummary = {
  pending: 0,
  blocked: 0,
  failed: 0,
  synced: 0,
};

const OfflineSync: React.FC = () => {
  const { tenantId, appSlug } = useAuth();
  const { isOnline } = useOnlineStatus();
  const [queueItems, setQueueItems] = useState<OfflineQueueItem[]>([]);
  const [logs, setLogs] = useState<OfflineSyncLog[]>([]);
  const [summary, setSummary] = useState<OfflineQueueSummary>(emptySummary);
  const [snapshot, setSnapshot] = useState<OfflineCacheSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheRows = useMemo(() => {
    if (!snapshot) return [];

    return (Object.keys(resourceLabels) as OfflineCacheResource[]).map((resource) => {
      const meta = snapshot.meta.find((item) => item.resource === resource);
      return {
        resource,
        label: resourceLabels[resource],
        count: snapshot.counts[resource],
        updatedAt: meta?.updated_at,
        status: meta?.status || 'partial',
        error: meta?.error_message,
      };
    });
  }, [snapshot]);

  const reload = useCallback(async () => {
    if (!tenantId) {
      setQueueItems([]);
      setLogs([]);
      setSummary(emptySummary);
      setSnapshot(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextItems, nextLogs, nextSummary, nextSnapshot] = await Promise.all([
        listOfflineQueueItems(tenantId),
        listOfflineSyncLogs(tenantId),
        getOfflineQueueSummary(tenantId),
        readOfflineCacheSnapshot(tenantId, appSlug),
      ]);

      setQueueItems(nextItems);
      setLogs(nextLogs);
      setSummary(nextSummary);
      setSnapshot(nextSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar pendências offline.');
    } finally {
      setLoading(false);
    }
  }, [appSlug, tenantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleRefreshCache = async () => {
    if (!tenantId || !isOnline) return;

    setRefreshingCache(true);
    setError(null);

    try {
      await refreshOfflineEssentialCache(tenantId, appSlug);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar o cache offline.');
    } finally {
      setRefreshingCache(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#007BFF] dark:text-[#00D2FF]">
            Modo Balcao Offline Seguro
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
            Pendencias offline
          </h1>
        </div>

        <button
          type="button"
          onClick={handleRefreshCache}
          disabled={!tenantId || !isOnline || refreshingCache}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007BFF] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#0067d6] disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
        >
          <span className={`material-symbols-outlined text-[18px] ${refreshingCache ? 'animate-spin' : ''}`}>
            sync
          </span>
          {refreshingCache ? 'Atualizando...' : 'Atualizar cache'}
        </button>
      </div>

      <div className={`rounded-lg border px-4 py-3 text-sm ${
        isOnline
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200'
          : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
      }`}>
        <div className="flex items-center gap-2 font-semibold">
          <span className="material-symbols-outlined text-[20px]">{isOnline ? 'cloud_done' : 'cloud_off'}</span>
          {isOnline
            ? 'Online. A fila real de venda e pagamento offline permanece desativada nesta fase.'
            : 'Offline. Esta tela consulta apenas IndexedDB local.'}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      {!tenantId && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm dark:border-[#14304A] dark:bg-[#071426] dark:text-slate-300">
          Tenant nao resolvido para a sessao atual.
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[
          ['Pendentes', summary.pending, 'hourglass_empty'],
          ['Bloqueadas', summary.blocked, 'block'],
          ['Falhas', summary.failed, 'error'],
          ['Sincronizadas', summary.synced, 'done_all'],
        ].map(([label, value, icon]) => (
          <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-[#14304A] dark:bg-[#071426]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{label}</span>
              <span className="material-symbols-outlined text-[20px] text-[#007BFF] dark:text-[#00D2FF]">{icon}</span>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-[#14304A] dark:bg-[#071426]">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-[#14304A]">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Cache local essencial</h2>
        </div>
        <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-[#14304A]">
          {cacheRows.map((row) => (
            <div key={row.resource} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{row.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ultima atualizacao: {formatDateTime(row.updatedAt)}
                </p>
                {row.error && <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-300">{row.error}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{row.count} registros</span>
                <span className={`rounded-full px-2 py-1 text-xs font-black uppercase ${
                  row.status === 'ready'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
                }`}>
                  {row.status}
                </span>
              </div>
            </div>
          ))}
          {!loading && cacheRows.length === 0 && (
            <div className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
              Nenhum cache local encontrado.
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-[#14304A] dark:bg-[#071426]">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-[#14304A]">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Fila local</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#14304A]">
            {queueItems.slice(0, 20).map((item) => (
              <div key={item.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{item.action_type}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {item.entity_type} | {formatDateTime(item.created_at)}
                </p>
                {item.error_message && (
                  <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-300">{item.error_message}</p>
                )}
              </div>
            ))}
            {!loading && queueItems.length === 0 && (
              <div className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
                Nenhuma pendencia local registrada.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-[#14304A] dark:bg-[#071426]">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-[#14304A]">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Logs locais</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-[#14304A]">
            {logs.slice(0, 20).map((log) => (
              <div key={`${log.id}-${log.created_at}`} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{log.message}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {log.level}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(log.created_at)}</p>
              </div>
            ))}
            {!loading && logs.length === 0 && (
              <div className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
                Nenhum log local registrado.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default OfflineSync;
