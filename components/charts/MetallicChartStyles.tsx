import React from 'react';

// Gradientes metálicas sutis estilo MetaMetric
export const CHART_GRADIENTS = {
  // Gradiente azul (receitas)
  blueRevenue: (
    <defs>
      <linearGradient id="blueRevenueGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8} />
        <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.4} />
        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
      </linearGradient>
    </defs>
  ),
  
  // Gradiente verde (sucesso/crescimento)
  greenGrowth: (
    <defs>
      <linearGradient id="greenGrowthGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#10B981" stopOpacity={0.8} />
        <stop offset="100%" stopColor="#10B981" stopOpacity={0.1} />
      </linearGradient>
    </defs>
  ),
  
  // Gradiente dourado (gold SMG)
  goldPrimary: (
    <defs>
      <linearGradient id="goldPrimaryGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#C6A45A" stopOpacity={1} />
        <stop offset="50%" stopColor="#D4B872" stopOpacity={0.8} />
        <stop offset="100%" stopColor="#9A7B3A" stopOpacity={0.6} />
      </linearGradient>
    </defs>
  ),
  
  // Gradiente Roxo
  purple: (
    <defs>
      <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.8} />
        <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.2} />
      </linearGradient>
    </defs>
  ),
  
  // Gradiente pink
  pink: (
    <defs>
      <linearGradient id="pinkGradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#EC4899" stopOpacity={0.9} />
        <stop offset="100%" stopColor="#EC4899" stopOpacity={0.3} />
      </linearGradient>
    </defs>
  ),
  
  // Gradiente ciano (destaque)
  cyan: (
    <defs>
      <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.9} />
        <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.2} />
      </linearGradient>
    </defs>
  ),
};

// Cores metálicas sutis para gráficos
export const METALLIC_COLORS = {
  // Palette estilo MetaMetric - tons metalicos sutis
  revenue: '#3B82F6',      // Blue principal
  revenueLight: '#60A5FA',
  revenueDark: '#1D4ED8',
  
  expense: '#EF4444',      // Vermelho suave
  expenseLight: '#F87171',
  expenseDark: '#DC2626',
  
  profit: '#10B981',       // Verde success
  profitLight: '#34D399',
  profitDark: '#059669',
  
  primary: '#C6A45A',     // Gold SMG
  primaryLight: '#D4B872',
  primaryDark: '#9A7B3A',
  
  purple: '#8B5CF6',
  purpleLight: '#A78BFA',
  purpleDark: '#6D28D9',
  
  pink: '#EC4899',
  pinkLight: '#F472B6',
  pinkDark: '#DB2777',
  
  cyan: '#06B6D4',
  cyanLight: '#22D3EE',
  cyanDark: '#0891B2',
  
  slate: '#64748B',
  slateLight: '#94A3B8',
  slateDark: '#475569',
};

// Tooltip estilo MetaMetric
export const METALLIC_TOOLTIP_STYLE = (dark: boolean) => ({
  backgroundColor: dark ? '#1A1A1A' : '#FFFFFF',
  border: `1px solid ${dark ? '#333333' : '#E2E8F0'}`,
  borderRadius: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  padding: '12px 16px',
});

// Tooltip content formatter
export const FormatTooltip = ({ 
  active, 
  payload, 
  label, 
  formatter = (v: number) => v,
  dark = false 
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter?: (v: number) => string;
  dark?: boolean;
}) => {
  if (!active || !payload?.length) return null;
  
  return (
    <div className={`${dark ? 'bg-[#1A1A1A]' : 'bg-white'} p-3 rounded-lg border ${dark ? 'border-[#333]' : 'border-slate-200'} shadow-lg`}>
      {label && <p className={`text-xs font-bold mb-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className={dark ? 'text-slate-300' : 'text-slate-700'}>{entry.name}:</span>
          <span className="font-bold" style={{ color: entry.color }}>{formatter(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

// Componente de área com gradiente
export const GradientArea = ({ 
  data, 
  dataKey, 
  stroke = METALLIC_COLORS.revenue, 
  fill = 'url(#blueRevenueGradient)',
  strokeWidth = 3,
}: {
  data: Array<Record<string, unknown>>;
  dataKey: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
}) => (
  <>
    {CHART_GRADIENTS.blueRevenue}
    <defs>
      <linearGradient id="customGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={stroke} stopOpacity={0.6} />
        <stop offset="100%" stopColor={stroke} stopOpacity={0.05} />
      </linearGradient>
    </defs>
    <Area 
      type="monotone" 
      dataKey={dataKey} 
      stroke={stroke} 
      strokeWidth={strokeWidth}
      fill="url(#customGradient)" 
    />
  </>
);

// Estilo de grid sutile
export const METALLIC_GRID_STYLE = (dark: boolean) => ({
  strokeDasharray: '3 3',
  vertical: false,
  stroke: dark ? '#262626' : '#E2E8F0',
});

// Estilo de eixo
export const METALLIC_AXIS_STYLE = (dark: boolean) => ({
  axisLine: false,
  tickLine: false,
  tick: { fill: dark ? '#64748B' : '#94A3B8', fontSize: 11 },
});

// Barras com gradiente
export const GradientBar = ({ 
  dataKey, 
  fill = METALLIC_COLORS.revenue,
  radius = [4, 4, 0, 0],
}: {
  dataKey: string;
  fill?: string;
  radius?: number[];
}) => (
  <Bar 
    dataKey={dataKey} 
    fill={fill} 
    radius={radius}
    maxBarSize={40}
  />
);

export default CHART_GRADIENTS;