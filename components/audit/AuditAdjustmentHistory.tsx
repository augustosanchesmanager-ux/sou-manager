import React from 'react';
import { AUDIT_ADJUSTMENT_RPC_NOTICE } from '../../src/lib/audit-adjustments';

interface AuditAdjustmentHistoryProps {
    sourceLabel: string;
}

const AuditAdjustmentHistory: React.FC<AuditAdjustmentHistoryProps> = ({ sourceLabel }) => {
    return (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-slate-400">history</span>
                <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Histórico de ajustes</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        Nenhum histórico é gravado nesta primeira entrega. O histórico de "{sourceLabel}" dependerá da tabela futura
                        {' '}audit_adjustments com tenant_id, usuário, data, motivo e snapshots antes/depois.
                    </p>
                    <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        {AUDIT_ADJUSTMENT_RPC_NOTICE}
                    </p>
                </div>
            </div>
        </section>
    );
};

export default AuditAdjustmentHistory;
