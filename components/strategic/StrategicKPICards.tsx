import React from 'react';
import { formatCurrency } from '../../shared/format/currency';
import MetricCard from '../ui/MetricCard';

interface StrategicKPICardsProps {
  revenue: number;
  revenueGrowth: number;
  avgTicket: number;
  avgTicketGrowth: number;
  totalClients: number;
  newClients: number;
  occupationRate: number;
  appointmentCount: number;
  onKpiClick?: (kpi: string) => void;
}

const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

const growthDirection = (value: number): 'up' | 'down' | 'flat' =>
  value > 0 ? 'up' : value < 0 ? 'down' : 'flat';

export const StrategicKPICards: React.FC<StrategicKPICardsProps> = ({
  revenue,
  revenueGrowth,
  avgTicket,
  avgTicketGrowth,
  totalClients,
  newClients,
  occupationRate,
  appointmentCount,
  onKpiClick,
}) => {
  return (
    <section className="rounded-3xl border border-slate-200 bg-surface-light p-4 shadow-sm dark:border-border-dark dark:bg-card-dark">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-operational dark:text-operational-bright">Pulso da operação</p>
          <h3 className="text-lg font-black text-smg-deep dark:text-white">Financeiro, agenda e clientes</h3>
        </div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Clique em um indicador para abrir a análise.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Receita recebida"
          value={formatCurrency(revenue)}
          trend={revenueGrowth !== 0 ? { direction: growthDirection(revenueGrowth), label: formatPercent(revenueGrowth) } : undefined}
          helper="Entradas reais do financeiro"
          icon="payments"
          tone="positive"
          density="compact"
          onClick={onKpiClick ? () => onKpiClick('revenue') : undefined}
        />
        <MetricCard
          label="Ticket médio"
          value={formatCurrency(avgTicket)}
          trend={avgTicketGrowth !== 0 ? { direction: growthDirection(avgTicketGrowth), label: formatPercent(avgTicketGrowth) } : undefined}
          helper="Média por venda registrada"
          icon="receipt_long"
          tone="warning"
          density="compact"
          onClick={onKpiClick ? () => onKpiClick('avgTicket') : undefined}
        />
        <MetricCard
          label="Base de clientes"
          value={String(totalClients)}
          helper={newClients > 0 ? `+${newClients} novos no período` : 'Cadastro real da barbearia'}
          icon="group"
          tone="info"
          density="compact"
          onClick={onKpiClick ? () => onKpiClick('clients') : undefined}
        />
        <MetricCard
          label="Ocupação da agenda"
          value={`${occupationRate.toFixed(0)}%`}
          helper={`${appointmentCount} agendamentos no período`}
          icon="event_available"
          tone="info"
          density="compact"
          onClick={onKpiClick ? () => onKpiClick('occupation') : undefined}
        />
      </div>
    </section>
  );
};
