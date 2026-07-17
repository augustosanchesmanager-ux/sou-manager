import React from 'react';
import { SparkLineChart } from './SparkLineChart';
import { TrendBadge } from './TrendBadge';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  sparklineData?: number[];
  icon?: string;
  color?: string;
  onClick?: () => void;
  variant?: 'default' | 'compact' | 'featured';
}

const colorMap: Record<string, { bg: string; text: string; hex: string }> = {
  blue: { bg: 'bg-[#007BFF]/10', text: 'text-[#007BFF]', hex: '#007BFF' },
  purple: { bg: 'bg-[#007BFF]/10', text: 'text-[#007BFF]', hex: '#007BFF' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', hex: '#10B981' },
  amber: { bg: 'bg-[#B88A44]/15', text: 'text-[#9A6F2D] dark:text-[#E3C382]', hex: '#B88A44' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', hex: '#EF4444' },
  cyan: { bg: 'bg-[#00D2FF]/10', text: 'text-[#008FC2] dark:text-[#72E7FF]', hex: '#00D2FF' },
  violet: { bg: 'bg-[#003366]/10', text: 'text-[#003366] dark:text-[#9DEBFF]', hex: '#003366' },
  pink: { bg: 'bg-[#B88A44]/15', text: 'text-[#9A6F2D] dark:text-[#E3C382]', hex: '#B88A44' },
};

const getColorStyles = (color: string) => colorMap[color] || colorMap.blue;

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  sparklineData,
  icon,
  color = 'blue',
  onClick,
  variant = 'default',
}) => {
  const colorStyles = getColorStyles(color);
  
  const baseClasses = variant === 'featured'
    ? 'bg-[linear-gradient(135deg,#06182f,#08284d)] border-[#00D2FF]/20'
    : 'bg-white dark:bg-[#1A1A1D] border-slate-200 dark:border-[#262A33]';
  
  return (
    <div 
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-xl border shadow-sm transition-all duration-200
        ${baseClasses}
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-[#007BFF]/40' : 'shadow-slate-200/50 dark:shadow-none'}
      `}
    >
      {/* Background gradient effect */}
      {variant === 'featured' && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(0,210,255,0.18),transparent_30%)]" />
      )}
      
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${colorStyles.bg}`}>
            <span className={`material-symbols-outlined ${colorStyles.text}`}>
              {icon || 'analytics'}
            </span>
          </div>
          
          {trend !== undefined && (
            <TrendBadge value={trend} size="sm" />
          )}
        </div>
        
        {/* Content */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {title}
          </p>
          
          <div className="flex items-end justify-between">
            <div>
              <h3 className={`
                font-black text-slate-900 dark:text-white
                ${variant === 'compact' ? 'text-xl' : variant === 'featured' ? 'text-3xl' : 'text-2xl'}
              `}>
                {value}
              </h3>
              
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {subtitle}
                </p>
              )}
              
              {trendLabel && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  {trendLabel}
                </p>
              )}
            </div>
            
            {/* Sparkline */}
            {sparklineData && sparklineData.length > 0 && (
              <div className="flex-shrink-0">
                <SparkLineChart 
                  data={sparklineData} 
                  color={colorStyles.hex}
                  width={80}
                  height={32}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom accent line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${colorStyles.hex}, transparent)` }}
        />
      </div>
    </div>
  );
};

export default MetricCard;
