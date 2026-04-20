import React, { useMemo } from 'react';
import { buildRiskClients } from '../selectors';
import type { DashboardClient } from '../types';

export const SmartReturnWidget: React.FC<{
  clients: DashboardClient[];
  onNavigate: () => void;
}> = ({ clients, onNavigate }) => {
  const atRisk = useMemo(() => buildRiskClients(clients).slice(0, 4), [clients]);

  if (atRisk.length === 0) return null;

  return (
    <div className="card-boutique p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-500 text-lg">psychology</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Motor de Retorno</h3>
            <p className="text-[10px] text-slate-500">{atRisk.length} cliente(s) precisam de atencao</p>
          </div>
          <span className="size-2 bg-red-500 rounded-full animate-pulse ml-1" />
        </div>
        <button onClick={onNavigate} className="text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider">
          Ver todos →
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {atRisk.map((client) => (
          <div
            key={client.id}
            className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
              client.days >= 30
                ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/20'
                : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/20'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`size-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                  client.days >= 30
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700'
                }`}
              >
                {client.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{client.name}</p>
                <p className={`text-[10px] font-bold ${client.days >= 30 ? 'text-red-500' : 'text-amber-600'}`}>{client.days}d sem visita</p>
              </div>
            </div>

            {client.phone && (
              <a
                href={`https://wa.me/55${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Fala ${client.name.split(' ')[0]}! Sentimos sua falta. Que tal agendar um corte?`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="size-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-sm">chat</span>
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

