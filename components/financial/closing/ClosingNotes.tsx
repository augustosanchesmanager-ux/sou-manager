import React from 'react';

interface ClosingNotesProps {
    observations: string;
    onChange: (value: string) => void;
    loading: boolean;
}

const ClosingNotes: React.FC<ClosingNotesProps> = ({ observations, onChange, loading }) => {
    if (loading) return null;

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <label
                htmlFor="cash-close-obs"
                className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-2 block"
            >
                Observacoes
            </label>
            <textarea
                id="cash-close-obs"
                rows={2}
                maxLength={200}
                placeholder="Divergencias, notas ou justificativas..."
                value={observations}
                onChange={e => onChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 text-right">
                {observations.length}/200
            </p>
        </div>
    );
};

export default ClosingNotes;
