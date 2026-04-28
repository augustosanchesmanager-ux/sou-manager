import React, { useMemo, useId } from 'react';

interface SparkLineChartProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  showArea?: boolean;
  strokeWidth?: number;
}

export const SparkLineChart: React.FC<SparkLineChartProps> = ({
  data,
  color = '#3B82F6',
  width = 100,
  height = 32,
  showArea = true,
  strokeWidth = 2,
}) => {
  const uniqueId = useId();
  const gradientId = useMemo(() => `sparkline-gradient-${uniqueId}`, [uniqueId]);
  
  const points = useMemo(() => {
    if (!data || data.length === 0) return '';
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    return data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(' ');
  }, [data, width, height]);

  const areaPath = useMemo(() => {
    if (!data || data.length === 0 || !showArea) return '';
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const linePoints = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return { x, y };
    });
    
    if (linePoints.length === 0) return '';
    
    const startX = linePoints[0].x;
    const endX = linePoints[linePoints.length - 1].x;
    
    let path = `M ${startX} ${height}`;
    linePoints.forEach(p => {
      path += ` L ${p.x} ${p.y}`;
    });
    path += ` L ${endX} ${height} Z`;
    
    return path;
  }, [data, width, height, showArea]);

  if (!data || data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center text-slate-400 text-xs"
        style={{ width, height }}
      >
        —
      </div>
    );
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      
      {showArea && areaPath && (
        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
          className="transition-opacity duration-300"
        />
      )}
      
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-300"
        style={{
          filter: `drop-shadow(0 0 4px ${color}40)`,
        }}
      />
    </svg>
  );
};

export default SparkLineChart;