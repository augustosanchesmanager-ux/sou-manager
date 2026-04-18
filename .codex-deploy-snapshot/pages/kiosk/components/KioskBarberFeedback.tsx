import React, { useEffect, useState } from 'react';
import { useKioskTheme } from '../KioskThemeProvider';
import { supabase } from '../../../services/supabaseClient';

interface Client { id: string; name: string; }
interface Barber { id: string; name: string; }

interface KioskBarberFeedbackProps {
    tenantId: string;
    client: Client;
    channel: 'totem' | 'qr';
    sessionId?: string;
    onComplete: () => void;
    onBack: () => void;
}

const BARBER_TAGS = ['Atendimento', 'Qualidade do corte', 'Pontualidade', 'Atenção aos detalhes', 'Simpatia', 'Técnica'];

const KioskBarberFeedback: React.FC<KioskBarberFeedbackProps> = ({ tenantId, client, channel, sessionId, onComplete, onBack }) => {
    const { theme } = useKioskTheme();
    const [step, setStep] = useState<'barber' | 'rating' | 'success'>('barber');
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
    const [rating, setRating] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { loadBarbers(); }, []);

    const loadBarbers = async () => {
        const { data } = await supabase.from('staff').select('id, name').eq('tenant_id', tenantId).eq('is_active', true);
        setBarbers(data || []);
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    };

    const handleSubmit = async () => {
        if (rating === 0) return;
        setLoading(true);
        try {
            await supabase.from('feedback_barber').insert({
                tenant_id: tenantId,
                client_id: client.id,
                barber_id: selectedBarber?.id || null,
                session_id: sessionId || null,
                rating,
                tags: selectedTags,
                comment: comment.trim() || null,
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
        maxWidth: '560px',
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
        width: '100%',
        transition: 'transform 0.15s',
        letterSpacing: theme.name === 'sanchez' ? '1px' : 'normal',
        textTransform: theme.name === 'sanchez' ? 'uppercase' : 'none',
    };

    const itemBtn = (selected: boolean): React.CSSProperties => ({
        background: selected ? theme.primaryLight : theme.buttonSecondary,
        border: `1.5px solid ${selected ? theme.primary : theme.border}`,
        borderRadius: '12px',
        padding: '14px 16px',
        cursor: 'pointer',
        color: selected ? theme.textMain : theme.textSub,
        fontWeight: selected ? 700 : 500,
        fontSize: '14px',
        transition: 'all 0.2s',
        textAlign: 'center' as const,
    });

    const ratingLabels = ['', '😞 Ruim', '😐 Regular', '🙂 Bom', '😊 Ótimo', '🤩 Excelente'];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '24px' }}>
            <div style={card}>

                {step === 'barber' && (
                    <>
                        <p style={{ color: theme.textSub, fontSize: '13px', textAlign: 'center', marginBottom: '4px' }}>AVALIAÇÃO</p>
                        <h2 style={{ color: theme.textMain, fontFamily: theme.fontHeading, fontSize: '24px', fontWeight: 700, textAlign: 'center', marginBottom: '24px' }}>
                            {theme.name === 'sanchez' ? 'Quem te atendeu, Chefe?' : 'Quem te atendeu hoje?'}
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginBottom: '24px' }}>
                            {barbers.map(b => (
                                <button key={b.id} style={itemBtn(selectedBarber?.id === b.id)} onClick={() => setSelectedBarber(b)}>
                                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>✂️</div>
                                    {b.name}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button style={{ ...btnPrimary, background: theme.buttonSecondary, color: theme.textSub, flex: 1 }} onClick={onBack}>← Voltar</button>
                            <button style={{ ...btnPrimary, flex: 2 }} disabled={!selectedBarber} onClick={() => setStep('rating')}>Continuar →</button>
                        </div>
                    </>
                )}

                {step === 'rating' && (
                    <>
                        <p style={{ color: theme.textSub, fontSize: '13px', textAlign: 'center', marginBottom: '4px' }}>AVALIAÇÃO — {selectedBarber?.name}</p>
                        <h2 style={{ color: theme.textMain, fontFamily: theme.fontHeading, fontSize: '22px', fontWeight: 700, textAlign: 'center', marginBottom: '24px' }}>
                            {theme.name === 'sanchez' ? 'Como foi o atendimento, Chefe?' : 'Como foi o atendimento?'}
                        </h2>

                        {/* Stars */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
                            {[1, 2, 3, 4, 5].map(s => (
                                <button
                                    key={s}
                                    onMouseEnter={() => setHoveredStar(s)}
                                    onMouseLeave={() => setHoveredStar(0)}
                                    onClick={() => setRating(s)}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontSize: '44px',
                                        transition: 'transform 0.15s',
                                        transform: (hoveredStar >= s || rating >= s) ? 'scale(1.2)' : 'scale(1)',
                                        filter: (hoveredStar >= s || rating >= s) ? 'saturate(1)' : 'saturate(0) opacity(0.4)',
                                    }}
                                >
                                    ⭐
                                </button>
                            ))}
                        </div>
                        <p style={{ textAlign: 'center', color: theme.primary, fontWeight: 600, fontSize: '16px', marginBottom: '24px', minHeight: '24px' }}>
                            {rating > 0 ? ratingLabels[rating] : ''}
                        </p>

                        {/* Tags */}
                        <p style={{ color: theme.textSub, fontSize: '13px', marginBottom: '10px' }}>O que destacou? (opcional)</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                            {BARBER_TAGS.map(tag => (
                                <button key={tag} style={{
                                    ...itemBtn(selectedTags.includes(tag)),
                                    padding: '8px 14px',
                                    fontSize: '13px',
                                    borderRadius: '99px',
                                }} onClick={() => toggleTag(tag)}>
                                    {selectedTags.includes(tag) ? '✓ ' : ''}{tag}
                                </button>
                            ))}
                        </div>

                        {/* Comment */}
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
                                marginBottom: '16px',
                                boxSizing: 'border-box',
                                outline: 'none',
                            }}
                            placeholder="Deixe um comentário (opcional, max. 250 chars)"
                            rows={3}
                            maxLength={250}
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                        />

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button style={{ ...btnPrimary, background: theme.buttonSecondary, color: theme.textSub, flex: 1 }} onClick={() => setStep('barber')}>← Voltar</button>
                            <button style={{ ...btnPrimary, flex: 2 }} disabled={rating === 0 || loading} onClick={handleSubmit}>
                                {loading ? 'Enviando...' : '⭐ Enviar Avaliação'}
                            </button>
                        </div>
                    </>
                )}

                {step === 'success' && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px', animation: 'bounceIn 0.5s' }}>⭐</div>
                        <h2 style={{ color: theme.textMain, fontFamily: theme.fontHeading, fontSize: '26px', fontWeight: 700, marginBottom: '8px' }}>
                            {theme.name === 'sanchez' ? 'Obrigado, Chefe!' : 'Avaliação enviada!'}
                        </h2>
                        <p style={{ color: theme.textSub, fontSize: '16px', marginBottom: '32px' }}>
                            {theme.name === 'sanchez'
                                ? `Sua avaliação de ${selectedBarber?.name} foi registrada.`
                                : `Obrigado por avaliar ${selectedBarber?.name}!`}
                        </p>
                        <button style={{ ...btnPrimary, padding: '16px 40px', fontSize: '16px', width: 'auto' }} onClick={onComplete}>
                            Concluir ✓
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KioskBarberFeedback;
