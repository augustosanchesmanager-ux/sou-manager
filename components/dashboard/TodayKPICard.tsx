import React from 'react';
import MetricCard, { type MetricTone } from '../ui/MetricCard';
import { formatCurrency } from '../../shared/format/currency';

export type TodayKPIColor = 'primary' | 'emerald' | 'amber' | 'rose' | 'neutral' | 'sky' | 'blue';

interface TodayKPICardProps {
  label: string;
  value: number;
  icon: string;
  color: TodayKPIColor;
  format?: 'currency' | 'number';
  onClick?: () => void;
}

// Maps the dashboard color vocabulary onto the canonical #132 MetricCard tones.
const COLOR_TO_TONE: Record<TodayKPIColor, MetricTone> = {
  primary: 'brass',
  emerald: 'positive',
  amber: 'warning',
  rose: 'negative',
  neutral: 'neutral',
  sky: 'warning',
  blue: 'positive',
};

export const TodayKPICard: React.FC<TodayKPICardProps> = ({
  label,
  value,
  icon,
  color,
  format = 'number',
  onClick,
}) => {
  const formatted =
    format === 'currency' ? formatCurrency(value) : new Intl.NumberFormat('pt-BR').format(value);

  return (
    <MetricCard
      label={label}
      value={formatted}
      icon={icon}
      tone={COLOR_TO_TONE[color] || 'neutral'}
      density="compact"
      onClick={onClick}
    />
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
  { key: 'emAtendimento', label: 'Na Cadeira', icon: 'content_cut', color: 'amber' as const, format: 'number' as const },
  { key: 'pendentes', label: 'Pendentes', icon: 'schedule', color: 'primary' as const, format: 'number' as const },
  { key: 'cancelados', label: 'Cancelados', icon: 'cancel', color: 'rose' as const, format: 'number' as const },
  { key: 'concluidos', label: 'Concluídos', icon: 'task_alt', color: 'emerald' as const, format: 'number' as const },
] as const;

/**
 * Metric Strip Contínuo — Inspirado em ferramentas SaaS de precisão (Linear/Stripe).
 * Substitui caixas demarcadas por um painel fluido com divisórias suaves de 1px.
 */
export const TodayKPIGrid: React.FC<TodayKPIGridProps> = ({ kpis, onKpiClick }) => {
  return (
    <section className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark shadow-sm overflow-hidden transition-colors">
      <div className="grid grid-cols-2 divide-y sm:divide-y-0 sm:grid-cols-3 lg:grid-cols-6 divide-line dark:divide-border-dark">
        {KPI_CONFIG.map((config, index) => {
          const val = kpis[config.key as keyof typeof kpis];
          const formatted =
            config.format === 'currency' ? formatCurrency(val) : new Intl.NumberFormat('pt-BR').format(val);

          const isFaturamento = config.key === 'faturamento';
          const isCancelado = config.key === 'cancelados';

          return (
            <button
              key={config.key}
              type="button"
              onClick={() => onKpiClick?.(config.key)}
              className={`p-4 text-left transition-colors group hover:bg-gold-pale/50 dark:hover:bg-white/[0.03] active:scale-[0.99] touch-manipulation focus:outline-none focus-visible:bg-gold-pale dark:focus-visible:bg-white/5 ${
                index !== 0 ? 'sm:border-l border-line dark:border-border-dark' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                  {config.label}
                </span>
                <span className="material-symbols-outlined text-base text-ink-soft/70 group-hover:text-primary transition-colors">
                  {config.icon}
                </span>
              </div>
              <p
                className={`mt-2 font-display text-xl sm:text-2xl font-bold tabular-nums tracking-tight whitespace-nowrap ${
                  isFaturamento
                    ? 'text-primary-dark dark:text-primary-light font-extrabold'
                    : isCancelado
                      ? 'text-danger'
                      : 'text-ink dark:text-white'
                }`}
              >
                {formatted}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default TodayKPICard;
