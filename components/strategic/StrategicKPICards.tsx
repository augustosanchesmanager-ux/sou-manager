import React from 'react';

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

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

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
  const cards = [
    {
      key: 'revenue',
      label: 'Faturamento',
      value: formatCurrency(revenue),
      subValue: revenueGrowth !== 0 ? formatPercent(revenueGrowth) : undefined,
      icon: 'payments',
      color: 'emerald',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'avgTicket',
      label: 'Ticket Médio',
      value: formatCurrency(avgTicket),
      subValue: avgTicketGrowth !== 0 ? formatPercent(avgTicketGrowth) : undefined,
      icon: 'receipt_long',
      color: 'amber',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      key: 'clients',
      label: 'Clientes',
      value: String(totalClients),
      subValue: newClients > 0 ? `+${newClients} novos` : undefined,
      icon: 'group',
      color: 'blue',
      bgColor: 'bg-blue-500/10 border-blue-500/20',
      textColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      key: 'occupation',
      label: 'Ocupação',
      value: `${occupationRate.toFixed(0)}%`,
      subValue: `${appointmentCount} agendamentos`,
      icon: 'event_available',
      color: 'primary',
      bgColor: 'bg-primary/10 border-primary/20',
      textColor: 'text-primary',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.key}
          onClick={() => onKpiClick?.(card.key)}
          className={`card-boutique p-4 border ${card.bgColor} hover:scale-[1.02] transition-all duration-200 cursor-pointer ${
            onKpiClick ? 'hover:shadow-lg hover:border-primary/30' : ''
          }`}
        >
          <div className="flex justify-between items-start mb-3">
            <div className={`size-9 rounded-lg border flex items-center justify-center ${card.bgColor}`}>
              <span className={`material-symbols-outlined text-lg ${card.textColor}`}>{card.icon}</span>
            </div>
            {card.subValue && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                card.subValue.startsWith('+') 
                  ? 'bg-emerald-500/10 text-emerald-600' 
                  : 'bg-red-500/10 text-red-500'
              }`}>
                {card.subValue}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{card.label}</p>
          <p className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white mt-1">{card.value}</p>
        </div>
      ))}
    </div>
  );
};