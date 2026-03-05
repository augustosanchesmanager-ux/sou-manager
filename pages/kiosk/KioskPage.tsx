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
}

interface Client { id: string; name: string; phone: string; }

// ──────────────────────────────────────────────
// Inner component (has access to theme context)
// ──────────────────────────────────────────────
const KioskInner: React.FC<{ tenant: TenantInfo; timeout: number }> = ({ tenant, timeout }) => {
    const { theme } = useKioskTheme();
    const [view, setView] = useState<KioskView>('home');
    const [pendingView, setPendingView] = useState<KioskView | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [sessionId, setSessionId] = useState<string | undefined>(undefined);
    const [countdown, setCountdown] = useState(timeout);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isSanchez = theme.name === 'sanchez';

    const resetToHome = useCallback(() => {
        setView('home');
        setClient(null);
        setSessionId(undefined);
        setPendingView(null);
        setCountdown(timeout);
    }, [timeout]);

    // Auto-reset timer
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

    // Reset timer on any click
    const handleActivity = () => {
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
            icon: '📅',
            label: isSanchez ? 'Agendar próximo atendimento' : 'Agendar próximo horário',
            sub: isSanchez ? 'Escolha data, hora e barbeiro' : 'Rápido e fácil',
            target: 'schedule' as KioskView,
        },
        {
            id: 'barber',
            icon: '⭐',
            label: isSanchez ? 'Avaliar seu barbeiro' : 'Avaliar atendimento',
            sub: 'Dê sua nota e comentário',
            target: 'barber_feedback' as KioskView,
        },
        {
            id: 'shop',
            icon: '📊',
            label: isSanchez ? 'Avaliar a Sanchez Barber' : 'Avaliar a barbearia',
            sub: 'Pesquisa de satisfação',
            target: 'shop_feedback' as KioskView,
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
            {/* Decorative background glow */}
            <div style={{
                position: 'absolute',
                top: '-200px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '600px',
                height: '600px',
                background: `radial-gradient(circle, ${theme.primary}22 0%, transparent 70%)`,
                pointerEvents: 'none',
                zIndex: 0,
            }} />

            {/* Header */}
            <header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 40px',
                borderBottom: `1px solid ${theme.border}`,
                background: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(12px)',
                zIndex: 10,
                position: 'relative',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '12px',
                        background: theme.primaryLight,
                        border: `1px solid ${theme.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '22px',
                    }}>✂️</div>
                    <div>
                        <p style={{ color: theme.textMain, fontFamily: theme.fontHeading, fontWeight: 700, fontSize: '18px', margin: 0 }}>
                            {tenant.name || (isSanchez ? 'Sanchez Barber' : 'Barbearia')}
                        </p>
                        <p style={{ color: theme.textMuted, fontSize: '11px', margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>
                            {isSanchez ? 'Totem do Chefe' : 'Autoatendimento'}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {view !== 'home' && (
                        <div style={{
                            background: theme.primaryLight,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '10px',
                            padding: '6px 12px',
                            color: theme.textSub,
                            fontSize: '13px',
                            fontWeight: 600,
                        }}>
                            ⏱ {countdown}s
                        </div>
                    )}
                    <div style={{
                        background: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: '10px',
                        padding: '6px 12px',
                        display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }} />
                        <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 600 }}>Online</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ flex: 1, display: 'flex', zIndex: 1, position: 'relative' }}>
                {view === 'home' && (
                    <div style={{ width: '100%', display: 'flex', gap: '0', minHeight: 'calc(100vh - 85px)' }}>
                        {/* Left: Main Actions */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 48px' }}>
                            <h1 style={{
                                color: theme.textMain,
                                fontFamily: theme.fontHeading,
                                fontSize: 'clamp(28px, 4vw, 48px)',
                                fontWeight: 800,
                                textAlign: 'center',
                                marginBottom: '8px',
                                lineHeight: 1.2,
                            }}>
                                {isSanchez ? '👋 Bem-vindo, Chefe.' : 'Olá! O que deseja fazer?'}
                            </h1>
                            <p style={{
                                color: theme.textSub,
                                fontSize: 'clamp(14px, 1.5vw, 18px)',
                                textAlign: 'center',
                                marginBottom: '48px',
                            }}>
                                {isSanchez
                                    ? 'Aqui todo cliente é tratado como Chefe.'
                                    : 'Selecione uma opção abaixo para começar.'}
                            </p>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: '20px',
                                width: '100%',
                                maxWidth: '800px',
                            }}>
                                {homeButtons.map(btn => (
                                    <button
                                        key={btn.id}
                                        id={`kiosk-btn-${btn.id}`}
                                        onClick={() => handleMenuChoice(btn.target)}
                                        style={{
                                            background: theme.bgCard,
                                            border: `1.5px solid ${theme.border}`,
                                            borderRadius: '24px',
                                            padding: 'clamp(24px, 3vw, 40px) 20px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '12px',
                                            transition: 'all 0.25s',
                                            backdropFilter: 'blur(16px)',
                                        }}
                                        onMouseEnter={e => {
                                            const t = e.currentTarget;
                                            t.style.background = theme.bgCardHover;
                                            t.style.border = `1.5px solid ${theme.primary}`;
                                            t.style.transform = 'translateY(-4px)';
                                            t.style.boxShadow = theme.primaryGlow;
                                        }}
                                        onMouseLeave={e => {
                                            const t = e.currentTarget;
                                            t.style.background = theme.bgCard;
                                            t.style.border = `1.5px solid ${theme.border}`;
                                            t.style.transform = 'translateY(0)';
                                            t.style.boxShadow = 'none';
                                        }}
                                    >
                                        <span style={{ fontSize: 'clamp(40px, 5vw, 64px)', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }}>
                                            {btn.icon}
                                        </span>
                                        <span style={{
                                            color: theme.textMain,
                                            fontFamily: theme.fontHeading,
                                            fontWeight: 700,
                                            fontSize: 'clamp(14px, 1.5vw, 18px)',
                                            textAlign: 'center',
                                            lineHeight: 1.3,
                                        }}>
                                            {btn.label}
                                        </span>
                                        <span style={{
                                            color: theme.textMuted,
                                            fontSize: '12px',
                                            textAlign: 'center',
                                        }}>
                                            {btn.sub}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right: QR Sidebar */}
                        <div style={{
                            width: '260px',
                            borderLeft: `1px solid ${theme.border}`,
                            background: 'rgba(0,0,0,0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '24px 20px',
                            gap: '16px',
                        }}>
                            <div style={{
                                width: '100%',
                                background: theme.primaryLight,
                                border: `1px solid ${theme.border}`,
                                borderRadius: '14px',
                                padding: '12px',
                                textAlign: 'center',
                            }}>
                                <p style={{ color: theme.textSub, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 4px' }}>
                                    📱 Plano B
                                </p>
                                <p style={{ color: theme.textMuted, fontSize: '11px', margin: 0 }}>
                                    Prefere usar seu celular?
                                </p>
                            </div>
                            <KioskQRBlock tenantSlug={tenant.slug} compact />
                        </div>
                    </div>
                )}

                {/* Identify */}
                {view === 'identify' && (
                    <div style={{ width: '100%' }}>
                        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${theme.border}` }}>
                            <button
                                onClick={resetToHome}
                                style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                ← Voltar ao início
                            </button>
                        </div>
                        <KioskIdentify tenantId={tenant.id} onIdentified={handleIdentified} />
                    </div>
                )}

                {/* Schedule */}
                {view === 'schedule' && client && (
                    <div style={{ width: '100%' }}>
                        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${theme.border}` }}>
                            <p style={{ color: theme.textSub, fontSize: '13px', margin: 0 }}>
                                Olá, <strong style={{ color: theme.primary }}>{client.name.split(' ')[0]}</strong>! Vamos agendar 📅
                            </p>
                        </div>
                        <KioskSchedule
                            tenantId={tenant.id}
                            client={client}
                            channel="totem"
                            sessionId={sessionId}
                            onComplete={handleComplete}
                            onBack={resetToHome}
                        />
                    </div>
                )}

                {/* Barber Feedback */}
                {view === 'barber_feedback' && client && (
                    <div style={{ width: '100%' }}>
                        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${theme.border}` }}>
                            <p style={{ color: theme.textSub, fontSize: '13px', margin: 0 }}>
                                Olá, <strong style={{ color: theme.primary }}>{client.name.split(' ')[0]}</strong>! Vamos avaliar ⭐
                            </p>
                        </div>
                        <KioskBarberFeedback
                            tenantId={tenant.id}
                            client={client}
                            channel="totem"
                            sessionId={sessionId}
                            onComplete={handleComplete}
                            onBack={resetToHome}
                        />
                    </div>
                )}

                {/* Shop Feedback */}
                {view === 'shop_feedback' && client && (
                    <div style={{ width: '100%' }}>
                        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${theme.border}` }}>
                            <p style={{ color: theme.textSub, fontSize: '13px', margin: 0 }}>
                                Olá, <strong style={{ color: theme.primary }}>{client.name.split(' ')[0]}</strong>! Sua opinião importa 📊
                            </p>
                        </div>
                        <KioskShopFeedback
                            tenantId={tenant.id}
                            client={client}
                            channel="totem"
                            sessionId={sessionId}
                            onComplete={handleComplete}
                            onBack={resetToHome}
                        />
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer style={{
                padding: '10px 40px',
                borderTop: `1px solid ${theme.border}`,
                background: 'rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 10,
            }}>
                <span style={{ color: theme.textMuted, fontSize: '11px' }}>
                    SOU MANA.GER · Totem + QR Add-on
                </span>
                <span style={{ color: theme.textMuted, fontSize: '11px' }}>
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
            </footer>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap');
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
        </div>
    );
};

// ──────────────────────────────────────────────
// Outer loader wrapper
// ──────────────────────────────────────────────
const KioskPage: React.FC = () => {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const [tenant, setTenant] = useState<TenantInfo | null>(null);
    const [addonEnabled, setAddonEnabled] = useState<boolean | null>(null);
    const [timeout, setTimeout_] = useState(30);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!tenantSlug) { setError('Slug não informado.'); setLoading(false); return; }
        loadTenant();
    }, [tenantSlug]);

    const loadTenant = async () => {
        try {
            // Look up tenant by slug
            const { data: tenantData, error: tenantError } = await supabase
                .from('tenants')
                .select('id, name, slug')
                .eq('slug', tenantSlug)
                .single();

            if (tenantError || !tenantData) {
                // fallback: try to find by profile business name / any identifier
                setError(`Barbearia "${tenantSlug}" não encontrada.`);
                setLoading(false);
                return;
            }

            // Check if addon is enabled
            const { data: addon } = await supabase
                .from('kiosk_addons')
                .select('status, kiosk_theme, max_devices')
                .eq('tenant_id', tenantData.id)
                .single();

            if (!addon || addon.status !== 'enabled') {
                setAddonEnabled(false);
                setLoading(false);
                return;
            }

            setAddonEnabled(true);
            setTenant({
                id: tenantData.id,
                slug: tenantData.slug || tenantSlug || '',
                name: tenantData.name || '',
                theme: (addon.kiosk_theme as KioskTheme) || 'default',
            });
        } catch (e) {
            setError('Erro ao carregar configurações do totem.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#64748b', fontSize: '14px' }}>Carregando totem...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (error) return (
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '48px' }}>⚠️</span>
            <p style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 700 }}>Totem indisponível</p>
            <p style={{ color: '#64748b', fontSize: '14px' }}>{error}</p>
        </div>
    );

    if (addonEnabled === false) return (
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '48px' }}>🔒</span>
            <p style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 700 }}>Add-on não ativo</p>
            <p style={{ color: '#64748b', fontSize: '14px' }}>O módulo Totem + QR não está habilitado para esta barbearia.</p>
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
