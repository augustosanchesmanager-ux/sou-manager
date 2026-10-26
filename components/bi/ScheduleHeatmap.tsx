import React, { useState } from 'react';
import { ScheduleHeatmapCell } from '../../src/types/business-insights';
import { Clock, Calendar, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';

interface ScheduleHeatmapProps {
  cells: ScheduleHeatmapCell[];
  onSlotClick?: (cell: ScheduleHeatmapCell) => void;
}

const DAYS = [
  { day: 1, label: 'Segunda' },
  { day: 2, label: 'Terça' },
  { day: 3, label: 'Quarta' },
  { day: 4, label: 'Quinta' },
  { day: 5, label: 'Sexta' },
  { day: 6, label: 'Sábado' },
  { day: 0, label: 'Domingo' },
];

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8h às 20h

export const ScheduleHeatmap: React.FC<ScheduleHeatmapProps> = ({ cells, onSlotClick }) => {
  const [hoveredCell, setHoveredCell] = useState<ScheduleHeatmapCell | null>(null);

  // Mapear dados rapidamente por dia e hora
  const cellMap = React.useMemo(() => {
    const map = new Map<string, ScheduleHeatmapCell>();
    cells.forEach((c) => {
      map.set(`${c.dayOfWeek}-${c.hour}`, c);
    });
    return map;
  }, [cells]);

  // Estilo de cor de ocupação (Tailwind v4, sem tons roxos)
  const getCellIntensity = (rate: number, count: number) => {
    if (count === 0 || rate === 0) {
      return 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 border border-slate-200/60 dark:border-slate-800';
    }
    if (rate >= 75) {
      // Alta demanda: Verde esmeralda escuro
      return 'bg-emerald-600 text-white font-semibold hover:bg-emerald-500 shadow-sm';
    }
    if (rate >= 40) {
      // Média demanda: Dourado / Âmbar
      return 'bg-amber-500 text-white font-medium hover:bg-amber-400 shadow-sm';
    }
    // Baixa demanda (Ociosidade): Slate suave com destaque de oportunidade
    return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
  };

  // Identificar horários mais ociosos para recomendação
  const idleSlots = React.useMemo(() => {
    return cells
      .filter((c) => c.dayOfWeek >= 1 && c.dayOfWeek <= 5 && c.occupancyRate < 30)
      .sort((a, b) => a.occupancyRate - b.occupancyRate)
      .slice(0, 3);
  }, [cells]);

  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Mapa de Calor de Ocupação da Grade (Heatmap)
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Taxa média de preenchimento dos horários de atendimento. Identifique janelas de ociosidade para campanhas promocionais.
          </p>
        </div>

        {/* Legenda de Cores */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-600 inline-block" />
            <span className="text-gray-600 dark:text-gray-300 font-medium">Alta (&gt;75%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-500 inline-block" />
            <span className="text-gray-600 dark:text-gray-300 font-medium">Média (40-74%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-100 dark:bg-emerald-950 inline-block border border-emerald-300 dark:border-emerald-700" />
            <span className="text-gray-600 dark:text-gray-300 font-medium">Baixa (&lt;40%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-slate-800 inline-block border border-slate-300 dark:border-slate-700" />
            <span className="text-gray-400">Sem agendamentos</span>
          </div>
        </div>
      </div>

      {/* Sugestão Inteligente de Oportunidade */}
      {idleSlots.length > 0 && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200">
            <span className="font-bold">Oportunidade de Campanha de Cupons:</span> Foram identificados horários recorrentes de ociosidade em{' '}
            {idleSlots.map((s, idx) => (
              <span key={idx} className="font-semibold underline mr-1">
                {s.dayLabel} às {s.hourLabel} ({s.occupancyRate}% ocupado)
              </span>
            ))}
            . Disparar ofertas exclusivas para estes intervalos pode elevar a ocupação sem canibalizar horários de pico.
          </div>
        </div>
      )}

      {/* Grade de Calor Matriz */}
      <div className="overflow-x-auto">
        <table className="w-full text-center border-collapse min-w-[650px]">
          <thead>
            <tr>
              <th className="p-2 text-xs font-semibold text-gray-400 uppercase tracking-wider text-left w-20">
                Horário
              </th>
              {DAYS.map((d) => (
                <th
                  key={d.day}
                  className="p-2 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                >
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {HOURS.map((hour) => {
              const hourFormatted = `${String(hour).padStart(2, '0')}:00`;

              return (
                <tr key={hour} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/20">
                  <td className="p-2 text-xs font-medium text-gray-500 dark:text-gray-400 text-left">
                    {hourFormatted}
                  </td>
                  {DAYS.map((d) => {
                    const cell = cellMap.get(`${d.day}-${hour}`) || {
                      dayOfWeek: d.day,
                      dayLabel: d.label,
                      hour,
                      hourLabel: hourFormatted,
                      appointmentsCount: 0,
                      occupancyRate: 0,
                      revenue: 0,
                    };

                    return (
                      <td key={d.day} className="p-1">
                        <button
                          type="button"
                          onMouseEnter={() => setHoveredCell(cell)}
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={() => onSlotClick?.(cell)}
                          className={`w-full py-2 px-1 rounded-md text-xs transition-all duration-200 flex flex-col items-center justify-center cursor-pointer ${getCellIntensity(
                            cell.occupancyRate,
                            cell.appointmentsCount
                          )}`}
                        >
                          <span className="text-[11px] font-bold">
                            {cell.appointmentsCount > 0 ? `${cell.occupancyRate}%` : '—'}
                          </span>
                          {cell.appointmentsCount > 0 && (
                            <span className="text-[9px] opacity-80">
                              {cell.appointmentsCount} atend.
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detalhe do Hover */}
      {hoveredCell && hoveredCell.appointmentsCount > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-slate-800/80 rounded-lg border border-gray-200 dark:border-gray-700 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-gray-900 dark:text-white">
              {hoveredCell.dayLabel} às {hoveredCell.hourLabel}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 dark:text-gray-300">
              Atendimentos: <strong>{hoveredCell.appointmentsCount}</strong>
            </span>
            <span className="text-gray-600 dark:text-gray-300">
              Taxa de Ocupação: <strong>{hoveredCell.occupancyRate}%</strong>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              Faturamento: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(hoveredCell.revenue)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
