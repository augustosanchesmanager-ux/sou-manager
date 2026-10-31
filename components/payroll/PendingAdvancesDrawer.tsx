import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../ui/Modal';
import { useBarberAdvances } from '../../src/hooks/usePayoutService';
import type { BarberAdvance } from '../../domain/payout/types';
import { sumCents } from '../../domain/payout/money';

export interface PendingAdvancesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    staff: {
        id: string;
        name: string;
        role?: string;
    } | null;
    onNewAdvanceClick?: (staffId: string) => void;
    onChanged?: () => void;
}

const brl = (value: number): string =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (iso: string): string => {
    try {
        return new Date(iso).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
};

export const PendingAdvancesDrawer: React.FC<PendingAdvancesDrawerProps> = ({
    isOpen,
    onClose,
    staff,
    onNewAdvanceClick,
    onChanged,
}) => {
    const { listPendingAdvances, reverseAdvance } = useBarberAdvances();

    const [advances, setAdvances] = useState<BarberAdvance[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [reversingAdvanceId, setReversingAdvanceId] = useState<string | null>(null);
    const [reverseMotivo, setReverseMotivo] = useState<string>('');
    const [submittingReverse, setSubmittingReverse] = useState(false);

    const loadAdvances = useCallback(async () => {
        if (!isOpen || !staff) {
            setAdvances([]);
            return;
        }

        setLoading(true);
        setErrorMessage(null);
        try {
            const list = await listPendingAdvances(staff.id);
            setAdvances(list);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro ao carregar vales pendentes.';
            setErrorMessage(msg);
        } finally {
            setLoading(false);
        }
    }, [isOpen, staff, listPendingAdvances]);

    useEffect(() => {
        if (isOpen) {
            setReversingAdvanceId(null);
            setReverseMotivo('');
            loadAdvances();
        }
    }, [isOpen, loadAdvances]);

    const totalPending = useMemo(
        () => sumCents(advances.map((a) => a.amount)),
        [advances],
    );

    const handleConfirmReverse = async (advanceId: string) => {
        if (!reverseMotivo.trim()) {
            setErrorMessage('Informe o motivo obrigatório para estornar o vale.');
            return;
        }

        setSubmittingReverse(true);
        setErrorMessage(null);

        try {
            await reverseAdvance(advanceId, reverseMotivo.trim());
            setReversingAdvanceId(null);
            setReverseMotivo('');
            await loadAdvances();
            onChanged?.();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro ao estornar o vale.';
            setErrorMessage(msg);
        } finally {
            setSubmittingReverse(false);
        }
    };

    if (!isOpen || !staff) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Vales Pendentes — ${staff.name}`}
            maxWidth="lg"
        >
            <div className="space-y-5">
                {errorMessage && (
                    <div className="rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base shrink-0">error</span>
                        <span>{errorMessage}</span>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-white/[0.02] p-4 rounded-xl border border-slate-200 dark:border-border-dark">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Saldo Pendente de Abatimento (FIFO)
                        </span>
                        <span className="text-2xl font-black text-red-500 tabular-nums">
                            {brl(totalPending)}
                        </span>
                        <span className="text-xs text-slate-500 block mt-0.5">
                            {advances.length} {advances.length === 1 ? 'vale aberto' : 'vales abertos'}
                        </span>
                    </div>

                    {onNewAdvanceClick && (
                        <button
                            type="button"
                            onClick={() => onNewAdvanceClick(staff.id)}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-night bg-primary hover:bg-primary-dark shadow-sm transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px]">add_circle</span>
                            Lançar Novo Vale
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="py-10 text-center text-sm text-slate-500">
                        Carregando vales pendentes...
                    </div>
                ) : advances.length === 0 ? (
                    <div className="py-10 text-center border border-dashed border-slate-200 dark:border-border-dark rounded-xl space-y-2">
                        <span className="material-symbols-outlined text-3xl text-slate-400">
                            verified
                        </span>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            Nenhum vale pendente para {staff.name}
                        </p>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Todos os adiantamentos anteriores já foram deduzidos em acertos ou estornados.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                        {advances.map((adv, idx) => {
                            const isReversing = reversingAdvanceId === adv.id;
                            return (
                                <div
                                    key={adv.id}
                                    className="rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-4 space-y-3 shadow-sm"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                                                    #{idx + 1} Fila FIFO
                                                </span>
                                                <span className="text-xs font-semibold text-slate-500">
                                                    Emitido em {formatDateTime(adv.issuedAt)}
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                {adv.notes || 'Adiantamento / Vale sem observação'}
                                            </p>
                                            {adv.transactionId && (
                                                <span className="text-[10px] font-mono text-slate-400 block">
                                                    Espelho Caixa: #{adv.transactionId.slice(0, 8)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-3">
                                            <span className="text-base font-black text-red-500 tabular-nums">
                                                - {brl(adv.amount)}
                                            </span>
                                            {!isReversing && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReversingAdvanceId(adv.id);
                                                        setReverseMotivo('');
                                                        setErrorMessage(null);
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20 transition-colors"
                                                >
                                                    Estornar
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {isReversing && (
                                        <div className="pt-3 border-t border-slate-100 dark:border-border-dark space-y-3 bg-rose-50/40 dark:bg-rose-500/5 p-3 rounded-lg">
                                            <label className="block text-[11px] font-bold uppercase text-rose-700 dark:text-rose-300">
                                                Motivo Obrigatório do Estorno
                                            </label>
                                            <input
                                                type="text"
                                                value={reverseMotivo}
                                                onChange={(e) => setReverseMotivo(e.target.value)}
                                                placeholder="Ex.: Lançado para o profissional errado ou valor incorreto"
                                                disabled={submittingReverse}
                                                className="w-full bg-white dark:bg-background-dark border border-rose-200 dark:border-rose-500/30 rounded-lg py-2 px-3 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-rose-500 outline-none"
                                            />
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                O estorno marca <code className="font-mono">reversed_at</code> no vale e insere automaticamente a devolução espelhada no caixa.
                                            </p>
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReversingAdvanceId(null);
                                                        setReverseMotivo('');
                                                    }}
                                                    disabled={submittingReverse}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleConfirmReverse(adv.id)}
                                                    disabled={submittingReverse || !reverseMotivo.trim()}
                                                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors"
                                                >
                                                    {submittingReverse ? 'Estornando...' : 'Confirmar Estorno'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-border-dark">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PendingAdvancesDrawer;
