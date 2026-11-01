import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import { useBarberAdvances } from '../../src/hooks/usePayoutService';
import { getEffectiveCommissionRate } from '../../src/lib/staff/roles';
import { roundCents } from '../../domain/payout/money';

export interface BarberAdvanceStaffOption {
    id: string;
    name: string;
    role?: string;
}

export interface BarberAdvanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    professionals?: BarberAdvanceStaffOption[];
    defaultStaffId?: string | null;
    /** 'cash' = Gaveta / Caixa Físico (Dinheiro); 'bank' = Conta Bancária (Pix) */
    defaultOrigin?: 'cash' | 'bank';
    onSuccess?: (payload: {
        advanceId: string;
        staffId: string;
        staffName: string;
        amount: number;
        paymentMethod: string;
        notes: string;
    }) => void;
}

const QUICK_AMOUNTS = [20, 50, 100, 200];

const brl = (value: number): string =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const BarberAdvanceModal: React.FC<BarberAdvanceModalProps> = ({
    isOpen,
    onClose,
    professionals: externalProfessionals,
    defaultStaffId = null,
    defaultOrigin = 'bank',
    onSuccess,
}) => {
    const { tenantId, service, registerAdvance } = useBarberAdvances();

    const [loadedProfessionals, setLoadedProfessionals] = useState<BarberAdvanceStaffOption[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(false);

    const [selectedStaffId, setSelectedStaffId] = useState<string>('');
    const [amountInput, setAmountInput] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'Dinheiro' | 'Pix' | 'Transferência'>(
        defaultOrigin === 'cash' ? 'Dinheiro' : 'Pix',
    );
    const [notes, setNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const staffOptions = useMemo(() => {
        if (externalProfessionals && externalProfessionals.length > 0) {
            return externalProfessionals;
        }
        return loadedProfessionals;
    }, [externalProfessionals, loadedProfessionals]);

    useEffect(() => {
        if (!isOpen) return;
        setErrorMessage(null);
        setAmountInput('');
        setNotes('');
        setPaymentMethod(defaultOrigin === 'cash' ? 'Dinheiro' : 'Pix');

        if (defaultStaffId) {
            setSelectedStaffId(defaultStaffId);
        } else if (externalProfessionals && externalProfessionals.length > 0) {
            setSelectedStaffId(externalProfessionals[0].id);
        }
    }, [isOpen, defaultStaffId, defaultOrigin, externalProfessionals]);

    useEffect(() => {
        if (!isOpen) return;
        if (externalProfessionals && externalProfessionals.length > 0) return;
        if (!service || !tenantId) return;

        let cancelled = false;
        setLoadingStaff(true);

        service
            .listEligibleProfessionals(tenantId, getEffectiveCommissionRate)
            .then((list) => {
                if (cancelled) return;
                const mapped = list.map((s) => ({
                    id: s.id,
                    name: s.name,
                    role: s.role,
                }));
                setLoadedProfessionals(mapped);
                if (!defaultStaffId && mapped.length > 0) {
                    setSelectedStaffId(mapped[0].id);
                }
            })
            .catch((err) => {
                console.error('Erro ao carregar profissionais para vale:', err);
            })
            .finally(() => {
                if (!cancelled) setLoadingStaff(false);
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen, externalProfessionals, service, tenantId, defaultStaffId]);

    const parsedAmount = useMemo(() => {
        const normalized = amountInput.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
        const num = Number.parseFloat(normalized);
        if (!Number.isFinite(num) || num <= 0) return 0;
        return roundCents(num);
    }, [amountInput]);

    const handleQuickAmount = (val: number) => {
        setAmountInput(val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        setErrorMessage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStaffId) {
            setErrorMessage('Selecione o profissional.');
            return;
        }
        if (parsedAmount <= 0) {
            setErrorMessage('Informe um valor maior que R$ 0,00.');
            return;
        }

        setSubmitting(true);
        setErrorMessage(null);

        try {
            const idempotencyKey = `adv:${tenantId}:${selectedStaffId}:${Date.now()}`;
            const result = await registerAdvance({
                staffId: selectedStaffId,
                amount: parsedAmount,
                paymentMethod,
                notes: notes.trim() || null,
                idempotencyKey,
            });

            const staffObj = staffOptions.find((s) => s.id === selectedStaffId);
            onSuccess?.({
                advanceId: result.advanceId,
                staffId: selectedStaffId,
                staffName: staffObj?.name || 'Profissional',
                amount: parsedAmount,
                paymentMethod,
                notes: notes.trim(),
            });
            onClose();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erro ao registrar o vale.';
            setErrorMessage(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Lançar Vale / Adiantamento"
            maxWidth="md"
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                {errorMessage && (
                    <div className="rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base shrink-0">error</span>
                        <span>{errorMessage}</span>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">
                        Profissional
                    </label>
                    <select
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        disabled={loadingStaff || submitting}
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 px-3 text-sm font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                    >
                        {staffOptions.length === 0 ? (
                            <option value="">
                                {loadingStaff ? 'Carregando profissionais...' : 'Nenhum profissional elegível'}
                            </option>
                        ) : (
                            staffOptions.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name} {s.role ? `(${s.role})` : ''}
                                </option>
                            ))
                        )}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">
                        Valor do Adiantamento (R$)
                    </label>
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            R$
                        </span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={amountInput}
                            onChange={(e) => {
                                setAmountInput(e.target.value);
                                setErrorMessage(null);
                            }}
                            placeholder="0,00"
                            disabled={submitting}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 pl-10 pr-4 text-base font-black text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none tabular-nums"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {QUICK_AMOUNTS.map((val) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => handleQuickAmount(val)}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-border-dark bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary transition-colors tabular-nums"
                            >
                                + {brl(val)}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">
                        Origem dos Fundos
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {(
                            [
                                {
                                    id: 'Dinheiro',
                                    label: 'Caixa Físico',
                                    sub: 'Gaveta (Dinheiro)',
                                    icon: 'point_of_sale',
                                },
                                {
                                    id: 'Pix',
                                    label: 'Conta Pix',
                                    sub: 'Bancário direto',
                                    icon: 'bolt',
                                },
                                {
                                    id: 'Transferência',
                                    label: 'Transferência',
                                    sub: 'Conta bancária',
                                    icon: 'account_balance',
                                },
                            ] as const
                        ).map((opt) => {
                            const active = paymentMethod === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setPaymentMethod(opt.id)}
                                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                                        active
                                            ? 'border-primary bg-amber-50/70 dark:bg-primary/15 text-slate-900 dark:text-white shadow-sm'
                                            : 'border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <span
                                        className={`material-symbols-outlined text-lg mt-0.5 ${
                                            active ? 'text-primary' : 'text-slate-400'
                                        }`}
                                    >
                                        {opt.icon}
                                    </span>
                                    <div>
                                        <span className="text-xs font-bold block">{opt.label}</span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                                            {opt.sub}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">
                        Motivo / Observação
                    </label>
                    <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        maxLength={160}
                        placeholder="Ex.: Almoço, combustível, adiantamento quinzenal..."
                        disabled={submitting}
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 px-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                    />
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/[0.02] p-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
                    <span className="material-symbols-outlined text-base text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                        info
                    </span>
                    <span>
                        Este lançamento grava o vale pendente para abatimento automático no próximo acerto (FIFO) e registra a saída espelhada em <code className="font-mono">transactions</code> (<code className="font-mono">vale_comissao</code>).
                    </span>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={submitting || !selectedStaffId || parsedAmount <= 0}
                        className="flex-1 py-3 rounded-xl text-sm font-bold text-night bg-primary hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-display"
                    >
                        {submitting ? 'Registrando...' : `Confirmar Vale ${parsedAmount > 0 ? brl(parsedAmount) : ''}`}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default BarberAdvanceModal;
