import React from 'react';

interface TrendBadgeProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showValue?: boolean;
  suffix?: string;
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({
  value,
  size = 'sm',
  showIcon = true,
  showValue = true,
  suffix = '%',
}) => {
  const isPositive = value >= 0;
  const isNeutral = value === 0;
  
  const colorClass = isNeutral 
    ? 'text-slate-400 bg-slate-100 dark:bg-slate-800' 
    : isPositive 
      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' 
      : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20';
  
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px] gap-0.5',
    md: 'px-2 py-1 text-xs gap-1',
    lg: 'px-2.5 py-1 text-sm gap-1',
  };
  
  const iconSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };
  
  const icon = isNeutral ? 'remove' : isPositive ? 'trending_up' : 'trending_down';
  
  return (
    <span 
      className={`inline-flex items-center font-bold rounded-full ${colorClass} ${sizeClasses[size]}`}
    >
      {showIcon && (
        <span className={`material-symbols-outlined ${iconSize[size]} flex-shrink-0`}>
          {icon}
        </span>
      )}
      {showValue && (
        <span>
          {isPositive && !isNeutral ? '+' : ''}{value.toFixed(1)}{suffix}
        </span>
      )}
    </span>
  );
};

export default TrendBadge;