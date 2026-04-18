import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface ExpenseCategoryChartProps {
  pieData: Array<{ name: string; value: number }>;
  costCenterData: Array<{ name: string; value: number }>;
}

const pieColors = ['#f97316', '#10b981', '#0ea5e9', '#eab308', '#ef4444', '#14b8a6'];

const ExpenseCategoryChart: React.FC<ExpenseCategoryChartProps> = ({ pieData, costCenterData }) => {
  return (
    <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <article className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark p-5 h-[280px]">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Despesas por categoria</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Concentração das saídas no período selecionado</p>
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={78} innerRadius={48} paddingAngle={2}>
              {pieData.map((entry, index) => (
                <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
          </PieChart>
        </ResponsiveContainer>
      </article>

      <article className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark p-5 h-[280px]">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Saídas por centro de custo</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Visão executiva dos focos de gasto</p>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={costCenterData}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#cbd5e1" opacity={0.3} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
            <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </article>
    </section>
  );
};

export default ExpenseCategoryChart;
