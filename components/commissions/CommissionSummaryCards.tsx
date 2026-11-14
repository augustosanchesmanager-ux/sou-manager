import React from 'react';
import type { ViewMode } from './types';

interface CommissionSummaryCardsProps {
    viewMode: ViewMode;
    confirmedCommission: number;
    pendingCommission: number;
    cancelledCommission: number;
    totalSales: number;
}

const formatCurrency = (val: number) =>
    Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const CommissionSummaryCards: React.FC<CommissionSummaryCardsProps> = ({
    viewMode,
    confirmedCommission,
    pendingCommission,
    cancelledCommission,
    totalSales,
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {viewMode === 'settlement' ? 'Saldo Liberado para Repasse' : 'Comissão Confirmada / Liberada'}
                </p>
                <h3 className="text-2xl font-black text-emerald-500">
                    {formatCurrency(confirmedCommission)}
                </h3>
            </div>
            <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {viewMode === 'settlement' ? 'Fiados Retidos Fora do Ciclo' : 'Aguardando Pagamento (Fiados)'}
                </p>
                <h3 className="text-2xl font-black text-amber-500">
                    {formatCurrency(pendingCommission)}
                </h3>
            </div>
            <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Comissão cancelada</p>
                <h3 className="text-2xl font-black text-rose-500">
                    {formatCurrency(cancelledCommission)}
                </h3>
            </div>
            <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {viewMode === 'settlement' ? 'Faturamento Liquidado' : 'Produção Bruta Total'}
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    {formatCurrency(totalSales)}
                </h3>
            </div>
        </div>
    );
};

export default CommissionSummaryCards;
