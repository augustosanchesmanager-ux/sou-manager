import React from 'react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { formatCurrency } from '../../shared/format/currency';
import type { AREntry, CancelReasonType } from './types';
import { CANCEL_REASON_OPTIONS, getShortId } from './types';

export interface CancelComandaModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: AREntry | null;
    cancelReasonType: CancelReasonType | '';
    onCancelReasonTypeChange: (reason: CancelReasonType | '') => void;
    cancelReasonNote: string;
    onCancelReasonNoteChange: (note: string) => void;
    cancelRequiresNote: boolean;
    canConfirmCancel: boolean;
    isSubmitting: boolean;
    onConfirm: () => void;
}

const CancelComandaModal: React.FC<CancelComandaModalProps> = ({
    isOpen,
    onClose,
    entry,
    cancelReasonType,
    onCancelReasonTypeChange,
    cancelReasonNote,
    onCancelReasonNoteChange,
    cancelRequiresNote,
    canConfirmCancel,
    isSubmitting,
    onConfirm,
}) => {
    if (!entry) return null;

    const footer = (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end w-full">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Voltar
            </Button>
            <Button
                type="button"
                variant="danger"
                onClick={onConfirm}
                disabled={!canConfirmCancel || isSubmitting}
                isLoading={isSubmitting}
            >
                {isSubmitting ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Cancelar comanda aberta"
            maxWidth="sm"
            footer={footer}
        >
            <div className="space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                    <p className="font-bold">Cancelamento operacional auditado</p>
                    <p className="mt-1 text-xs">
                        A comanda será marcada como cancelada com motivo, usuário e data. Nenhuma baixa financeira ou transaction será criada.
                    </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/5">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Comanda</p>
                    <p className="mt-1 font-black text-slate-900 dark:text-white">
                        #{getShortId(entry.id)} · {entry.clientName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        {formatCurrency(entry.amount)} em aberto desde {new Date(entry.dateValue).toLocaleDateString('pt-BR')}
                    </p>
                </div>

                <label className="block space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Motivo obrigatório</span>
                    <select
                        value={cancelReasonType}
                        onChange={(event) => onCancelReasonTypeChange(event.target.value as CancelReasonType | '')}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-200"
                    >
                        <option value="">Selecione...</option>
                        {CANCEL_REASON_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </label>

                <label className="block space-y-1.5">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Observação {cancelRequiresNote ? 'obrigatória' : 'opcional'}
                    </span>
                    <textarea
                        value={cancelReasonNote}
                        onChange={(event) => onCancelReasonNoteChange(event.target.value)}
                        disabled={isSubmitting}
                        rows={3}
                        placeholder={cancelRequiresNote ? 'Descreva o motivo do cancelamento.' : 'Detalhe o contexto operacional, se necessário.'}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 outline-none dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-200"
                    />
                </label>

                {cancelReasonType && ['duplicate', 'test', 'operational_error'].includes(cancelReasonType) && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        Este motivo segue o padrão existente da tela de comandas e marca a comanda como oculta do financeiro operacional.
                    </p>
                )}
            </div>
        </Modal>
    );
};

export default CancelComandaModal;
