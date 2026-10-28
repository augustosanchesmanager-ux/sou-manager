import React from 'react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { formatCurrency } from '../../shared/format/currency';
import type { FinancialReversalType } from '../../src/lib/finance/reversal';
import type {
    PaidComandaSettlement,
    PaymentMethod,
    ReversalReason,
} from './types';

export interface ReversalModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: PaidComandaSettlement | null;
    reversalType: FinancialReversalType;
    onReversalTypeChange: (type: FinancialReversalType) => void;
    reversalAmount: string;
    onReversalAmountChange: (amount: string) => void;
    refundMethod: PaymentMethod;
    onRefundMethodChange: (method: PaymentMethod) => void;
    reversalDate: string;
    onReversalDateChange: (date: string) => void;
    reasonType: ReversalReason;
    onReasonTypeChange: (reason: ReversalReason) => void;
    reasonNote: string;
    onReasonNoteChange: (note: string) => void;
    reversalConfirmed: boolean;
    onReversalConfirmedChange: (confirmed: boolean) => void;
    isSubmitting: boolean;
    onConfirm: () => void;
}

const ReversalModal: React.FC<ReversalModalProps> = ({
    isOpen,
    onClose,
    entry,
    reversalType,
    onReversalTypeChange,
    reversalAmount,
    onReversalAmountChange,
    refundMethod,
    onRefundMethodChange,
    reversalDate,
    onReversalDateChange,
    reasonType,
    onReasonTypeChange,
    reasonNote,
    onReasonNoteChange,
    reversalConfirmed,
    onReversalConfirmedChange,
    isSubmitting,
    onConfirm,
}) => {
    if (!entry) return null;

    const footer = (
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancelar
            </Button>
            <Button onClick={onConfirm} disabled={isSubmitting}>
                {isSubmitting ? 'Registrando...' : 'Confirmar estorno'}
            </Button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Estorno / devolução auditada"
            maxWidth="lg"
            footer={footer}
        >
            <div className="space-y-5">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                    <p className="font-bold">A transaction original não será apagada. O sistema criará uma movimentação reversa auditada.</p>
                    <p className="mt-2">Use estorno apenas quando houver erro de baixa, devolução ao cliente ou correção financeira autorizada.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                        <p className="text-xs font-bold uppercase text-slate-500">Baixa original</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{entry.clientName}</p>
                        <p className="mt-1 text-xs text-slate-500">{entry.id}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                        <p className="text-xs font-bold uppercase text-slate-500">Valor original</p>
                        <p className="mt-2 text-lg font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(entry.amount)}
                        </p>
                        {entry.reversedAmount > 0 && (
                            <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
                                Ja revertido: {formatCurrency(entry.reversedAmount)}
                            </p>
                        )}
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                            Saldo reversivel: {formatCurrency(entry.reversibleAmount)}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="space-y-2">
                        <span className="text-xs font-bold uppercase text-slate-500">Tipo de reversão</span>
                        <select
                            value={reversalType}
                            onChange={(event) => onReversalTypeChange(event.target.value as FinancialReversalType)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white"
                        >
                            <option value="wrong_settlement">Baixa indevida</option>
                            <option value="full_refund">Devolução total</option>
                            <option value="partial_refund">Devolução parcial</option>
                        </select>
                    </label>

                    <label className="space-y-2">
                        <span className="text-xs font-bold uppercase text-slate-500">Valor a reverter</span>
                        <input
                            type="number"
                            min="0.01"
                            max={entry.reversibleAmount}
                            step="0.01"
                            value={reversalAmount}
                            onChange={(event) => onReversalAmountChange(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white"
                        />
                    </label>

                    <label className="space-y-2">
                        <span className="text-xs font-bold uppercase text-slate-500">Forma de devolução</span>
                        <select
                            value={refundMethod}
                            onChange={(event) => onRefundMethodChange(event.target.value as PaymentMethod)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white"
                        >
                            <option value="pix">Pix</option>
                            <option value="cash">Dinheiro</option>
                            <option value="credit">Cartão de crédito</option>
                            <option value="debit">Cartão de débito</option>
                            <option value="other">Outro</option>
                        </select>
                    </label>

                    <label className="space-y-2">
                        <span className="text-xs font-bold uppercase text-slate-500">Data real da reversão</span>
                        <input
                            type="datetime-local"
                            value={reversalDate}
                            onChange={(event) => onReversalDateChange(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                        />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                        <span className="text-xs font-bold uppercase text-slate-500">Motivo</span>
                        <select
                            value={reasonType}
                            onChange={(event) => onReasonTypeChange(event.target.value as ReversalReason)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white"
                        >
                            <option value="baixa_indevida">Baixa indevida</option>
                            <option value="cobranca_duplicada">Cobrança duplicada</option>
                            <option value="devolucao_ao_cliente">Devolução ao cliente</option>
                            <option value="erro_forma_pagamento">Erro de forma de pagamento</option>
                            <option value="erro_operacional">Erro operacional</option>
                            <option value="cancelamento_administrativo">Cancelamento administrativo</option>
                            <option value="cliente_duplicado">Cliente duplicado</option>
                            <option value="outro">Outro</option>
                        </select>
                    </label>

                    <label className="space-y-2 md:col-span-2">
                        <span className="text-xs font-bold uppercase text-slate-500">Observação obrigatória</span>
                        <textarea
                            value={reasonNote}
                            onChange={(event) => onReasonNoteChange(event.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-primary dark:border-border-dark dark:bg-card-dark dark:text-white"
                            placeholder="Descreva o contexto do estorno/devolução para auditoria."
                        />
                    </label>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-600 dark:border-border-dark dark:text-slate-300">
                    <input
                        type="checkbox"
                        checked={reversalConfirmed}
                        onChange={(event) => onReversalConfirmedChange(event.target.checked)}
                        className="mt-1 size-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span>
                        Confirmo que esta ação criará uma movimentação reversa auditada e preservará a transaction original.
                    </span>
                </label>
            </div>
        </Modal>
    );
};

export default ReversalModal;
