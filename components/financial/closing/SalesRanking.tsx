import React from 'react';
import { Trophy, Medal, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../cashCloseUtils';
import type { BarberSummary } from '../cashCloseUtils';

interface SalesRankingProps {
    barberSummaries: BarberSummary[];
    loading: boolean;
}

const getRankStyle = (position: number) => {
    switch (position) {
        case 0:
            return {
                bg: 'bg-amber-50 dark:bg-amber-500/10',
                border: 'border-amber-200 dark:border-amber-500/20',
                icon: <Trophy size={14} className="text-amber-500" />,
                badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
                label: '1st',
            };
        case 1:
            return {
                bg: 'bg-slate-50 dark:bg-white/5',
                border: 'border-slate-200 dark:border-border-dark',
                icon: <Medal size={14} className="text-slate-400" />,
                badge: 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300',
                label: '2nd',
            };
        case 2:
            return {
                bg: 'bg-orange-50 dark:bg-orange-500/10',
                border: 'border-orange-200 dark:border-orange-500/20',
                icon: <Medal size={14} className="text-orange-400" />,
                badge: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-300',
                label: '3rd',
            };
        default:
            return {
                bg: 'bg-slate-50 dark:bg-white/5',
                border: 'border-slate-200 dark:border-border-dark',
                icon: null,
                badge: 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400',
                label: `${position + 1}th`,
            };
    }
};

const SalesRanking: React.FC<SalesRankingProps> = ({ barberSummaries, loading }) => {
    if (loading) {
        return (
            <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 h-32 animate-pulse" />
        );
    }

    if (barberSummaries.length === 0) return null;

    const maxReceived = Math.max(...barberSummaries.map(b => b.totalReceived));

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Ranking de Vendas
                </h3>
            </div>

            <div className="space-y-1.5">
                {barberSummaries.map((barber, index) => {
                    const rank = getRankStyle(index);
                    const barWidth = maxReceived > 0 ? (barber.totalReceived / maxReceived) * 100 : 0;

                    return (
                        <div
                            key={barber.staffId}
                            className={`flex items-center gap-3 p-2.5 rounded-lg ${rank.bg} border ${rank.border}`}
                        >
                            <div className="flex items-center gap-2 shrink-0 w-10">
                                {rank.icon}
                                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${rank.badge}`}>
                                    {rank.label}
                                </span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                        {barber.staffName}
                                    </span>
                                    <span className="text-xs font-extrabold text-slate-900 dark:text-white ml-2">
                                        {formatCurrency(barber.totalReceived)}
                                    </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-primary transition-all"
                                        style={{ width: `${barWidth}%` }}
                                    />
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[9px] font-bold text-slate-400">
                                        {barber.comandaCount} comandas
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400">
                                        Ticket médio: {barber.comandaCount > 0 ? formatCurrency(barber.totalReceived / barber.comandaCount) : formatCurrency(0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SalesRanking;
