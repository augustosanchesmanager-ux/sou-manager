import React from 'react';
import type { ChefClubContext } from '../../contracts/chefClub';

interface ChefClubSummaryProps {
  context: ChefClubContext | null;
  appliedItems?: number;
  savingsTotal?: number;
}

const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

const ChefClubSummary: React.FC<ChefClubSummaryProps> = ({ context, appliedItems = 0, savingsTotal = 0 }) => {
  if (!context?.subscription) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm shadow-amber-500/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
            <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
            Clube do Chefe
          </div>
          <p className="mt-3 text-sm font-bold text-slate-900 dark:text-white">{context.subscription.plan_name}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Ciclo vigente {context.subscription.cycle_end ? `até ${new Date(context.subscription.cycle_end).toLocaleDateString('pt-BR')}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tracking-tight text-amber-600">{appliedItems}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">itens com benefício</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {context.balances.map((balance) => (
          <div key={balance.id} className="rounded-xl border border-white/10 bg-white/70 p-3 dark:bg-[#0f172a]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {balance.benefit_label}
            </p>
            <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
              {balance.available_credits} disponível(is)
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-white/70 px-4 py-3 text-sm dark:bg-[#0f172a]">
        <span className="font-bold text-slate-600 dark:text-slate-300">Economia estimada</span>
        <span className="text-lg font-black text-amber-600">{formatCurrency(savingsTotal)}</span>
      </div>
    </div>
  );
};

export default ChefClubSummary;
