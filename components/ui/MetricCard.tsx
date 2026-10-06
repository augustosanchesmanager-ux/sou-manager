import React from 'react';

export type MetricTone = 'brass' | 'positive' | 'negative' | 'info' | 'neutral';
export type MetricDensity = 'compact' | 'comfortable';
export type MetricTrendDirection = 'up' | 'down' | 'flat';

export interface MetricTrend {
    direction: MetricTrendDirection;
    label: string;
}

export interface MetricCardProps {
    label: string;
    value: string;
    helper?: string;
    icon?: string;
    tone?: MetricTone;
    trend?: MetricTrend;
    density?: MetricDensity;
    className?: string;
}

const toneTileStyles: Record<MetricTone, string> = {
    brass: 'bg-primary/10 text-primary-dark border-primary/25 dark:text-primary-light',
    positive: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-300',
    negative: 'bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-300',
    info: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-300',
    neutral: 'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-300',
};

const trendConfig: Record<MetricTrendDirection, { icon: string; text: string }> = {
    up: { icon: 'trending_up', text: 'text-emerald-600 dark:text-emerald-300' },
    down: { icon: 'trending_down', text: 'text-red-600 dark:text-red-300' },
    flat: { icon: 'minimize', text: 'text-slate-500 dark:text-slate-400' },
};

const MetricCard: React.FC<MetricCardProps> = ({
    label,
    value,
    helper,
    icon,
    tone = 'neutral',
    trend,
    density = 'comfortable',
    className = '',
}) => {
    const trendStyle = trend ? trendConfig[trend.direction] : null;
    const valueSize = density === 'compact' ? 'text-2xl' : 'text-3xl';
    const padding = density === 'compact' ? 'p-4' : 'p-5';

    return (
        <article
            aria-label={`${label}: ${value}`}
            className={`rounded-2xl border border-slate-200 bg-surface-light shadow-elite dark:border-border-dark dark:bg-card-dark ${padding} ${className}`}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
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
            <p className={`mt-2 font-black tracking-tight text-slate-950 dark:text-white ${valueSize}`}>
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
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{helper}</span>
                    ) : null}
                </div>
            ) : null}
        </article>
    );
};

export default MetricCard;
