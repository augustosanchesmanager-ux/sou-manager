import React, { useMemo } from 'react';
import { formatCurrency } from '../../shared/format/currency';

interface ExpenseData {
  category: string;
  amount: number;
  color: string;
}

interface ExpenseChartProps {
  data: ExpenseData[];
  total: number;
  title?: string;
  showLegend?: boolean;
  compact?: boolean;
}

const DEFAULT_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', 
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6'
];

export const ExpenseChart: React.FC<ExpenseChartProps> = ({
  data,
  total,
  title = 'Despesas por Categoria',
  showLegend = true,
  compact = false,
}) => {
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      percentage: total > 0 ? (item.amount / total) * 100 : 0,
      color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    }));
  }, [data, total]);

  if (compact) {
    return (
      <div className="space-y-3">
        {chartData.map((item, index) => (
          <div key={item.category}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1.5">
                <span 
                  className="size-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {item.category}
                </span>
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatCurrency(item.amount)}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${item.percentage}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Donut Chart */}
      <div className="flex items-center justify-center">
        <div className="relative">
          <svg width="140" height="140" viewBox="0 0 140 140">
            {/* Background circle */}
            <circle
              cx="70"
              cy="70"
              r="55"
              fill="none"
              stroke="currentColor"
              strokeWidth="20"
              className="text-slate-100 dark:text-slate-800"
            />
            
            {/* Segments */}
            {(() => {
              let currentAngle = 0;
              return chartData.map((segment) => {
                const startAngle = currentAngle;
                currentAngle += (segment.percentage / 100) * 360;
                const endAngle = currentAngle;
                
                const startRad = ((startAngle - 90) * Math.PI) / 180;
                const endRad = ((endAngle - 90) * Math.PI) / 180;
                
                const x1 = 70 + 55 * Math.cos(startRad);
                const y1 = 70 + 55 * Math.sin(startRad);
                const x2 = 70 + 55 * Math.cos(endRad);
                const y2 = 70 + 55 * Math.sin(endRad);
                
                const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                
                const d = `M 70 70 L ${x1} ${y1} A 55 55 0 ${largeArc} 1 ${x2} ${y2} Z`;
                
                return (
                  <path
                    key={segment.category}
                    d={d}
                    fill={segment.color}
                    className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                    style={{
                      filter: `drop-shadow(0 0 4px ${segment.color}40)`,
                    }}
                  />
                );
              });
            })()}
            
            {/* Center text */}
            <text
              x="70"
              y="65"
              textAnchor="middle"
              className="fill-slate-900 dark:fill-white text-lg font-bold"
            >
              {formatCurrency(total)}
            </text>
            <text
              x="70"
              y="82"
              textAnchor="middle"
              className="fill-slate-500 dark:fill-slate-400 text-[10px] font-medium"
            >
              TOTAL
            </text>
          </svg>
        </div>
      </div>
      
      {/* Legend */}
      {showLegend && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {title}
          </h4>
          {chartData.map((item) => (
            <div key={item.category} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span 
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {item.category}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  {formatCurrency(item.amount)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExpenseChart;