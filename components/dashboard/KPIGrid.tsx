import React from 'react';
import type { DashboardPeriod } from '../../src/modules/dashboard';
import { KPICard, type KPIType } from './KPICard';

interface DashboardMetrics {
  revenue: number;
  revenuePrevious?: number;
  expenses: number;
  expensesPrevious?: number;
  netRevenue: number;
  netRevenuePrevious?: number;
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
  period: DashboardPeriod;
  onKpiClick?: (type: KPIType) => void;
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'hoje',
  yesterday: 'ontem',
  week: 'esta semana',
  month: 'este mês',
};

export const KPIGrid: React.FC<KPIGridProps> = ({
  metrics,
  period,
  onKpiClick,
}) => {
  const periodLabel = PERIOD_LABELS[period];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <KPICard
        type="revenue"
        value={metrics.revenue}
        previousValue={metrics.revenuePrevious}
        goal={metrics.revenueGoal}
        label={`Faturamento de ${periodLabel}`}
        onClick={() => onKpiClick?.('revenue')}
      />

      <KPICard
        type="appointments"
        value={metrics.todayAppointments}
        previousValue={metrics.previousAppointments}
        goal={metrics.appointmentsGoal}
        label={`Agendamentos de ${periodLabel}`}
        onClick={() => onKpiClick?.('appointments')}
      />

      <KPICard
        type="comandas"
        value={metrics.openComandasCount ?? 0}
        label="Comandas abertas"
        onClick={() => onKpiClick?.('comandas')}
      />

      <KPICard
        type="ticket"
        value={metrics.avgTicket}
        previousValue={metrics.previousAvgTicket}
        label={`Ticket médio de ${periodLabel}`}
        onClick={() => onKpiClick?.('ticket')}
      />

      <KPICard
        type="cash"
        value={metrics.netRevenue}
        previousValue={metrics.netRevenuePrevious}
        label={`Saldo financeiro de ${periodLabel}`}
        onClick={() => onKpiClick?.('cash')}
      />
    </div>
  );
};

export default KPIGrid;
