import React from 'react';

export type MetricTone = 'brass' | 'positive' | 'negative' | 'info' | 'warning' | 'neutral';
export type MetricDensity = 'compact' | 'comfortable';
export type MetricTrendDirection = 'up' | 'down' | 'flat';

export interface MetricTrend {
    direction: MetricTrendDirection;
    label: string;
}

export interface MetricProgress {
    percent: number;
    label: string;
}

export interface MetricCardProps {
    label: string;
    value: string;
    helper?: string;
    icon?: string;
    tone?: MetricTone;
    trend?: MetricTrend;
    progress?: MetricProgress;
    density?: MetricDensity;
    onClick?: () => void;
    className?: string;
}

const toneTileStyles: Record<MetricTone, string> = {
    brass: 'bg-[#F7E7C2] text-[#A96F14] border-[#E8DFC9]',
    positive: 'bg-[#DFF2E5] text-[#178A50] border-[#E8DFC9]',
    negative: 'bg-[#F9E1E1] text-[#C92A2A] border-[#E8DFC9]',
    info: 'bg-[#EFE9D8] text-[#6B6252] border-[#E8DFC9]',
    warning: 'bg-[#F7E7C2] text-[#A96F14] border-[#E8DFC9]',
    neutral: 'bg-[#F1ECE0] text-[#6B6252] border-[#E8DFC9]',
};

const trendConfig: Record<MetricTrendDirection, { icon: string; text: string }> = {
    up: { icon: 'trending_up', text: 'text-[#178A50]' },
    down: { icon: 'trending_down', text: 'text-[#C92A2A]' },
    flat: { icon: 'minimize', text: 'text-[#6B6252]' },
};

const MetricCard: React.FC<MetricCardProps> = ({
    label,
    value,
    helper,
    icon,
    tone = 'neutral',
    trend,
    progress,
    density = 'comfortable',
    onClick,
    className = '',
}) => {
    const trendStyle = trend ? trendConfig[trend.direction] : null;
    const valueSize = density === 'compact' ? 'text-2xl' : 'text-3xl';
    const padding = density === 'compact' ? 'p-4' : 'p-5';
    const progressPercent = progress ? Math.min(100, Math.max(0, Math.round(progress.percent))) : 0;
    const progressBarTone = 'bg-[#D99A2B]';

    const cardClasses = `w-full rounded-2xl border border-[#E8DFC9] bg-white text-left transition-shadow duration-200 ${padding} ${onClick ? 'cursor-pointer hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D99A2B]' : ''} ${className}`;

    const content = (
        <>
            <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6B6252]">
                    {label}
                </p>
                {icon ? (
                    <span
                        aria-hidden="true"
                        className={`flex size-9 items-center justify-center rounded-xl border ${toneTileStyles[tone]}`}
                    >
                        <span className="material-symbols-outlined text-xl">{icon}</span>
                    </span>
                ) : null}
            </div>
            <p className={`mt-2 font-black tracking-tight text-[#191611] ${valueSize}`}>
                {value}
            </p>
            {trend || helper ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {trend && trendStyle ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${trendStyle.text}`}>
                            <span aria-hidden="true" className="material-symbols-outlined text-base">
                                {trendStyle.icon}
                            </span>
                            {trend.label}
                        </span>
                    ) : null}
                    {helper ? (
                        <span className="text-xs font-medium text-[#6B6252]">{helper}</span>
                    ) : null}
                </div>
            ) : null}
            {progress ? (
                <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[11px] text-[#6B6252]">
                        <span>{progress.label}</span>
                        <span className="font-black text-[#191611]">{progressPercent}%</span>
                    </div>
                    <div
                        className="h-1.5 overflow-hidden rounded-full bg-[#E8DFC9]"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progressPercent}
                        aria-label={progress.label}
                    >
                        <div className={`h-full rounded-full ${progressBarTone}`} style={{ width: `${progressPercent}%` }} />
                    </div>
                </div>
            ) : null}
        </>
    );

    if (onClick) {
        return (
            <button type="button" onClick={onClick} aria-label={`${label}: ${value}`} className={cardClasses}>
                {content}
            </button>
        );
    }

    return (
        <article aria-label={`${label}: ${value}`} className={cardClasses}>
            {content}
        </article>
    );
};

export default MetricCard;
