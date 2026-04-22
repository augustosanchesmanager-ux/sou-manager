import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMembershipOverview } from '../../hooks/useMembershipOverview';

interface ClubMacroWidgetProps {
  compact?: boolean;
}

export const ClubMacroWidget: React.FC<ClubMacroWidgetProps> = ({ compact = false }) => {
  const navigate = useNavigate();
  const { data, reload } = useMembershipOverview({ status: 'all' });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

  if (data.loading) {
    return (
      <div className="card-boutique p-4">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          <div>
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
            <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const hasData = data.metrics.activeSubscribers > 0;
  const hasOverdue = data.metrics.totalOverdue > 0;

  if (compact) {
    return (
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              hasData ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'
            }`}>
              <span className={`material-symbols-outlined text-sm ${hasData ? 'text-amber-600' : 'text-emerald-600'}`}>
                workspace_premium
              </span>
            </div>
            <span className="font-bold text-slate-900 dark:text-white text-sm">Clube</span>
          </div>
          <button
            onClick={() => navigate('/chef-club-subscriptions')}
            className="text-xs font-bold text-primary hover:text-primary/80"
          >
            Ver →
          </button>
        </div>

        {!hasData ? (
          <div className="text-center py-2">
            <p className="text-slate-500 text-xs">Nenhum assinante</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 border border-emerald-100 dark:border-emerald-800/30">
              <p className="text-[9px] uppercase text-emerald-600 dark:text-emerald-400 font-bold">MRR</p>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(data.metrics.mrr)}
              </p>
            </div>
            <div className={`rounded-lg p-2 border ${
              hasOverdue
                ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30'
                : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5'
            }`}>
              <p className={`text-[9px] uppercase font-bold ${hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                {hasOverdue ? 'Atrasado' : 'Em Dia'}
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
    <div className="card-boutique p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            hasData ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'
          }`}>
            <span className={`material-symbols-outlined ${hasData ? 'text-amber-600' : 'text-emerald-600'}`}>
              workspace_premium
            </span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Clube dos Chefs</h3>
            <p className="text-xs text-slate-500">Receita Recorrente</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/chef-club-subscriptions')}
          className="text-xs font-bold text-primary hover:text-primary/80"
        >
          Ver todos →
        </button>
      </div>

      {!hasData ? (
        <div className="text-center py-6">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">group_add</span>
          <p className="text-slate-600 dark:text-slate-400 font-bold text-sm">Nenhum assinante ainda</p>
          <p className="text-slate-500 text-xs mt-1">Crie planos para começar</p>
          <button 
            onClick={() => navigate('/chef-club-plans')}
            className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold"
          >
            Criar Plano
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-100 dark:border-emerald-800/30">
              <p className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400 font-bold">MRR</p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(data.metrics.mrr)}
              </p>
            </div>
            
            <div className={`rounded-lg p-3 border ${
              hasOverdue 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30' 
                : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5'
            }`}>
              <p className={`text-[10px] uppercase font-bold ${hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                {hasOverdue ? 'Atrasado' : 'Em Dia'}
              </p>
              <p className={`text-lg font-black ${hasOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {formatCurrency(data.metrics.totalOverdue)}
              </p>
            </div>
          </div>

          <div className="flex justify-between text-xs mb-4">
            <div className="text-center">
              <p className="text-slate-500">Assinantes</p>
              <p className="font-black text-slate-900 dark:text-white">{data.metrics.activeSubscribers}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-500">A Receber</p>
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
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-white/5">
              <p className="text-[10px] uppercase text-slate-500 font-bold">Próximas cobranças</p>
              {data.collectionQueue.slice(0, 3).map((item) => (
                <div 
                  key={item.id}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                    item.priority === 'high' 
                      ? 'bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/20' 
                      : 'bg-slate-50 dark:bg-white/5'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{item.clientName}</p>
                    <p className="text-slate-500 text-[10px]">
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
    </div>
  );
};