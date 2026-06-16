import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface RevenueEvolutionChartProps {
  data: { date: string; value: number }[];
  title?: string;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export const RevenueEvolutionChart: React.FC<RevenueEvolutionChartProps> = ({ data, title = 'Evolução de Receita' }) => {
  if (!data || data.length === 0) {
    return (
      <section className="rounded-3xl border border-[#D9EAF5] bg-white p-6 shadow-sm dark:border-[#14304A] dark:bg-card-dark">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-[#BDEFFF] bg-[#EAF7FF] text-[#007BFF] dark:border-[#14304A] dark:bg-[#0D2238] dark:text-[#00D2FF]">
            <span className="material-symbols-outlined">monitoring</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Financeiro</p>
            <h3 className="text-base font-black text-[#003366] dark:text-white">{title}</h3>
          </div>
        </div>
        <div className="flex h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-[#D9EAF5] bg-[#F7FBFE] p-6 text-center dark:border-[#14304A] dark:bg-[#0B1828]">
          <span className="material-symbols-outlined mb-2 text-3xl text-[#007BFF] dark:text-[#00D2FF]">bar_chart_4_bars</span>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Sem receita registrada neste período</p>
          <p className="mt-1 text-xs text-slate-500">Quando houver entradas no financeiro, a curva aparece aqui.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-[#D9EAF5] bg-white p-6 shadow-sm dark:border-[#14304A] dark:bg-card-dark">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-[#BDEFFF] bg-[#EAF7FF] text-[#007BFF] dark:border-[#14304A] dark:bg-[#0D2238] dark:text-[#00D2FF]">
            <span className="material-symbols-outlined">monitoring</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Financeiro</p>
            <h3 className="text-base font-black text-[#003366] dark:text-white">{title}</h3>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
          Dados reais
        </span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.32} />
                <stop offset="95%" stopColor="#00D2FF" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis 
              tickFormatter={(v) => formatCurrency(v)}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), 'Receita']}
              labelFormatter={(label) => new Date(label).toLocaleDateString('pt-BR')}
              contentStyle={{ 
                backgroundColor: '#FFFFFF',
                border: '1px solid #D9EAF5',
                borderRadius: '12px',
                fontSize: '12px'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#revenueGradient)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
