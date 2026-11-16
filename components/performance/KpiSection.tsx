import type React from 'react';
import MetricCard, { type MetricTrend } from '../ui/MetricCard';
import type {
  PerformanceDeltas,
  PerformanceTotals,
  PerformanceWindow,
} from '../../src/modules/performance/types';

const fmt = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const fmtNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

const toTrend = (pct: number | null): MetricTrend | undefined => {
  if (pct === null || !Number.isFinite(pct)) return undefined;
  const normalized = Math.abs(pct) < 0.05 ? 0 : pct;
  return {
    direction: normalized > 0 ? 'up' : normalized < 0 ? 'down' : 'flat',
    label: `${normalized > 0 ? '+' : ''}${normalized
      .toFixed(1)
      .replace('.', ',')}%`,
  };
};

const baseHelper = (
  previousWindow: PerformanceWindow | null,
  pct: number | null,
): string | undefined => {
  if (!previousWindow) return undefined;
  if (pct === null) return 'sem base no período anterior';
  return 'vs período anterior';
};

const KpiSkeleton: React.FC = () => (
  <div
    aria-hidden="true"
    className="rounded-2xl border border-line bg-card p-5"
  >
    <div className="h-3 w-24 animate-pulse rounded bg-line/70" />
    <div className="mt-3 h-8 w-32 animate-pulse rounded bg-line/70" />
    <div className="mt-3 h-3 w-20 animate-pulse rounded bg-line/50" />
  </div>
);

interface KpiSectionProps {
  totals: PerformanceTotals | null;
  deltas: PerformanceDeltas | null;
  previousWindow: PerformanceWindow | null;
  loading: boolean;
}

const KpiSection: React.FC<KpiSectionProps> = ({
  totals,
  deltas,
  previousWindow,
  loading,
}) => {
  if (loading || !totals || !deltas) {
    return (
      <section
        aria-busy="true"
        aria-label="Indicadores do período"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </section>
    );
  }

  return (
    <section
      aria-busy="false"
      aria-label="Indicadores do período"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <MetricCard
        label="Faturamento"
        value={fmt(totals.totalRevenue)}
        helper={`Caixa ${fmt(totals.cashRevenue)} · Clube ${fmt(
          totals.clubCreditVolume,
        )}`}
        trend={toTrend(deltas.revenuePct)}
        density="compact"
      />
      <MetricCard
        label="Atendimentos"
        value={fmtNumber(totals.totalAttendances)}
        helper={
          baseHelper(previousWindow, deltas.appointmentsPct) ??
          'comandas finalizadas'
        }
        trend={toTrend(deltas.appointmentsPct)}
        density="compact"
      />
      <MetricCard
        label="Ticket médio"
        value={fmt(totals.averageTicket)}
        helper={
          baseHelper(previousWindow, deltas.averageTicketPct) ?? 'por atendimento'
        }
        trend={toTrend(deltas.averageTicketPct)}
        density="compact"
      />
      <MetricCard
        label="Comissão"
        value={fmt(totals.totalCommissions)}
        helper={`Margem ${fmt(totals.netMargin)} · ${totals.netMarginPercent
          .toFixed(1)
          .replace('.', ',')}%`}
        trend={toTrend(deltas.commissionPct)}
        density="compact"
      />
    </section>
  );
};

export default KpiSection;
