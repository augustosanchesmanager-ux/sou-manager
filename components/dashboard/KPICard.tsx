import React from 'react';

export type KPIType = 'revenue' | 'appointments' | 'clients' | 'ticket' | 'comandas' | 'cash';

interface KPICardProps {
  type: KPIType;
  value: number;
  previousValue?: number;
  goal?: number;
  label: string;
  showComparison?: boolean;
  onClick?: () => void;
}

const KPI_CONFIG: Record<KPIType, { icon: string; color: string }> = {
  revenue: { icon: 'payments', color: 'emerald' },
  appointments: { icon: 'calendar_month', color: 'primary' },
  clients: { icon: 'group', color: 'blue' },
  ticket: { icon: 'receipt_long', color: 'amber' },
  comandas: { icon: 'receipt_long', color: 'amber' },
  cash: { icon: 'account_balance_wallet', color: 'emerald' },
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string; progress: string }> = {
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/30',
    progress: 'bg-emerald-500',
  },
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary dark:text-[#C6A45A]',
    border: 'border-primary/20',
    progress: 'bg-primary',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/30',
    progress: 'bg-blue-500',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/30',
    progress: 'bg-amber-500',
  },
};

export const KPICard: React.FC<KPICardProps> = ({
  type,
  value,
  previousValue,
  goal,
  label,
  showComparison = true,
  onClick,
}) => {
  const config = KPI_CONFIG[type];
  const colors = COLOR_CLASSES[config.color];
  
  const formatValue = (val: number) => {
    if (type === 'revenue' || type === 'ticket' || type === 'cash') {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      }).format(val);
    }
    return new Intl.NumberFormat('pt-BR').format(val);
  };

  const comparison = previousValue && showComparison
    ? ((value - previousValue) / previousValue) * 100
    : null;

  const isPositive = comparison !== null && comparison >= 0;
  const progress = goal ? Math.min(100, Math.round((value / goal) * 100)) : null;

  return (
    <button
      onClick={onClick}
      className={`w-full p-5 bg-white dark:bg-[#1A1A1A] border ${colors.border} rounded-2xl text-left hover:shadow-lg hover:scale-[1.01] transition-all duration-200 group relative overflow-hidden`}
    >
      <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-10 ${colors.bg.replace('50 dark:', '').replace('dark:', '')}`} />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colors.bg} ${colors.text}`}>
            <span className="material-symbols-outlined text-lg">{config.icon}</span>
          </div>
          {onClick && (
            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
              arrow_forward
            </span>
          )}
        </div>

        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500">
          {label}
        </p>
        
        <p className="text-2xl font-black mt-1 text-slate-900 dark:text-white">
          {formatValue(value)}
        </p>

        {comparison !== null && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
            isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
          }`}>
            <span className="material-symbols-outlined text-sm">
              {isPositive ? 'trending_up' : 'trending_down'}
            </span>
            {isPositive ? '+' : ''}{comparison.toFixed(0)}%
            {previousValue && (
              <span className="text-slate-400 dark:text-slate-500 font-normal">
                {' '}({formatValue(Math.abs(value - previousValue))})
              </span>
            )}
          </div>
        )}

        {progress !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-[9px] text-slate-400 mb-1">
              <span>Meta: {formatValue(goal || 0)}</span>
              <span className="font-black">{progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  progress >= 100 ? 'bg-emerald-500' : progress >= 60 ? 'bg-amber-500' : 'bg-red-400'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </button>
  );
};

export default KPICard;
