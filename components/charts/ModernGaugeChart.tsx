import React, { useMemo } from 'react';

interface ModernGaugeChartProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  gradientColors?: [string, string];
  showPercentage?: boolean;
  animated?: boolean;
}

export const ModernGaugeChart: React.FC<ModernGaugeChartProps> = ({
  value,
  max = 100,
  size = 180,
  strokeWidth = 16,
  label,
  sublabel,
  color = '#3B82F6',
  gradientColors,
  showPercentage = true,
  animated = true,
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference * 0.75; // 270 degrees
  
  const gradientId = useMemo(() => `gauge-gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  
  const defaultGradient: [string, string] = gradientColors || [color, `${color}88`];
  
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-[135deg]">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={defaultGradient[0]} />
            <stop offset="100%" stopColor={defaultGradient[1]} />
          </linearGradient>
        </defs>
        
        {/* Background arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.25}
          strokeLinecap="round"
          className="text-slate-100 dark:text-slate-800"
        />
        
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{
            filter: `drop-shadow(0 0 8px ${color}40)`,
          }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPercentage && (
          <span className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums" style={{ color }}>
            {Math.round(percentage)}%
          </span>
        )}
        {label && (
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">
            {label}
          </span>
        )}
        {sublabel && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default ModernGaugeChart;