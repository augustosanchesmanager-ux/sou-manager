import type React from 'react';
import { useMemo, useState } from 'react';
import type { StaffPerformanceRecord } from '../../src/modules/performance/types';

const fmt = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const fmtNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

const roleLabel = (role: string) => {
  switch (role) {
    case 'barber':
      return 'Barbeiro';
    case 'manager':
      return 'Gerente';
    case 'receptionist':
      return 'Recepcionista';
    case 'seller':
      return 'Vendedor';
    default:
      return role;
  }
};

type SortKey = 'revenue' | 'appointments' | 'ticket';
type SortDirection = 'asc' | 'desc';

const sortValue = (record: StaffPerformanceRecord, key: SortKey) => {
  if (key === 'appointments') return record.appointments_count;
  if (key === 'ticket') return record.average_ticket;
  return record.total_revenue;
};

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}

const SortableHeader: React.FC<SortableHeaderProps> = ({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = 'right',
}) => {
  const active = activeKey === sortKey;
  const ariaSort = active
    ? direction === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 rounded transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          active ? 'text-ink' : ''
        }`}
      >
        {label}
        <span
          aria-hidden="true"
          className={`material-symbols-outlined text-sm ${
            active ? 'text-primary' : 'text-ink-soft'
          }`}
        >
          {active
            ? direction === 'asc'
              ? 'arrow_upward'
              : 'arrow_downward'
            : 'unfold_more'}
        </span>
      </button>
    </th>
  );
};

interface StaffRankingTableProps {
  staff: StaffPerformanceRecord[];
  loading: boolean;
}

const StaffRankingTable: React.FC<StaffRankingTableProps> = ({ staff, loading }) => {
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [direction, setDirection] = useState<SortDirection>('desc');

  const sorted = useMemo(() => {
    const factor = direction === 'asc' ? 1 : -1;
    return [...staff].sort((a, b) => {
      const delta = (sortValue(a, sortKey) - sortValue(b, sortKey)) * factor;
      if (delta !== 0) return delta;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [staff, sortKey, direction]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(key);
    setDirection('desc');
  };

  const totalRevenue = useMemo(
    () => staff.reduce((sum, record) => sum + record.total_revenue, 0),
    [staff],
  );

  return (
    <section
      aria-labelledby="performance-ranking-title"
      className="rounded-2xl border border-line bg-card"
    >
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-5 py-4">
        <div>
          <h2
            id="performance-ranking-title"
            className="font-display text-base font-bold tracking-tight text-ink"
          >
            Ranking da equipe
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Faturamento e participação de cada profissional no período.
          </p>
        </div>
        {!loading && staff.length > 0 && (
          <p className="text-[11px] tabular-nums text-ink-soft">
            {staff.length} {staff.length === 1 ? 'profissional' : 'profissionais'} ·{' '}
            {fmt(totalRevenue)}
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 p-5" aria-hidden="true">
          {['skeleton-a', 'skeleton-b', 'skeleton-c', 'skeleton-d', 'skeleton-e'].map(
            (rowKey) => (
              <div key={rowKey} className="flex items-center gap-4">
                <div className="h-8 w-8 animate-pulse rounded-full bg-line/60" />
                <div className="h-3 w-40 animate-pulse rounded bg-line/60" />
                <div className="ml-auto h-3 w-16 animate-pulse rounded bg-line/50" />
                <div className="h-3 w-20 animate-pulse rounded bg-line/50" />
              </div>
            ),
          )}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <span aria-hidden="true" className="material-symbols-outlined text-2xl text-ink-soft">
            group_off
          </span>
          <p className="text-sm font-semibold text-ink">Nenhum profissional no período</p>
          <p className="max-w-sm text-xs text-ink-soft">
            Não há comandas finalizadas para atribuir a alguém. O ranking aparece
            assim que houver movimento.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <caption className="sr-only">
              Ranking de profissionais por faturamento no período, com atendimentos,
              ticket médio, comissão e participação na receita.
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft"
                >
                  Profissional
                </th>
                <SortableHeader
                  label="Atendimentos"
                  sortKey="appointments"
                  activeKey={sortKey}
                  direction={direction}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Ticket médio"
                  sortKey="ticket"
                  activeKey={sortKey}
                  direction={direction}
                  onSort={handleSort}
                />
                <th
                  scope="col"
                  className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft"
                >
                  Comissão
                </th>
                <SortableHeader
                  label="Faturamento"
                  sortKey="revenue"
                  activeKey={sortKey}
                  direction={direction}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((record, index) => (
                <tr
                  key={record.id}
                  className="group border-b border-line/60 last:border-b-0"
                >
                  <td className="sticky left-0 z-10 bg-card px-4 py-2.5 group-hover:bg-gold-pale">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 text-right text-[11px] font-bold tabular-nums text-ink-soft">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate font-bold text-ink">
                          {index === 0 && record.total_revenue > 0 && (
                            <span role="img" aria-label="Primeiro lugar">
                              🥇
                            </span>
                          )}
                          {record.name}
                        </p>
                        <p className="text-[11px] text-ink-soft">
                          {roleLabel(record.role)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                    {fmtNumber(record.appointments_count)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                    {fmt(record.average_ticket)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                    {fmt(record.commission_generated)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col items-end">
                      <span className="font-bold tabular-nums text-ink">
                        {fmt(record.total_revenue)}
                      </span>
                      <span
                        aria-hidden="true"
                        className="mt-1 h-0.5 w-20 overflow-hidden rounded-full bg-line/70"
                      >
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.min(100, Math.max(0, record.share_percentage))}%`,
                          }}
                        />
                      </span>
                      <span className="mt-0.5 text-[10px] tabular-nums text-ink-soft">
                        {record.share_percentage.toFixed(1).replace('.', ',')}% da receita
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default StaffRankingTable;
