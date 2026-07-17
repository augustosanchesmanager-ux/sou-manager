import React from 'react';
import { formatCurrency } from '../cashCloseUtils';
import type { PaymentMethodRow, CashClosingEntryExtended } from '../cashCloseUtils';

interface PaymentMethodBreakdownProps {
    paymentMethodBreakdown: [string, { entradas: number; saidas: number; count: number }][];
    filteredEntries: CashClosingEntryExtended[];
    loading: boolean;
}

const PAYMENT_ICONS: Record<string, string> = {
    'Dinheiro': '💵',
    'PIX': '📱',
    'Debito': '💳',
    'Credito': '💳',
    'Voucher': '🎟️',
    'Clube': '👑',
    'Fiado': '📋',
    'Cashback': '🎁',
};

const PaymentMethodBreakdown: React.FC<PaymentMethodBreakdownProps> = ({
    paymentMethodBreakdown,
    filteredEntries,
    loading,
}) => {
    if (loading || paymentMethodBreakdown.length === 0) return null;

    const totalEntradas = paymentMethodBreakdown.reduce((s, [, d]) => s + d.entradas, 0);

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-3">
                Por Forma de Pagamento
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-white/5">
                            <th className="text-left py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Forma</th>
                            <th className="text-center py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Qtd</th>
                            <th className="text-right py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Valor</th>
                            <th className="text-right py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">%</th>
                            <th className="text-right py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Saidas</th>
                            <th className="text-right py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Liquido</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paymentMethodBreakdown.map(([method, data]) => {
                            const net = data.entradas - data.saidas;
                            const pct = totalEntradas > 0 ? (data.entradas / totalEntradas) * 100 : 0;
                            const icon = PAYMENT_ICONS[method] || '💰';

                            return (
                                <tr key={method} className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                    <td className="py-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm">{icon}</span>
                                            <span className="font-semibold text-slate-700 dark:text-slate-200">{method}</span>
                                        </div>
                                    </td>
                                    <td className="text-center py-2.5 text-slate-500 font-medium">{data.count}</td>
                                    <td className="text-right py-2.5 text-emerald-600 dark:text-emerald-400 font-bold">
                                        {formatCurrency(data.entradas)}
                                    </td>
                                    <td className="text-right py-2.5">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <div className="w-12 h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-primary/60"
                                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 w-8 text-right">
                                                {pct.toFixed(0)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="text-right py-2.5 text-rose-600 dark:text-rose-400 font-bold">
                                        {data.saidas > 0 ? formatCurrency(data.saidas) : '—'}
                                    </td>
                                    <td className={`text-right py-2.5 font-extrabold ${net >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
                                        {formatCurrency(net)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PaymentMethodBreakdown;
