import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { cancelReasonLabels, type CancelReason } from '../../domain/chefClub';

export interface CancelSubscriptionModalConfirmPayload {
    cancelReceivables: boolean;
    cancelReason?: CancelReason;
    cancelObservation?: string | null;
}

interface CancelSubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (payload: CancelSubscriptionModalConfirmPayload) => Promise<void> | void;
    saving?: boolean;
    clientName?: string;
    planName?: string;
}

export const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    saving = false,
    clientName,
    planName,
}) => {
    const [cancelReason, setCancelReason] = useState<CancelReason | ''>('');
    const [cancelObservation, setCancelObservation] = useState('');
    const [cancelReceivables, setCancelReceivables] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setCancelReason('');
            setCancelObservation('');
            setCancelReceivables(false);
        }
    }, [isOpen]);

    const handleConfirm = async () => {
        if (saving) return;
        if (cancelReceivables && !cancelReason) return;

        await onConfirm({
            cancelReceivables,
            cancelReason: cancelReason || undefined,
            cancelObservation: cancelObservation.trim() || null,
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => (saving ? undefined : onClose())}
            title="Cancelar Assinatura"
            maxWidth="md"
        >
            <div className="space-y-4">
                {(clientName || planName) && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                        {clientName && (
                            <p className="text-sm font-black text-slate-900 dark:text-white">{clientName}</p>
                        )}
                        {planName && (
                            <p className="mt-0.5 text-xs font-bold text-slate-500 dark:text-slate-400">{planName}</p>
                        )}
                    </div>
                )}

                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Tem certeza que deseja cancelar esta assinatura? Esta ação não pode ser desfeita.
                </p>

                <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Decisão sobre cobranças em aberto
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => setCancelReceivables(false)}
                            className={`rounded-xl border p-3 text-left transition-colors ${
                                !cancelReceivables
                                    ? 'border-primary bg-primary/10 dark:border-primary'
                                    : 'border-slate-200 bg-white hover:border-primary/40 dark:border-white/10 dark:bg-white/5'
                            }`}
                        >
                            <p className="text-xs font-black text-slate-900 dark:text-white">
                                Cancelar apenas assinatura
                            </p>
                            <p className="mt-1 text-[11px] font-medium leading-4 text-slate-500 dark:text-slate-400">
                                Mantém eventuais faturas pendentes/atrasadas para cobrança ou baixa avulsa.
                            </p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCancelReceivables(true)}
                            className={`rounded-xl border p-3 text-left transition-colors ${
                                cancelReceivables
                                    ? 'border-red-500 bg-red-50 dark:border-red-500/50 dark:bg-red-500/10'
                                    : 'border-slate-200 bg-white hover:border-red-300 dark:border-white/10 dark:bg-white/5'
                            }`}
                        >
                            <p className="text-xs font-black text-red-700 dark:text-red-300">
                                Cancelar e anular cobranças
                            </p>
                            <p className="mt-1 text-[11px] font-medium leading-4 text-slate-500 dark:text-slate-400">
                                Encerra a assinatura e cancela todas as faturas em aberto do cliente.
                            </p>
                        </button>
                    </div>
                </div>

                <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-500/20 dark:bg-red-500/10">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="cancelReceivables"
                            checked={cancelReceivables}
                            onChange={(e) => setCancelReceivables(e.target.checked)}
                            className="rounded border-slate-300 text-red-500 focus:ring-red-500"
                        />
                        <label htmlFor="cancelReceivables" className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            Cancelar cobranças pendentes/atrasadas
                        </label>
                    </div>
                    <p className="-mt-1 ml-6 text-[10px] text-slate-500">
                        Recebíveis já pagos não serão afetados
                    </p>

                    <div>
                        <label htmlFor="cancelReason" className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                            Motivo do Cancelamento {cancelReceivables ? '*' : '(opcional)'}
                        </label>
                        <select
                            id="cancelReason"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value as CancelReason | '')}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
                        >
                            <option value="">Selecione o motivo</option>
                            {Object.entries(cancelReasonLabels).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="cancelObservation" className="mb-1 block text-[10px] font-black uppercase text-slate-500">
                            Observação (opcional)
                        </label>
                        <textarea
                            id="cancelObservation"
                            value={cancelObservation}
                            onChange={(e) => setCancelObservation(e.target.value)}
                            rows={2}
                            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
                            placeholder="Detalhes adicionais..."
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        disabled={saving}
                        onClick={onClose}
                        className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 disabled:opacity-50 dark:bg-white/5 dark:text-slate-300"
                    >
                        Voltar
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleConfirm()}
                        disabled={saving || (cancelReceivables && !cancelReason)}
                        className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                        {saving ? 'Aguarde...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default CancelSubscriptionModal;
