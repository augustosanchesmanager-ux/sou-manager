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
      bg: 'bg-red-50 dark:bg-red-900/10',
      border: 'border-red-100 dark:border-red-800/20',
      icon: 'text-red-500',
      text: 'text-red-700 dark:text-red-400',
    };
  }
  
  const colors: Record<AlertType, { bg: string; border: string; icon: string; text: string }> = {
    stock: {
      bg: 'bg-amber-50 dark:bg-amber-900/10',
      border: 'border-amber-100 dark:border-amber-800/20',
      icon: 'text-amber-500',
      text: 'text-amber-700 dark:text-amber-400',
    },
    churn: {
      bg: 'bg-orange-50 dark:bg-orange-900/10',
      border: 'border-orange-100 dark:border-orange-800/20',
      icon: 'text-orange-500',
      text: 'text-orange-700 dark:text-orange-400',
    },
    revenue: {
      bg: 'bg-red-50 dark:bg-red-900/10',
      border: 'border-red-100 dark:border-red-800/20',
      icon: 'text-red-500',
      text: 'text-red-700 dark:text-red-400',
    },
    inadimplence: {
      bg: 'bg-red-50 dark:bg-red-900/10',
      border: 'border-red-100 dark:border-red-800/20',
      icon: 'text-red-500',
      text: 'text-red-700 dark:text-red-400',
    },
    occupation: {
      bg: 'bg-blue-50 dark:bg-blue-900/10',
      border: 'border-blue-100 dark:border-blue-800/20',
      icon: 'text-blue-500',
      text: 'text-blue-700 dark:text-blue-400',
    },
  };
  
  return colors[type] || colors.revenue;
};

export const StrategicAlerts: React.FC<StrategicAlertsProps> = ({ alerts, onAlertClick }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="card-boutique p-6">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-500">check_circle</span>
          Alertas Estratégicos
        </h3>
        <div className="py-4 text-center text-emerald-600 dark:text-emerald-400 text-sm">
          <span className="material-symbols-outlined text-2xl mb-1">sentiment_satisfied</span>
          <p>Nenhum alerta crítico</p>
        </div>
      </div>
    );
  }

  const sortedAlerts = [...alerts].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className="card-boutique p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500">notifications_active</span>
          Alertas Estratégicos
        </h3>
        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          {alerts.length}
        </span>
      </div>

      <div className="space-y-2">
        {sortedAlerts.map((alert) => {
          const colors = getAlertColors(alert.type, alert.priority);
          
          return (
            <div
              key={alert.id}
              onClick={() => onAlertClick?.(alert)}
              className={`flex items-center gap-3 p-3 rounded-lg border ${colors.bg} ${colors.border} hover:opacity-90 transition-opacity cursor-pointer`}
            >
              <div className={`size-8 rounded-lg flex items-center justify-center bg-white dark:bg-black/20 ${colors.icon}`}>
                <span className="material-symbols-outlined text-lg">{getAlertIcon(alert.type)}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${colors.text} truncate`}>
                  {alert.message}
                </p>
                {alert.count !== undefined && (
                  <p className="text-[10px] text-slate-500">
                    {alert.count} item(s) afetado(s)
                  </p>
                )}
              </div>
              
              {alert.priority === 'high' && (
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
              
              <span className="material-symbols-outlined text-slate-400 text-sm">chevron_right</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};