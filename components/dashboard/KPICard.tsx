import React from 'react';
import MetricCard, { type MetricTone } from '../ui/MetricCard';

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

const KPI_CONFIG: Record<KPIType, { icon: string; tone: MetricTone }> = {
  revenue: { icon: 'payments', tone: 'positive' },
  appointments: { icon: 'calendar_month', tone: 'brass' },
  clients: { icon: 'group', tone: 'info' },
  ticket: { icon: 'receipt_long', tone: 'warning' },
  comandas: { icon: 'receipt_long', tone: 'warning' },
  cash: { icon: 'account_balance_wallet', tone: 'positive' },
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
    <MetricCard
      label={label}
      value={formatValue(value)}
      helper={
        comparison !== null && previousValue
          ? `(${formatValue(Math.abs(value - previousValue))})`
          : undefined
      }
      icon={config.icon}
      tone={config.tone}
      trend={
        comparison !== null
          ? {
              direction: isPositive ? 'up' : 'down',
              label: `${isPositive ? '+' : ''}${comparison.toFixed(0)}%`,
            }
          : undefined
      }
      progress={
        progress !== null && goal
          ? { percent: progress, label: `Meta: ${formatValue(goal)}` }
          : undefined
      }
      density="compact"
      onClick={onClick}
    />
  );
};

export default KPICard;
