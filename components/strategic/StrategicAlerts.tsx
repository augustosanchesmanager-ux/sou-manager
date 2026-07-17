import React from 'react';

export type AlertType = 'stock' | 'churn' | 'revenue' | 'inadimplence' | 'occupation';

export interface StrategicAlert {
  id: string;
  type: AlertType;
  message: string;
  priority: 'high' | 'medium' | 'low';
  actionUrl?: string;
  count?: number;
}

interface StrategicAlertsProps {
  alerts: StrategicAlert[];
  onAlertClick?: (alert: StrategicAlert) => void;
}

const getAlertIcon = (type: AlertType) => {
  const icons: Record<AlertType, string> = {
    stock: 'inventory_2',
    churn: 'person_off',
    revenue: 'trending_down',
    inadimplence: 'warning',
    occupation: 'event_busy',
  };
  return icons[type] || 'info';
};

const getAlertColors = (type: AlertType, priority: 'high' | 'medium' | 'low') => {
  if (priority === 'high') {
    return {
      bg: 'bg-red-50 dark:bg-red-500/10',
      border: 'border-red-200 dark:border-red-500/30',
      icon: 'text-red-500',
      text: 'text-red-700 dark:text-red-300',
      badge: 'bg-red-500 text-white',
    };
  }

  const colors: Record<AlertType, { bg: string; border: string; icon: string; text: string; badge: string }> = {
    stock: {
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      border: 'border-amber-200 dark:border-amber-500/30',
      icon: 'text-amber-500',
      text: 'text-amber-700 dark:text-amber-300',
      badge: 'bg-amber-500 text-white',
    },
    churn: {
      bg: 'bg-orange-50 dark:bg-orange-500/10',
      border: 'border-orange-200 dark:border-orange-500/30',
      icon: 'text-orange-500',
      text: 'text-orange-700 dark:text-orange-300',
      badge: 'bg-orange-500 text-white',
    },
    revenue: {
      bg: 'bg-red-50 dark:bg-red-500/10',
      border: 'border-red-200 dark:border-red-500/30',
      icon: 'text-red-500',
      text: 'text-red-700 dark:text-red-300',
      badge: 'bg-red-500 text-white',
    },
    inadimplence: {
      bg: 'bg-red-50 dark:bg-red-500/10',
      border: 'border-red-200 dark:border-red-500/30',
      icon: 'text-red-500',
      text: 'text-red-700 dark:text-red-300',
      badge: 'bg-red-500 text-white',
    },
    occupation: {
      bg: 'bg-[#EAF7FF] dark:bg-[#0D2238]',
      border: 'border-[#BDEFFF] dark:border-[#14304A]',
      icon: 'text-[#007BFF] dark:text-[#00D2FF]',
      text: 'text-[#003366] dark:text-[#D9F6FF]',
      badge: 'bg-[#007BFF] text-white',
    },
  };

  return colors[type] || colors.revenue;
};

export const StrategicAlerts: React.FC<StrategicAlertsProps> = ({ alerts, onAlertClick }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <section className="rounded-3xl border border-[#D9EAF5] bg-white p-6 shadow-sm dark:border-[#14304A] dark:bg-card-dark">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Atenção do dono</p>
            <h3 className="text-base font-black text-[#003366] dark:text-white">Alertas estratégicos</h3>
          </div>
        </div>
        <div className="flex h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
          <span className="material-symbols-outlined mb-2 text-3xl text-emerald-500">done_all</span>
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Nenhum alerta crítico agora</p>
          <p className="mt-1 text-xs text-slate-500">Estoque, inadimplência e ocupação seguem sem sinal urgente.</p>
        </div>
      </section>
    );
  }

  const sortedAlerts = [...alerts].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const highPriorityCount = alerts.filter((alert) => alert.priority === 'high').length;

  return (
    <section className="rounded-3xl border border-[#D9EAF5] bg-white p-6 shadow-sm dark:border-[#14304A] dark:bg-card-dark">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300">
            <span className="material-symbols-outlined">notifications_active</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Atenção do dono</p>
            <h3 className="text-base font-black text-[#003366] dark:text-white">Alertas estratégicos</h3>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${highPriorityCount > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
          {alerts.length}
        </span>
      </div>

      <div className="space-y-2">
        {sortedAlerts.map((alert) => {
          const colors = getAlertColors(alert.type, alert.priority);

          return (
            <button
              key={alert.id}
              type="button"
              onClick={() => onAlertClick?.(alert)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#00D2FF]/30 ${colors.bg} ${colors.border}`}
            >
              <div className={`flex size-9 items-center justify-center rounded-xl bg-white dark:bg-black/20 ${colors.icon}`}>
                <span className="material-symbols-outlined text-lg">{getAlertIcon(alert.type)}</span>
              </div>

              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-bold ${colors.text}`}>
                  {alert.message}
                </p>
                {alert.count !== undefined && (
                  <p className="text-[10px] font-semibold text-slate-500">
                    {alert.count} item(s) afetado(s)
                  </p>
                )}
              </div>

              <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${colors.badge}`}>
                {alert.priority === 'high' ? 'Urgente' : alert.priority === 'medium' ? 'Revisar' : 'Baixo'}
              </span>
              <span className="material-symbols-outlined text-sm text-slate-400">chevron_right</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
