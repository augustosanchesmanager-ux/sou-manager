import React from 'react';

interface DonutSegment {
  value: number;
  label: string;
  color: string;
}

interface ModernDonutChartProps {
  data: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

export const ModernDonutChart: React.FC<ModernDonutChartProps> = ({
  data,
  size = 200,
  strokeWidth = 32,
  centerLabel,
  centerValue,
}) => {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  const total = data.reduce((acc, d) => acc + d.value, 0);
  
  let accumulatedOffset = 0;
  
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {data.map((segment, index) => {
          const percentage = (segment.value / total) * 100;
          const segmentLength = (percentage / 100) * circumference;
          const offset = accumulatedOffset;
          accumulatedOffset += segmentLength;
          
          return (
            <circle
              key={segment.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              className="transition-all duration-700 ease-out hover:opacity-80 cursor-pointer"
              style={{
                filter: `drop-shadow(0 0 4px ${segment.color}30)`,
              }}
            />
          );
        })}
      </svg>
      
      {/* Center content */}
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && (
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {centerLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

interface DonutLegendProps {
  data: DonutSegment[];
}

export const DonutLegend: React.FC<DonutLegendProps> = ({ data }) => {
  const total = data.reduce((acc, d) => acc + d.value, 0);
  
  return (
    <div className="space-y-2 mt-4">
      {data.map((segment) => (
        <div key={segment.label} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: segment.color || '#64748B' }}
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {segment.label || 'Desconhecido'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {segment.value ?? 0}
            </span>
            <span className="text-xs text-slate-400">
              {total > 0 ? `${Math.round(((segment.value ?? 0) / total) * 100)}%` : '0%'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ModernDonutChart;