import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { formatCurrency } from '../../shared/format/currency';
import type { ChefClubClientCredits } from '../../src/lib/supabase/chefClub';
import type {
    AREntry,
    OpenComandaDetail,
    PaymentMethod,
    SettlementMode,
} from './types';
import { getShortId } from './types';

export interface SettlementModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: AREntry | null;
    detail: OpenComandaDetail | null;
    settlementGross: number;
    settlementDiscount: number;
    settlementNet: number;
    settlementDifference: number;
    settlementMode: SettlementMode;
    onSettlementModeChange: (mode: SettlementMode) => void;
    settlementPaidAmount: string;
    onSettlementPaidAmountChange: (amount: string) => void;
    settlementPaymentMethod: PaymentMethod;
    onSettlementPaymentMethodChange: (method: PaymentMethod) => void;
    settlementPaymentDate: string;
    onSettlementPaymentDateChange: (date: string) => void;
    settlementNotes: string;
    onSettlementNotesChange: (notes: string) => void;
    settlementZeroReason: string;
    onSettlementZeroReasonChange: (reason: string) => void;
    settlementClubCredits: ChefClubClientCredits | null;
    settlementClubCreditsLoading: boolean;
    settlementClubCanCover: boolean;
    canUseAdministrativeZeroClose: boolean;
    isSubmitting: boolean;
    onConfirm: () => void;
}

const SettlementModal: React.FC<SettlementModalProps> = ({
    isOpen,
    onClose,
    entry,
    detail,
    settlementGross,
    settlementDiscount,
    settlementNet,
    settlementDifference,
    settlementMode,
    onSettlementModeChange,
    settlementPaidAmount,
    onSettlementPaidAmountChange,
    settlementPaymentMethod,
    onSettlementPaymentMethodChange,
    settlementPaymentDate,
    onSettlementPaymentDateChange,
    settlementNotes,
    onSettlementNotesChange,
    settlementZeroReason,
    onSettlementZeroReasonChange,
    settlementClubCredits,
    settlementClubCreditsLoading,
    settlementClubCanCover,
    canUseAdministrativeZeroClose,
    isSubmitting,
    onConfirm,
}) => {
    const navigate = useNavigate();
    if (!entry) return null;

    const footer = (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end w-full">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancelar
            </Button>
            <Button type="button" onClick={onConfirm} isLoading={isSubmitting}>
                {isSubmitting ? 'Registrando...' : 'Confirmar baixa'}
            </Button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Dar baixa financeira"
            maxWidth="3xl"
            footer={footer}
        >
            <div className="space-y-5">
                <p className="-mt-2 text-xs text-slate-500">
                    A baixa será registrada pela RPC financeira central.
                </p>

                <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-white/5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Cliente</p>
                            <strong className="mt-1 block text-base text-slate-900 dark:text-white">{entry.clientName}</strong>
                            {entry.clientPhone && (
                                <p className="mt-1 text-xs font-semibold text-slate-500">{entry.clientPhone}</p>
                            )}
                            <p className="mt-2 text-xs text-slate-500">
                                Comanda #{getShortId(entry.id)} · {detail?.status || entry.status}
                            </p>
                        </div>
                        <div className="text-left md:text-right">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Abertura</p>
                            <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                                {new Date(entry.dateValue).toLocaleString('pt-BR')}
                            </p>
                            <p className="mt-2 text-xs text-slate-500">
                                Profissional principal: {detail?.mainStaffName || 'Não informado'}
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-border-dark dark:bg-background-dark">
                            <p className="text-[11px] font-bold uppercase text-slate-400">Subtotal bruto</p>
                            <p className="mt-1 font-black text-slate-900 dark:text-white">{formatCurrency(settlementGross)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-border-dark dark:bg-background-dark">
                            <p className="text-[11px] font-bold uppercase text-slate-400">Desconto</p>
                            <p className={`mt-1 font-black ${settlementDiscount > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
                                {formatCurrency(settlementDiscount)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-border-dark dark:bg-background-dark">
                            <p className="text-[11px] font-bold uppercase text-slate-400">Valor líquido</p>
                            <p className="mt-1 font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(settlementNet)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-border-dark dark:bg-background-dark">
                            <p className="text-[11px] font-bold uppercase text-slate-400">Diferença do pago</p>
                            <p className={`mt-1 font-black ${Math.abs(settlementDifference) > 0.009 ? 'text-amber-600 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
                                {formatCurrency(settlementDifference)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-border-dark">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-border-dark">
                        <div>
                            <p className="text-sm font-black text-slate-900 dark:text-white">Itens da comanda</p>
                            <p className="text-xs text-slate-500">Visualização apenas para conferência antes da baixa.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                if (entry?.id) {
                                    navigate(`/checkout?comandaId=${entry.id}`);
                                } else {
                                    navigate('/checkout');
                                }
                            }}
                            title="Abrir esta comanda no Checkout para editar serviços, produtos ou profissionais."
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-border-dark dark:bg-card-dark dark:text-slate-200 dark:hover:bg-white/5"
                        >
                            <ExternalLink className="size-3.5" />
                            Editar no Checkout
                        </button>
                    </div>
                    <p className="border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 dark:border-border-dark">
                        Para alterar itens, descontos ou profissionais, ajuste a comanda no Checkout antes da baixa financeira.
                    </p>

                    {detail?.items.length ? (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {detail.items.map((item) => (
                                <div key={item.id} className="p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-500 dark:bg-white/5">
                                                    {item.typeLabel}
                                                </span>
                                                {item.participants.length > 0 && (
                                                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">
                                                        Compartilhado
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                                            <p className="mt-1 text-xs text-slate-500">Responsável: {item.staffName}</p>
                                        </div>
                                        <div className="text-left md:text-right">
                                            <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(item.total)}</p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {item.quantity} x {formatCurrency(item.unitPrice)}
                                            </p>
                                        </div>
                                    </div>

                                    {item.participants.length > 0 && (
                                        <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
                                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Participação lançada</p>
                                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                {item.participants.map((participant) => (
                                                    <div key={participant.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-border-dark dark:bg-background-dark">
                                                        <p className="font-bold text-slate-900 dark:text-white">{participant.staffName}</p>
                                                        <p className="mt-1 text-slate-500">
                                                            {participant.payoutType} · {participant.payoutValue}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-sm text-slate-500">
                            Nenhum item encontrado para esta comanda.
                        </div>
                    )}
                </div>

                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Tipo de baixa</span>
                        <div className="grid gap-2 md:grid-cols-2">
                            {[
                                { value: 'payment' as SettlementMode, label: 'Baixar com pagamento', helper: 'Cria receita real na RPC financeira.' },
                                ...(entry?.clientId
                                    ? [{ value: 'club_credit' as SettlementMode, label: 'Consumir crédito do Clube', helper: settlementClubCreditsLoading ? 'Carregando créditos...' : `${settlementClubCredits?.availableCredits || 0} crédito(s) disponível(is).` }]
                                    : []),
                                { value: 'house_courtesy' as SettlementMode, label: 'Cortesia da casa', helper: 'Sem entrada financeira, com motivo obrigatório.' },
                                { value: 'administrative_adjustment' as SettlementMode, label: 'Baixa administrativa', helper: 'Restrita a gerente/admin/superadmin.' },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => onSettlementModeChange(option.value)}
                                    disabled={
                                        (option.value === 'club_credit' && !settlementClubCanCover) ||
                                        (option.value === 'administrative_adjustment' && !canUseAdministrativeZeroClose)
                                    }
                                    className={`rounded-xl border px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                        settlementMode === option.value
                                            ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                            : 'border-slate-200 bg-white text-slate-600 dark:border-border-dark dark:bg-background-dark dark:text-slate-300'
                                    }`}
                                >
                                    <span className="block font-black">{option.label}</span>
                                    <span>{option.helper}</span>
                                </button>
                            ))}
                        </div>
                        {settlementMode !== 'payment' && (
                            <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                                Fechamento sem pagamento real. Não será criada transaction de receita no caixa.
                            </p>
                        )}
                    </div>

                    {settlementMode === 'payment' && (
                        <>
                            <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                                Valor pago
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={settlementPaidAmount}
                                    onChange={(event) => onSettlementPaidAmountChange(event.target.value)}
                                    className="rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2.5 text-sm outline-none focus:border-primary"
                                    placeholder="0,00"
                                />
                                <span className="text-xs font-medium text-slate-500">
                                    Pode ser diferente do total; a diferença fica registrada na auditoria financeira.
                                </span>
                            </label>

                            <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                                Forma de pagamento
                                <select
                                    value={settlementPaymentMethod}
                                    onChange={(event) => onSettlementPaymentMethodChange(event.target.value as PaymentMethod)}
                                    className="rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2.5 text-sm outline-none focus:border-primary"
                                >
                                    <option value="pix">Pix</option>
                                    <option value="cash">Dinheiro</option>
                                    <option value="credit">Cartão de crédito</option>
                                    <option value="debit">Cartão de débito</option>
                                    <option value="other">Outro</option>
                                </select>
                            </label>
                        </>
                    )}

                    {(settlementMode === 'house_courtesy' || settlementMode === 'administrative_adjustment') && (
                        <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                            Motivo obrigatório
                            <textarea
                                value={settlementZeroReason}
                                onChange={(event) => onSettlementZeroReasonChange(event.target.value)}
                                rows={3}
                                className="rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2.5 text-sm outline-none focus:border-primary"
                                placeholder="Explique a autorização e o motivo da baixa sem pagamento."
                            />
                        </label>
                    )}

                    <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                        Data real do pagamento
                        <input
                            type="datetime-local"
                            value={settlementPaymentDate}
                            onChange={(event) => onSettlementPaymentDateChange(event.target.value)}
                            className="rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2.5 text-sm outline-none focus:border-primary"
                        />
                    </label>

                    <label className="grid gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200">
                        Observacao
                        <textarea
                            value={settlementNotes}
                            onChange={(event) => onSettlementNotesChange(event.target.value)}
                            rows={3}
                            className="resize-none rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2.5 text-sm outline-none focus:border-primary"
                            placeholder="Opcional"
                        />
                    </label>
                </div>
            </div>
        </Modal>
    );
};

export default SettlementModal;
