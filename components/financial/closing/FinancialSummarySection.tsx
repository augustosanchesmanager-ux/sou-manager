import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, RotateCcw, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../cashCloseUtils';

interface FinancialSummarySectionProps {
    loading: boolean;
    totalEntradas: number;
    totalSaidas: number;
    totalReversals: number;
    reversalCount: number;
    saldoAtual: number;
    entradasCount: number;
    saidasCount: number;
}

const Card: React.FC<{
    title: string;
    value: number;
    count: number;
    countLabel: string;
    icon: React.ReactNode;
    tone: 'positive' | 'negative' | 'neutral';
    trend: 'up' | 'down';
    helperText: string;
}> = ({ title, value, count, countLabel, icon, tone, trend, helperText }) => {
    const toneStyles = {
        positive: {
            value: 'text-emerald-600 dark:text-emerald-400',
            icon: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            badge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
        },
        negative: {
            value: 'text-rose-600 dark:text-rose-400',
            icon: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
            badge: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
        },
        neutral: {
            value: 'text-slate-900 dark:text-white',
            icon: 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400',
            badge: 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-border-dark',
        },
    };

    const s = toneStyles[tone];

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between mb-3">
                <div className={`size-8 rounded-lg flex items-center justify-center ${s.icon}`}>
                    {icon}
                </div>
                <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${s.badge}`}>
                    {trend === 'up' ? '↑' : '↓'} {count} {countLabel}
                </span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {title}
            </p>
            <p className={`mt-1 text-xl font-extrabold ${s.value}`}>
                {formatCurrency(value)}
            </p>
            <p className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                {helperText}
            </p>
        </div>
    );
};

const FinancialSummarySection: React.FC<FinancialSummarySectionProps> = ({
    loading,
    totalEntradas,
    totalSaidas,
    totalReversals,
    reversalCount,
    saldoAtual,
    entradasCount,
    saidasCount,
}) => {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 h-28 animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Card
                title="Entradas"
                value={totalEntradas}
                count={entradasCount}
                countLabel="registros"
                icon={<ArrowUpCircle size={16} />}
                tone="positive"
                trend="up"
                helperText="Receitas do dia"
            />
            <Card
                title="Saidas"
                value={totalSaidas}
                count={saidasCount}
                countLabel="registros"
                icon={<ArrowDownCircle size={16} />}
                tone="negative"
                trend="down"
                helperText="Despesas do dia"
            />
            <Card
                title="Estornos"
                value={totalReversals}
                count={reversalCount}
                countLabel="reversoes"
                icon={<RotateCcw size={16} />}
                tone={totalReversals > 0 ? 'negative' : 'neutral'}
                trend="down"
                helperText="Reversoes auditadas"
            />
            <Card
                title="Saldo Operacional"
                value={saldoAtual}
                count={0}
                countLabel=""
                icon={<CheckCircle size={16} />}
                tone={saldoAtual >= 0 ? 'positive' : 'negative'}
                trend={saldoAtual >= 0 ? 'up' : 'down'}
                helperText="Entradas menos saidas"
            />
        </div>
    );
};

export default FinancialSummarySection;
