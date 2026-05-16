import React from 'react';
import { Link } from 'react-router-dom';

interface TodayCashCardProps {
  loading?: boolean;
}

export const TodayCashCard: React.FC<TodayCashCardProps> = ({ loading }) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-emerald-600">account_balance_wallet</span>
          <h3 className="font-bold text-slate-900 dark:text-white">Caixa de hoje</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded w-2/3" />
          <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
        <span className="material-symbols-outlined text-emerald-600">account_balance_wallet</span>
        <h3 className="font-bold text-slate-900 dark:text-white">Caixa de hoje</h3>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600 dark:text-slate-400">Status</span>
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
            Conferência pendente
          </span>
        </div>

        <Link
          to="/cashflow"
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">fact_check</span>
          Conferir caixa
        </Link>
      </div>
    </div>
  );
};

export default TodayCashCard;