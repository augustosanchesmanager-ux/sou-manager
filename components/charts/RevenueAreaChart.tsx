import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import { METALLIC_COLORS, METALLIC_TOOLTIP_STYLE, METALLIC_GRID_STYLE, METALLIC_AXIS_STYLE } from './MetallicChartStyles';

interface RevenueChartProps {
  data: Array<{ month: string; income: number; expense: number }>;
  dataKey?: string;
  showExpenses?: boolean;
  height?: number;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL', 
    maximumFractionDigits: 0,
    notation: value >= 1000 ? 'compact' : 'standard'
  }).format(value);

export const RevenueAreaChart: React.FC<RevenueChartProps> = ({ 
  data, 
  dataKey = 'income',
  showExpenses = false,
  height = 280 
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm" style={{ minHeight: height }}>
        Sem dados para exibir
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <defs>
          {/* Gradiente azul metalico para receitas */}
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={METALLIC_COLORS.revenue} stopOpacity={0.5} />
            <stop offset="50%" stopColor={METALLIC_COLORS.revenue} stopOpacity={0.2} />
            <stop offset="100%" stopColor={METALLIC_COLORS.revenue} stopOpacity={0.02} />
          </linearGradient>
          
          {/* Gradiente vermelho para despesas */}
          <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={METALLIC_COLORS.expense} stopOpacity={0.4} />
            <stop offset="100%" stopColor={METALLIC_COLORS.expense} stopOpacity={0.05} />
          </linearGradient>
          
          {/* Gradiente dourado SMG */}
          <linearGradient id="goldGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={METALLIC_COLORS.primary} stopOpacity={0.6} />
            <stop offset="50%" stopColor={METALLIC_COLORS.primaryLight} stopOpacity={0.3} />
            <stop offset="100%" stopColor={METALLIC_COLORS.primaryDark} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        
        <CartesianGrid {...METALLIC_GRID_STYLE(isDark)} />
        
        <XAxis 
          dataKey="month" 
          {...METALLIC_AXIS_STYLE(isDark)}
        />
        
        <YAxis 
          {...METALLIC_AXIS_STYLE(isDark)}
          tickFormatter={(v) => formatCurrency(v)}
          width={70}
        />
        
        <Tooltip 
          contentStyle={METALLIC_TOOLTIP_STYLE(isDark)}
          formatter={(value: number) => [formatCurrency(value), '']}
          labelStyle={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: '11px' }}
        />
        
        <Area 
          type="monotone" 
          dataKey={dataKey} 
          stroke={METALLIC_COLORS.revenue}
          strokeWidth={3}
          fill="url(#revenueGradient)"
          dot={false}
          activeDot={{ r: 6, fill: METALLIC_COLORS.revenue, stroke: isDark ? '#1A1A1A' : '#FFFFFF', strokeWidth: 2 }}
        />
        
        {showExpenses && (
          <Area 
            type="monotone" 
            dataKey="expense" 
            stroke={METALLIC_COLORS.expense}
            strokeWidth={2}
            strokeDasharray="5 5"
            fill="url(#expenseGradient)"
            dot={false}
            activeDot={{ r: 4, fill: METALLIC_COLORS.expense, stroke: isDark ? '#1A1A1A' : '#FFFFFF', strokeWidth: 2 }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default RevenueAreaChart;