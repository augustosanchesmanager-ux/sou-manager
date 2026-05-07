import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { notificationsService } from '../services/notificationsService';
import type { InternalNotification, InternalNotificationStatus } from '../types/notifications';

const SWEEP_STORAGE_PREFIX = 'soumanager.notifications.sweep';
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

export const useNotifications = (initialStatus: InternalNotificationStatus | 'all' = 'unread') => {
  const { user, tenantId } = useAuth();
  const [notifications, setNotifications] = useState<InternalNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<InternalNotificationStatus | 'all'>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rpcStatus = useMemo(() => (filter === 'all' ? null : filter), [filter]);

  const refreshCount = useCallback(async () => {
    if (!user || !tenantId) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await notificationsService.countUnread();
      setUnreadCount(count);
    } catch (err: any) {
      console.warn('Erro ao contar notificações:', err);
    }
  }, [tenantId, user]);

  const refresh = useCallback(async () => {
    if (!user || !tenantId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [items, count] = await Promise.all([
        notificationsService.list(rpcStatus, 50),
        notificationsService.countUnread(),
      ]);
      setNotifications(items);
      setUnreadCount(count);
    } catch (err: any) {
      console.error('Erro ao carregar notificações:', err);
      setError(err.message || 'Não foi possível carregar as notificações.');
    } finally {
      setLoading(false);
    }
  }, [rpcStatus, tenantId, user]);

  const runSweepIfNeeded = useCallback(async () => {
    if (!tenantId || !user) return;

    const storageKey = `${SWEEP_STORAGE_PREFIX}:${tenantId}:${user.id}`;
    const lastRun = Number(window.localStorage.getItem(storageKey) || 0);
    if (Date.now() - lastRun < SWEEP_INTERVAL_MS) return;

    try {
      window.localStorage.setItem(storageKey, String(Date.now()));
      await notificationsService.sweep(tenantId);
      await refresh();
    } catch (err) {
      console.warn('Rotina de notificações não executou:', err);
    }
  }, [refresh, tenantId, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void runSweepIfNeeded();
  }, [runSweepIfNeeded]);

  useEffect(() => {
    if (!tenantId || !user) return;

    const channel = supabase
      .channel(`notifications:${tenantId}:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          void refresh();
          void refreshCount();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, refreshCount, tenantId, user]);

  const markAsRead = useCallback(async (id: string) => {
    await notificationsService.markAsRead(id);
    await refresh();
  }, [refresh]);

  const markAllAsRead = useCallback(async () => {
    await notificationsService.markAllAsRead();
    await refresh();
  }, [refresh]);

  const archive = useCallback(async (id: string) => {
    await notificationsService.archive(id);
    await refresh();
  }, [refresh]);

  return {
    notifications,
    unreadCount,
    filter,
    setFilter,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    archive,
  };
};

export type UseNotificationsResult = ReturnType<typeof useNotifications>;

