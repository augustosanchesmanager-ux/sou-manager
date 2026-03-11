import React from 'react';
import { CalendarClock, TrendingUp } from 'lucide-react';
import FinancialAlertCard from './FinancialAlertCard';

interface UpcomingItem {
  title: string;
  date: string;
  value: number;
  kind: 'pagar' | 'receber';
}

interface UpcomingBillsPanelProps {
  dueTodayCount: number;
  payable: UpcomingItem[];
  receivable: UpcomingItem[];
  delinquencySummary: string;
  nextDaysProjection: string;
}

const UpcomingBillsPanel: React.FC<UpcomingBillsPanelProps> = ({
  dueTodayCount,
  payable,
  receivable,
  delinquencySummary,
  nextDaysProjection,
}) => {
  return (
    <aside className="space-y-4">
      <article className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark p-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Contas vencendo hoje</h3>
        </div>
        <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{dueTodayCount}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Priorize para evitar impacto no caixa.</p>
      </article>

      <article className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Contas a pagar proximas</h3>
        <div className="space-y-2">
          {payable.map((item) => (
            <div key={item.title} className="rounded-xl border border-slate-200 dark:border-border-dark p-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(item.date).toLocaleDateString('pt-BR')} • {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Contas a receber proximas</h3>
        <div className="space-y-2">
          {receivable.map((item) => (
            <div key={item.title} className="rounded-xl border border-slate-200 dark:border-border-dark p-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(item.date).toLocaleDateString('pt-BR')} • {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-sky-600 dark:text-sky-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Resumo financeiro rapido</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{delinquencySummary}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{nextDaysProjection}</p>
      </article>

      <FinancialAlertCard
        title="Alerta de concentracao de despesas"
        description="Centro de custo RH representa 38% das saídas previstas para os proximos 7 dias."
        level="medium"
      />
      <FinancialAlertCard
        title="Ajuste recomendado"
        description="Antecipar recebiveis de contratos pode elevar o saldo disponivel em 12% nesta semana."
        level="ok"
      />
    </aside>
  );
};

export default UpcomingBillsPanel;
