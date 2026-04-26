import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area } from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import { METALLIC_COLORS, METALLIC_TOOLTIP_STYLE, METALLIC_GRID_STYLE, METALLIC_AXIS_STYLE } from './MetallicChartStyles';

interface LineChartData {
  name: string;
  value: number;
  target?: number;
}

interface TrendLineChartProps {
  data: LineChartData[];
  dataKey?: string;
  targetKey?: string;
  height?: number;
  showDots?: boolean;
  showArea?: boolean;
  color?: string;
}

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL', 
    maximumFractionDigits: 0,
    notation: value >= 1000 ? 'compact' : 'standard'
  }).format(value);

export const TrendLineChart: React.FC<TrendLineChartProps> = ({ 
  data, 
  dataKey = 'value',
  targetKey,
  height = 200,
  showDots = true,
  showArea = true,
  color = METALLIC_COLORS.revenue,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <defs>
          {/* Gradiente area sutile */}
          <linearGradient id="lineAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        
        <CartesianGrid {...METALLIC_GRID_STYLE(isDark)} />
        
        <XAxis dataKey="name" {...METALLIC_AXIS_STYLE(isDark)} />
        
        <YAxis 
          {...METALLIC_AXIS_STYLE(isDark)} 
          tickFormatter={(v) => formatCurrency(v)}
          width={60}
        />
        
        <Tooltip 
          contentStyle={METALLIC_TOOLTIP_STYLE(isDark)}
          formatter={(value: number) => [formatCurrency(value), '']}
        />
        
        {showArea && (
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke="transparent"
            fill="url(#lineAreaGradient)"
          />
        )}
        
        <Line 
          type="monotone" 
          dataKey={dataKey} 
          stroke={color}
          strokeWidth={3}
          dot={showDots ? { 
            r: 4, 
            fill: color, 
            stroke: isDark ? '#1A1A1A' : '#FFFFFF', 
            strokeWidth: 2 
          } : false}
          activeDot={{ 
            r: 6, 
            fill: color, 
            stroke: isDark ? '#1A1A1A' : '#FFFFFF', 
            strokeWidth: 2 
          }}
        />
        
        {targetKey && (
          <ReferenceLine 
            yAxisId={0}
            stroke={METALLIC_COLORS.slateDark}
            strokeDasharray="5 5"
            strokeWidth={1}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default TrendLineChart;