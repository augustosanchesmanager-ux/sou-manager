import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PerformanceHeader from '../components/performance/PerformanceHeader';
import KpiSection from '../components/performance/KpiSection';
import TrendChart from '../components/performance/TrendChart';
import GoalProgress from '../components/performance/GoalProgress';
import StaffRankingTable from '../components/performance/StaffRankingTable';
import { fetchPerformanceData } from '../src/modules/performance/performanceService';
import type {
  DateRegime,
  PerformanceFilterState,
  PerformanceResult,
} from '../src/modules/performance/types';

const formatLocalYMD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentMonthRange = (): PerformanceFilterState => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: formatLocalYMD(start),
    dateTo: formatLocalYMD(now),
  };
};

const Performance: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PerformanceResult | null>(null);

  const [filters, setFilters] = useState<PerformanceFilterState>(getCurrentMonthRange);
  const [dateRegime, setDateRegime] = useState<DateRegime>('attendance');

  const requestRef = useRef(0);

  const loadPerformance = useCallback(async () => {
    if (!tenantId) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchPerformanceData(tenantId, filters, dateRegime);
      if (requestRef.current !== requestId) return;
      setResult(data);
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar os indicadores de performance.',
      );
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [tenantId, filters, dateRegime]);

  useEffect(() => {
    void loadPerformance();
  }, [loadPerformance]);

  const handleUseCurrentMonth = () => {
    setFilters(getCurrentMonthRange());
    setDateRegime('attendance');
  };

  const handleExportCSV = () => {
    if (!result || result.rankedStaff.length === 0) return;

    const header = [
      'Posição',
      'Profissional',
      'Cargo',
      'Atendimentos',
      'Faturamento Total (R$)',
      'Faturamento Caixa (R$)',
      'Consumo Clube (R$)',
      'Ticket Médio (R$)',
      'Comissão Acumulada (R$)',
      'Participação (%)',
    ].join(';');

    const rows = result.rankedStaff.map((member, index) =>
      [
        `#${index + 1}`,
        `"${member.name.replace(/"/g, '""')}"`,
        `"${member.role}"`,
        member.appointments_count,
        member.total_revenue.toFixed(2),
        member.cash_revenue.toFixed(2),
        member.club_credit_volume.toFixed(2),
        member.average_ticket.toFixed(2),
        member.commission_generated.toFixed(2),
        member.share_percentage.toFixed(2),
      ].join(';'),
    );

    const csvContent = `\uFEFF${[header, ...rows].join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `performance_equipe_${result.window.dateFrom}_${result.window.dateTo}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasResult = result !== null;
  const showSections = loading || hasResult;

  const previewWindow = (() => {
    const from = new Date(`${filters.dateFrom}T00:00:00Z`).getTime();
    const to = new Date(`${filters.dateTo}T00:00:00Z`).getTime();
    if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;
    const days = Math.round((to - from) / 86_400_000) + 1;
    if (days > 10_000) return null;
    return {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      days,
      granularity: (days <= 31 ? 'day' : 'week') as 'day' | 'week',
    };
  })();

  return (
    <div className="mx-auto w-full max-w-7xl animate-fade-in space-y-6 pb-12">
      <PerformanceHeader
        filters={filters}
        onFiltersChange={setFilters}
        dateRegime={dateRegime}
        onDateRegimeChange={setDateRegime}
        windowInfo={result?.window ?? previewWindow}
        onExportCSV={handleExportCSV}
        exportDisabled={!result || loading || result.rankedStaff.length === 0}
        onOpenAudit={() => navigate('/reports')}
      />

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-xs font-semibold text-ink">{error}</p>
          <button
            type="button"
            onClick={() => void loadPerformance()}
            className="self-start rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-gold-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:self-auto"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {result?.truncated && (
        <div
          role="status"
          className="rounded-xl border border-line bg-gold-pale px-4 py-3 text-xs text-ink"
        >
          <strong className="font-bold">Foto parcial do período:</strong> existem
          mais de 500 comandas no intervalo selecionado. Totais, gráfico e ranking
          consideram as 500 mais recentes. Reduza o período para ver o restante.
        </div>
      )}

      {result?.previousTruncated && (
        <p role="status" className="text-xs text-ink-soft">
          A comparação com o período anterior pode estar subestimada: a janela
          anterior também passou do limite de 500 comandas.
        </p>
      )}

      {showSections && (
        <>
          <KpiSection
            totals={result?.totals ?? null}
            deltas={result?.deltas ?? null}
            previousWindow={result?.previousWindow ?? null}
            loading={loading}
          />

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <TrendChart
                timeline={result?.timeline ?? []}
                granularity={result?.window.granularity ?? 'day'}
                totals={result?.totals ?? null}
                loading={loading}
                onUseCurrentMonth={handleUseCurrentMonth}
              />
            </div>
            <div className="lg:col-span-4">
              <GoalProgress
                goal={result?.tenantGoal ?? null}
                goalContext={
                  result?.goalContext ?? {
                    applies: false,
                    reason: 'no_goal',
                    pacePercent: null,
                  }
                }
                totals={result?.totals ?? null}
                loading={loading}
                onManageGoals={() => navigate('/settings')}
                onUseCurrentMonth={handleUseCurrentMonth}
              />
            </div>
          </div>

          <StaffRankingTable
            staff={result?.rankedStaff ?? []}
            loading={loading}
          />
        </>
      )}
    </div>
  );
};

export default Performance;
