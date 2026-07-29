import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMembershipOverview } from '../../hooks/useMembershipOverview';
import { formatCurrency } from '../../../shared/format/currency';

interface ClubMacroWidgetProps {
  compact?: boolean;
}

export const ClubMacroWidget: React.FC<ClubMacroWidgetProps> = ({ compact = false }) => {
  const navigate = useNavigate();
  const { data } = useMembershipOverview({ status: 'all' });

  if (data.loading) {
    return (
      <div className="rounded-3xl border border-[#D9EAF5] bg-white p-4 shadow-sm dark:border-[#14304A] dark:bg-card-dark">
        <div className="flex animate-pulse items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#EAF7FF] dark:bg-[#0D2238]" />
          <div>
            <div className="mb-2 h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-6 w-16 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      </div>
    );
  }

  const hasData = data.metrics.activeSubscribers > 0;
  const hasOverdue = data.metrics.totalOverdue > 0;

  if (compact) {
    return (
      <div className="rounded-2xl border border-[#D9EAF5] bg-white p-4 dark:border-[#14304A] dark:bg-card-dark">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
              hasData ? 'border-amber-500/20 bg-amber-500/10' : 'border-emerald-500/20 bg-emerald-500/10'
            }`}>
              <span className={`material-symbols-outlined text-sm ${hasData ? 'text-amber-600' : 'text-emerald-600'}`}>
                workspace_premium
              </span>
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">Club dos Chefes</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/chef-club-subscriptions')}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#007BFF] transition hover:bg-[#EAF7FF] dark:text-[#00D2FF] dark:hover:bg-[#0D2238]"
          >
            Ver
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>

        {!hasData ? (
          <div className="py-2 text-center">
            <p className="text-xs text-slate-500">Nenhum assinante</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2 dark:border-emerald-800/30 dark:bg-emerald-900/20">
              <p className="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">MRR</p>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(data.metrics.mrr)}
              </p>
            </div>
            <div className={`rounded-lg border p-2 ${
              hasOverdue
                ? 'border-red-100 bg-red-50 dark:border-red-800/30 dark:bg-red-900/20'
                : 'border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-white/5'
            }`}>
              <p className={`text-[9px] font-bold uppercase ${hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                {hasOverdue ? 'Atrasado' : 'Em dia'}
              </p>
              <p className={`text-base font-black ${hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {formatCurrency(data.metrics.totalOverdue)}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-[#D9EAF5] bg-white p-6 shadow-sm dark:border-[#14304A] dark:bg-card-dark">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
            hasData ? 'border-amber-500/20 bg-amber-500/10' : 'border-emerald-500/20 bg-emerald-500/10'
          }`}>
            <span className={`material-symbols-outlined ${hasData ? 'text-amber-600' : 'text-emerald-600'}`}>
              workspace_premium
            </span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recorrência</p>
            <h3 className="text-base font-black text-[#003366] dark:text-white">Club dos Chefes</h3>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/chef-club-subscriptions')}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#007BFF] transition hover:bg-[#EAF7FF] dark:text-[#00D2FF] dark:hover:bg-[#0D2238]"
        >
          Ver assinaturas
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </button>
      </div>

      {!hasData ? (
        <div className="py-6 text-center">
          <span className="material-symbols-outlined mb-2 text-4xl text-slate-300">group_add</span>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Nenhum assinante ainda</p>
          <p className="mt-1 text-xs text-slate-500">Crie planos para começar</p>
          <button
            type="button"
            onClick={() => navigate('/chef-club-plans')}
            className="mt-3 rounded-lg bg-[#007BFF] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#003366]"
          >
            Criar plano
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-800/30 dark:bg-emerald-900/20">
              <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">MRR</p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(data.metrics.mrr)}
              </p>
            </div>

            <div className={`rounded-2xl border p-3 ${
              hasOverdue
                ? 'border-red-100 bg-red-50 dark:border-red-800/30 dark:bg-red-900/20'
                : 'border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-white/5'
            }`}>
              <p className={`text-[10px] font-bold uppercase ${hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                {hasOverdue ? 'Atrasado' : 'Em dia'}
              </p>
              <p className={`text-lg font-black ${hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {formatCurrency(data.metrics.totalOverdue)}
              </p>
            </div>
          </div>

          <div className="mb-4 flex justify-between text-xs">
            <div className="text-center">
              <p className="text-slate-500">Assinantes</p>
              <p className="font-black text-slate-900 dark:text-white">{data.metrics.activeSubscribers}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-500">A receber</p>
              <p className="font-black text-amber-600">{formatCurrency(data.metrics.pendingAmount)}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-500">Churn</p>
              <p className={`font-black ${data.metrics.churnRate > 10 ? 'text-red-500' : 'text-emerald-500'}`}>
                {data.metrics.churnRate.toFixed(1)}%
              </p>
            </div>
          </div>

          {data.collectionQueue.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-white/5">
              <p className="text-[10px] font-bold uppercase text-slate-500">Próximas cobranças</p>
              {data.collectionQueue.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-xl p-2 text-xs ${
                    item.priority === 'high'
                      ? 'border border-red-100 bg-red-50 dark:border-red-800/20 dark:bg-red-900/10'
                      : 'bg-slate-50 dark:bg-white/5'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900 dark:text-white">{item.clientName}</p>
                    <p className="text-[10px] text-slate-500">
                      {item.priority === 'high'
                        ? `${item.daysOverdue}d atrasado`
                        : `Vence ${new Date(item.dueDate).toLocaleDateString('pt-BR')}`
                      }
                    </p>
                  </div>
                  <p className={`font-black ${item.priority === 'high' ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                    {formatCurrency(item.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};
