import React from 'react';
import { Link } from 'react-router-dom';
import type { Client } from '../../src/modules/dashboard/types';

interface DashboardWidgetsProps {
  returningClients: Client[];
  birthdaysToday: string[];
  birthdaysTomorrow: string[];
  teamStatus: { id: string; name: string; active: boolean }[];
  loading?: boolean;
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({
  returningClients,
  birthdaysToday,
  birthdaysTomorrow,
  teamStatus,
  loading,
}) => {
  const activeTeam = teamStatus.filter((t) => t.active).length;
  const totalTeam = teamStatus.length;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-purple-500">psychology</span>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Retorno Inteligente</h4>
        </div>
        
        <div className="space-y-2">
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {returningClients.length}
          </p>
          <p className="text-xs text-slate-500">
            {returningClients.length === 1 ? 'cliente para retorno esta semana' : 'clientes para retorno esta semana'}
          </p>
        </div>

        {returningClients.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <div className="space-y-1.5 max-h-20 overflow-y-auto">
              {returningClients.slice(0, 3).map((client) => (
                <div key={client.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-300 truncate">{client.name}</span>
                  <span className="text-slate-400">→</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          to="/smart-return"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-blue-600 transition-colors"
        >
          Ver lista completa →
        </Link>
      </div>

      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-pink-500">cake</span>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Aniversários</h4>
        </div>
        
        <div className="space-y-2">
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {birthdaysToday.length}
          </p>
          <p className="text-xs text-slate-500">aniversariantes hoje</p>
          {birthdaysTomorrow.length > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              +{birthdaysTomorrow.length} amanhã
            </p>
          )}
        </div>

        {birthdaysToday.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <div className="space-y-1">
              {birthdaysToday.slice(0, 3).map((name, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-pink-500" />
                  <span className="text-slate-600 dark:text-slate-300">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          to="/clients"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-blue-600 transition-colors"
        >
          Ver todos →
        </Link>
      </div>

      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-blue-500">groups</span>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Status Equipe</h4>
        </div>
        
        <div className="space-y-2">
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {activeTeam}<span className="text-slate-400">/{totalTeam}</span>
          </p>
          <p className="text-xs text-slate-500">profissionais ativos</p>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1.5">
            {teamStatus.map((member) => (
              <div
                key={member.id}
                className={`w-3 h-3 rounded-full ${
                  member.active 
                    ? 'bg-emerald-500' 
                    : 'bg-slate-200 dark:bg-slate-600'
                }`}
                title={member.name}
              />
            ))}
          </div>
        </div>

        <Link
          to="/team"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-blue-600 transition-colors"
        >
          Ver equipe →
        </Link>
      </div>
    </div>
  );
};

export default DashboardWidgets;