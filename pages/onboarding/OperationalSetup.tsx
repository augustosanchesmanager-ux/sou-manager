import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { completeOnboardingService } from '../../application/onboarding';
import type { TenantSettings, BusinessHours } from '../../domain/tenantSettings/types';

const DAYS: { key: string; label: string }[] = [
    { key: 'mon', label: 'Segunda' },
    { key: 'tue', label: 'Terça' },
    { key: 'wed', label: 'Quarta' },
    { key: 'thu', label: 'Quinta' },
    { key: 'fri', label: 'Sexta' },
    { key: 'sat', label: 'Sábado' },
    { key: 'sun', label: 'Domingo' },
];

const DEFAULT_WEEK: Record<string, { open: string; close: string } | null> = {
    mon: { open: '09:00', close: '19:00' },
    tue: { open: '09:00', close: '19:00' },
    wed: { open: '09:00', close: '19:00' },
    thu: { open: '09:00', close: '19:00' },
    fri: { open: '09:00', close: '20:00' },
    sat: { open: '09:00', close: '19:00' },
    sun: null,
};

const INTERVAL_OPTIONS = [15, 30, 45, 60];
const DURATION_OPTIONS = [30, 45, 60, 90, 120];

/**
 * Bloco 3 — Configurações Operacionais (Fase 6.0.2).
 *
 * Horário de funcionamento, intervalo entre horários, duração padrão,
 * horizonte de agendamento e agenda por barbeiro.
 *
 * Persistência via saveOperationalStep; finalização via complete().
 * Suporta retomada: carrega settings existentes (inclusive phone da etapa
 * anterior, necessário para o RPC complete_onboarding).
 */
const OperationalSetup: React.FC = () => {
    const navigate = useNavigate();
    const { tenantId, refreshTenant } = useAuth();

    const [settings, setSettings] = useState<TenantSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [week, setWeek] = useState<Record<string, { open: string; close: string } | null>>(DEFAULT_WEEK);
    const [intervalMinutes, setIntervalMinutes] = useState(30);
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [bookingHorizonDays, setBookingHorizonDays] = useState(30);
    const [staffOwnedSchedule, setStaffOwnedSchedule] = useState(true);

    // Resume
    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const current = await completeOnboardingService.getSettings(tenantId);
                if (cancelled) return;
                setSettings(current);
                if (current?.business_hours) {
                    const merged = { ...DEFAULT_WEEK, ...current.business_hours };
                    setWeek(merged);
                }
                if (current?.appointment_interval_minutes) setIntervalMinutes(current.appointment_interval_minutes);
                if (current?.default_appointment_duration_minutes) setDurationMinutes(current.default_appointment_duration_minutes);
                if (current?.booking_horizon_days) setBookingHorizonDays(current.booking_horizon_days);
                setStaffOwnedSchedule(current?.staff_owned_schedule ?? true);
            } catch {
                // Segue com defaults.
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [tenantId]);

    const toggleDay = (key: string) => {
        setWeek((prev) => {
            if (prev[key]) {
                return { ...prev, [key]: null };
            }
            return { ...prev, [key]: DEFAULT_WEEK[key] ?? { open: '09:00', close: '19:00' } };
        });
    };

    const updateDayTime = (key: string, field: 'open' | 'close', value: string) => {
        setWeek((prev) => {
            const current = prev[key] ?? { open: '09:00', close: '19:00' };
            return { ...prev, [key]: { ...current, [field]: value } };
        });
    };

    const handleSave = async () => {
        if (!tenantId) {
            setError('Tenant não identificado. Faça login novamente.');
            return;
        }

        const businessHours: BusinessHours = {};
        for (const day of DAYS) {
            if (week[day.key]) {
                businessHours[day.key] = week[day.key];
            } else {
                businessHours[day.key] = null;
            }
        }

        setSaving(true);
        setError(null);

        try {
            await completeOnboardingService.saveOperationalStep({
                tenantId,
                businessHours,
                appointmentIntervalMinutes: intervalMinutes,
                defaultAppointmentDurationMinutes: durationMinutes,
                bookingHorizonDays,
                staffOwnedSchedule,
            });

            await completeOnboardingService.complete({
                tenantId,
                phone: settings?.phone ?? '',
                cnpj: settings?.cnpj ?? undefined,
                addressStreet: settings?.address_street ?? undefined,
                addressNumber: settings?.address_number ?? undefined,
                addressCity: settings?.address_city ?? undefined,
                addressState: settings?.address_state ?? undefined,
                addressZip: settings?.address_zip ?? undefined,
                chairCount: settings?.chair_count ?? undefined,
                businessHours,
            });

            // O complete_onboarding ativa o tenant no banco; sem refrescar o
            // contexto, o ProtectedRoute ainda vê status 'draft' e redireciona
            // de volta para o onboarding (regressão stale-draft).
            await refreshTenant();

            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar configurações operacionais');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 relative transition-colors duration-300">
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>

            <button
                onClick={() => navigate('/onboarding/shop-setup')}
                className="absolute top-6 left-6 lg:top-12 lg:left-12 flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-bold z-10"
            >
                <span className="material-symbols-outlined">arrow_back</span> Voltar
            </button>

            <div className="w-full max-w-lg z-10 animate-fade-in py-10">
                <div className="mb-8">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full mb-4">
                        <span className="material-symbols-outlined text-sm">schedule</span>
                        Configurações Operacionais
                    </span>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                        Horários de funcionamento
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                        Ajuste sua agenda inicial. Você pode mudar tudo depois nas configurações.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-lg text-center font-bold mb-5">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-10 text-center text-slate-400 text-sm">
                        Carregando configurações...
                    </div>
                ) : (
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 dark:border-border-dark">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Horário de funcionamento</h2>
                            <p className="text-xs text-slate-400">Toque no dia para abrir/fechar a barbearia.</p>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-border-dark">
                            {DAYS.map((day) => {
                                const isOpen = Boolean(week[day.key]);
                                return (
                                    <div key={day.key} className="flex items-center justify-between gap-3 px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleDay(day.key)}
                                                className={`relative w-11 h-6 rounded-full transition-colors ${
                                                    isOpen ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'
                                                }`}
                                                aria-pressed={isOpen}
                                            >
                                                <span
                                                    className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                                                        isOpen ? 'translate-x-[22px]' : 'translate-x-0.5'
                                                    }`}
                                                />
                                            </button>
                                            <span
                                                className={`text-sm font-bold ${
                                                    isOpen ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                                                }`}
                                            >
                                                {day.label}
                                            </span>
                                        </div>
                                        {isOpen && (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    value={week[day.key]?.open ?? '09:00'}
                                                    onChange={(e) => updateDayTime(day.key, 'open', e.target.value)}
                                                    className="bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                                />
                                                <span className="text-slate-400 text-sm font-bold">às</span>
                                                <input
                                                    type="time"
                                                    value={week[day.key]?.close ?? '19:00'}
                                                    onChange={(e) => updateDayTime(day.key, 'close', e.target.value)}
                                                    className="bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {!loading && (
                    <>
                        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl shadow-sm mt-6 p-5 space-y-5">
                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Intervalo entre horários</p>
                                    <p className="text-xs text-slate-400">Espaço entre um atendimento e outro na agenda.</p>
                                </div>
                                <select
                                    value={intervalMinutes}
                                    onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                                    className="bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none [color-scheme:light] dark:[color-scheme:dark]"
                                >
                                    {INTERVAL_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                                            {opt} min
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Duração padrão dos serviços</p>
                                    <p className="text-xs text-slate-400">Usado quando um serviço não define duração própria.</p>
                                </div>
                                <select
                                    value={durationMinutes}
                                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                                    className="bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none [color-scheme:light] dark:[color-scheme:dark]"
                                >
                                    {DURATION_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                                            {opt} min
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Clientes podem agendar até</p>
                                    <p className="text-xs text-slate-400">Horizonte máximo de agendamento online.</p>
                                </div>
                                <select
                                    value={bookingHorizonDays}
                                    onChange={(e) => setBookingHorizonDays(Number(e.target.value))}
                                    className="bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none [color-scheme:light] dark:[color-scheme:dark]"
                                >
                                    {[15, 30, 60, 90].map((opt) => (
                                        <option key={opt} value={opt} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                                            {opt} dias
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-between gap-6">
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Agenda por barbeiro</p>
                                    <p className="text-xs text-slate-400">Cada barbeiro mantém sua própria agenda de horários.</p>
                                </div>
                                <button
                                    onClick={() => setStaffOwnedSchedule((v) => !v)}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${
                                        staffOwnedSchedule ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'
                                    }`}
                                    aria-pressed={staffOwnedSchedule}
                                >
                                    <span
                                        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                                            staffOwnedSchedule ? 'translate-x-[22px]' : 'translate-x-0.5'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full bg-primary hover:bg-primary-light text-white font-bold py-4 rounded-xl shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
                        >
                            {saving ? 'Finalizando...' : 'Concluir onboarding'}
                            {!saving && <span className="material-symbols-outlined">arrow_forward</span>}
                        </button>
                        <p className="text-center text-[11px] text-slate-400 mt-3">
                            Isso cria sua barbearia ativa e leva você ao painel.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default OperationalSetup;
