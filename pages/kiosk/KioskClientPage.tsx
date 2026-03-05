import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { KioskThemeProvider, KioskTheme } from './KioskThemeProvider';
import { useKioskTheme } from './KioskThemeProvider';
import KioskIdentify from './components/KioskIdentify';
import KioskSchedule from './components/KioskSchedule';
import KioskBarberFeedback from './components/KioskBarberFeedback';
import KioskShopFeedback from './components/KioskShopFeedback';

type KioskView = 'home' | 'identify' | 'schedule' | 'barber_feedback' | 'shop_feedback';

interface TenantInfo { id: string; slug: string; name: string; theme: KioskTheme; }
interface Client { id: string; name: string; phone: string; }

const KioskClientInner: React.FC<{ tenant: TenantInfo }> = ({ tenant }) => {
    const { theme } = useKioskTheme();
    const [view, setView] = useState<KioskView>('home');
    const [pendingView, setPendingView] = useState<KioskView | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [sessionId, setSessionId] = useState<string | undefined>(undefined);
    const isSanchez = theme.name === 'sanchez';

    const createSession = async () => {
        try {
            const { data } = await supabase.from('kiosk_sessions').insert({
                tenant_id: tenant.id,
                channel: 'qr',
                status: 'initiated',
                user_agent: navigator.userAgent.slice(0, 200),
            }).select('id').single();
            if (data) setSessionId(data.id);
        } catch { /* silent */ }
    };

    const handleMenuChoice = (next: KioskView) => {
        setPendingView(next);
        createSession();
        setView('identify');
    };

    const handleIdentified = (c: Client) => {
        setClient(c);
        setView(pendingView || 'schedule');
    };

    const resetToHome = () => {
        setView('home');
        setClient(null);
        setSessionId(undefined);
        setPendingView(null);
    };

    const actions = [
        { id: 'schedule', icon: '📅', label: isSanchez ? 'Agendar atendimento' : 'Agendar horário', target: 'schedule' as KioskView },
        { id: 'barber', icon: '⭐', label: isSanchez ? 'Avaliar barbeiro' : 'Avaliar atendimento', target: 'barber_feedback' as KioskView },
        { id: 'shop', icon: '📊', label: isSanchez ? 'Avaliar a Sanchez' : 'Avaliar barbearia', target: 'shop_feedback' as KioskView },
    ];

    return (
        <div style={{
            minHeight: '100vh',
            background: theme.bg,
            fontFamily: theme.fontBody,
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Compact mobile header */}
            <header style={{
                padding: '14px 20px',
                borderBottom: `1px solid ${theme.border}`,
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 100,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>✂️</span>
                    <div>
                        <p style={{ color: theme.textMain, fontWeight: 700, fontSize: '14px', margin: 0 }}>
                            {tenant.name || (isSanchez ? 'Sanchez Barber' : 'Barbearia')}
                        </p>
                        <p style={{ color: theme.textMuted, fontSize: '10px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {isSanchez ? '📱 Totem do Chefe · Mobile' : '📱 Autoatendimento'}
                        </p>
                    </div>
                </div>
                {view !== 'home' && (
                    <button
                        onClick={resetToHome}
                        style={{ background: 'none', border: `1px solid ${theme.border}`, color: theme.textSub, borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px' }}
                    >
                        ← Início
                    </button>
                )}
            </header>

            <main style={{ flex: 1 }}>
                {view === 'home' && (
                    <div style={{ padding: '24px 16px' }}>
                        {/* QR badge */}
                        <div style={{
                            background: theme.primaryLight,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '14px',
                            padding: '12px 16px',
                            marginBottom: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                        }}>
                            <span style={{ fontSize: '20px' }}>📲</span>
                            <div>
                                <p style={{ color: theme.primary, fontWeight: 700, fontSize: '13px', margin: 0 }}>
                                    Você escaneou o QR Code!
                                </p>
                                <p style={{ color: theme.textMuted, fontSize: '11px', margin: 0 }}>
                                    {isSanchez ? 'Conclua em segundos, Chefe.' : 'Finalize aqui em menos de 1 minuto.'}
                                </p>
                            </div>
                        </div>

                        <h1 style={{
                            color: theme.textMain,
                            fontFamily: theme.fontHeading,
                            fontSize: '26px',
                            fontWeight: 800,
                            marginBottom: '6px',
                        }}>
                            {isSanchez ? '👋 Bem-vindo, Chefe.' : 'Olá! O que deseja?'}
                        </h1>
                        <p style={{ color: theme.textSub, fontSize: '14px', marginBottom: '28px' }}>
                            {isSanchez ? 'Aqui você é tratado como Chefe.' : 'Selecione uma opção para continuar.'}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {actions.map(a => (
                                <button
                                    key={a.id}
                                    id={`kiosk-mobile-btn-${a.id}`}
                                    onClick={() => handleMenuChoice(a.target)}
                                    style={{
                                        background: theme.bgCard,
                                        border: `1.5px solid ${theme.border}`,
                                        borderRadius: '18px',
                                        padding: '20px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        textAlign: 'left',
                                        width: '100%',
                                        transition: 'all 0.2s',
                                    }}
                                    onTouchStart={e => (e.currentTarget.style.background = theme.bgCardHover)}
                                    onTouchEnd={e => (e.currentTarget.style.background = theme.bgCard)}
                                >
                                    <span style={{ fontSize: '36px', flexShrink: 0 }}>{a.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ color: theme.textMain, fontWeight: 700, fontSize: '16px', margin: 0, fontFamily: theme.fontHeading }}>
                                            {a.label}
                                        </p>
                                        <p style={{ color: theme.textMuted, fontSize: '12px', margin: 0, marginTop: '2px' }}>
                                            {a.id === 'schedule' ? 'Escolha serviço, barbeiro e horário' :
                                                a.id === 'barber' ? 'Dê sua nota e comentário' : 'Pesquisa de satisfação NPS'}
                                        </p>
                                    </div>
                                    <span style={{ color: theme.primary, fontSize: '20px', flexShrink: 0 }}>›</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {view === 'identify' && (
                    <KioskIdentify tenantId={tenant.id} onIdentified={handleIdentified} />
                )}

                {view === 'schedule' && client && (
                    <KioskSchedule tenantId={tenant.id} client={client} channel="qr" sessionId={sessionId} onComplete={resetToHome} onBack={resetToHome} />
                )}

                {view === 'barber_feedback' && client && (
                    <KioskBarberFeedback tenantId={tenant.id} client={client} channel="qr" sessionId={sessionId} onComplete={resetToHome} onBack={resetToHome} />
                )}

                {view === 'shop_feedback' && client && (
                    <KioskShopFeedback tenantId={tenant.id} client={client} channel="qr" sessionId={sessionId} onComplete={resetToHome} onBack={resetToHome} />
                )}
            </main>

            <footer style={{
                padding: '10px 20px',
                borderTop: `1px solid ${theme.border}`,
                textAlign: 'center',
            }}>
                <p style={{ color: theme.textMuted, fontSize: '10px', margin: 0 }}>SOU MANA.GER · Totem + QR</p>
            </footer>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; }
      `}</style>
        </div>
    );
};

const KioskClientPage: React.FC = () => {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const [tenant, setTenant] = useState<TenantInfo | null>(null);
    const [addonEnabled, setAddonEnabled] = useState<boolean | null>(null);
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
                .eq('slug', tenantSlug)
                .single();

            if (!tenantData) { setError('Barbearia não encontrada.'); setLoading(false); return; }

            const { data: addon } = await supabase
                .from('kiosk_addons')
                .select('status, kiosk_theme')
                .eq('tenant_id', tenantData.id)
                .single();

            if (!addon || addon.status !== 'enabled') { setAddonEnabled(false); setLoading(false); return; }

            setAddonEnabled(true);
            setTenant({
                id: tenantData.id,
                slug: tenantData.slug || tenantSlug || '',
                name: tenantData.name || '',
                theme: (addon.kiosk_theme as KioskTheme) || 'default',
            });
        } catch { setError('Erro ao carregar.'); }
        finally { setLoading(false); }
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    if (error || addonEnabled === false) return (
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '40px' }}>⚠️</span>
            <p style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 700 }}>Serviço indisponível</p>
            <p style={{ color: '#64748b', fontSize: '13px' }}>{error || 'Este add-on não está ativo.'}</p>
        </div>
    );

    if (!tenant) return null;

    return (
        <KioskThemeProvider themeName={tenant.theme}>
            <KioskClientInner tenant={tenant} />
        </KioskThemeProvider>
    );
};

export default KioskClientPage;
