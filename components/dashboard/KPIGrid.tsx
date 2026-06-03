import React from 'react';
import { getBusinessLabels } from '../../src/lib/apps/businessLabels';
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
  appSlug?: string | null;
  onKpiClick?: (type: KPIType) => void;
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'de hoje',
  yesterday: 'de ontem',
  week: 'da semana',
  month: 'do mês',
};

export const KPIGrid: React.FC<KPIGridProps> = ({
  metrics,
  period,
  appSlug,
  onKpiClick,
}) => {
  const periodLabel = PERIOD_LABELS[period];
  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';

  if (isEsteticaApp) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard
          type="revenue"
          value={metrics.revenue}
          previousValue={metrics.revenuePrevious}
          label={`Faturamento ${periodLabel}`}
          onClick={() => onKpiClick?.('revenue')}
        />

        <KPICard
          type="appointments"
          value={metrics.todayAppointments}
          previousValue={metrics.previousAppointments}
          label={`${labels.orderPlural} ${periodLabel}`}
          onClick={() => onKpiClick?.('appointments')}
        />

        <KPICard
          type="comandas"
          value={metrics.openComandasCount ?? 0}
          label={`${labels.orderPlural} abertos`}
          onClick={() => onKpiClick?.('comandas')}
        />

        <KPICard
          type="clients"
          value={metrics.totalClients}
          label="Clientes cadastrados"
          onClick={() => onKpiClick?.('clients')}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <KPICard
        type="revenue"
        value={metrics.revenue}
        previousValue={metrics.revenuePrevious}
        goal={metrics.revenueGoal}
        label={`Faturamento ${periodLabel}`}
        onClick={() => onKpiClick?.('revenue')}
      />

      <KPICard
        type="appointments"
        value={metrics.todayAppointments}
        previousValue={metrics.previousAppointments}
        goal={metrics.appointmentsGoal}
        label={`Agendamentos ${periodLabel}`}
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
        label={`Ticket médio ${periodLabel}`}
        onClick={() => onKpiClick?.('ticket')}
      />

      <KPICard
        type="cash"
        value={metrics.netRevenue}
        previousValue={metrics.netRevenuePrevious}
        label={`Saldo financeiro ${periodLabel}`}
        onClick={() => onKpiClick?.('cash')}
      />
    </div>
  );
};

export default KPIGrid;
