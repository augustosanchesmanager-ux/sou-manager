import React from 'react';
import {
    ClipboardList, AlertCircle, Ban, RotateCcw, Clock, FileEdit,
    TrendingUp, TrendingDown, ArrowRightLeft, Activity
} from 'lucide-react';
import { formatCurrency } from '../cashCloseUtils';
import type { DailyAuditData } from '../cashCloseUtils';

interface DailyAuditProps {
    audit: DailyAuditData;
    loading: boolean;
}

const AuditItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: number | string;
    sublabel?: string;
    tone?: 'default' | 'warning' | 'danger' | 'success';
}> = ({ icon, label, value, sublabel, tone = 'default' }) => {
    const toneStyles = {
        default: 'text-slate-700 dark:text-slate-200',
        warning: 'text-amber-600 dark:text-amber-400',
        danger: 'text-rose-600 dark:text-rose-400',
        success: 'text-emerald-600 dark:text-emerald-400',
    };

    return (
        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
            <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500">
                    {icon}
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
            </div>
            <div className="text-right">
                <span className={`text-sm font-extrabold ${toneStyles[tone]}`}>{value}</span>
                {sublabel && (
                    <span className="block text-[9px] font-medium text-slate-400 dark:text-slate-500">{sublabel}</span>
                )}
            </div>
        </div>
    );
};

const DailyAudit: React.FC<DailyAuditProps> = ({ audit, loading }) => {
    if (loading) return null;

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-3">
                Auditoria do Dia
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <div>
                    <AuditItem
                        icon={<ClipboardList size={14} />}
                        label="Total de Comandas"
                        value={audit.totalComandas}
                    />
                    <AuditItem
                        icon={<Clock size={14} />}
                        label="Comandas Abertas"
                        value={audit.openComandas}
                        tone={audit.openComandas > 0 ? 'warning' : 'default'}
                    />
                    <AuditItem
                        icon={<Ban size={14} />}
                        label="Comandas Canceladas"
                        value={audit.cancelledComandas}
                        tone={audit.cancelledComandas > 0 ? 'danger' : 'default'}
                    />
                    <AuditItem
                        icon={<RotateCcw size={14} />}
                        label="Comandas Estornadas"
                        value={audit.reversedComandas}
                        tone={audit.reversedComandas > 0 ? 'danger' : 'default'}
                    />
                    <AuditItem
                        icon={<AlertCircle size={14} />}
                        label="Pagamentos Pendentes"
                        value={audit.pendingPayments}
                        sublabel={audit.pendingPaymentsTotal > 0 ? formatCurrency(audit.pendingPaymentsTotal) : undefined}
                        tone={audit.pendingPayments > 0 ? 'warning' : 'default'}
                    />
                </div>
                <div>
                    <AuditItem
                        icon={<FileEdit size={14} />}
                        label="Recebimentos Manuais"
                        value={audit.manualReceivables}
                    />
                    <AuditItem
                        icon={<FileEdit size={14} />}
                        label="Lançamentos Manuais"
                        value={audit.manualExpenses}
                    />
                    <AuditItem
                        icon={<TrendingUp size={14} />}
                        label="Receitas"
                        value={audit.totalIncome}
                        tone="success"
                    />
                    <AuditItem
                        icon={<TrendingDown size={14} />}
                        label="Despesas"
                        value={audit.totalExpenses}
                    />
                    <AuditItem
                        icon={<ArrowRightLeft size={14} />}
                        label="Movimentacoes"
                        value={audit.totalTransactions}
                    />
                </div>
            </div>
        </div>
    );
};

export default DailyAudit;
