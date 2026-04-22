import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'amber' | 'emerald' | 'red';
  className?: string;
  showLabel?: boolean;
  label?: string;
}

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
  xl: 'h-16 w-16 border-4',
} as const;

const colorMap = {
  primary: 'border-primary/30 border-t-primary',
  white: 'border-white/30 border-t-white',
  amber: 'border-amber-500/30 border-t-amber-500',
  emerald: 'border-emerald-500/30 border-t-emerald-500',
  red: 'border-red-500/30 border-t-red-500',
} as const;

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
  showLabel = false,
  label = 'Carregando...',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <div
        className={`rounded-full animate-spin ${sizeMap[size]} ${colorMap[color]}`}
        style={{
          borderTopWidth: size === 'sm' ? '2px' : size === 'md' ? '2px' : size === 'lg' ? '3px' : '4px',
        }}
      />
      {showLabel && label && (
        <span className="text-sm text-slate-600 dark:text-slate-400 animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
};

export default LoadingSpinner;
