import React from 'react';
import { StaffProductivityDetail } from '../../src/types/business-insights';
import { Users, Scissors, Award, TrendingUp, DollarSign } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface StaffProfitabilityTableProps {
  staffDetails: StaffProductivityDetail[];
}

export const StaffProfitabilityTable: React.FC<StaffProfitabilityTableProps> = ({
  staffDetails,
}) => {
  // Ordenar por maior faturamento bruto gerado
  const sortedStaff = React.useMemo(() => {
    return [...staffDetails].sort((a, b) => b.totalGrossRevenue - a.totalGrossRevenue);
  }, [staffDetails]);

  const topStaff = sortedStaff[0];

  // Dados para o gráfico comparativo
  const chartData = sortedStaff.map((s) => ({
    name: s.name.split(' ')[0],
    faturamento: s.totalGrossRevenue,
    comissao: s.totalCommission,
    margemBarbearia: s.netShopMargin,
  }));

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            Produtividade & Lucratividade por Barbeiro
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Volume de cortes, ticket médio real, custo de comissão líquida e margem retida para a casa (Rubens, Heron, Lucas).
          </p>
        </div>

        {topStaff && (
          <div className="px-3.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-lg flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <div className="text-xs">
              <span className="text-gray-500 dark:text-gray-400">Destaque do Período:</span>{' '}
              <strong className="text-amber-900 dark:text-amber-300">{topStaff.name}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Gráfico Comparativo: Faturamento vs Comissão vs Margem da Casa */}
      {chartData.length > 0 && (
        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} />
              <YAxis
                tick={{ fill: '#64748B', fontSize: 11 }}
                axisLine={false}
                tickFormatter={(v) => `R$${v}`}
              />
              <Tooltip
                formatter={(val: any) => formatBRL(Number(val))}
                contentStyle={{
                  backgroundColor: '#0F172A',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#FFF',
                  fontSize: '12px',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                formatter={(value) => {
                  if (value === 'faturamento') return 'Faturamento Bruto';
                  if (value === 'comissao') return 'Comissão do Barbeiro';
                  if (value === 'margemBarbearia') return 'Margem Líquida da Barbearia';
                  return value;
                }}
              />
              <Bar dataKey="faturamento" fill="#B88A44" radius={[4, 4, 0, 0]} barSize={22} />
              <Bar dataKey="comissao" fill="#94A3B8" radius={[4, 4, 0, 0]} barSize={22} />
              <Bar dataKey="margemBarbearia" fill="#10B981" radius={[4, 4, 0, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela Detalhada de Performance */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <th className="py-3 px-3 font-semibold">Profissional</th>
              <th className="py-3 px-3 font-semibold text-center">Atendimentos</th>
              <th className="py-3 px-3 font-semibold text-right">Ticket Médio</th>
              <th className="py-3 px-3 font-semibold text-right">Faturamento Bruto</th>
              <th className="py-3 px-3 font-semibold text-right">Comissão Devida</th>
              <th className="py-3 px-3 font-semibold text-right">Margem Retida (Casa)</th>
              <th className="py-3 px-3 font-semibold text-center">% Margem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sortedStaff.map((staff, idx) => (
              <tr
                key={staff.staffId}
                className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <td className="py-3 px-3 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <span>{staff.name}</span>
                </td>
                <td className="py-3 px-3 text-center text-gray-700 dark:text-gray-300 font-semibold">
                  {staff.appointmentsCount}
                </td>
                <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-300">
                  {formatBRL(staff.avgTicket)}
                </td>
                <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                  {formatBRL(staff.totalGrossRevenue)}
                </td>
                <td className="py-3 px-3 text-right text-amber-700 dark:text-amber-400 font-medium">
                  {formatBRL(staff.totalCommission)}
                </td>
                <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                  {formatBRL(staff.netShopMargin)}
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {staff.netMarginPercent.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
