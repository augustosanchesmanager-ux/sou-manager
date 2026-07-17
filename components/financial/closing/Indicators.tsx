import React from 'react';
import {
    Users, UserPlus, ShoppingBag, Scissors, Clock, Award,
    Target, TrendingUp
} from 'lucide-react';
import { formatCurrency } from '../cashCloseUtils';
import type { IndicatorsData } from '../cashCloseUtils';

interface IndicatorsProps {
    indicators: IndicatorsData;
    loading: boolean;
}

const IndicatorCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    sublabel?: string;
    tone?: 'default' | 'accent' | 'success';
}> = ({ icon, label, value, sublabel, tone = 'default' }) => {
    const toneStyles = {
        default: 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400',
        accent: 'bg-primary/10 text-primary',
        success: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    };

    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-white/5 last:border-0">
            <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${toneStyles[tone]}`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {label}
                </p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {value}
                </p>
                {sublabel && (
                    <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500">
                        {sublabel}
                    </p>
                )}
            </div>
        </div>
    );
};

const Indicators: React.FC<IndicatorsProps> = ({ indicators, loading }) => {
    if (loading) return null;

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-3">
                Indicadores
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <div>
                    <IndicatorCard
                        icon={<TrendingUp size={14} />}
                        label="Ticket Medio"
                        value={formatCurrency(indicators.ticketMedio)}
                    />
                    <IndicatorCard
                        icon={<Users size={14} />}
                        label="Clientes Atendidos"
                        value={String(indicators.clientesAtendidos)}
                    />
                    <IndicatorCard
                        icon={<UserPlus size={14} />}
                        label="Novos Clientes"
                        value={String(indicators.novosClientes)}
                        tone={indicators.novosClientes > 0 ? 'success' : 'default'}
                    />
                    <IndicatorCard
                        icon={<ShoppingBag size={14} />}
                        label="Produtos Vendidos"
                        value={String(indicators.produtosVendidos)}
                    />
                </div>
                <div>
                    <IndicatorCard
                        icon={<Scissors size={14} />}
                        label="Servicos Vendidos"
                        value={String(indicators.servicosVendidos)}
                        tone="accent"
                    />
                    <IndicatorCard
                        icon={<Clock size={14} />}
                        label="Tempo Medio Atendimento"
                        value={indicators.tempoMedioAtendimento > 0 ? `${indicators.tempoMedioAtendimento} min` : '—'}
                    />
                    <IndicatorCard
                        icon={<Award size={14} />}
                        label="Comissao Total"
                        value={formatCurrency(indicators.comissaoTotal)}
                    />
                    <IndicatorCard
                        icon={<Target size={14} />}
                        label="Meta do Dia"
                        value={indicators.metaDoDia > 0 ? formatCurrency(indicators.metaDoDia) : 'Sem meta'}
                        sublabel={indicators.percentualMeta > 0 ? `${indicators.percentualMeta.toFixed(0)}% atingido` : undefined}
                    />
                </div>
            </div>
        </div>
    );
};

export default Indicators;
