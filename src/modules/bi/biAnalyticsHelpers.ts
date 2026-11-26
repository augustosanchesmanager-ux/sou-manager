import type { RevenueEvolutionPoint, TopService } from '../../types/business-insights';

const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

export interface RawBiTransaction {
  amount: number | string | null;
  date: string;
  type: string | null;
}

/**
 * Extracts YYYY-MM strictly in America/Sao_Paulo without UTC midnight shift bugs.
 */
const toSaoPauloYearMonth = (rawDate: string): string | null => {
  if (!rawDate) return null;
  const trimmed = String(rawDate).trim();
  // Pure date string YYYY-MM-DD: read calendar year/month directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed.slice(0, 7);
  }
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) return null;
  const isoDate = parsed.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return isoDate.slice(0, 7);
};

/**
 * Builds an accurate 6-month revenue vs expense series keyed by YYYY-MM
 * (never merges same-named months from different years and ignores non-income/non-expense rows).
 */
export const buildRevenueEvolutionSeries = (
  transactions: RawBiTransaction[],
  referenceDate: Date = new Date()
): RevenueEvolutionPoint[] => {
  const refIso = referenceDate.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [refYearStr, refMonthStr] = refIso.split('-');
  const refYear = Number(refYearStr);
  const refMonthIndex = Number(refMonthStr) - 1; // 0-based

  const buckets = new Map<string, { label: string; income: number; expense: number }>();

  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(Date.UTC(refYear, refMonthIndex - offset, 15));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const shortYear = String(y).slice(-2);
    buckets.set(key, {
      label: `${MONTHS_PT[m]}/${shortYear}`,
      income: 0,
      expense: 0,
    });
  }

  for (const tx of transactions) {
    const key = toSaoPauloYearMonth(tx.date);
    if (!key) continue;
    const bucket = buckets.get(key);
    if (!bucket) continue;

    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      bucket.income += amount;
    } else if (tx.type === 'expense') {
      bucket.expense += amount;
    }
  }

  return Array.from(buckets.values()).map((b) => ({
    month: b.label,
    income: Math.round(b.income * 100) / 100,
    expense: Math.round(b.expense * 100) / 100,
  }));
};

export type ServiceQuadrant = 'star' | 'opportunity' | 'traffic' | 'review';

export interface ServiceMatrixPoint {
  name: string;
  count: number;
  revenue: number;
  avgTicket: number;
  revenueShare: number;
  quadrant: ServiceQuadrant;
}

export interface ServiceMatrixResult {
  points: ServiceMatrixPoint[];
  avgVolume: number;
  avgTicket: number;
  countsByQuadrant: Record<ServiceQuadrant, number>;
}

/**
 * Classifies services into a 2x2 strategic matrix (Volume x Ticket Medio)
 * so barbershop managers immediately see Stars vs Opportunities.
 */
export const buildServiceMatrix2x2 = (services: TopService[]): ServiceMatrixResult => {
  const valid = services.filter((s) => s.count > 0);
  if (valid.length === 0) {
    return {
      points: [],
      avgVolume: 0,
      avgTicket: 0,
      countsByQuadrant: { star: 0, opportunity: 0, traffic: 0, review: 0 },
    };
  }

  const totalRevenue = valid.reduce((sum, s) => sum + (Number(s.revenue) || 0), 0);
  const avgVolume = valid.reduce((sum, s) => sum + s.count, 0) / valid.length;
  const enriched = valid.map((s) => ({
    ...s,
    avgTicket: s.count > 0 ? s.revenue / s.count : 0,
  }));
  const avgTicket = enriched.reduce((sum, s) => sum + s.avgTicket, 0) / enriched.length;

  const countsByQuadrant: Record<ServiceQuadrant, number> = {
    star: 0,
    opportunity: 0,
    traffic: 0,
    review: 0,
  };

  const points: ServiceMatrixPoint[] = enriched.map((s) => {
    const highVolume = s.count >= avgVolume;
    const highTicket = s.avgTicket >= avgTicket;
    let quadrant: ServiceQuadrant;
    if (highVolume && highTicket) quadrant = 'star';
    else if (!highVolume && highTicket) quadrant = 'opportunity';
    else if (highVolume && !highTicket) quadrant = 'traffic';
    else quadrant = 'review';

    countsByQuadrant[quadrant] += 1;
    return {
      name: s.name,
      count: s.count,
      revenue: Math.round(s.revenue * 100) / 100,
      avgTicket: Math.round(s.avgTicket * 100) / 100,
      revenueShare: totalRevenue > 0 ? Math.round((s.revenue / totalRevenue) * 1000) / 10 : 0,
      quadrant,
    };
  });

  return {
    points: points.sort((a, b) => b.revenue - a.revenue),
    avgVolume: Math.round(avgVolume * 10) / 10,
    avgTicket: Math.round(avgTicket * 100) / 100,
    countsByQuadrant,
  };
};
