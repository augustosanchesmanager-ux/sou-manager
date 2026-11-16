/**
 * Tokens de gráfico da tela de performance.
 *
 * Recharts exige cores resolvidas em string, então os valores ficam aqui em
 * vez de duplicar hex dentro dos componentes. A série é o latão envelhecido
 * do DESIGN.md; a grade e o eixo usam os neutros quentes do sistema.
 */
export interface PerformanceChartTheme {
  series: string;
  seriesGradientFrom: string;
  grid: string;
  gridOpacity: number;
  axisText: string;
  tooltipSurface: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipMuted: string;
  cursor: string;
}

const AGED_BRASS = '#B88A44';

export const getPerformanceChartTheme = (isDark: boolean): PerformanceChartTheme => ({
  series: AGED_BRASS,
  seriesGradientFrom: isDark ? 'rgba(184, 138, 68, 0.30)' : 'rgba(184, 138, 68, 0.20)',
  grid: isDark ? '#FAF6EE' : '#191611',
  gridOpacity: 0.07,
  axisText: isDark ? '#A79C8A' : '#6B6252',
  tooltipSurface: isDark ? '#1A1610' : '#FFFFFF',
  tooltipBorder: isDark ? '#2D2618' : '#E8DFC9',
  tooltipText: isDark ? '#F5F1E6' : '#191611',
  tooltipMuted: isDark ? '#A79C8A' : '#6B6252',
  cursor: isDark ? 'rgba(250, 246, 238, 0.18)' : 'rgba(25, 22, 17, 0.14)',
});

/** Eixo Y compacto: 2.000 vira "R$ 2k", 850 vira "R$ 850". */
export const formatCompactCurrency = (value: number): string => {
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    const thousands = value / 1000;
    const digits = Math.abs(thousands) >= 10 || Number.isInteger(thousands) ? 0 : 1;
    return `R$ ${thousands.toFixed(digits).replace('.', ',')}k`;
  }
  return `R$ ${Math.round(value)}`;
};
