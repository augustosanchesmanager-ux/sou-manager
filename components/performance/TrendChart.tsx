import type React from 'react';
import { useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import type {
  PerformanceTotals,
  TimelinePoint,
} from '../../src/modules/performance/types';
import {
  formatCompactCurrency,
  getPerformanceChartTheme,
  type PerformanceChartTheme,
} from './chartTokens';

const fmt = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const fmtNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

interface TooltipEntry {
  payload?: TimelinePoint;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  theme: PerformanceChartTheme;
}

const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, theme }) => {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;

  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs shadow-lg"
      style={{
        backgroundColor: theme.tooltipSurface,
        borderColor: theme.tooltipBorder,
        color: theme.tooltipText,
      }}
    >
      <p className="font-bold" style={{ color: theme.tooltipMuted }}>
        {point.tooltipLabel}
      </p>
      <p className="mt-1 text-sm font-black tabular-nums">{fmt(point.total)}</p>
      <p className="mt-0.5 tabular-nums" style={{ color: theme.tooltipMuted }}>
        {fmtNumber(point.count)} {point.count === 1 ? 'atendimento' : 'atendimentos'}
      </p>
      <p className="mt-1 tabular-nums" style={{ color: theme.tooltipMuted }}>
        Caixa {fmt(point.cash)}
      </p>
      <p className="tabular-nums" style={{ color: theme.tooltipMuted }}>
        Clube {fmt(point.club)}
      </p>
    </div>
  );
};

interface TrendChartProps {
  timeline: TimelinePoint[];
  granularity: 'day' | 'week';
  totals: PerformanceTotals | null;
  loading: boolean;
  onUseCurrentMonth: () => void;
}

const TrendChart: React.FC<TrendChartProps> = ({
  timeline,
  granularity,
  totals,
  loading,
  onUseCurrentMonth,
}) => {
  const { theme } = useTheme();
  const chartTheme = getPerformanceChartTheme(theme === 'dark');
  const rawGradientId = useId();
  const gradientId = `performance-revenue-${rawGradientId.replace(/:/g, '')}`;

  const summary = useMemo(() => {
    if (timeline.length === 0) return 'Sem dados no período.';
    const peak = timeline.reduce((best, point) =>
      point.total > best.total ? point : best,
    );
    const silentBuckets = timeline.filter((point) => point.total === 0).length;
    const bucketLabel = granularity === 'week' ? 'semanas' : 'dias';
    return `Faturamento total ${fmt(totals?.totalRevenue ?? 0)}. Pico em ${
      peak.tooltipLabel
    } com ${fmt(peak.total)}. ${silentBuckets} ${bucketLabel} sem faturamento.`;
  }, [timeline, granularity, totals]);

  const hasData = Boolean(totals && totals.totalRevenue > 0);
  const cashShare =
    totals && totals.totalRevenue > 0
      ? (totals.cashRevenue / totals.totalRevenue) * 100
      : 0;
  const clubShare = totals && totals.totalRevenue > 0
    ? (totals.clubCreditVolume / totals.totalRevenue) * 100
    : 0;

  return (
    <section
      aria-labelledby="performance-trend-title"
      className="rounded-2xl border border-line bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="performance-trend-title"
            className="font-display text-base font-bold tracking-tight text-ink"
          >
            Faturamento no tempo
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Caixa e consumo do clube, {granularity === 'week' ? 'por semana' : 'por dia'}.
            Dias sem venda aparecem como zero.
          </p>
        </div>
        <span className="rounded-lg border border-line px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">
          {granularity === 'week' ? 'Semana' : 'Dia'}
        </span>
      </div>

      {loading ? (
        <div
          aria-hidden="true"
          className="mt-5 h-[220px] animate-pulse rounded-xl bg-line/40 sm:h-[280px]"
        />
      ) : !hasData ? (
        <div className="mt-5 flex h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-4 text-center sm:h-[280px]">
          <span aria-hidden="true" className="material-symbols-outlined text-2xl text-ink-soft">
            query_stats
          </span>
          <p className="text-sm font-semibold text-ink">
            Nenhum faturamento neste período
          </p>
          <p className="max-w-sm text-xs text-ink-soft">
            Ajuste o intervalo ou confira o regime de data. Nada foi arredondado
            nem escondido: o período está zerado.
          </p>
          <button
            type="button"
            onClick={onUseCurrentMonth}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-gold-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Usar mês atual
          </button>
        </div>
      ) : (
        <>
          <figure className="mt-4">
            <div className="h-[220px] w-full min-w-0 sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart
                  data={timeline}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  accessibilityLayer
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={chartTheme.series}
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="100%"
                        stopColor={chartTheme.series}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke={chartTheme.grid}
                    strokeOpacity={chartTheme.gridOpacity}
                  />
                  <ReferenceLine
                    y={0}
                    stroke={chartTheme.grid}
                    strokeOpacity={0.22}
                  />
                  <XAxis
                    dataKey="label"
                    interval="preserveStartEnd"
                    minTickGap={24}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: chartTheme.axisText }}
                    tickMargin={8}
                  />
                  <YAxis
                    width={58}
                    tickCount={4}
                    domain={[0, 'auto']}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) => formatCompactCurrency(value)}
                    tick={{ fontSize: 11, fill: chartTheme.axisText }}
                  />
                  <Tooltip
                    cursor={{ stroke: chartTheme.cursor, strokeDasharray: '4 4' }}
                    content={<ChartTooltip theme={chartTheme} />}
                  />
                  <Area
                    type="linear"
                    dataKey="total"
                    name="Faturamento"
                    stroke={chartTheme.series}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: chartTheme.series,
                      stroke: chartTheme.tooltipSurface,
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <figcaption className="sr-only">{summary}</figcaption>
          </figure>

          <div className="mt-4 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-4 text-[11px] text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
                Caixa {cashShare.toFixed(0)}%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full bg-primary/45" />
                Clube {clubShare.toFixed(0)}%
              </span>
              <span className="ml-auto tabular-nums text-ink">
                {fmt(totals?.totalRevenue ?? 0)}
              </span>
            </div>
            <div
              className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-line/60"
              role="img"
              aria-label={`Composição do faturamento: caixa ${cashShare.toFixed(
                0,
              )}%, clube ${clubShare.toFixed(0)}%`}
            >
              <span className="h-full bg-primary" style={{ width: `${cashShare}%` }} />
              <span className="h-full bg-primary/45" style={{ width: `${clubShare}%` }} />
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default TrendChart;
