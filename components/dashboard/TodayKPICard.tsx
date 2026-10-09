import React from 'react';
import MetricCard, { type MetricTone } from '../ui/MetricCard';
import { formatCurrency } from '../../shared/format/currency';

interface TodayKPICardProps {
  label: string;
  value: number;
  icon: string;
  color: 'primary' | 'emerald' | 'amber' | 'sky' | 'rose' | 'blue';
  format?: 'currency' | 'number';
  onClick?: () => void;
}

// Maps the dashboard color vocabulary onto the canonical #132 MetricCard tones.
const COLOR_TO_TONE: Record<TodayKPICardProps['color'], MetricTone> = {
  primary: 'brass',
  emerald: 'positive',
  amber: 'warning',
  sky: 'info',
  rose: 'negative',
  blue: 'neutral',
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
      tone={COLOR_TO_TONE[color]}
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
