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
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-success">account_balance_wallet</span>
          <h3 className="font-bold text-ink">Movimento financeiro</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-2/3 rounded bg-gold-pale" />
          <div className="h-10 rounded bg-gold-pale" />
        </div>
      </div>
    );
  }

  const rows = [
    { label: 'Entradas', value: income, tone: 'text-success' },
    { label: 'Saídas', value: expenses, tone: 'text-danger' },
    { label: 'Saldo', value: net, tone: net >= 0 ? 'text-ink' : 'text-danger' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-line p-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-success">account_balance_wallet</span>
          <h3 className="font-bold text-ink">Movimento financeiro</h3>
        </div>
        <span className="rounded-full border border-line px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-ink-soft">
          {PERIOD_LABELS[period]}
        </span>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label} className="rounded-xl border border-line bg-gold-pale p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ink-soft">{row.label}</p>
              <p className={`mt-1 text-xs font-bold leading-tight ${row.tone}`}>{formatCurrency(row.value)}</p>
            </div>
          ))}
        </div>

        <p className="text-xs font-medium leading-5 text-ink-soft">
          Baseado nas transações registradas no período selecionado.
        </p>

        <Link
          to="/cashflow"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark py-2.5 font-black text-night transition hover:from-primary-dark hover:to-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <span className="material-symbols-outlined text-sm">fact_check</span>
          Ver fluxo de caixa
        </Link>
      </div>
    </div>
  );
};

export default TodayCashCard;