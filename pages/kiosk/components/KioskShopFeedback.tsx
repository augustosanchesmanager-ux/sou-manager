import React, { useState } from 'react';
import { useKioskTheme } from '../KioskThemeProvider';
import { supabase } from '../../../services/supabaseClient';

interface Client { id: string; name: string; }

interface KioskShopFeedbackProps {
    tenantId: string;
    client: Client;
    channel: 'totem' | 'qr';
    sessionId?: string;
    onComplete: () => void;
    onBack: () => void;
}

const SHOP_REASONS = ['Ambiente', 'Atendimento', 'Tempo de espera', 'Preço', 'Localização', 'Limpeza', 'Outros'];

const KioskShopFeedback: React.FC<KioskShopFeedbackProps> = ({ tenantId, client, channel, sessionId, onComplete, onBack }) => {
    const { theme } = useKioskTheme();
    const [nps, setNps] = useState<number | null>(null);
    const [hoveredNps, setHoveredNps] = useState<number | null>(null);
    const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
    const [comment, setComment] = useState('');
    const [marketingOptIn, setMarketingOptIn] = useState<boolean | null>(null);
    const [step, setStep] = useState<'nps' | 'details' | 'success'>('nps');
    const [loading, setLoading] = useState(false);

    const toggleReason = (r: string) => {
        setSelectedReasons(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
    };

    const getNpsColor = (n: number) => {
        if (n <= 6) return theme.npsDetractor;
        if (n <= 8) return theme.npsPassive;
        return theme.npsPromoter;
    };

    const getNpsLabel = (n: number) => {
        if (n === null) return '';
        if (n <= 6) return '😞 Detrator';
        if (n <= 8) return '😐 Neutro';
        return '😍 Promotor';
    };

    const handleSubmit = async () => {
        if (nps === null) return;
        setLoading(true);
        try {
            await supabase.from('feedback_shop').insert({
                tenant_id: tenantId,
                client_id: client.id,
                session_id: sessionId || null,
                nps,
                reasons: selectedReasons,
                comment: comment.trim() || null,
                marketing_opt_in: marketingOptIn ?? false,
                source_channel: channel,
            });
            setStep('success');
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const card: React.CSSProperties = {
        background: theme.bgCard,
        border: `1px solid ${theme.border}`,
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '36px 32px',
        width: '100%',
        maxWidth: '620px',
    };

    const btnPrimary: React.CSSProperties = {
        background: theme.buttonPrimary,
        color: theme.buttonPrimaryText,
        border: 'none',
        borderRadius: '14px',
        padding: '16px 28px',
        fontSize: '16px',
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: theme.fontBody,
        transition: 'transform 0.15s',
        letterSpacing: theme.name === 'sanchez' ? '1px' : 'normal',
        textTransform: theme.name === 'sanchez' ? 'uppercase' : 'none',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '24px' }}>
            <div style={card}>

                {/* NPS STEP */}
                {step === 'nps' && (
                    <>
                        <p style={{ color: theme.textSub, fontSize: '13px', textAlign: 'center', marginBottom: '4px' }}>AVALIAÇÃO DA BARBEARIA</p>
                        <h2 style={{ color: theme.textMain, fontFamily: theme.fontHeading, fontSize: '22px', fontWeight: 700, textAlign: 'center', marginBottom: '8px' }}>
                            {theme.name === 'sanchez'
                                ? 'Quanto indicaria a Sanchez Barber, Chefe?'
                                : 'Quanto você indicaria nossa barbearia?'}
                        </h2>
                        <p style={{ color: theme.textMuted, fontSize: '14px', textAlign: 'center', marginBottom: '28px' }}>
                            De 0 (nunca indicaria) a 10 (com certeza indicaria)
                        </p>

                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
                            {Array.from({ length: 11 }, (_, i) => i).map(n => {
                                const isSelected = nps === n;
                                const isHovered = hoveredNps === n;
                                const col = getNpsColor(n);
                                return (
                                    <button
                                        key={n}
                                        onMouseEnter={() => setHoveredNps(n)}
                                        onMouseLeave={() => setHoveredNps(null)}
                                        onClick={() => setNps(n)}
                                        style={{
                                            width: '52px',
                                            height: '52px',
                                            borderRadius: '12px',
                                            background: isSelected ? col : (isHovered ? `${col}22` : theme.buttonSecondary),
                                            border: `2px solid ${isSelected ? col : (isHovered ? `${col}66` : theme.border)}`,
                                            color: isSelected ? '#fff' : theme.textMain,
                                            fontSize: '18px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.15s',
                                            transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                                        }}
                                    >
                                        {n}
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px' }}>
                            <span style={{ color: theme.npsDetractor, fontSize: '12px', fontWeight: 600 }}>0-6 · Detratores</span>
                            <span style={{ color: theme.npsPassive, fontSize: '12px', fontWeight: 600 }}>7-8 · Neutros</span>
                            <span style={{ color: theme.npsPromoter, fontSize: '12px', fontWeight: 600 }}>9-10 · Promotores</span>
                        </div>

                        {nps !== null && (
                            <p style={{ textAlign: 'center', color: getNpsColor(nps), fontWeight: 700, fontSize: '18px', marginBottom: '20px' }}>
                                {getNpsLabel(nps)}
                            </p>
                        )}

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button style={{ ...btnPrimary, background: theme.buttonSecondary, color: theme.textSub, flex: 1 }} onClick={onBack}>← Voltar</button>
                            <button style={{ ...btnPrimary, flex: 2 }} disabled={nps === null} onClick={() => setStep('details')}>Continuar →</button>
                        </div>
                    </>
                )}

                {/* DETAILS STEP */}
                {step === 'details' && (
                    <>
                        <h2 style={{ color: theme.textMain, fontFamily: theme.fontHeading, fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
                            O que mais importou? (opcional)
                        </h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                            {SHOP_REASONS.map(r => (
                                <button key={r} style={{
                                    background: selectedReasons.includes(r) ? theme.primaryLight : theme.buttonSecondary,
                                    border: `1.5px solid ${selectedReasons.includes(r) ? theme.primary : theme.border}`,
                                    borderRadius: '99px',
                                    padding: '10px 16px',
                                    color: selectedReasons.includes(r) ? theme.textMain : theme.textSub,
                                    fontWeight: selectedReasons.includes(r) ? 700 : 500,
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    transition: 'all 0.2s',
                                }} onClick={() => toggleReason(r)}>
                                    {selectedReasons.includes(r) ? '✓ ' : ''}{r}
                                </button>
                            ))}
                        </div>

                        <textarea
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.04)',
                                border: `1.5px solid ${theme.border}`,
                                borderRadius: '12px',
                                color: theme.textMain,
                                padding: '14px',
                                fontSize: '14px',
                                resize: 'none',
                                fontFamily: theme.fontBody,
                                marginBottom: '20px',
                                boxSizing: 'border-box',
                                outline: 'none',
                            }}
                            placeholder="Comentário livre (opcional, max. 300 chars)"
                            rows={3}
                            maxLength={300}
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                        />

                        {/* Marketing opt-in */}
                        <div style={{ background: theme.primaryLight, border: `1px solid ${theme.border}`, borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
                            <p style={{ color: theme.textMain, fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                                📱 Quer receber promoções e novidades no WhatsApp?
                            </p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => setMarketingOptIn(true)}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '14px',
                                        background: marketingOptIn === true ? theme.buttonPrimary : theme.buttonSecondary,
                                        color: marketingOptIn === true ? theme.buttonPrimaryText : theme.textSub,
                                        border: `1.5px solid ${marketingOptIn === true ? theme.primary : theme.border}`,
                                    }}
                                >
                                    👍 Sim, quero!
                                </button>
                                <button
                                    onClick={() => setMarketingOptIn(false)}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '14px',
                                        background: marketingOptIn === false ? 'rgba(239,68,68,0.1)' : theme.buttonSecondary,
                                        color: marketingOptIn === false ? '#ef4444' : theme.textSub,
                                        border: `1.5px solid ${marketingOptIn === false ? '#ef4444' : theme.border}`,
                                    }}
                                >
                                    Não, obrigado
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button style={{ ...btnPrimary, background: theme.buttonSecondary, color: theme.textSub, flex: 1 }} onClick={() => setStep('nps')}>← Voltar</button>
                            <button style={{ ...btnPrimary, flex: 2 }} disabled={loading} onClick={handleSubmit}>
                                {loading ? 'Enviando...' : '📊 Enviar Avaliação'}
                            </button>
                        </div>
                    </>
                )}

                {/* SUCCESS */}
                {step === 'success' && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🙏</div>
                        <h2 style={{ color: theme.textMain, fontFamily: theme.fontHeading, fontSize: '26px', fontWeight: 700, marginBottom: '8px' }}>
                            {theme.name === 'sanchez' ? 'Valeu, Chefe!' : 'Obrigado pelo feedback!'}
                        </h2>
                        <p style={{ color: theme.textSub, fontSize: '16px', marginBottom: '8px' }}>
                            Sua avaliação foi registrada com sucesso.
                        </p>
                        {nps !== null && nps >= 9 && (
                            <p style={{ color: theme.npsPromoter, fontSize: '14px', marginBottom: '24px', fontWeight: 600 }}>
                                {theme.name === 'sanchez' ? '🌟 Toda a equipe Sanchez agradece, Chefe!' : '🌟 Muito obrigado por nos recomendar!'}
                            </p>
                        )}
                        <button style={{ ...btnPrimary, padding: '16px 40px', fontSize: '16px', margin: '0 auto' }} onClick={onComplete}>
                            Concluir ✓
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KioskShopFeedback;
