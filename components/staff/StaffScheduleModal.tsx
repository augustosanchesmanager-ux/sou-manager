import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import type { DayWorkingHours, StaffWorkingHours } from '../../domain/staff/types';

interface StaffScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    memberName: string;
    workingHours: StaffWorkingHours;
    onSave: (workingHours: StaffWorkingHours) => Promise<void>;
}

const DAYS_OF_WEEK: Array<{ key: keyof NonNullable<StaffWorkingHours>; label: string }> = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
];

const DEFAULT_DAY: DayWorkingHours = {
    open: '09:00',
    close: '19:00',
    break_start: null,
    break_end: null,
};

export const StaffScheduleModal: React.FC<StaffScheduleModalProps> = ({
    isOpen,
    onClose,
    memberName,
    workingHours,
    onSave,
}) => {
    const [isCustom, setIsCustom] = useState(false);
    const [schedule, setSchedule] = useState<Record<string, DayWorkingHours | null>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        if (workingHours && typeof workingHours === 'object' && Object.keys(workingHours).length > 0) {
            setIsCustom(true);
            const init: Record<string, DayWorkingHours | null> = {};
            for (const day of DAYS_OF_WEEK) {
                init[day.key] = workingHours[day.key] ? { ...workingHours[day.key]! } : null;
            }
            setSchedule(init);
        } else {
            setIsCustom(false);
            // Default template
            const init: Record<string, DayWorkingHours | null> = {
                monday: null,
                tuesday: { open: '09:00', close: '19:00', break_start: '12:00', break_end: '13:00' },
                wednesday: { open: '09:00', close: '19:00', break_start: '12:00', break_end: '13:00' },
                thursday: { open: '09:00', close: '20:00', break_start: '13:00', break_end: '14:00' },
                friday: { open: '09:00', close: '20:00', break_start: '13:00', break_end: '14:00' },
                saturday: { open: '08:00', close: '18:00', break_start: null, break_end: null },
                sunday: null,
            };
            setSchedule(init);
        }
    }, [isOpen, workingHours]);

    const handleToggleDay = (dayKey: string) => {
        setSchedule((prev) => ({
            ...prev,
            [dayKey]: prev[dayKey] ? null : { ...DEFAULT_DAY },
        }));
    };

    const handleTimeChange = (
        dayKey: string,
        field: keyof DayWorkingHours,
        value: string
    ) => {
        setSchedule((prev) => {
            const current = prev[dayKey] || { ...DEFAULT_DAY };
            return {
                ...prev,
                [dayKey]: {
                    ...current,
                    [field]: value || null,
                },
            };
        });
    };

    const handleReplicateWeekday = () => {
        const source = schedule.tuesday || schedule.monday || schedule.wednesday;
        if (!source) return;

        setSchedule((prev) => ({
            ...prev,
            monday: prev.monday ? { ...source } : null,
            tuesday: { ...source },
            wednesday: { ...source },
            thursday: { ...source },
            friday: { ...source },
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (!isCustom) {
                // Reset to null -> inherits shop schedule
                await onSave(null);
            } else {
                await onSave(schedule as StaffWorkingHours);
            }
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Horários de Atendimento — ${memberName}`}
            maxWidth="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Custom Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200 dark:border-[#262626]">
                    <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            Definir horários próprios deste profissional
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Se desmarcado, a agenda seguirá o expediente geral cadastrado para a barbearia.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isCustom}
                            onChange={(e) => setIsCustom(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
                    </label>
                </div>

                {isCustom && (
                    <>
                        <div className="flex items-center justify-between pt-1">
                            <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                                Dias e Turnos da Semana
                            </span>
                            <button
                                type="button"
                                onClick={handleReplicateWeekday}
                                className="text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors cursor-pointer"
                            >
                                Replicar horário para dias úteis
                            </button>
                        </div>

                        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                            {DAYS_OF_WEEK.map(({ key, label }) => {
                                const dayConfig = schedule[key];
                                const isWorking = dayConfig !== null && dayConfig !== undefined;

                                return (
                                    <div
                                        key={key}
                                        className={`p-3 rounded-xl border transition-all ${
                                            isWorking
                                                ? 'bg-white dark:bg-card-dark border-slate-200 dark:border-border-dark'
                                                : 'bg-slate-50/50 dark:bg-[#121212] border-dashed border-slate-200 dark:border-slate-800 opacity-60'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`check-${key}`}
                                                    checked={isWorking}
                                                    onChange={() => handleToggleDay(key)}
                                                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                                                />
                                                <label
                                                    htmlFor={`check-${key}`}
                                                    className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                                                >
                                                    {label}
                                                </label>
                                            </div>
                                            <span
                                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                                    isWorking
                                                        ? 'bg-emerald-500/10 text-emerald-500'
                                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                                }`}
                                            >
                                                {isWorking ? 'Atende' : 'Folga'}
                                            </span>
                                        </div>

                                        {isWorking && dayConfig && (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                                                <div>
                                                    <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-0.5">
                                                        Entrada
                                                    </label>
                                                    <input
                                                        type="time"
                                                        value={dayConfig.open || '09:00'}
                                                        onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-2 text-xs text-slate-900 dark:text-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-0.5">
                                                        Saída
                                                    </label>
                                                    <input
                                                        type="time"
                                                        value={dayConfig.close || '19:00'}
                                                        onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-2 text-xs text-slate-900 dark:text-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-0.5">
                                                        Início Almoço
                                                    </label>
                                                    <input
                                                        type="time"
                                                        value={dayConfig.break_start || ''}
                                                        onChange={(e) =>
                                                            handleTimeChange(key, 'break_start', e.target.value)
                                                        }
                                                        placeholder="Opcional"
                                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-2 text-xs text-slate-900 dark:text-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-0.5">
                                                        Fim Almoço
                                                    </label>
                                                    <input
                                                        type="time"
                                                        value={dayConfig.break_end || ''}
                                                        onChange={(e) =>
                                                            handleTimeChange(key, 'break_end', e.target.value)
                                                        }
                                                        placeholder="Opcional"
                                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-2 text-xs text-slate-900 dark:text-white"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                <div className="flex gap-3 pt-3 border-t border-slate-200 dark:border-border-dark">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-lg text-xs font-bold text-neutral-950 bg-amber-500 hover:bg-amber-400 shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
                    >
                        {saving ? 'Salvando...' : 'Salvar Horários'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};
