import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import { METALLIC_COLORS, METALLIC_TOOLTIP_STYLE, METALLIC_GRID_STYLE, METALLIC_AXIS_STYLE } from './MetallicChartStyles';
import { formatCurrency } from '../../shared/format/currency';

interface BarChartData {
  name: string;
  value: number;
}

interface BarsChartProps {
  data: BarChartData[];
  dataKey?: string;
  layout?: 'horizontal' | 'vertical';
  height?: number;
  color?: string;
  showValues?: boolean;
}

const DEFAULT_COLORS = [
  METALLIC_COLORS.revenue,
  METALLIC_COLORS.purple,
  METALLIC_COLORS.pink,
  METALLIC_COLORS.cyan,
  METALLIC_COLORS.primary,
  METALLIC_COLORS.profit,
];

export const MetallicBarsChart: React.FC<BarsChartProps> = ({ 
  data, 
  dataKey = 'value',
  layout = 'horizontal',
  height = 280,
  color,
  showValues = true
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const barColor = color || METALLIC_COLORS.primary;
  
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart 
        data={data} 
        layout={layout}
        margin={{ top: 10, right: 20, left: layout === 'vertical' ? 60 : 0, bottom: 0 }}
      >
        <defs>
          {/* Gradiente barras - estilo metalico sutil */}
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={barColor} stopOpacity={1} />
            <stop offset="50%" stopColor={barColor} stopOpacity={0.85} />
            <stop offset="100%" stopColor={barColor} stopOpacity={0.6} />
          </linearGradient>
          
          {/* Gradiente multi-tonal */}
          <linearGradient id="barGradientMulti0" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={DEFAULT_COLORS[0]} stopOpacity={1} />
            <stop offset="100%" stopColor={DEFAULT_COLORS[0]} stopOpacity={0.6} />
          </linearGradient>
          <linearGradient id="barGradientMulti1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={DEFAULT_COLORS[1]} stopOpacity={1} />
            <stop offset="100%" stopColor={DEFAULT_COLORS[1]} stopOpacity={0.6} />
          </linearGradient>
          <linearGradient id="barGradientMulti2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={DEFAULT_COLORS[2]} stopOpacity={1} />
            <stop offset="100%" stopColor={DEFAULT_COLORS[2]} stopOpacity={0.6} />
          </linearGradient>
          <linearGradient id="barGradientMulti3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={DEFAULT_COLORS[3]} stopOpacity={1} />
            <stop offset="100%" stopColor={DEFAULT_COLORS[3]} stopOpacity={0.6} />
          </linearGradient>
          <linearGradient id="barGradientMulti4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={DEFAULT_COLORS[4]} stopOpacity={1} />
            <stop offset="100%" stopColor={DEFAULT_COLORS[4]} stopOpacity={0.6} />
          </linearGradient>
        </defs>
        
        <CartesianGrid {...METALLIC_GRID_STYLE(isDark)} horizontal={layout === 'vertical'} />
        
        {layout === 'horizontal' ? (
          <>
            <XAxis dataKey="name" {...METALLIC_AXIS_STYLE(isDark)} />
            <YAxis {...METALLIC_AXIS_STYLE(isDark)} tickFormatter={(v) => formatCurrency(v)} width={70} />
          </>
        ) : (
          <>
            <XAxis type="number" {...METALLIC_AXIS_STYLE(isDark)} tickFormatter={(v) => formatCurrency(v)} />
            <YAxis type="category" dataKey="name" {...METALLIC_AXIS_STYLE(isDark)} width={100} />
          </>
        )}
        
        <Tooltip 
          contentStyle={METALLIC_TOOLTIP_STYLE(isDark)}
          formatter={(value: number) => [formatCurrency(value), '']}
          labelStyle={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: '11px' }}
        />
        
        <Bar 
          dataKey={dataKey}
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={`url(#barGradientMulti${index % 5})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default MetallicBarsChart;