import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { useBarberPayoutConfig } from '../../src/hooks/usePayoutService';
import type { BarberPayoutConfig, PayoutFrequency } from '../../domain/payout/types';

export const PAYOUT_WEEKDAY_LABELS: Record<number, { short: string; full: string }> = {
    1: { short: 'Seg', full: 'Segunda-feira' },
    2: { short: 'Ter', full: 'Terça-feira' },
    3: { short: 'Qua', full: 'Quarta-feira' },
    4: { short: 'Qui', full: 'Quinta-feira' },
    5: { short: 'Sex', full: 'Sexta-feira' },
    6: { short: 'Sáb', full: 'Sábado' },
    7: { short: 'Dom', full: 'Domingo' },
};

export const PAYOUT_FREQUENCY_LABELS: Record<PayoutFrequency, string> = {
    daily: 'Diário',
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    monthly: 'Mensal',
};

/**
 * Formata um badge resumido do ciclo de repasse (ex.: "Semanal (Ter)", "Mensal (Dia 5)").
 */
export function formatPayoutCycleBadge(config: BarberPayoutConfig | null | undefined): string {
    if (!config) return 'Sem ciclo definido';
    const base = PAYOUT_FREQUENCY_LABELS[config.frequency] ?? config.frequency;
    if ((config.frequency === 'weekly' || config.frequency === 'biweekly') && config.payoutWeekday) {
        const wd = PAYOUT_WEEKDAY_LABELS[config.payoutWeekday]?.short ?? `${config.payoutWeekday}ª`;
        return `${base} (${wd})`;
    }
    if (config.frequency === 'monthly' && config.payoutMonthDay) {
        return `${base} (Dia ${config.payoutMonthDay})`;
    }
    return base;
}

/**
 * Avalia se um profissional configurado tem vencimento na data de referência (`YYYY-MM-DD`)
 * ou dentro do intervalo `[periodStart, periodEnd]`.
 */
export function isPayoutConfigDueInPeriod(
    config: BarberPayoutConfig | null | undefined,
    periodStart: string,
    periodEnd: string,
    referenceDateIso?: string,
): { dueToday: boolean; dueInPeriod: boolean } {
    if (!config) {
        return { dueToday: false, dueInPeriod: false };
    }

    const todayIso = referenceDateIso ?? new Date().toISOString().split('T')[0];

    const matchesDate = (dateIso: string): boolean => {
        if (config.frequency === 'daily') return true;
        const dt = new Date(`${dateIso}T12:00:00`);
        if (Number.isNaN(dt.getTime())) return false;

        if (config.frequency === 'weekly' || config.frequency === 'biweekly') {
            if (!config.payoutWeekday) return false;
            const jsDay = dt.getDay(); // 0 = Sun ... 6 = Sat
            const isoWeekday = jsDay === 0 ? 7 : jsDay; // 1 = Mon ... 7 = Sun
            return isoWeekday === config.payoutWeekday;
        }

        if (config.frequency === 'monthly') {
            if (!config.payoutMonthDay) return false;
            const year = dt.getFullYear();
            const month = dt.getMonth();
            const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
            const effectiveDay = Math.min(config.payoutMonthDay, lastDayOfMonth);
            return dt.getDate() === effectiveDay;
        }

        return false;
    };

    const dueToday = matchesDate(todayIso);

    if (config.frequency === 'daily') {
        return { dueToday: true, dueInPeriod: true };
    }

    // Verifica se algum dia dentro de [periodStart, periodEnd] (limitado a 62 dias de varredura) bate com a regra
    let dueInPeriod = dueToday;
    const start = new Date(`${periodStart}T12:00:00`);
    const end = new Date(`${periodEnd}T12:00:00`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
        const cursor = new Date(start);
        let guard = 0;
        while (cursor <= end && guard < 62) {
            const iso = cursor.toISOString().split('T')[0];
            if (matchesDate(iso)) {
                dueInPeriod = true;
                break;
            }
            cursor.setDate(cursor.getDate() + 1);
            guard += 1;
        }
    }

    return { dueToday, dueInPeriod };
}

interface PayoutCycleConfigFieldsProps {
    frequency: PayoutFrequency;
    payoutWeekday: number;
    payoutMonthDay: number;
    allowAdvances: boolean;
    onChange: (next: {
        frequency: PayoutFrequency;
        payoutWeekday: number;
        payoutMonthDay: number;
        allowAdvances: boolean;
    }) => void;
    disabled?: boolean;
}

/**
 * Bloco reutilizável de campos da Política de Repasse & Vales (Lei Salão-Parceiro).
 * Pode ser embutido diretamente no formulário de `Team.tsx` ou dentro do `PayoutCycleConfigModal`.
 */
export const PayoutCycleConfigFields: React.FC<PayoutCycleConfigFieldsProps> = ({
    frequency,
    payoutWeekday,
    payoutMonthDay,
    allowAdvances,
    onChange,
    disabled = false,
}) => {
    const needsWeekday = frequency === 'weekly' || frequency === 'biweekly';
    const needsMonthDay = frequency === 'monthly';

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Periodicidade do Repasse
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['daily', 'weekly', 'biweekly', 'monthly'] as PayoutFrequency[]).map((freq) => {
                        const active = frequency === freq;
                        return (
                            <button
                                key={freq}
                                type="button"
                                disabled={disabled}
                                onClick={() =>
                                    onChange({
                                        frequency: freq,
                                        payoutWeekday,
                                        payoutMonthDay,
                                        allowAdvances,
                                    })
                                }
                                className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition-all ${
                                    active
                                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 shadow-sm'
                                        : 'border-slate-200 dark:border-border-dark bg-white dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                                }`}
                            >
                                {PAYOUT_FREQUENCY_LABELS[freq]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {needsWeekday && (
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                        Dia Base do Acerto ({frequency === 'weekly' ? 'Semanal' : 'Quinzenal'})
                    </label>
                    <div className="grid grid-cols-7 gap-1.5">
                        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                            const active = payoutWeekday === day;
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() =>
                                        onChange({
                                            frequency,
                                            payoutWeekday: day,
                                            payoutMonthDay,
                                            allowAdvances,
                                        })
                                    }
                                    className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                                        active
                                            ? 'border-amber-500 bg-amber-500 text-slate-950 shadow-sm'
                                            : 'border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                                    }`}
                                >
                                    {PAYOUT_WEEKDAY_LABELS[day].short}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                        Dia oficial da semana para fechamento e repasse das comissões líquidas.
                    </p>
                </div>
            )}

            {needsMonthDay && (
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                        Dia do Mês para Pagamento (1 a 31)
                    </label>
                    <input
                        type="number"
                        min={1}
                        max={31}
                        disabled={disabled}
                        value={payoutMonthDay}
                        onChange={(e) => {
                            const val = Math.min(31, Math.max(1, Number.parseInt(e.target.value, 10) || 1));
                            onChange({
                                frequency,
                                payoutWeekday,
                                payoutMonthDay: val,
                                allowAdvances,
                            });
                        }}
                        className="w-32 bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2 px-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                        Em meses mais curtos (ex.: fevereiro), o vencimento ajusta-se automaticamente ao último dia do mês.
                    </p>
                </div>
            )}

            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50/70 dark:bg-white/[0.02] p-3">
                <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Permitir Vales / Adiantamentos
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Quando desativado, bloqueia sangrias de vale no Caixa e na Folha para este profissional.
                    </span>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={allowAdvances}
                    disabled={disabled}
                    onClick={() =>
                        onChange({
                            frequency,
                            payoutWeekday,
                            payoutMonthDay,
                            allowAdvances: !allowAdvances,
                        })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        allowAdvances ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                >
                    <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            allowAdvances ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                </button>
            </div>
        </div>
    );
};

interface PayoutCycleConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    staffId: string | null;
    staffName: string;
    initialConfig?: BarberPayoutConfig | null;
    onSaved?: (config: BarberPayoutConfig) => void;
}

const PayoutCycleConfigModal: React.FC<PayoutCycleConfigModalProps> = ({
    isOpen,
    onClose,
    staffId,
    staffName,
    initialConfig,
    onSaved,
}) => {
    const { getConfigByStaff, upsertConfig } = useBarberPayoutConfig();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [frequency, setFrequency] = useState<PayoutFrequency>('weekly');
    const [payoutWeekday, setPayoutWeekday] = useState<number>(2); // Terça-feira (padrão barbearia)
    const [payoutMonthDay, setPayoutMonthDay] = useState<number>(5);
    const [allowAdvances, setAllowAdvances] = useState<boolean>(true);

    useEffect(() => {
        if (!isOpen || !staffId) return;
        setError(null);

        if (initialConfig && initialConfig.staffId === staffId) {
            setFrequency(initialConfig.frequency);
            setPayoutWeekday(initialConfig.payoutWeekday ?? 2);
            setPayoutMonthDay(initialConfig.payoutMonthDay ?? 5);
            setAllowAdvances(initialConfig.allowAdvances);
            return;
        }

        let cancelled = false;
        setLoading(true);
        getConfigByStaff(staffId)
            .then((cfg) => {
                if (cancelled) return;
                if (cfg) {
                    setFrequency(cfg.frequency);
                    setPayoutWeekday(cfg.payoutWeekday ?? 2);
                    setPayoutMonthDay(cfg.payoutMonthDay ?? 5);
                    setAllowAdvances(cfg.allowAdvances);
                } else {
                    setFrequency('weekly');
                    setPayoutWeekday(2);
                    setPayoutMonthDay(5);
                    setAllowAdvances(true);
                }
            })
            .catch((err) => {
                console.error('Erro ao carregar configuração de ciclo:', err);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen, staffId, initialConfig, getConfigByStaff]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!staffId) return;

        setSaving(true);
        setError(null);
        try {
            const saved = await upsertConfig({
                staffId,
                frequency,
                payoutWeekday: frequency === 'weekly' || frequency === 'biweekly' ? payoutWeekday : null,
                payoutMonthDay: frequency === 'monthly' ? payoutMonthDay : null,
                allowAdvances,
            });
            onSaved?.(saved);
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao salvar política de repasse.';
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Política de Repasse — ${staffName}`}
            maxWidth="md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-xl border border-amber-200/80 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
                    Cláusula contratual de periodicidade de acerto e limite de adiantamentos (Lei Salão-Parceiro — ADR-030).
                </div>

                {loading ? (
                    <div className="py-8 text-center text-sm text-slate-400">
                        Carregando configuração do profissional...
                    </div>
                ) : (
                    <PayoutCycleConfigFields
                        frequency={frequency}
                        payoutWeekday={payoutWeekday}
                        payoutMonthDay={payoutMonthDay}
                        allowAdvances={allowAdvances}
                        disabled={saving}
                        onChange={(next) => {
                            setFrequency(next.frequency);
                            setPayoutWeekday(next.payoutWeekday);
                            setPayoutMonthDay(next.payoutMonthDay);
                            setAllowAdvances(next.allowAdvances);
                        }}
                    />
                )}

                {error && (
                    <div className="rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
                        {error}
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving || loading}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                    >
                        {saving ? 'Salvando...' : 'Salvar Política'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default PayoutCycleConfigModal;
