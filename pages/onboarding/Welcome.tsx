import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import { completeOnboardingService } from '../../application/onboarding';
import type { TenantSettings } from '../../domain/tenantSettings/types';

const PLAN_LABELS: Record<string, string> = {
    free: 'Plano Free',
    pro: 'Plano Pro',
    elite: 'Plano Elite',
};

const STEP_KEYS = ['company', 'hours', 'services', 'team', 'finish'] as const;
const STEP_LABELS: Record<string, string> = {
    company: 'Empresa',
    hours: 'Horários',
    services: 'Serviços',
    team: 'Equipe',
    finish: 'Finalizar',
};

/**
 * Bloco 1 — Welcome (Fase 6.0.2).
 *
 * Primeira tela após o provisionamento do tenant. Objetivo: celebrar a criação
 * da conta e guiar o usuário até o primeiro valor percebido, deixando claro que
 * o processo é rápido ("Leva menos de 3 minutos").
 *
 * Mostra nome da empresa, plano e o progresso da jornada de onboarding. NÃO
 * configura nada aqui — apenas orienta e navega para o próximo passo.
 */
const Welcome: React.FC = () => {
    const navigate = useNavigate();
    const { tenant, tenantId } = useAuth();
    const [settings, setSettings] = useState<TenantSettings | null>(null);
    const [stepState, setStepState] = useState<Record<string, boolean>>({
        company: false,
        hours: false,
        services: false,
        team: false,
        finish: false,
    });
    const [loading, setLoading] = useState(true);

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
                setStepState({
                    company: Boolean(current?.phone || current?.timezone),
                    hours: Boolean(current?.business_hours),
                    services: false,
                    team: false,
                    finish: false,
                });
            } catch {
                // Segue com estado vazio — o welcome não deve bloquear o fluxo.
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [tenantId]);

    const doneCount = Object.values(stepState).filter(Boolean).length;
    const percent = Math.round((doneCount / STEP_KEYS.length) * 100);
    const planLabel = PLAN_LABELS[tenant?.plan ?? 'free'] ?? 'Plano Free';

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-lg z-10 animate-fade-in">
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
                    <header className="mb-6 flex items-center justify-between">
                        <Logo size="sm" />
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                            <span className="material-symbols-outlined text-sm">workspace_premium</span>
                            {planLabel}
                        </span>
                    </header>

                    <div className="size-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-3xl">celebration</span>
                    </div>

                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                        Bem-vindo ao SMG Barber!
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-2">
                        Sua conta foi criada com sucesso.
                    </p>
                    <p className="text-slate-900 dark:text-white text-lg font-bold mb-6">
                        Vamos configurar a {tenant?.name ?? 'sua barbearia'}.
                    </p>
                    <p className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full mb-8">
                        <span className="material-symbols-outlined text-sm">bolt</span>
                        Leva menos de 3 minutos.
                    </p>

                    <div className="bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-2xl p-5 mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Progresso</span>
                            <span className="text-xs font-black text-primary">{percent}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 dark:bg-white/10 rounded-full mb-5 overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                        <ul className="space-y-2.5">
                            {STEP_KEYS.map((key) => (
                                <li key={key} className="flex items-center gap-2.5 text-sm">
                                    <span
                                        className={`size-5 rounded-full flex items-center justify-center text-[11px] transition-colors ${
                                            stepState[key]
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-slate-200 dark:bg-white/10 text-slate-400'
                                        }`}
                                    >
                                        {stepState[key] ? (
                                            <span className="material-symbols-outlined text-[13px]">check</span>
                                        ) : (
                                            <span className="material-symbols-outlined text-[13px]">square</span>
                                        )}
                                    </span>
                                    <span
                                        className={`font-semibold ${
                                            stepState[key] ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                    >
                                        {STEP_LABELS[key]}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <button
                        onClick={() => navigate('/onboarding/shop-setup')}
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary-light text-white font-bold py-4 rounded-xl shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {settings?.phone ? 'Continuar configuração' : 'Começar'}
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Welcome;
