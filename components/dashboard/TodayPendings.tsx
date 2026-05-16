import React from 'react';
import { Link } from 'react-router-dom';
import type { ReturningClient } from '../../src/modules/dashboard/types';

interface TodayPendingsProps {
  openComandasCount: number;
  pendingAppointmentsCount: number;
  returningClientsCount: number;
  loading?: boolean;
}

const PENDING_ITEMS = [
  {
    key: 'comandas',
    label: 'Comandas abertas',
    icon: 'receipt_long',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    link: '/comandas',
  },
  {
    key: 'pending',
    label: 'Agendamentos pendentes',
    icon: 'pending_actions',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    link: '/schedule',
  },
  {
    key: 'returns',
    label: 'Retornos sugeridos',
    icon: 'person_search',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-600 dark:text-purple-400',
    link: '/smart-return',
  },
];

export const TodayPendings: React.FC<TodayPendingsProps> = ({
  openComandasCount,
  pendingAppointmentsCount,
  returningClientsCount,
  loading,
}) => {
  const counts: Record<string, number> = {
    comandas: openComandasCount,
    pending: pendingAppointmentsCount,
    returns: returningClientsCount,
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-amber-500">warning</span>
          <h3 className="font-bold text-slate-900 dark:text-white">Pendências de hoje</h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
        <span className="material-symbols-outlined text-amber-500">warning</span>
        <h3 className="font-bold text-slate-900 dark:text-white">Pendências de hoje</h3>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {PENDING_ITEMS.map((item) => {
          const count = counts[item.key] || 0;
          return (
            <div
              key={item.key}
              className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.iconBg}`}>
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
                  className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  Ver →
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