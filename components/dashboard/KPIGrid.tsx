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

  const getAppointmentLabel = () => {
    const pending = 0;
    const confirmed = metrics.todayAppointments - pending;
    return `${metrics.todayAppointments} ${LABEL_MAP[period]}`;
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        type="revenue"
        value={metrics.revenue}
        previousValue={metrics.revenuePrevious}
        goal={metrics.revenueGoal}
        label={`Faturamento do ${LABEL_MAP[period]}`}
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
        type="clients"
        value={metrics.totalClients}
        previousValue={metrics.previousClients}
        label="Total de Clientes"
        onClick={() => onKpiClick?.('clients')}
      />
      
      <KPICard
        type="ticket"
        value={metrics.avgTicket}
        previousValue={metrics.previousAvgTicket}
        label="Ticket Médio"
        onClick={() => onKpiClick?.('ticket')}
      />
    </div>
  );
};

export default KPIGrid;