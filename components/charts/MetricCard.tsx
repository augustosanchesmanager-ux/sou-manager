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

const colorMap: Record<string, { bg: string; text: string; glow: string }> = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-500', glow: 'blue' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-500', glow: 'purple' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', glow: 'emerald' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', glow: 'amber' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-500', glow: 'rose' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-500', glow: 'cyan' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-500', glow: 'violet' },
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-500', glow: 'pink' },
};

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
  const colorStyles = colorMap[color] || colorMap.blue;
  
  const baseClasses = variant === 'featured'
    ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50'
    : 'bg-white dark:bg-[#1A1A1D] border-slate-200 dark:border-[#262A33]';
  
  return (
    <div 
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl border shadow-lg transition-all duration-300
        ${baseClasses}
        ${onClick ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] hover:border-primary/30' : 'shadow-slate-200/50 dark:shadow-none'}
      `}
    >
      {/* Background gradient effect */}
      {variant === 'featured' && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50" />
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
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </p>
          
          <div className="flex items-end justify-between">
            <div>
              <h3 className={`
                font-black text-slate-900 dark:text-white tracking-tight
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
                  color={color === 'blue' ? '#3B82F6' : color === 'purple' ? '#8B5CF6' : color === 'emerald' ? '#10B981' : color === 'amber' ? '#F59E0B' : color === 'rose' ? '#F43F5E' : '#3B82F6'}
                  width={80}
                  height={32}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom accent line */}
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-${color}-500 to-transparent opacity-50`} />
      </div>
    </div>
  );
};

export default MetricCard;