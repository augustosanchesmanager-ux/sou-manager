import React from 'react';
import { CalendarRange, RefreshCw, Lock, Save, Eye } from 'lucide-react';

interface ClosingHeaderProps {
    filterDate: string;
    onDateChange: (date: string) => void;
    status: string;
    statusClasses: string;
    lastSavedLabel: string;
    formattedDate: string;
    loading: boolean;
    saving: boolean;
    onRefresh: () => void;
    onSave: () => void;
    onPreview: () => void;
    hasTenantContext: boolean;
}

const ClosingHeader: React.FC<ClosingHeaderProps> = ({
    filterDate,
    onDateChange,
    status,
    statusClasses,
    lastSavedLabel,
    formattedDate,
    loading,
    saving,
    onRefresh,
    onSave,
    onPreview,
    hasTenantContext,
}) => {
    return (
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Fechamento de Caixa
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Conferencia, ajustes e fechamento do caixa diario.
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${statusClasses}`}>
                        {status}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {formattedDate}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                        Salvo: {lastSavedLabel}
                    </span>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto shrink-0">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2">
                    <CalendarRange className="h-4 w-4 text-slate-400" />
                    <input
                        type="date"
                        value={filterDate}
                        onChange={e => onDateChange(e.target.value)}
                        className="bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                </label>
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Atualizando...' : 'Atualizar'}
                </button>
                <button
                    onClick={onPreview}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                    <Eye className="h-4 w-4" />
                    Pre-visualizar
                </button>
                <button
                    onClick={onSave}
                    disabled={loading || saving || !hasTenantContext}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-gold-hover disabled:opacity-50 transition-colors"
                >
                    <Save className="h-4 w-4" />
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </div>
    );
};

export default ClosingHeader;
