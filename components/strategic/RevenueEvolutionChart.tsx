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
      <div className="card-boutique p-6">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
          Sem dados no período
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="card-boutique p-6">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                backgroundColor: 'rgba(255,255,255,0.95)', 
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
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
    </div>
  );
};