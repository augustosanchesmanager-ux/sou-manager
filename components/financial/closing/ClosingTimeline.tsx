import React from 'react';
import { Clock, Scissors, ArrowDownCircle, ArrowUpCircle, RotateCcw, AlertCircle } from 'lucide-react';
import type { TimelineEvent } from '../cashCloseUtils';

interface ClosingTimelineProps {
    events: TimelineEvent[];
    loading: boolean;
}

const EVENT_STYLES: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    service: {
        icon: <Scissors size={12} />,
        color: 'text-primary',
        bg: 'bg-primary/10',
    },
    sangria: {
        icon: <ArrowDownCircle size={12} />,
        color: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-500/10',
    },
    suprimento: {
        icon: <ArrowUpCircle size={12} />,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    reversal: {
        icon: <RotateCcw size={12} />,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-500/10',
    },
    opening: {
        icon: <Clock size={12} />,
        color: 'text-sky-600 dark:text-sky-400',
        bg: 'bg-sky-50 dark:bg-sky-500/10',
    },
    closing: {
        icon: <Clock size={12} />,
        color: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-50 dark:bg-white/5',
    },
    audit: {
        icon: <AlertCircle size={12} />,
        color: 'text-violet-600 dark:text-violet-400',
        bg: 'bg-violet-50 dark:bg-violet-500/10',
    },
};

const ClosingTimeline: React.FC<ClosingTimelineProps> = ({ events, loading }) => {
    if (loading) return null;

    if (events.length === 0) {
        return (
            <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
                <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-3">
                    Timeline
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-3">
                    Nenhum evento registrado no dia.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-3">
                Timeline
            </h3>
            <div className="relative">
                <div className="absolute left-[15px] top-0 bottom-0 w-px bg-slate-200 dark:bg-white/10" />
                <div className="space-y-3">
                    {events.map((event, i) => {
                        const style = EVENT_STYLES[event.type] || EVENT_STYLES.service;
                        const timeLabel = event.time
                            ? new Date(event.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : '';

                        return (
                            <div key={i} className="flex items-start gap-3 relative">
                                <div className={`size-[30px] rounded-full ${style.bg} ${style.color} flex items-center justify-center shrink-0 z-10`}>
                                    {style.icon}
                                </div>
                                <div className="min-w-0 flex-1 pt-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                                            {event.label}
                                        </span>
                                        {timeLabel && (
                                            <span className="text-[9px] font-mono font-medium text-slate-400 dark:text-slate-500">
                                                {timeLabel}
                                            </span>
                                        )}
                                    </div>
                                    {event.detail && (
                                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                            {event.detail}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ClosingTimeline;
