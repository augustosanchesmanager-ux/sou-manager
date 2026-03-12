import React from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { QuickAction } from './types';

const toneClass = {
  default: 'border-slate-200 bg-white hover:border-primary/30 dark:border-white/10 dark:bg-white/5',
  danger: 'border-red-200 bg-red-50/70 hover:border-red-300 dark:border-red-500/20 dark:bg-red-500/10',
  success: 'border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 dark:border-emerald-500/20 dark:bg-emerald-500/10',
};

interface QuickActionsPanelProps {
  actions: QuickAction[];
  onSelect: (action: QuickAction) => void;
}

const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({ actions, onSelect }) => (
  <section className="card-boutique p-5">
    <div className="flex items-center gap-2 text-base font-bold text-slate-950 dark:text-white">
      <ShieldCheck className="h-4 w-4 text-primary" />
      Acoes rapidas
    </div>
    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Operacoes criticas sempre visiveis para reduzir tempo de resposta.</p>

    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onSelect(action)}
          className={`rounded-2xl border p-4 text-left transition hover:shadow-lg ${toneClass[action.tone]}`}
          title={`${action.label}. Toda acao gera historico automaticamente.`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-950 dark:text-white">{action.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{action.description}</p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400" />
          </div>
        </button>
      ))}
    </div>
  </section>
);

export default QuickActionsPanel;
