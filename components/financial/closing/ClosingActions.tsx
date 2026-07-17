import React from 'react';
import { Save, Lock, FileText, Download, Printer, Eye } from 'lucide-react';

interface ClosingActionsProps {
    loading: boolean;
    saving: boolean;
    closing: boolean;
    hasTenantContext: boolean;
    validationValid: boolean;
    hasObservations: boolean;
    onSave: () => void;
    onClose: () => void;
    onPreview: () => void;
    onExportPDF: () => void;
    onExportCSV: () => void;
    onPrint: () => void;
}

const ClosingActions: React.FC<ClosingActionsProps> = ({
    loading,
    saving,
    closing,
    hasTenantContext,
    validationValid,
    hasObservations,
    onSave,
    onClose,
    onPreview,
    onExportPDF,
    onExportCSV,
    onPrint,
}) => {
    const canClose = !loading && !closing && hasTenantContext && (validationValid || hasObservations);

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark p-4 shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-3">
                Acoes do Fechamento
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <button
                    onClick={onPreview}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                    <Eye size={14} /> Pre-visualizar
                </button>

                <button
                    onClick={onSave}
                    disabled={loading || saving || !hasTenantContext}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40 transition-colors"
                >
                    <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
                </button>

                <button
                    onClick={onClose}
                    disabled={!canClose}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                >
                    <Lock size={14} /> {closing ? 'Fechando...' : 'Fechar Caixa'}
                </button>

                <button
                    onClick={onExportPDF}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                    <FileText size={14} /> PDF
                </button>

                <button
                    onClick={onExportCSV}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                    <Download size={14} /> CSV
                </button>

                <button
                    onClick={onPrint}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                    <Printer size={14} /> Imprimir
                </button>
            </div>
        </div>
    );
};

export default ClosingActions;
