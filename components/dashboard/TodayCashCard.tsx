import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardPeriod } from '../../src/modules/dashboard';
import { formatCurrency } from '../../shared/format/currency';
import { getClientForTable } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';

interface TodayCashCardProps {
  loading?: boolean;
  income: number;
  expenses: number;
  net: number;
  period: DashboardPeriod;
}

interface CashTransactionEntry {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  created_at: string;
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'hoje',
  yesterday: 'ontem',
  week: 'esta semana',
  month: 'este mês',
};

const formatTimeOnly = (isoString?: string): string => {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const TodayCashCard: React.FC<TodayCashCardProps> = ({ loading, income, expenses, net, period }) => {
  const { tenantId, appSlug } = useAuth();
  const [recentTransactions, setRecentTransactions] = useState<CashTransactionEntry[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    const fetchMiniTimeline = async () => {
      setLoadingTransactions(true);
      try {
        const client = getClientForTable('transactions', appSlug);
        const { data } = await client
          .from('transactions')
          .select('id, type, amount, description, created_at, date')
          .eq('tenant_id', tenantId)
          .in('type', ['income', 'expense'])
          .order('created_at', { ascending: false })
          .limit(5);

        if (data) {
          setRecentTransactions(
            data.map((item: any) => ({
              id: item.id,
              type: item.type,
              amount: Number(item.amount || 0),
              description: item.description || (item.type === 'income' ? 'Entrada no caixa' : 'Saída / Sangria'),
              created_at: item.created_at || item.date || new Date().toISOString(),
            }))
          );
        }
      } catch (err) {
        console.error('Erro ao buscar mini timeline financeira:', err);
      } finally {
        setLoadingTransactions(false);
      }
    };

    fetchMiniTimeline();
  }, [tenantId, appSlug]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-success">account_balance_wallet</span>
          <h3 className="font-display font-bold text-ink dark:text-white">Movimento financeiro</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-2/3 rounded bg-line dark:bg-border-dark" />
          <div className="h-10 rounded bg-line dark:bg-border-dark" />
        </div>
      </div>
    );
  }

  const rows = [
    { label: 'Entradas', value: income, tone: 'text-success' },
    { label: 'Saídas', value: expenses, tone: 'text-danger' },
    { label: 'Saldo', value: net, tone: net >= 0 ? 'text-ink dark:text-white font-extrabold' : 'text-danger font-extrabold' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark shadow-sm transition-colors flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 border-b border-line dark:border-border-dark p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">account_balance_wallet</span>
          <h3 className="font-display font-bold text-sm sm:text-base text-ink dark:text-white">Movimento financeiro</h3>
        </div>
        <span className="rounded-full border border-line dark:border-border-dark bg-card dark:bg-surface-dark px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-soft">
          {PERIOD_LABELS[period]}
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5 flex-1 flex flex-col justify-between">
        {/* Strip Limpo de 3 Colunas */}
        <div className="grid grid-cols-3 divide-x divide-line dark:divide-border-dark rounded-xl border border-line dark:border-border-dark bg-card dark:bg-surface-dark p-3">
          {rows.map((row, index) => (
            <div key={row.label} className={index === 0 ? 'pr-2.5' : index === 1 ? 'px-2.5' : 'pl-2.5'}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">{row.label}</p>
              <p className={`mt-1 font-display text-xs sm:text-sm md:text-base font-bold tabular-nums tracking-tight whitespace-nowrap leading-tight ${row.tone}`}>
                {formatCurrency(row.value)}
              </p>
            </div>
          ))}
        </div>

        {/* Mini Timeline de Entradas e Saídas em Tempo Real */}
        <div className="space-y-2 flex-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
              Últimas movimentações
            </p>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              ao vivo
            </span>
          </div>

          <div className="rounded-xl border border-line dark:border-border-dark bg-gold-pale/30 dark:bg-surface-dark/40 divide-y divide-line dark:divide-border-dark overflow-hidden">
            {loadingTransactions ? (
              <div className="p-3 text-center text-xs text-ink-soft">Carregando movimentações...</div>
            ) : recentTransactions.length === 0 ? (
              <div className="p-3 text-center text-xs text-ink-soft">Nenhum lançamento no período</div>
            ) : (
              recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-2.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        tx.type === 'income' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">
                        {tx.type === 'income' ? 'arrow_downward' : 'arrow_upward'}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink dark:text-white leading-tight">
                        {tx.description}
                      </p>
                      <span className="text-[10px] text-ink-soft">{formatTimeOnly(tx.created_at)}</span>
                    </div>
                  </div>
                  <span
                    className={`font-display font-bold tabular-nums shrink-0 ml-2 ${
                      tx.type === 'income' ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <Link
          to="/cashflow"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line dark:border-border-dark bg-card dark:bg-surface-dark py-2 text-xs font-semibold text-ink dark:text-white hover:border-primary/40 transition-all touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="material-symbols-outlined text-sm text-primary">fact_check</span>
          <span>Ver fluxo de caixa completo</span>
        </Link>
      </div>
    </div>
  );
};

export default TodayCashCard;
