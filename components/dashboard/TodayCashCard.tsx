import React from 'react';
import { Link } from 'react-router-dom';
import type { DashboardPeriod } from '../../src/modules/dashboard';
import { formatCurrency } from '../../shared/format/currency';

interface TodayCashCardProps {
  loading?: boolean;
  income: number;
  expenses: number;
  net: number;
  period: DashboardPeriod;
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'hoje',
  yesterday: 'ontem',
  week: 'esta semana',
  month: 'este mês',
};

export const TodayCashCard: React.FC<TodayCashCardProps> = ({ loading, income, expenses, net, period }) => {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1A1A1A]">
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600">account_balance_wallet</span>
          <h3 className="font-bold text-slate-900 dark:text-white">Movimento financeiro</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  const rows = [
    { label: 'Entradas', value: income, tone: 'text-emerald-700 dark:text-emerald-300' },
    { label: 'Saídas', value: expenses, tone: 'text-red-600 dark:text-red-300' },
    { label: 'Saldo', value: net, tone: net >= 0 ? 'text-slate-950 dark:text-white' : 'text-red-600 dark:text-red-300' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#1A1A1A]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600">account_balance_wallet</span>
          <h3 className="font-bold text-slate-900 dark:text-white">Movimento financeiro</h3>
        </div>
        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {PERIOD_LABELS[period]}
        </span>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{row.label}</p>
              <p className={`mt-1 text-sm font-black leading-tight ${row.tone}`}>{formatCurrency(row.value)}</p>
            </div>
          ))}
        </div>

        <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
          Baseado nas transações registradas no período selecionado.
        </p>

        <Link
          to="/cashflow"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 font-bold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          <span className="material-symbols-outlined text-sm">fact_check</span>
          Ver fluxo de caixa
        </Link>
      </div>
    </div>
  );
};

export default TodayCashCard;
