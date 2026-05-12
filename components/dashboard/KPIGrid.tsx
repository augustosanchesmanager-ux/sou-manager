import React from 'react';
import { KPICard, type KPIType } from './KPICard';

interface DashboardMetrics {
  revenue: number;
  revenuePrevious?: number;
  todayAppointments: number;
  previousAppointments?: number;
  totalClients: number;
  previousClients?: number;
  avgTicket: number;
  previousAvgTicket?: number;
  revenueGoal?: number;
  appointmentsGoal?: number;
  openComandasCount?: number;
}

interface KPIGridProps {
  metrics: DashboardMetrics;
  period: 'today' | 'yesterday' | 'week' | 'month';
  onKpiClick?: (type: KPIType) => void;
}

export const KPIGrid: React.FC<KPIGridProps> = ({
  metrics,
  period,
  onKpiClick,
}) => {
  const LABEL_MAP: Record<string, string> = {
    today: 'Hoje',
    yesterday: 'Ontem',
    week: 'Esta Semana',
    month: 'Este Mês',
  };

  const periodLabel = LABEL_MAP[period] || period;

  const getRevenueLabel = () => {
    if (period === 'today') return 'Faturamento de hoje';
    return `Faturamento da ${periodLabel}`;
  };

  const getAppointmentLabel = () => {
    return `Agendamentos de hoje`;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <KPICard
        type="revenue"
        value={metrics.revenue}
        previousValue={metrics.revenuePrevious}
        goal={metrics.revenueGoal}
        label={getRevenueLabel()}
        onClick={() => onKpiClick?.('revenue')}
      />

      <KPICard
        type="appointments"
        value={metrics.todayAppointments}
        previousValue={metrics.previousAppointments}
        goal={metrics.appointmentsGoal}
        label={getAppointmentLabel()}
        onClick={() => onKpiClick?.('appointments')}
      />

      <KPICard
        type="comandas"
        value={metrics.openComandasCount ?? 0}
        label="Comandas Abertas"
        onClick={() => onKpiClick?.('comandas')}
      />

      <KPICard
        type="ticket"
        value={metrics.avgTicket}
        previousValue={metrics.previousAvgTicket}
        label="Ticket médio de hoje"
        onClick={() => onKpiClick?.('ticket')}
      />

      <KPICard
        type="cash"
        value={0}
        label="Caixa de hoje"
        onClick={() => onKpiClick?.('cash')}
      />
    </div>
  );
};

export default KPIGrid;