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
const getTrendTone = (value: number) => {
  if (value > 0) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (value < 0) return 'bg-red-500/10 text-red-600 dark:text-red-300';
  return 'bg-slate-500/10 text-slate-500 dark:text-slate-300';
};

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
      label: 'Receita recebida',
      value: formatCurrency(revenue),
      subValue: revenueGrowth !== 0 ? formatPercent(revenueGrowth) : undefined,
      trendTone: getTrendTone(revenueGrowth),
      icon: 'payments',
      helper: 'Entradas reais do financeiro',
      iconBox: 'bg-emerald-500/10 border-emerald-500/20',
      textColor: 'text-emerald-600 dark:text-emerald-300',
    },
    {
      key: 'avgTicket',
      label: 'Ticket médio',
      value: formatCurrency(avgTicket),
      subValue: avgTicketGrowth !== 0 ? formatPercent(avgTicketGrowth) : undefined,
      trendTone: getTrendTone(avgTicketGrowth),
      icon: 'receipt_long',
      helper: 'Média por venda registrada',
      iconBox: 'bg-amber-500/10 border-amber-500/20',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      key: 'clients',
      label: 'Base de clientes',
      value: String(totalClients),
      subValue: newClients > 0 ? `+${newClients} novos` : undefined,
      trendTone: newClients > 0 ? 'bg-[#EAF7FF] text-[#007BFF] dark:bg-[#0D2238] dark:text-[#00D2FF]' : 'bg-slate-500/10 text-slate-500 dark:text-slate-300',
      icon: 'group',
      helper: 'Cadastro real da barbearia',
      iconBox: 'bg-[#EAF7FF] border-[#BDEFFF] dark:bg-[#0D2238] dark:border-[#14304A]',
      textColor: 'text-[#007BFF] dark:text-[#00D2FF]',
    },
    {
      key: 'occupation',
      label: 'Ocupação da agenda',
      value: `${occupationRate.toFixed(0)}%`,
      subValue: `${appointmentCount} agendamentos`,
      trendTone: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
      icon: 'event_available',
      helper: 'Uso das cadeiras no período',
      iconBox: 'bg-sky-500/10 border-sky-500/20',
      textColor: 'text-sky-600 dark:text-sky-300',
    },
  ];

  return (
    <section className="rounded-3xl border border-[#D9EAF5] bg-white p-4 shadow-sm dark:border-[#14304A] dark:bg-card-dark">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#007BFF] dark:text-[#00D2FF]">Pulso da operação</p>
          <h3 className="text-lg font-black text-[#003366] dark:text-white">Financeiro, agenda e clientes</h3>
        </div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Clique em um indicador para abrir a análise.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => onKpiClick?.(card.key)}
            className="group rounded-2xl border border-slate-200 bg-[#F7FBFE] p-4 text-left transition hover:border-[#00D2FF]/50 hover:bg-[#EAF7FF]/70 focus:outline-none focus:ring-2 focus:ring-[#00D2FF]/30 dark:border-border-dark dark:bg-[#0B1828] dark:hover:border-[#00D2FF]/40"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className={`flex size-10 items-center justify-center rounded-xl border ${card.iconBox}`}>
                <span className={`material-symbols-outlined text-xl ${card.textColor}`}>{card.icon}</span>
              </div>
              {card.subValue && (
                <span className={`rounded-full px-2 py-1 text-[10px] font-black ${card.trendTone}`}>
                  {card.subValue}
                </span>
              )}
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{card.value}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{card.helper}</p>
          </button>
        ))}
      </div>
    </section>
  );
};
