import React, { createContext, useContext, ReactNode } from 'react';

export type KioskTheme = 'default' | 'sanchez';

export interface KioskThemeTokens {
    bg: string;
    bgCard: string;
    bgCardHover: string;
    primary: string;
    primaryLight: string;
    primaryGlow: string;
    textMain: string;
    textSub: string;
    textMuted: string;
    border: string;
    borderStrong: string;
    buttonPrimary: string;
    buttonPrimaryText: string;
    buttonSecondary: string;
    fontHeading: string;
    fontBody: string;
    logoText: string;
    npsPromoter: string;
    npsDetractor: string;
    npsPassive: string;
    starActive: string;
    name: KioskTheme;
}

const defaultTheme: KioskThemeTokens = {
    name: 'default',
    bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    bgCard: 'rgba(30,41,59,0.85)',
    bgCardHover: 'rgba(51,65,85,0.9)',
    primary: '#6366f1',
    primaryLight: 'rgba(99,102,241,0.15)',
    primaryGlow: '0 0 40px rgba(99,102,241,0.3)',
    textMain: '#f8fafc',
    textSub: '#cbd5e1',
    textMuted: '#64748b',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(99,102,241,0.4)',
    buttonPrimary: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    buttonPrimaryText: '#ffffff',
    buttonSecondary: 'rgba(255,255,255,0.07)',
    fontHeading: "'Inter', sans-serif",
    fontBody: "'Inter', sans-serif",
    logoText: 'white',
    npsPromoter: '#10b981',
    npsPassive: '#f59e0b',
    npsDetractor: '#ef4444',
    starActive: '#fbbf24',
};

const sanchezTheme: KioskThemeTokens = {
    name: 'sanchez',
    bg: 'linear-gradient(160deg, #050505 0%, #111111 50%, #0a0800 100%)',
    bgCard: 'rgba(20,16,5,0.9)',
    bgCardHover: 'rgba(35,28,8,0.95)',
    primary: '#d4a017',
    primaryLight: 'rgba(212,160,23,0.12)',
    primaryGlow: '0 0 60px rgba(212,160,23,0.25)',
    textMain: '#ffffff',
    textSub: '#c9a227',
    textMuted: '#6b5a2a',
    border: 'rgba(212,160,23,0.15)',
    borderStrong: 'rgba(212,160,23,0.5)',
    buttonPrimary: 'linear-gradient(135deg, #d4a017, #b8860b)',
    buttonPrimaryText: '#000000',
    buttonSecondary: 'rgba(212,160,23,0.1)',
    fontHeading: "'Playfair Display', 'Georgia', serif",
    fontBody: "'Inter', sans-serif",
    logoText: '#d4a017',
    npsPromoter: '#10b981',
    npsPassive: '#f59e0b',
    npsDetractor: '#ef4444',
    starActive: '#d4a017',
};

export const KIOSK_THEMES: Record<KioskTheme, KioskThemeTokens> = {
    default: defaultTheme,
    sanchez: sanchezTheme,
};

interface KioskThemeContextType {
    theme: KioskThemeTokens;
    themeName: KioskTheme;
}

const KioskThemeContext = createContext<KioskThemeContextType>({
    theme: defaultTheme,
    themeName: 'default',
});

export const KioskThemeProvider: React.FC<{ themeName: KioskTheme; children: ReactNode }> = ({
    themeName,
    children,
}) => {
    const theme = KIOSK_THEMES[themeName] || defaultTheme;
    return (
        <KioskThemeContext.Provider value={{ theme, themeName }}>
            {children}
        </KioskThemeContext.Provider>
    );
};

export const useKioskTheme = () => useContext(KioskThemeContext);
