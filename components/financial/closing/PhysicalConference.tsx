import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, Edit3 } from 'lucide-react';
import { formatCurrency } from '../cashCloseUtils';
import type { CashCloseValidation } from '../cashCloseUtils';

interface PhysicalConferenceProps {
    validation: CashCloseValidation;
    totalExpected: number;
    onCountedCashChange: (value: number) => void;
    loading: boolean;
}

const PhysicalConference: React.FC<PhysicalConferenceProps> = ({
    validation,
    totalExpected,
    onCountedCashChange,
    loading,
}) => {
    const [countedCash, setCountedCash] = useState('');
    const [justification, setJustification] = useState('');
    const [showJustification, setShowJustification] = useState(false);

    if (loading) return null;

    const countedValue = parseFloat(countedCash) || 0;
    const cashDifference = countedValue - totalExpected;
    const hasDifference = countedValue > 0 && Math.abs(cashDifference) > 0.01;

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Conferencia Fisica
                </h3>
                {!hasDifference && countedValue > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                        <CheckCircle size={10} /> Conferido
                    </span>
                ) : hasDifference ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-rose-700 dark:text-rose-300">
                        <AlertTriangle size={10} /> Divergencia
                    </span>
                ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Total Esperado
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                        {formatCurrency(totalExpected)}
                    </p>
                </div>

                <div className="rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-1.5">
                        Valor Contado
                    </p>
                    <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            value={countedCash}
                            onChange={e => {
                                setCountedCash(e.target.value);
                                onCountedCashChange(parseFloat(e.target.value) || 0);
                            }}
                            className="w-full rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark pl-8 pr-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        />
                    </div>
                </div>

                <div className={`rounded-lg border p-3 ${hasDifference ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-[0.14em] ${hasDifference ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        Diferenca
                    </p>
                    <p className={`mt-1 text-lg font-extrabold ${hasDifference ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {formatCurrency(hasDifference ? cashDifference : 0)}
                    </p>
                </div>
            </div>

            {countedValue > 0 && hasDifference && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                            Diferenca de {formatCurrency(cashDifference)} detectada
                        </span>
                    </div>
                    {!showJustification ? (
                        <button
                            onClick={() => setShowJustification(true)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline"
                        >
                            <Edit3 size={12} /> Adicionar justificativa
                        </button>
                    ) : (
                        <textarea
                            rows={2}
                            maxLength={200}
                            placeholder="Justifique a diferenca encontrada..."
                            value={justification}
                            onChange={e => setJustification(e.target.value)}
                            className="w-full rounded-lg border border-amber-200 dark:border-amber-500/20 bg-white dark:bg-surface-dark px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-400/30 resize-none"
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default PhysicalConference;
