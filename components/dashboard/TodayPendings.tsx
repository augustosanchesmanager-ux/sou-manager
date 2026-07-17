import React from 'react';
import { Link } from 'react-router-dom';
import { getBusinessLabels } from '../../src/lib/apps/businessLabels';

interface TodayPendingsProps {
  appSlug?: string | null;
  openComandasCount: number;
  pendingAppointmentsCount: number;
  returningClientsCount: number;
  loading?: boolean;
}

const buildPendingItems = (appSlug?: string | null) => {
  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';

  return [
  {
    key: 'comandas',
    label: isEsteticaApp ? `${labels.orderPlural} abertos` : 'Comandas abertas',
    icon: 'receipt_long',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    link: '/comandas',
  },
  {
    key: 'pending',
    label: isEsteticaApp ? 'Atendimentos pendentes' : 'Agendamentos pendentes',
    icon: 'pending_actions',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    link: '/schedule',
  },
  {
    key: 'returns',
    label: isEsteticaApp ? 'Clientes para retorno' : 'Retornos sugeridos',
    icon: 'person_search',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    link: '/smart-return',
  },
  ];
};

export const TodayPendings: React.FC<TodayPendingsProps> = ({
  appSlug,
  openComandasCount,
  pendingAppointmentsCount,
  returningClientsCount,
  loading,
}) => {
  const pendingItems = buildPendingItems(appSlug);
  const counts: Record<string, number> = {
    comandas: openComandasCount,
    pending: pendingAppointmentsCount,
    returns: returningClientsCount,
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1A1A1A]">
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500">warning</span>
          <h3 className="font-bold text-slate-900 dark:text-white">Pendências de hoje</h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-8 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#1A1A1A]">
      <div className="flex items-center gap-2 border-b border-slate-100 p-5 dark:border-slate-700">
        <span className="material-symbols-outlined text-amber-500">warning</span>
        <h3 className="font-bold text-slate-900 dark:text-white">Pendências de hoje</h3>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {pendingItems.map((item) => {
          const count = counts[item.key] || 0;
          return (
            <div
              key={item.key}
              className="flex items-center justify-between p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.iconBg}`}>
                  <span className={`material-symbols-outlined text-base ${item.iconColor}`}>
                    {item.icon}
                  </span>
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {count}
                </span>
                <Link
                  to={item.link}
                  className="inline-flex items-center gap-1 text-xs font-black text-primary transition hover:text-primary/80"
                >
                  Ver
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TodayPendings;
