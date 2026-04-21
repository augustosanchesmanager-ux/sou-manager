import React from 'react';

interface AppointmentPoint {
  id: string;
  date: string;
  professional: string;
  service: string;
  client: string;
  status: 'completed' | 'cancelled' | 'no_show' | 'pending';
  value?: number;
}

interface AppointmentTimelineProps {
  data: AppointmentPoint[];
  title?: string;
  maxItems?: number;
}

const STATUS_CONFIG = {
  completed: { icon: 'task_alt', color: 'emerald', bg: 'bg-emerald-500', label: 'Concluído' },
  cancelled: { icon: 'cancel', color: 'rose', bg: 'bg-rose-500', label: 'Cancelado' },
  no_show: { icon: 'person_off', color: 'amber', bg: 'bg-amber-500', label: 'Faltou' },
  pending: { icon: 'schedule', color: 'blue', bg: 'bg-blue-500', label: 'Pendente' },
};

export const AppointmentTimeline: React.FC<AppointmentTimelineProps> = ({
  data,
  title = 'Linha do Tempo',
  maxItems = 10,
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const displayData = data.slice(0, maxItems);
  
  const totalCompleted = data.filter(a => a.status === 'completed').length;
  const totalCancelled = data.filter(a => a.status === 'cancelled').length;
  const totalNoShow = data.filter(a => a.status === 'no_show').length;

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-500">timeline</span>
          {title}
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-600 font-medium">{totalCompleted}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-rose-500" />
            <span className="text-rose-600 font-medium">{totalCancelled}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-500" />
            <span className="text-amber-600 font-medium">{totalNoShow}</span>
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical Line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-purple-500 to-rose-500" />

        {/* Timeline Items */}
        <div className="space-y-3">
          {displayData.map((apt, index) => {
            const config = STATUS_CONFIG[apt.status];
            const isFirst = index === 0;
            const isLast = index === displayData.length - 1;
            
            return (
              <div 
                key={apt.id}
                className={`
                  relative flex items-start gap-4 pl-8
                  before:absolute before:left-2.5 before:top-3 before:size-3 
                  before:rounded-full before:bg-white before:border-2 
                  before:border-slate-300 before:z-10
                  ${isFirst ? 'before:border-primary before:bg-primary' : ''}
                  ${isLast ? 'before:border-rose-500 before:bg-rose-500' : ''}
                `}
              >
                {/* Dot */}
                <div className={`
                  absolute left-2 top-2 size-3 rounded-full ${config.bg}
                  ${isFirst ? 'ring-4 ring-primary/20' : ''}
                `} />

                {/* Card */}
                <div className={`
                  flex-1 rounded-xl p-3 transition-all
                  ${apt.status === 'completed' 
                    ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/30' 
                    : apt.status === 'cancelled'
                      ? 'bg-rose-50/50 dark:bg-rose-900/10 border border-rose-200/50 dark:border-rose-800/30'
                      : apt.status === 'no_show'
                        ? 'bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30'
                        : 'bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/30'
                  }
                  hover:shadow-md
                `}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-sm text-${config.color}-500`}>
                        {config.icon}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">
                          {apt.client}
                        </p>
                        <p className="text-xs text-slate-500">
                          {apt.service} • {apt.professional}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400">
                        {formatDate(apt.date)}
                      </p>
                      {apt.value && (
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(apt.value)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {data.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <span className="material-symbols-outlined text-4xl mb-2">event_busy</span>
          <p className="text-sm">Nenhum agendamento no período</p>
        </div>
      )}
    </div>
  );
};

export default AppointmentTimeline;