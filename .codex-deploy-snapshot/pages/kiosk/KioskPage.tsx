import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { KioskThemeProvider, KioskTheme } from './KioskThemeProvider';
import { useKioskTheme } from './KioskThemeProvider';
import KioskIdentify from './components/KioskIdentify';
import KioskSchedule from './components/KioskSchedule';
import KioskBarberFeedback from './components/KioskBarberFeedback';
import KioskShopFeedback from './components/KioskShopFeedback';
import KioskQRBlock from './components/KioskQRBlock';

type KioskView = 'home' | 'identify' | 'schedule' | 'barber_feedback' | 'shop_feedback';

interface TenantInfo {
    id: string;
    slug: string;
    name: string;
    theme: KioskTheme;
    logo_url?: string;
    ambient_images?: string[];
}

interface Client { id: string; name: string; phone: string; }

const KioskInner: React.FC<{ tenant: TenantInfo; timeout: number }> = ({ tenant, timeout }) => {
    const { theme } = useKioskTheme();
    const [view, setView] = useState<KioskView>('home');
    const [pendingView, setPendingView] = useState<KioskView | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [sessionId, setSessionId] = useState<string | undefined>(undefined);
    const [countdown, setCountdown] = useState(timeout);
    const [showAmbient, setShowAmbient] = useState(false);
    const [currentImageIdx, setCurrentImageIdx] = useState(0);

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const ambientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isSanchez = theme.name === 'sanchez';

    const resetToHome = useCallback(() => {
        setView('home');
        setClient(null);
        setSessionId(undefined);
        setPendingView(null);
        setCountdown(timeout);
        setShowAmbient(false);
    }, [timeout]);

    // Ambient Mode Logic (Screensaver)
    useEffect(() => {
        if (view !== 'home') {
            setShowAmbient(false);
            if (ambientTimerRef.current) clearTimeout(ambientTimerRef.current);
            return;
        }

        const startAmbient = () => {
            if (tenant.ambient_images && tenant.ambient_images.length > 0) {
                setShowAmbient(true);
            }
        };

        // If idle for 15 seconds on home screen, show ambient mode
        ambientTimerRef.current = setTimeout(startAmbient, 15000);

        return () => {
            if (ambientTimerRef.current) clearTimeout(ambientTimerRef.current);
        };
    }, [view, tenant.ambient_images]);

    // Auto-cycle images
    useEffect(() => {
        if (!showAmbient || !tenant.ambient_images || tenant.ambient_images.length === 0) {
            if (autoCycleRef.current) clearInterval(autoCycleRef.current);
            return;
        }

        autoCycleRef.current = setInterval(() => {
            setCurrentImageIdx(prev => (prev + 1) % tenant.ambient_images!.length);
        }, 8000); // 8 seconds per photo

        return () => {
            if (autoCycleRef.current) clearInterval(autoCycleRef.current);
        };
    }, [showAmbient, tenant.ambient_images]);

    // Auto-reset timer for active views
    useEffect(() => {
        if (view === 'home') { setCountdown(timeout); return; }

        setCountdown(timeout);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (countRef.current) clearInterval(countRef.current);

        timerRef.current = setTimeout(resetToHome, timeout * 1000);
        countRef.current = setInterval(() => setCountdown(c => c <= 1 ? timeout : c - 1), 1000);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (countRef.current) clearInterval(countRef.current);
        };
    }, [view, timeout, resetToHome]);

    const handleActivity = () => {
        if (showAmbient) {
            setShowAmbient(false);
            return;
        }
        if (view === 'home') return;
        setCountdown(timeout);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (countRef.current) clearInterval(countRef.current);
        timerRef.current = setTimeout(resetToHome, timeout * 1000);
        countRef.current = setInterval(() => setCountdown(c => c <= 1 ? timeout : c - 1), 1000);
    };

    const createSession = async (channel: 'totem' | 'qr') => {
        try {
            const { data } = await supabase.from('kiosk_sessions').insert({
                tenant_id: tenant.id,
                channel,
                status: 'initiated',
                user_agent: navigator.userAgent.slice(0, 200),
            }).select('id').single();
            if (data) setSessionId(data.id);
        } catch { /* silent */ }
    };

    const handleMenuChoice = (next: KioskView) => {
        setPendingView(next);
        createSession('totem');
        setView('identify');
    };

    const handleIdentified = (c: Client) => {
        setClient(c);
        setView(pendingView || 'schedule');
    };

    const handleComplete = () => resetToHome();

    const homeButtons = [
        {
            id: 'schedule',
            icon: 'calendar_month',
            label: isSanchez ? 'Novo Agendamento' : 'Agendar Próximo',
            sub: 'Escolha data e barbeiro',
            target: 'schedule' as KioskView,
            color: '#6366f1'
        },
        {
            id: 'barber',
            icon: 'star',
            label: isSanchez ? 'Avaliar o Time' : 'Avaliar Corte',
            sub: 'Nota para seu barbeiro',
            target: 'barber_feedback' as KioskView,
            color: '#fbbf24'
        },
        {
            id: 'shop',
            icon: 'bar_chart',
            label: isSanchez ? 'Pesquisa Sanchez' : 'Voz do Cliente',
            sub: 'Melhorias e sugestões',
            target: 'shop_feedback' as KioskView,
            color: '#10b981'
        },
    ];

    return (
        <div
            onClick={handleActivity}
            style={{
                minHeight: '100vh',
                background: theme.bg,
                display: 'flex',
                flexDirection: 'column',
                fontFamily: theme.fontBody,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* AMBIENT MODE OVERLAY */}
            {showAmbient && tenant.ambient_images && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        backgroundColor: '#000',
                        animation: 'fadeIn 2s ease'
                    }}
                >
                    {tenant.ambient_images.map((img, idx) => (
                        <div
                            key={idx}
                            style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundImage: `url(${img})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                opacity: currentImageIdx === idx ? 1 : 0,
                                transition: 'opacity 3s ease-in-out',
                                transform: currentImageIdx === idx ? 'scale(1.05)' : 'scale(1)',
                                filter: 'brightness(0.5) contrast(1.1)'
                            }}
                        />
                    ))}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.8) 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1001
                    }}>
                        {tenant.logo_url && (
                            <img
                                src={tenant.logo_url}
                                alt="Logo"
                                style={{
                                    maxHeight: '20vh',
                                    maxWidth: '80%',
                                    marginBottom: '40px',
                                    filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.3))',
                                    animation: 'pulse 4s infinite alternate ease-in-out'
                                }}
                            />
                        )}
                        <h2 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '8px', opacity: 0.8 }}>
                            {tenant.name}
                        </h2>
                        <div style={{ position: 'absolute', bottom: '60px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20">
                                <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem' }}>TOQUE NA TELA PARA COMEÇAR</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '24px 48px',
                borderBottom: `1px solid ${theme.border}`,
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(20px)',
                zIndex: 10,
                position: 'relative',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {tenant.logo_url ? (
                        <img src={tenant.logo_url} alt="Logo" style={{ height: '48px', objectFit: 'contain' }} />
                    ) : (
                        <div style={{ width: '48px', height: '48px', borderRadius: '15px', background: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-symbols-outlined text-white">content_cut</span>
                        </div>
                    )}
                    <div>
                        <p style={{ color: '#fff', fontSize: '20px', fontWeight: 900, margin: 0, tracking: '-1px' }}>
                            {tenant.name}
                        </p>
                        <p style={{ color: theme.textSub, fontSize: '11px', margin: 0, letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.6 }}>
                            {isSanchez ? 'TOTEM ORIGINAL SANCHEZ' : 'POSTO DE AUTOATENDIMENTO'}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ color: '#fff', fontSize: '24px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {view !== 'home' && (
                        <div style={{ background: theme.primary, borderRadius: '12px', padding: '6px 14px', color: '#fff', fontSize: '14px', fontWeight: 800 }}>
                            RETORNO EM {countdown}s
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main style={{ flex: 1, display: 'flex', zIndex: 1, position: 'relative' }}>
                {view === 'home' && (
                    <div style={{ width: '100%', display: 'flex', minHeight: 'calc(100vh - 100px)' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
                            <h1 style={{
                                color: '#fff',
                                fontSize: 'clamp(40px, 6vw, 72px)',
                                fontWeight: 900,
                                textAlign: 'center',
                                marginBottom: '16px',
                                letterSpacing: '-2px',
                                lineHeight: 0.9,
                            }}>
                                {isSanchez ? 'E aí, Chefe?' : 'Bom dia! 👋'}
                            </h1>
                            <p style={{ color: theme.textSub, fontSize: '1.2rem', textAlign: 'center', marginBottom: '64px', opacity: 0.8 }}>
                                O que vamos fazer hoje?
                            </p>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '32px',
                                width: '100%',
                                maxWidth: '1000px',
                            }}>
                                {homeButtons.map(btn => (
                                    <button
                                        key={btn.id}
                                        onClick={() => handleMenuChoice(btn.target)}
                                        className="kiosk-card-interactive"
                                        style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: `2px solid rgba(255,255,255,0.08)`,
                                            borderRadius: '40px',
                                            padding: '60px 24px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '24px',
                                            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                            backdropFilter: 'blur(30px)',
                                        }}
                                    >
                                        <div style={{
                                            width: '100px',
                                            height: '100px',
                                            borderRadius: '35px',
                                            background: `linear-gradient(135deg, ${btn.color}, ${btn.color}88)`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: `0 20px 40px ${btn.color}33`
                                        }}>
                                            <span className="material-symbols-outlined text-white text-5xl">{btn.icon}</span>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <h3 style={{ color: '#fff', fontSize: '22px', fontWeight: 900, marginBottom: '8px', textTransform: 'uppercase' }}>{btn.label}</h3>
                                            <p style={{ color: theme.textMuted, fontSize: '13px' }}>{btn.sub}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Identify */}
                {view === 'identify' && (
                    <div style={{ width: '100%', background: '#000' }}>
                        <div style={{ padding: '24px 48px' }}>
                            <button onClick={resetToHome} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '12px 24px', borderRadius: '15px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span className="material-symbols-outlined">arrow_back</span>
                                Voltar ao Início
                            </button>
                        </div>
                        <KioskIdentify tenantId={tenant.id} onIdentified={handleIdentified} />
                    </div>
                )}

                {/* Outras Views seguem o mesmo padrão cinemático */}
                {view === 'schedule' && client && (
                    <div style={{ width: '100%', background: '#000' }}>
                        <KioskSchedule tenantId={tenant.id} client={client} channel="totem" sessionId={sessionId} onComplete={handleComplete} onBack={resetToHome} />
                    </div>
                )}

                {view === 'barber_feedback' && client && (
                    <div style={{ width: '100%', background: '#000' }}>
                        <KioskBarberFeedback tenantId={tenant.id} client={client} channel="totem" sessionId={sessionId} onComplete={handleComplete} onBack={resetToHome} />
                    </div>
                )}

                {view === 'shop_feedback' && client && (
                    <div style={{ width: '100%', background: '#000' }}>
                        <KioskShopFeedback tenantId={tenant.id} client={client} channel="totem" sessionId={sessionId} onComplete={handleComplete} onBack={resetToHome} />
                    </div>
                )}
            </main>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');
                
                body { overflow: hidden; background: #000; }
                
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes pulse { from { transform: scale(1); opacity: 0.9; } to { transform: scale(1.05); opacity: 1; } }
                
                .kiosk-card-interactive:hover {
                    background: rgba(255,255,255,0.08) !important;
                    border-color: rgba(255,255,255,0.3) !important;
                    transform: translateY(-10px) scale(1.02);
                    box-shadow: 0 40px 80px rgba(0,0,0,0.5);
                }

                .kiosk-card-interactive:active {
                    transform: scale(0.95);
                }
            `}</style>
        </div>
    );
};

const KioskPage: React.FC = () => {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const [tenant, setTenant] = useState<TenantInfo | null>(null);
    const [addonEnabled, setAddonEnabled] = useState<boolean | null>(null);
    const [timeout, setTimeout_] = useState(60); // Default to 60s
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!tenantSlug) { setError('Slug não informado.'); setLoading(false); return; }
        loadTenant();
    }, [tenantSlug]);

    const loadTenant = async () => {
        try {
            const { data: tenantData } = await supabase
                .from('tenants')
                .select('id, name, slug')
                .or(`slug.eq.${tenantSlug},id.eq.${tenantSlug}`)
                .single();

            if (!tenantData) {
                setError(`Barbearia não encontrada.`);
                setLoading(false);
                return;
            }

            const { data: addon } = await supabase
                .from('tenant_addons')
                .select('status, limits')
                .eq('tenant_id', tenantData.id)
                .eq('addon_key', 'TOTEM_QR')
                .single();

            if (!addon || addon.status !== 'enabled') {
                setAddonEnabled(false);
                setLoading(false);
                return;
            }

            setAddonEnabled(true);
            const limits = addon.limits || {};
            if (limits.timeout_seconds) setTimeout_(limits.timeout_seconds);

            setTenant({
                id: tenantData.id,
                slug: tenantData.slug || '',
                name: tenantData.name || '',
                theme: (limits.theme as KioskTheme) || 'default',
                logo_url: limits.logo_url,
                ambient_images: limits.ambient_images
            });
        } catch (e) {
            setError('Erro ao carregar configurações do totem.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '32px' }}>
            <div style={{
                width: '60px', height: '60px',
                border: '4px solid rgba(255,255,255,0.1)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite'
            }} />
            <p style={{ color: '#64748b', fontSize: '14px', letterSpacing: '4px', fontWeight: 900 }}>SOU MANA.GER</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (error || addonEnabled === false) return (
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '24px', textAlign: 'center', padding: '40px' }}>
            <span style={{ fontSize: '80px', marginBottom: '20px' }}>🔐</span>
            <p style={{ color: '#fff', fontSize: '32px', fontWeight: 900, tracking: '-1px' }}>TOTEM NÃO HABILITADO</p>
            <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '400px' }}>{error || 'O módulo de autoatendimento precisa ser ativado no painel administrativo.'}</p>
        </div>
    );

    if (!tenant) return null;

    return (
        <KioskThemeProvider themeName={tenant.theme}>
            <KioskInner tenant={tenant} timeout={timeout} />
        </KioskThemeProvider>
    );
};

export default KioskPage;
