import React, { useEffect, useState } from 'react';
import { useKioskTheme } from '../KioskThemeProvider';

interface KioskQRBlockProps {
    tenantSlug: string;
    compact?: boolean; // for sidebar placement
}

const KioskQRBlock: React.FC<KioskQRBlockProps> = ({ tenantSlug, compact = false }) => {
    const { theme } = useKioskTheme();
    const [qrUrl, setQrUrl] = useState('');

    useEffect(() => {
        // URL do mini-portal do cliente via QR
        const clientPortalUrl = `${window.location.origin}/#/kiosk/${tenantSlug}/client`;
        // Google Charts QR Code API (free, no auth needed)
        const size = compact ? 120 : 180;
        setQrUrl(`https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(clientPortalUrl)}&choe=UTF-8&chld=M|1`);
    }, [tenantSlug]);

    if (compact) {
        return (
            <div style={{
                background: theme.bgCard,
                border: `1px solid ${theme.border}`,
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
            }}>
                <p style={{ color: theme.textSub, fontSize: '11px', fontWeight: 700, textAlign: 'center', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    {theme.name === 'sanchez' ? '📱 Chefe, prefere no celular?' : '📱 Prefere pelo celular?'}
                </p>
                {qrUrl && (
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '10px',
                        padding: '6px',
                        display: 'inline-block',
                    }}>
                        <img src={qrUrl} alt="QR Code" width={120} height={120} style={{ display: 'block' }} />
                    </div>
                )}
                <p style={{ color: theme.textMuted, fontSize: '11px', textAlign: 'center', lineHeight: 1.4 }}>
                    {theme.name === 'sanchez'
                        ? 'Escaneie e finalize em 10s'
                        : 'Aponte a câmera e continue'}
                </p>
            </div>
        );
    }

    return (
        <div style={{
            background: theme.bgCard,
            border: `1px solid ${theme.border}`,
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '240px',
            margin: '0 auto',
        }}>
            <div style={{
                background: theme.primaryLight,
                border: `1px solid ${theme.border}`,
                borderRadius: '12px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
            }}>
                <span style={{ fontSize: '14px' }}>📱</span>
                <span style={{ color: theme.primary, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Plano B</span>
            </div>

            <h3 style={{
                color: theme.textMain,
                fontFamily: theme.fontHeading,
                fontSize: '15px',
                fontWeight: 700,
                textAlign: 'center',
                lineHeight: 1.3,
                margin: 0,
            }}>
                {theme.name === 'sanchez'
                    ? 'Prefere no celular, Chefe?'
                    : 'Prefere fazer pelo celular?'}
            </h3>

            {qrUrl && (
                <div style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    padding: '10px',
                    display: 'inline-block',
                    boxShadow: `0 0 20px rgba(255,255,255,0.1)`,
                }}>
                    <img src={qrUrl} alt="QR Code - Mini-portal do cliente" width={180} height={180} style={{ display: 'block' }} />
                </div>
            )}

            <p style={{
                color: theme.textMuted,
                fontSize: '12px',
                textAlign: 'center',
                lineHeight: 1.5,
                margin: 0,
            }}>
                {theme.name === 'sanchez'
                    ? 'Escaneie o QR e finalize em 10 segundos'
                    : 'Aponte a câmera do celular e continue por lá'}
            </p>

            <div style={{
                display: 'flex',
                gap: '6px',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                padding: '6px 10px',
            }}>
                <span style={{ color: '#25d366', fontSize: '14px' }}>📲</span>
                <span style={{ color: theme.textMuted, fontSize: '11px' }}>Funciona em qualquer câmera</span>
            </div>
        </div>
    );
};

export default KioskQRBlock;
