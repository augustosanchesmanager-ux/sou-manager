import React from 'react';
import Button from './ui/Button';
import type { UseNotificationsResult } from '../src/hooks/useNotifications';
import type { InternalNotificationSeverity, InternalNotificationType } from '../src/types/notifications';
import { NOTIFICATION_TYPE_LABELS } from '../src/types/notifications';

interface NotificationCenterProps {
  controller: UseNotificationsResult;
  onClose?: () => void;
}

const iconByType: Record<InternalNotificationType, string> = {
  comanda_aberta: 'receipt_long',
  estoque_baixo: 'inventory_2',
  pagamento_a_realizar: 'payments',
  cobranca_clube_chefes: 'workspace_premium',
  proximo_cliente: 'event_upcoming',
  cliente_atrasado: 'alarm',
};

const severityMeta: Record<InternalNotificationSeverity, { label: string; className: string; iconClassName: string }> = {
  info: {
    label: 'Info',
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    iconClassName: 'text-blue-500 bg-blue-500/10',
  },
  warning: {
    label: 'Atenção',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    iconClassName: 'text-amber-500 bg-amber-500/10',
  },
  critical: {
    label: 'Crítico',
    className: 'bg-red-500/10 text-red-600 border-red-500/20',
    iconClassName: 'text-red-500 bg-red-500/10',
  },
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const NotificationCenter: React.FC<NotificationCenterProps> = ({ controller, onClose }) => {
  const {
    notifications,
    filter,
    setFilter,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    archive,
    refresh,
  } = controller;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
              filter === 'unread'
                ? 'bg-primary text-white'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            Não lidas
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
              filter === 'all'
                ? 'bg-primary text-white'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            Todas
          </button>
        </div>
        <button
          onClick={() => void markAllAsRead()}
          className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
          disabled={!notifications.some((notification) => notification.status === 'unread')}
        >
          Marcar todas como lidas
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-600">
          {error}
          <button onClick={() => void refresh()} className="ml-2 underline">
            Tentar novamente
          </button>
        </div>
      )}

      <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-2">
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className="material-symbols-outlined mb-2 text-4xl text-slate-300">notifications_off</span>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Nenhum aviso por aqui.</p>
            <p className="mt-1 text-xs text-slate-500">Quando algo importante acontecer, aparece nesta central.</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const severity = severityMeta[notification.severity] || severityMeta.info;
            const isUnread = notification.status === 'unread';

            return (
              <div
                key={notification.id}
                className={`group relative flex gap-3 overflow-hidden rounded-xl border p-4 transition-all ${
                  isUnread
                    ? 'border-primary/20 bg-slate-50 shadow-sm dark:bg-white/5'
                    : 'border-slate-100 bg-white opacity-75 dark:border-border-dark dark:bg-card-dark'
                }`}
              >
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${severity.iconClassName}`}>
                  <span className="material-symbols-outlined text-xl">{iconByType[notification.type] || 'notifications'}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`truncate pr-2 text-sm font-bold ${isUnread ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                      {notification.title}
                    </h4>
                    <span className="whitespace-nowrap text-[10px] text-slate-400">
                      {formatDateTime(notification.created_at)}
                    </span>
                  </div>

                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{notification.message}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-white/10 dark:text-slate-300">
                      {NOTIFICATION_TYPE_LABELS[notification.type] || notification.type}
                    </span>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${severity.className}`}>
                      {severity.label}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                  {isUnread && (
                    <button
                      onClick={() => void markAsRead(notification.id)}
                      className="rounded-lg p-1.5 text-primary hover:bg-primary/10"
                      title="Marcar como lida"
                    >
                      <span className="material-symbols-outlined text-[18px]">done_all</span>
                    </button>
                  )}
                  <button
                    onClick={() => void archive(notification.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                    title="Arquivar"
                  >
                    <span className="material-symbols-outlined text-[18px]">archive</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {onClose && (
        <div className="mt-auto pt-4">
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Fechar
          </Button>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
