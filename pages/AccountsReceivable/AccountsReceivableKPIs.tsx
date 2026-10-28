import React from 'react';
import MetricCard from '../../components/ui/MetricCard';
import { formatCurrency } from '../../shared/format/currency';
import type { AccountsReceivableTotals } from './types';

export interface AccountsReceivableKPIsProps {
    totals: AccountsReceivableTotals;
    selectedPeriodLabel: string;
}

const AccountsReceivableKPIs: React.FC<AccountsReceivableKPIsProps> = ({
    totals,
    selectedPeriodLabel,
}) => {
    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200/80 bg-white/90 px-5 py-3 text-sm text-slate-600 shadow-sm dark:border-border-dark dark:bg-card-dark/80 dark:text-slate-300">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-black text-slate-800 dark:text-white">Totais do período</span>
                    <span>
                        Os cards abaixo mostram {selectedPeriodLabel}; os filtros da listagem refinam apenas a tabela operacional.
                    </span>
                </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard
                    label="Total em Aberto"
                    value={formatCurrency(totals.open)}
                    tone="brass"
                    icon="account_balance_wallet"
                    helper="Soma geral em aberto no período"
                />
                <MetricCard
                    label="Comandas Abertas"
                    value={String(totals.comandas.count)}
                    helper={`${formatCurrency(totals.comandas.total)} em aberto`}
                    icon="receipt"
                    tone="warning"
                />
                <MetricCard
                    label="Planos Atrasados"
                    value={String(totals.clube.count)}
                    helper={`${formatCurrency(totals.clube.total)} em atraso`}
                    icon="groups"
                    tone="negative"
                />
                <MetricCard
                    label="Recibos Pendentes"
                    value={String(totals.recibos.count)}
                    helper={`${formatCurrency(totals.recibos.total)} pendente`}
                    icon="description"
                    tone="info"
                />
            </div>
        </div>
    );
};

export default AccountsReceivableKPIs;
