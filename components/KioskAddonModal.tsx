import React from 'react';

export type AddonModalTheme = 'default' | 'sanchez';
export type AddonType = 'TOTEM_QR' | 'CLIENT_PORTAL';

interface AddonModalProps {
    addonType: AddonType;
    theme?: AddonModalTheme;
    onActivate: () => void;
    onLearnMore?: () => void;
    onClose: () => void;
}

const AddonModal: React.FC<AddonModalProps> = ({
    addonType,
    theme = 'default',
    onActivate,
    onLearnMore,
    onClose,
}) => {
    const isSanchez = theme === 'sanchez';

    const colors = isSanchez
        ? {
            modalBg: 'linear-gradient(160deg, #090909 0%, #111108 100%)',
            border: 'rgba(212,160,23,0.25)',
            primary: '#d4a017',
            primaryLight: 'rgba(212,160,23,0.1)',
            textMain: '#ffffff',
            textSub: '#c9a227',
            textMuted: '#6b5a2a',
            cardBg: 'rgba(212,160,23,0.06)',
            cardBorder: 'rgba(212,160,23,0.15)',
            accent: '#d4a017',
            btnText: '#000000',
        }
        : {
            modalBg: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
            border: 'rgba(255,255,255,0.1)',
            primary: '#6366f1',
            primaryLight: 'rgba(99,102,241,0.1)',
            textMain: '#f8fafc',
            textSub: '#cbd5e1',
            textMuted: '#64748b',
            cardBg: 'rgba(99,102,241,0.06)',
            cardBorder: 'rgba(99,102,241,0.15)',
            accent: '#6366f1',
            btnText: '#ffffff',
        };

    const overlay: React.CSSProperties = {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
    };

    const modal: React.CSSProperties = {
        background: colors.modalBg,
        border: `1px solid ${colors.border}`,
        borderRadius: '28px',
        padding: '40px',
        maxWidth: '580px',
        width: '100%',
        position: 'relative',
        boxShadow: isSanchez
            ? '0 0 80px rgba(212,160,23,0.15), 0 40px 80px rgba(0,0,0,0.6)'
            : '0 0 80px rgba(99,102,241,0.15), 0 40px 80px rgba(0,0,0,0.6)',
    };

    // ==========================================
    // CONTENT DICTIONARY
    // ==========================================
    const content = {
        TOTEM_QR: {
            title: isSanchez ? '👑 Totem do Chefe — Agende e avalie em segundos' : '🖥️ Ative o Totem + QR (Autoatendimento)',
            subtitle: isSanchez
                ? <p style={{ color: colors.textSub, fontSize: '15px', marginBottom: '24px', lineHeight: 1.6 }}>"Aqui todo cliente é tratado como Chefe."<br /><span style={{ color: colors.textMuted, fontSize: '13px' }}>Agende o próximo horário e deixe seu feedback em segundos.</span></p>
                : <p style={{ color: colors.textSub, fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>Instale um totem na recepção e deixe clientes agendarem e avaliarem sozinhos — sem precisar do celular.</p>,
            benefits: isSanchez ? [
                { icon: '👑', title: 'Totem do Chefe na recepção', desc: 'PC + TV mostrando a identidade premium da Sanchez Barber.' },
                { icon: '📱', title: 'QR Code para o celular do cliente', desc: 'Agenda e avalia em 10 segundos sem fila.' },
                { icon: '📊', title: 'NPS e feedback em tempo real', desc: 'Saiba o que os Chefes pensam a cada atendimento.' },
            ] : [
                { icon: '🖥️', title: 'Totem na recepção da barbearia', desc: 'Tela grande, botões grandes, zero fricção para o cliente.' },
                { icon: '📱', title: 'QR Code — Plano B mobile', desc: 'Se o totem estiver ocupado, o cliente usa o celular.' },
                { icon: '⭐', title: 'Feedback e avaliações automáticas', desc: 'Nota do barbeiro + NPS da barbearia em cada visita.' },
            ],
            howItWorks: isSanchez
                ? ['Instale o Totem na recepção (PC + TV)', 'Cliente toca na tela e escolhe: Agendar ou Avaliar', 'Plano B: escaneia o QR e faz pelo celular em 10s']
                : ['1 PC + internet na recepção (TV opcional)', 'Cliente interage diretamente na tela grande', 'QR Code garante fluxo mesmo sem totem disponível'],
            btnText: isSanchez ? '👑 Ativar Totem do Chefe' : '✨ Ativar Totem + QR',
        },
        CLIENT_PORTAL: {
            title: isSanchez ? '👑 Portal do Chefe — agende de casa, no seu tempo' : '📱 Ative o Portal do Cliente (Agendamento 24/7)',
            subtitle: isSanchez
                ? <p style={{ color: colors.textSub, fontSize: '15px', marginBottom: '24px', lineHeight: 1.6 }}>"Para o Chefe que quer praticidade 24 horas por dia."<br /><span style={{ color: colors.textMuted, fontSize: '13px' }}>Os seus melhores clientes marcam no conforto de casa.</span></p>
                : <p style={{ color: colors.textSub, fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>Ofereça um app exclusivo para seus clientes agendarem a qualquer momento de casa, sem senha.</p>,
            benefits: isSanchez ? [
                { icon: '🏠', title: 'Agendamento de Casa', desc: 'O Chefe agenda e gerencia os horários no conforto do sofá.' },
                { icon: '📱', title: 'Menos WhatsApp na Recepção', desc: 'Autoatendimento libera o seu tempo para o que importa.' },
                { icon: '🔁', title: 'Mais retorno recorrente', desc: 'Lembretes fáceis e históricos na mão do cliente.' },
            ] : [
                { icon: '🏠', title: 'Agendamento de Casa', desc: 'Seu cliente agenda o serviço sem precisar mandar mensagem.' },
                { icon: '📱', title: 'Menos mensagens/WhatsApp', desc: 'Automatize a recepção e poupe horas de atendimento manual.' },
                { icon: '🔁', title: 'Mais retorno recorrente', desc: 'O cliente reagenda facilmente a qualquer hora do dia ou da noite.' },
            ],
            howItWorks: isSanchez
                ? ['Compartilhe o link do Portal do Chefe no Instagram/WhatsApp', 'O cliente acessa e valida o celular com um código OTP', 'Ele agenda, reagenda ou avalia quando quiser']
                : ['Divulgue o seu link exclusivo para seus clientes', 'Cliente faz login via número de telefone (sem senha complexa)', 'Cliente tem autonomia para ver agenda e remarcar conforme as regras'],
            btnText: isSanchez ? '👑 Ativar Portal do Chefe' : '✨ Ativar Portal do Cliente',
        }
    };

    const currentContent = content[addonType];

    return (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={modal}>
                {/* Close */}
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}
                >
                    ✕
                </button>

                {/* Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <div style={{
                        background: colors.primaryLight,
                        border: `1px solid ${colors.cardBorder}`,
                        borderRadius: '10px',
                        padding: '6px 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}>
                        <span style={{ fontSize: '14px' }}>✨</span>
                        <span style={{ color: colors.primary, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>ADD-ON PREMIUM</span>
                    </div>
                </div>

                {/* Title */}
                <h2 style={{
                    color: colors.textMain,
                    fontFamily: isSanchez ? "'Playfair Display', Georgia, serif" : "'Inter', sans-serif",
                    fontSize: '28px',
                    fontWeight: 800,
                    marginBottom: '8px',
                    lineHeight: 1.2,
                }}>
                    {currentContent.title}
                </h2>

                {currentContent.subtitle}

                {/* Benefits */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    {currentContent.benefits.map((b, i) => (
                        <div key={i} style={{
                            background: colors.cardBg,
                            border: `1px solid ${colors.cardBorder}`,
                            borderRadius: '14px',
                            padding: '14px 16px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                        }}>
                            <span style={{ fontSize: '22px', flexShrink: 0 }}>{b.icon}</span>
                            <div>
                                <p style={{ color: colors.textMain, fontWeight: 700, fontSize: '14px', margin: 0, marginBottom: '2px' }}>{b.title}</p>
                                <p style={{ color: colors.textMuted, fontSize: '12px', margin: 0 }}>{b.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* How it works */}
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '14px',
                    padding: '16px',
                    marginBottom: '28px',
                }}>
                    <p style={{ color: colors.textSub, fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                        ⚙️ Como funciona
                    </p>
                    {currentContent.howItWorks.map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: i < currentContent.howItWorks.length - 1 ? '8px' : 0 }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: colors.primaryLight, border: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px', color: colors.primary, fontWeight: 700 }}>{i + 1}</div>
                            <p style={{ color: colors.textSub, fontSize: '13px', margin: 0, lineHeight: 1.5 }}>{step}</p>
                        </div>
                    ))}
                </div>

                {addonType === 'TOTEM_QR' && (
                    <p style={{ color: colors.textMuted, fontSize: '12px', marginBottom: '20px', textAlign: 'center' }}>
                        📋 Requisito: 1 PC + conexão com a internet. TV/Monitor opcional para exibição.
                    </p>
                )}

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    {onLearnMore && (
                        <button
                            onClick={onLearnMore}
                            style={{
                                flex: 1,
                                padding: '14px',
                                borderRadius: '14px',
                                border: `1.5px solid ${colors.border}`,
                                background: 'rgba(255,255,255,0.04)',
                                color: colors.textSub,
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            {isSanchez ? 'Ver demonstração' : 'Saiba mais'}
                        </button>
                    )}
                    <button
                        onClick={onActivate}
                        style={{
                            flex: 2,
                            padding: '14px',
                            borderRadius: '14px',
                            border: 'none',
                            background: isSanchez
                                ? 'linear-gradient(135deg, #d4a017, #b8860b)'
                                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: colors.btnText,
                            fontSize: '15px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            letterSpacing: isSanchez ? '1px' : 'normal',
                            textTransform: isSanchez ? 'uppercase' : 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                        {currentContent.btnText}
                    </button>
                </div>

                <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap');
        `}</style>
            </div>
        </div>
    );
};

export default AddonModal;
