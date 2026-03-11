import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface CashFlowChartProps {
  title: string;
  subtitle: string;
  variant: 'bar' | 'area';
  data: Array<{ label: string; entradas: number; saidas: number; saldo: number }>;
}

const CashFlowChart: React.FC<CashFlowChartProps> = ({ title, subtitle, data, variant }) => {
  return (
    <article className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark p-5 h-[320px]">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        {variant === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#cbd5e1" opacity={0.35} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
            <Legend iconType="circle" />
            <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[8, 8, 0, 0]} />
            <Bar dataKey="saidas" name="Saídas" fill="#f97316" radius={[8, 8, 0, 0]} />
          </BarChart>
        ) : (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#cbd5e1" opacity={0.35} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
            <Area type="monotone" dataKey="saldo" name="Saldo" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#saldoFill)" />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </article>
  );
};

export default CashFlowChart;
