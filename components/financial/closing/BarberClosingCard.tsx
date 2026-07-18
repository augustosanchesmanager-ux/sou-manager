import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle, User } from 'lucide-react';
import { formatCurrency } from '../cashCloseUtils';
import type { BarberClosingDetail } from '../cashCloseUtils';
import BarberClosingDetailPanel from './BarberClosingDetailPanel';

interface BarberClosingCardProps {
    barber: BarberClosingDetail;
    loading: boolean;
    onCloseBarberCash?: (barberStaffId: string, conference: { countedCash: number; justification: string }) => void;
    onSaveBarberCash?: (barberStaffId: string) => void;
    onExportBarberPDF?: (barber: BarberClosingDetail) => void;
}

const BarberClosingCard: React.FC<BarberClosingCardProps> = ({
    barber,
    loading,
    onCloseBarberCash,
    onSaveBarberCash,
    onExportBarberPDF,
}) => {
    const [expanded, setExpanded] = useState(false);

    if (loading) return null;

    const allChecklistPassed = Object.values(barber.checklist).every(v => v);
    const hasDifference = Math.abs(barber.conference.difference) > 0.01;

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors text-left"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <User size={16} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                {barber.staffName}
                            </span>
                            {barber.role && (
                                <span className="text-[9px] font-bold uppercase text-slate-400 bg-slate-100 dark:bg-white/5 rounded-full px-1.5 py-0.5 shrink-0">
                                    {barber.role}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] font-bold text-slate-500">
                                Producao: <span className="text-slate-900 dark:text-white">{formatCurrency(barber.totalProduced)}</span>
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                                Comissao: <span className="text-primary">{formatCurrency(barber.commission)}</span>
                            </span>
                            {!allChecklistPassed && (
                                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                                    Pendencias
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                        barber.status === 'open'
                            ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20'
                            : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20'
                    }`}>
                        {barber.status === 'open' ? 'ABERTO' : 'FECHADO'}
                    </span>
                    {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-slate-200 dark:border-border-dark">
                    <BarberClosingDetailPanel
                        barber={barber}
                        onCloseBarberCash={onCloseBarberCash}
                        onSaveBarberCash={onSaveBarberCash}
                        onExportBarberPDF={onExportBarberPDF}
                    />
                </div>
            )}
        </div>
    );
};

export default BarberClosingCard;
