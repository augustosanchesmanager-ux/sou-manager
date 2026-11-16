import type React from 'react';
import DateRangeFilter from '../ui/DateRangeFilter';
import type {
  DateRegime,
  PerformanceFilterState,
  PerformanceWindow,
} from '../../src/modules/performance/types';

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const parseYmd = (ymd: string) => {
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day };
};

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

export const formatPeriodLabel = (window: PerformanceWindow | null): string => {
  if (!window) return 'Período não definido';
  const from = parseYmd(window.dateFrom);
  const to = parseYmd(window.dateTo);

  if (from.year === to.year && from.month === to.month) {
    const monthLabel = `${MONTHS[from.month - 1]} de ${from.year}`;
    const coversMonth =
      from.day === 1 && to.day === daysInMonth(from.year, from.month);
    if (coversMonth) {
      return `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)}`;
    }
    return `${String(from.day).padStart(2, '0')} a ${String(to.day).padStart(2, '0')} de ${monthLabel}`;
  }

  if (from.year === to.year) {
    return `${String(from.day).padStart(2, '0')}/${String(from.month).padStart(2, '0')} a ${String(to.day).padStart(2, '0')}/${String(to.month).padStart(2, '0')} de ${from.year}`;
  }

  return `${String(from.day).padStart(2, '0')}/${String(from.month).padStart(2, '0')}/${from.year} a ${String(to.day).padStart(2, '0')}/${String(to.month).padStart(2, '0')}/${to.year}`;
};

const regimeOptions: Array<{ value: DateRegime; label: string }> = [
  { value: 'attendance', label: 'Atendimento' },
  { value: 'payment', label: 'Caixa' },
];

interface PerformanceHeaderProps {
  filters: PerformanceFilterState;
  onFiltersChange: (filters: PerformanceFilterState) => void;
  dateRegime: DateRegime;
  onDateRegimeChange: (regime: DateRegime) => void;
  windowInfo: PerformanceWindow | null;
  onExportCSV: () => void;
  exportDisabled: boolean;
  onOpenAudit: () => void;
}

const PerformanceHeader: React.FC<PerformanceHeaderProps> = ({
  filters,
  onFiltersChange,
  dateRegime,
  onDateRegimeChange,
  windowInfo,
  onExportCSV,
  exportDisabled,
  onOpenAudit,
}) => {
  const granularityLabel = windowInfo?.granularity === 'week' ? 'por semana' : 'por dia';

  return (
    <header className="flex flex-col gap-5 border-b border-line pb-5">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">
          Painel gerencial
        </p>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          Performance
        </h1>
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-ink">{formatPeriodLabel(windowInfo)}</span>
          {windowInfo ? ` · ${windowInfo.days} dias · ${granularityLabel}` : null}
        </p>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="w-full xl:max-w-md">
          <DateRangeFilter
            className="performance-period"
            startDate={filters.dateFrom}
            endDate={filters.dateTo}
            onStartDateChange={(dateFrom) =>
              onFiltersChange({ ...filters, dateFrom })
            }
            onEndDateChange={(dateTo) => onFiltersChange({ ...filters, dateTo })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <fieldset
            className="m-0 inline-flex min-w-0 rounded-xl border border-line bg-card p-1"
            aria-label="Regime de data dos indicadores"
          >
            <legend className="sr-only">Regime de data dos indicadores</legend>
            {regimeOptions.map((option) => {
              const selected = dateRegime === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onDateRegimeChange(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    selected
                      ? 'bg-primary text-night'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </fieldset>

          <button
            type="button"
            onClick={onOpenAudit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-ink-soft transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-base">
              receipt_long
            </span>
            Auditoria
          </button>

          <button
            type="button"
            onClick={onExportCSV}
            disabled={exportDisabled}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-night transition-colors duration-150 hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-base">
              download
            </span>
            Exportar CSV
          </button>
        </div>
      </div>

      <p className="text-[11px] text-ink-soft">
        Caixa conta quando o dinheiro entrou. Atendimento conta quando o corte
        aconteceu.
      </p>
    </header>
  );
};

export default PerformanceHeader;
