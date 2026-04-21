export const theme = {
  colors: {
    primary: '#C6A45A',
    primaryLight: '#E8D5A3',
    primaryDark: '#9A7B3A',
    
    surface: '#FFFFFF',
    surfaceAlt: '#F8FAFC',
    surfaceHover: '#F1F5F9',
    
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    
    border: '#E2E8F0',
    borderSubtle: '#F1F5F9',
    
    bgPage: '#F8FAFC',
    bgPageDark: '#0A0A0C',
  },
  
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
  },
  
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },
  
  shadows: {
    card: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)',
    cardHover: '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
  },
  
  fontSizes: {
    xs: '10px',
    sm: '12px',
    base: '14px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '28px',
    '4xl': '32px',
  },
  
  leading: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  kpi: {
    colors: {
      revenue: { primary: 'emerald', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/30' },
      appointments: { primary: 'primary', bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
      clients: { primary: 'blue', bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800/30' },
      ticket: { primary: 'amber', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800/30' },
    },
  },
};

export type Theme = typeof theme;