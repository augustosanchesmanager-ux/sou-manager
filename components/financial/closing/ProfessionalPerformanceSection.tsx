import React from 'react';
import { User, TrendingUp, Scissors, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '../cashCloseUtils';
import type { BarberSummary } from '../cashCloseUtils';

interface ProfessionalPerformanceSectionProps {
    barberSummaries: BarberSummary[];
    loading: boolean;
}

const ProfessionalPerformanceSection: React.FC<ProfessionalPerformanceSectionProps> = ({
    barberSummaries,
    loading,
}) => {
    if (loading) {
        return (
            <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 h-32 animate-pulse" />
        );
    }

    if (barberSummaries.length === 0) return null;

    const totalGeral = barberSummaries.reduce((s, b) => s + b.totalReceived, 0);

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Valor Realizado por Profissional
                </h3>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    Total: {formatCurrency(totalGeral)}
                </span>
            </div>

            <div className="space-y-2">
                {barberSummaries.map((barber, index) => {
                    const percentage = totalGeral > 0 ? (barber.totalReceived / totalGeral) * 100 : 0;
                    const servicesCount = barber.comandas.reduce((s, c) =>
                        s + c.items.filter(i => !i.serviceName.includes('Produto')).length, 0
                    );
                    const productsCount = barber.comandas.reduce((s, c) =>
                        s + c.items.filter(i => i.serviceName.includes('Produto')).length, 0
                    );

                    return (
                        <div
                            key={barber.staffId}
                            className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark"
                        >
                            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <User size={14} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                                        {barber.staffName}
                                    </span>
                                    {barber.role && (
                                        <span className="text-[8px] font-bold uppercase text-slate-400 bg-slate-100 dark:bg-white/5 rounded-full px-1.5 py-0.5 shrink-0">
                                            {barber.role}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
                                        <Scissors size={9} />
                                        {servicesCount} servicos
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
                                        <ShoppingBag size={9} />
                                        {productsCount} produtos
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-500">
                                        {barber.comandaCount} comandas
                                    </span>
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                                    {formatCurrency(barber.totalReceived)}
                                </p>
                                <div className="flex items-center gap-1 justify-end mt-0.5">
                                    <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-primary transition-all"
                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400">
                                        {percentage.toFixed(0)}%
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

export default ProfessionalPerformanceSection;
