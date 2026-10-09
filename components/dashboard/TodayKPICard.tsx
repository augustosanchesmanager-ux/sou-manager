import React from 'react';
import { formatCurrency } from '../../shared/format/currency';
import { appointmentStatusLabels } from '../../shared/status/appointment';

interface TodayKPICardProps {
  label: string;
  value: number;
  icon: string;
  color: 'primary' | 'emerald' | 'amber' | 'sky' | 'rose' | 'blue';
  format?: 'currency' | 'number';
  onClick?: () => void;
}

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary dark:text-[#C6A45A]',
    border: 'border-primary/20',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/30',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/30',
  },
  sky: {
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    text: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-200 dark:border-sky-800/30',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800/30',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/30',
  },
};

export const TodayKPICard: React.FC<TodayKPICardProps> = ({
  label,
  value,
  icon,
  color,
  format = 'number',
  onClick,
}) => {
  const colors = COLOR_CLASSES[color];

  const formatValue = (val: number) => {
    if (format === 'currency') {
      return formatCurrency(val);
    }
    return new Intl.NumberFormat('pt-BR').format(val);
  };

  return (
    <button
      onClick={onClick}
      className={`w-full p-5 bg-white dark:bg-[#1A1A1A] border ${colors.border} rounded-2xl text-left hover:shadow-lg hover:scale-[1.01] transition-all duration-200 group relative overflow-hidden`}
    >
      <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-10 ${colors.bg.replace('50 dark:', '').replace('dark:', '')}`} />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colors.bg} ${colors.text}`}>
            <span className="material-symbols-outlined text-lg">{icon}</span>
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
      </div>
    </button>
  );
};

interface TodayKPIGridProps {
  kpis: {
    totalToday: number;
    faturamento: number;
    emAtendimento: number;
    pendentes: number;
    cancelados: number;
    concluidos: number;
  };
  onKpiClick?: (type: string) => void;
}

const KPI_CONFIG = [
  { key: 'totalToday', label: 'Hoje', icon: 'event', color: 'primary' as const, format: 'number' as const },
  { key: 'faturamento', label: 'Faturamento', icon: 'payments', color: 'emerald' as const, format: 'currency' as const },
  { key: 'emAtendimento', label: 'Em atendimento', icon: 'content_cut', color: 'sky' as const, format: 'number' as const },
  { key: 'pendentes', label: 'Pendentes', icon: 'schedule', color: 'amber' as const, format: 'number' as const },
  { key: 'cancelados', label: 'Cancelados', icon: 'cancel', color: 'rose' as const, format: 'number' as const },
  { key: 'concluidos', label: 'Concluídos', icon: 'task_alt', color: 'blue' as const, format: 'number' as const },
] as const;

export const TodayKPIGrid: React.FC<TodayKPIGridProps> = ({ kpis, onKpiClick }) => {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {KPI_CONFIG.map((config) => (
        <TodayKPICard
          key={config.key}
          label={config.label}
          value={kpis[config.key as keyof typeof kpis]}
          icon={config.icon}
          color={config.color}
          format={config.format}
          onClick={() => onKpiClick?.(config.key)}
        />
      ))}
    </div>
  );
};

export default TodayKPICard;