import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { completeOnboardingService } from '../../application/onboarding';
import { serviceRepository } from '../../domain/service/repository';
import type { TenantSettings, BusinessHours } from '../../domain/tenantSettings/types';
import ShopDetailsStep, { type ShopDetailsForm } from './steps/ShopDetailsStep';
import ServiceCatalogStep, {
    DAYS,
    DEFAULT_WEEK,
    createDefaultServiceRows,
    type OperationalForm,
    type ServiceRow,
} from './steps/ServiceCatalogStep';
import PublishStep, {
    type PublishSummary,
    type PublishVisibility,
} from './steps/PublishStep';

type WizardStep = 1 | 2 | 3;

const STEP_COPY: Record<WizardStep, { title: string; subtitle: string }> = {
    1: { title: 'Sua Barbearia', subtitle: 'Preencha as informações do seu negócio.' },
    2: { title: 'Como você atende', subtitle: 'Defina horários e o catálogo inicial de serviços.' },
    3: { title: 'Publicação', subtitle: 'Revise os dados e escolha como publicar.' },
};

/**
 * Onboarding — wizard de 3 passos (Fase 6.0.2, reestruturação).
 *
 * Passo 1 "Sua Barbearia": dados da empresa + endereço + regional.
 * Passo 2 "Como você atende": horário de funcionamento + catálogo inicial.
 * Passo 3 "Publicação": resumo + visibilidade (Público/Rascunho).
 *
 * Todo o estado do formulário vive neste shell para que "Voltar" entre os
 * passos nunca perca dados digitados. A persistência progressiva acontece em
 * saveCompanyStep (passo 1), saveOperationalStep + ensureInitialCatalog
 * (passo 2) e complete (passo 3, caminho Público).
 */
const ShopSetup: React.FC = () => {
    const navigate = useNavigate();
    const { tenantId, tenant, tenantSlug, refreshTenant } = useAuth();
    const [step, setStep] = useState<WizardStep>(1);
    const [settings, setSettings] = useState<TenantSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Company data (Step 1)
    const [shopForm, setShopForm] = useState<ShopDetailsForm>({
        phone: '',
        cnpj: '',
        addressZip: '',
        addressStreet: '',
        addressNumber: '',
        addressCity: '',
        addressState: '',
        chairCount: 2,
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
    });

    // Operational + catalog data (Step 2)
    const [operational, setOperational] = useState<OperationalForm>({
        week: DEFAULT_WEEK,
        intervalMinutes: 30,
        durationMinutes: 60,
        bookingHorizonDays: 30,
        staffOwnedSchedule: true,
    });
    const [serviceRows, setServiceRows] = useState<ServiceRow[]>(() => createDefaultServiceRows());
    const [servicesLoading, setServicesLoading] = useState(true);
    const [existingServicesCount, setExistingServicesCount] = useState(0);

    // Visibility (Step 3)
    const [visibility, setVisibility] = useState<PublishVisibility>('public');

    // Resume — empresa + operacional. Mantém a proteção de corrida do
    // ShopSetup original: os functional updaters só preenchem campos que ainda
    // estão no valor inicial, então um fetch que resolve depois do usuário
    // digitar não apaga o telefone digitado em tenants recém-provisionados
    // (tenant_settings.phone ainda NULL).
    useEffect(() => {
        if (!tenantId) return;
        let cancelled = false;
        void (async () => {
            try {
                const current = await completeOnboardingService.getSettings(tenantId);
                if (cancelled || !current) return;
                setSettings(current);
                // Functional updaters: só preenchem campos que ainda estão no
                // valor inicial. Se o usuário já digitou (fetch resolveu
                // depois), o valor digitado é preservado — evita o race que
                // apagava o telefone digitado em tenants recém-provisionados
                // (tenant_settings.phone ainda NULL).
                setShopForm((prev) => ({
                    ...prev,
                    phone: prev.phone === '' ? (current.phone ?? '') : prev.phone,
                    cnpj: prev.cnpj === '' ? (current.cnpj ?? '') : prev.cnpj,
                    addressZip: prev.addressZip === '' ? (current.address_zip ?? '') : prev.addressZip,
                    addressStreet: prev.addressStreet === '' ? (current.address_street ?? '') : prev.addressStreet,
                    addressNumber: prev.addressNumber === '' ? (current.address_number ?? '') : prev.addressNumber,
                    addressCity: prev.addressCity === '' ? (current.address_city ?? '') : prev.addressCity,
                    addressState: prev.addressState === '' ? (current.address_state ?? '') : prev.addressState,
                    chairCount: prev.chairCount === 2 ? (current.chair_count ?? 2) : prev.chairCount,
                    timezone: prev.timezone === 'America/Sao_Paulo' ? (current.timezone || 'America/Sao_Paulo') : prev.timezone,
                    currency: prev.currency === 'BRL' ? (current.currency || 'BRL') : prev.currency,
                }));
                setOperational((prev) => ({
                    ...prev,
                    week: current.business_hours ? { ...DEFAULT_WEEK, ...current.business_hours } : prev.week,
                    intervalMinutes: current.appointment_interval_minutes ?? prev.intervalMinutes,
                    durationMinutes: current.default_appointment_duration_minutes ?? prev.durationMinutes,
                    bookingHorizonDays: current.booking_horizon_days ?? prev.bookingHorizonDays,
                    staffOwnedSchedule: current.staff_owned_schedule ?? prev.staffOwnedSchedule,
                }));
            } catch {
                // Segue com campos vazios — o prefill é otimização, não requisito.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [tenantId]);

    // Resume — catálogo existente (decide entre o editor e o aviso "já está
    // no ar"; a contagem também gate do seed idempotente no passo 2).
    useEffect(() => {
        if (!tenantId) {
            setServicesLoading(false);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const services = await serviceRepository.list(tenantId);
                if (!cancelled) setExistingServicesCount(services.length);
            } catch {
                // Sem catálogo conhecido seguimos com o editor (contagem 0).
            } finally {
                if (!cancelled) setServicesLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [tenantId]);

    const handleBack = () => {
        setError(null);
        if (step === 1) {
            navigate('/onboarding/welcome');
            return;
        }
        setStep((prev) => (prev === 3 ? 2 : 1));
    };

    const buildBusinessHours = (): BusinessHours => {
        const businessHours: BusinessHours = {};
        for (const day of DAYS) {
            businessHours[day.key] = operational.week[day.key] ?? null;
        }
        return businessHours;
    };

    const handleShopContinue = async () => {
        if (!tenantId) {
            setError('Tenant não identificado. Faça login novamente.');
            return;
        }
        if (!shopForm.phone.trim()) {
            setError('Informe o telefone / WhatsApp da barbearia.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await completeOnboardingService.saveCompanyStep({
                tenantId,
                phone: shopForm.phone.trim(),
                cnpj: shopForm.cnpj.trim() || undefined,
                addressStreet: shopForm.addressStreet.trim() || undefined,
                addressNumber: shopForm.addressNumber.trim() || undefined,
                addressCity: shopForm.addressCity.trim() || undefined,
                addressState: shopForm.addressState.trim() || undefined,
                addressZip: shopForm.addressZip.trim() || undefined,
                timezone: shopForm.timezone,
                currency: shopForm.currency,
            });

            // Relê o registro persistido: o passo 3 (complete) reutiliza o
            // payload a partir de settings, exatamente como o OperationalSetup
            // original relia ao remontar. Sem o refetch, o telefone recém-salvo
            // ficaria ausente no payload em tenant novo.
            const refreshed = await completeOnboardingService.getSettings(tenantId);
            if (refreshed) setSettings(refreshed);

            setStep(2);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar dados da empresa');
        } finally {
            setLoading(false);
        }
    };

    const handleCatalogContinue = async () => {
        if (!tenantId) {
            setError('Tenant não identificado. Faça login novamente.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await completeOnboardingService.saveOperationalStep({
                tenantId,
                businessHours: buildBusinessHours(),
                appointmentIntervalMinutes: operational.intervalMinutes,
                defaultAppointmentDurationMinutes: operational.durationMinutes,
                bookingHorizonDays: operational.bookingHorizonDays,
                staffOwnedSchedule: operational.staffOwnedSchedule,
            });

            // Semeia o catálogo só quando o tenant ainda não tinha serviços (é
            // o caso em que o passo 2 mostra o editor). ensureInitialCatalog
            // reconfere a contagem no servidor e é idempotente.
            if (existingServicesCount === 0) {
                await completeOnboardingService.ensureInitialCatalog({
                    tenantId,
                    services: serviceRows
                        .map((row) => ({
                            name: row.name.trim(),
                            category: row.category,
                            price: Number(row.price),
                            duration: Number(row.duration),
                        }))
                        .filter((row) => row.name !== '' && Number.isFinite(row.price) && Number.isFinite(row.duration)),
                });
            }

            setStep(3);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao salvar configurações operacionais');
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        if (!tenantId) {
            setError('Tenant não identificado. Faça login novamente.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
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
                businessHours: buildBusinessHours(),
            });

            // O complete_onboarding ativa o tenant no banco; sem refrescar o
            // contexto, o ProtectedRoute ainda vê status 'draft' e redireciona
            // de volta para o onboarding (regressão stale-draft).
            await refreshTenant();

            navigate('/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao finalizar onboarding');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDraft = () => {
        setError(null);
        // O tenant permanece 'draft' (complete_onboarding não é chamado). O
        // AuthorizationService resolve o nível 'onboarding' e redireciona
        // qualquer rota fora do onboarding de volta para /onboarding/welcome —
        // inclusive /dashboard. Enviamos direto para o welcome, onde o usuário
        // pode retomar de onde parou.
        navigate('/onboarding/welcome');
    };

    const summary: PublishSummary = useMemo(
        () => ({
            shopName: tenant?.name ?? '',
            publicLink: `${window.location.origin}/#/c/${tenantSlug ?? ''}`,
            phone: shopForm.phone,
            address: [
                shopForm.addressStreet,
                shopForm.addressNumber,
                shopForm.addressCity,
                shopForm.addressState,
            ]
                .filter((part) => part.trim() !== '')
                .join(', '),
            chairCount: shopForm.chairCount,
            timezone: shopForm.timezone,
            services: serviceRows
                .filter((row) => row.name.trim() !== '')
                .map((row) => ({
                    name: row.name.trim(),
                    price: Number(row.price) || 0,
                    duration: Number(row.duration) || 0,
                })),
            businessHours: DAYS.flatMap((day) => {
                const hours = operational.week[day.key];
                return hours ? [{ label: day.label, open: hours.open, close: hours.close }] : [];
            }),
        }),
        [tenant?.name, tenantSlug, shopForm, operational.week, serviceRows],
    );

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col lg:flex-row">
            <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2074&auto=format&fit=crop')] bg-cover bg-center opacity-40"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent"></div>
                <div className="relative z-10 p-12 max-w-lg">
                    <div className="inline-flex items-center gap-2 mb-6 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                        <span className="material-symbols-outlined text-emerald-400 text-sm">rocket_launch</span>
                        <span className="text-sm font-bold text-white tracking-wide">PASSO {step} DE 3</span>
                    </div>
                    <h2 className="text-5xl font-black text-white tracking-tight leading-tight mb-6">
                        Leve sua barbearia para o próximo nível.
                    </h2>
                    <p className="text-slate-300 text-lg leading-relaxed">
                        Configure seu ambiente de trabalho digital e comece a ter controle total sobre seu faturamento e equipe em poucos minutos.
                    </p>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative">
                <button
                    onClick={handleBack}
                    className="absolute top-6 left-6 lg:top-12 lg:left-12 flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-bold"
                >
                    <span className="material-symbols-outlined">arrow_back</span> Voltar
                </button>

                <div className="w-full max-w-lg animate-fade-in">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
                            {STEP_COPY[step].title}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">{STEP_COPY[step].subtitle}</p>
                    </div>

                    {error && step !== 3 && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-lg text-center font-bold mb-5">
                            {error}
                        </div>
                    )}

                    <div key={step} className="animate-fade-in">
                        {step === 1 && (
                            <ShopDetailsStep
                                shopName={tenant?.name ?? ''}
                                tenantSlug={tenantSlug}
                                form={shopForm}
                                onChange={(patch) => setShopForm((prev) => ({ ...prev, ...patch }))}
                                onContinue={handleShopContinue}
                                loading={loading}
                            />
                        )}

                        {step === 2 && (
                            <ServiceCatalogStep
                                operational={operational}
                                onOperationalChange={(patch) => setOperational((prev) => ({ ...prev, ...patch }))}
                                onToggleDay={(key) => setOperational((prev) => ({
                                    ...prev,
                                    week: {
                                        ...prev.week,
                                        [key]: prev.week[key]
                                            ? null
                                            : (DEFAULT_WEEK[key] ?? { open: '09:00', close: '19:00' }),
                                    },
                                }))}
                                onUpdateDayTime={(key, field, value) => setOperational((prev) => {
                                    const current = prev.week[key] ?? { open: '09:00', close: '19:00' };
                                    return { ...prev, week: { ...prev.week, [key]: { ...current, [field]: value } } };
                                })}
                                servicesLoading={servicesLoading}
                                existingServicesCount={existingServicesCount}
                                serviceRows={serviceRows}
                                onRowsChange={setServiceRows}
                                onAddRow={() => setServiceRows((prev) => [
                                    ...prev,
                                    { key: `custom-${prev.length}-${Date.now()}`, name: '', category: 'Cabelo', price: '', duration: '30' },
                                ])}
                                onRemoveRow={(key) => setServiceRows((prev) => prev.filter((row) => row.key !== key))}
                                onContinue={handleCatalogContinue}
                                loading={loading}
                            />
                        )}

                        {step === 3 && (
                            <PublishStep
                                summary={summary}
                                tenantStatus={tenant?.status ?? null}
                                visibility={visibility}
                                onVisibilityChange={setVisibility}
                                onPublish={handlePublish}
                                onSaveDraft={handleSaveDraft}
                                loading={loading}
                                error={error}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShopSetup;
