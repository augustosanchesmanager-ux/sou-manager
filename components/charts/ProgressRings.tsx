import React from 'react';

interface RingData {
  value: number;
  max?: number;
  color: string;
  label: string;
}

interface ProgressRingsProps {
  rings: RingData[];
  size?: number;
  strokeWidth?: number;
  gap?: number;
}

export const ProgressRings: React.FC<ProgressRingsProps> = ({
  rings,
  size = 160,
  strokeWidth = 12,
  gap = 8,
}) => {
  const center = size / 2;
  const maxRadius = (size - strokeWidth) / 2;
  
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {rings.map((ring, index) => {
          const radius = maxRadius - (index * (strokeWidth + gap));
          const circumference = 2 * Math.PI * radius;
          const percentage = Math.min((ring.value / (ring.max || 100)) * 100, 100);
          const offset = circumference - (percentage / 100) * circumference;
          
          return (
            <g key={ring.label}>
              {/* Background */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-slate-100 dark:text-slate-800"
              />
              {/* Progress */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
                style={{
                  filter: `drop-shadow(0 0 6px ${ring.color}30)`,
                }}
              />
            </g>
          );
        })}
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900 dark:text-white">
          {Math.round(rings.reduce((acc, r) => acc + r.value, 0) / rings.length)}%
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">Média</span>
      </div>
    </div>
  );
};

interface SingleProgressRingProps {
  value: number;
  max?: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export const SingleProgressRing: React.FC<SingleProgressRingProps> = ({
  value,
  max = 100,
  color,
  size = 120,
  strokeWidth = 10,
  label,
}) => {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min((value / max) * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100 dark:text-slate-800"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>{Math.round(percentage)}%</span>
        {label && <span className="text-xs text-slate-500 mt-0.5">{label}</span>}
      </div>
    </div>
  );
};

export default ProgressRings;