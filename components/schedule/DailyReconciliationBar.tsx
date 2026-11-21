import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  Receipt,
  X,
} from 'lucide-react';
import { normalizeAppointmentStatus } from '../../shared/status/appointment';
import type { AppointmentComandaSummary } from '../../domain/comanda/types';

export interface ReconciliationAppointmentItem {
  id: string;
  client: string;
  clientPhone?: string;
  service: string;
  staffId: string;
  staffName: string;
  start: number;
  duration: number;
  startTime: string;
  date?: string;
  status: string;
  price: number;
}

export interface DailyReconciliationAnomaly {
  appointment: ReconciliationAppointmentItem;
  kind: 'awaiting_checkin' | 'pending_cash';
  normalizedStatus: string;
  comanda: AppointmentComandaSummary | null;
  amount: number;
}

export interface DailyReconciliationSummary {
  awaitingCheckIn: DailyReconciliationAnomaly[];
  pendingCash: DailyReconciliationAnomaly[];
  completedCycle: ReconciliationAppointmentItem[];
  pendingCashTotal: number;
  totalAnomalies: number;
  isFullyReconciled: boolean;
}

export interface DailyReconciliationBarProps {
  appointments: ReconciliationAppointmentItem[];
  comandasByAppointment: Record<string, AppointmentComandaSummary>;
  selectedDate: Date;
  onOpenDetails: (appointment: any) => void;
  onOpenComanda: (appointment: any) => void;
  onStartAppointment?: (appointment: any) => void;
  orderLabel?: string;
}

type DrawerCategory = 'all' | 'awaiting_checkin' | 'pending_cash';

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getAppointmentStartMs = (apt: ReconciliationAppointmentItem, selectedDate: Date): number => {
  if (apt.startTime) {
    const parsed = new Date(apt.startTime);
    if (!Number.isNaN(parsed.getTime()) && toLocalDateKey(parsed) === toLocalDateKey(selectedDate)) {
      return parsed.getTime();
    }
  }

  const fallback = new Date(selectedDate);
  const hours = Math.floor(apt.start);
  const minutes = Math.round((apt.start % 1) * 60);
  fallback.setHours(hours, minutes, 0, 0);
  return fallback.getTime();
};

const formatHourLabel = (value: number): string => {
  const totalMinutes = Math.round(value * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatBrl = (value: number): string =>
  `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

/**
 * Calcula as métricas e anomalias de conciliação diária de forma pura e determinística.
 */
export function computeDailyReconciliation(
  appointments: ReconciliationAppointmentItem[],
  comandasByAppointment: Record<string, AppointmentComandaSummary>,
  selectedDate: Date,
  now: Date = new Date(),
): DailyReconciliationSummary {
  const awaitingCheckIn: DailyReconciliationAnomaly[] = [];
  const pendingCash: DailyReconciliationAnomaly[] = [];
  const completedCycle: ReconciliationAppointmentItem[] = [];
  let pendingCashTotal = 0;

  const nowMs = now.getTime();

  for (const apt of appointments) {
    const normalizedStatus = normalizeAppointmentStatus(apt.status);
    const comanda = comandasByAppointment[apt.id] || null;
    const comandaStatus = comanda?.status || null;

    if (
      ['scheduled', 'pending', 'confirmed'].includes(normalizedStatus) &&
      getAppointmentStartMs(apt, selectedDate) < nowMs
    ) {
      awaitingCheckIn.push({
        appointment: apt,
        kind: 'awaiting_checkin',
        normalizedStatus,
        comanda,
        amount: Number(comanda?.total ?? apt.price ?? 0),
      });
      continue;
    }

    if (['completed', 'in_progress'].includes(normalizedStatus) && comandaStatus === 'open') {
      const amount = Number(comanda?.total ?? apt.price ?? 0);
      pendingCashTotal += amount;
      pendingCash.push({
        appointment: apt,
        kind: 'pending_cash',
        normalizedStatus,
        comanda,
        amount,
      });
      continue;
    }

    const isCompletedResolved =
      normalizedStatus === 'completed' &&
      (comandaStatus === 'paid' || !comandaStatus || comandaStatus === 'cancelled');
    const isClosedAbsence =
      (normalizedStatus === 'cancelled' || normalizedStatus === 'no_show') &&
      comandaStatus !== 'open';

    if (isCompletedResolved || isClosedAbsence) {
      completedCycle.push(apt);
    }
  }

  const totalAnomalies = awaitingCheckIn.length + pendingCash.length;

  return {
    awaitingCheckIn,
    pendingCash,
    completedCycle,
    pendingCashTotal,
    totalAnomalies,
    isFullyReconciled: totalAnomalies === 0,
  };
}

export const DailyReconciliationBar: React.FC<DailyReconciliationBarProps> = ({
  appointments,
  comandasByAppointment,
  selectedDate,
  onOpenDetails,
  onOpenComanda,
  onStartAppointment,
  orderLabel = 'Comanda',
}) => {
  const [activeDrawerCategory, setActiveDrawerCategory] = useState<DrawerCategory | null>(null);

  const summary = useMemo(
    () => computeDailyReconciliation(appointments, comandasByAppointment, selectedDate),
    [appointments, comandasByAppointment, selectedDate],
  );

  useEffect(() => {
    if (!activeDrawerCategory) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveDrawerCategory(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeDrawerCategory]);

  const drawerItems = useMemo(() => {
    if (activeDrawerCategory === 'awaiting_checkin') {
      return summary.awaitingCheckIn;
    }
    if (activeDrawerCategory === 'pending_cash') {
      return summary.pendingCash;
    }
    return [...summary.pendingCash, ...summary.awaitingCheckIn];
  }, [activeDrawerCategory, summary]);

  const formattedDateLabel = useMemo(
    () =>
      selectedDate.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [selectedDate],
  );

  const hasAwaitingCheckIn = summary.awaitingCheckIn.length > 0;
  const hasPendingCash = summary.pendingCash.length > 0;

  return (
    <>
      <section
        aria-label="Barra de Conciliação do Dia"
        className={`mb-4 rounded-2xl border bg-zinc-950 px-4 py-2.5 shadow-lg transition-all ${
          summary.isFullyReconciled
            ? 'border-emerald-500/30'
            : 'border-amber-500/40'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Status Geral da Conciliação */}
          <div className="flex items-center gap-2.5 min-w-0">
            {summary.isFullyReconciled ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-black text-emerald-300 whitespace-nowrap">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>Dia 100% Conciliado</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setActiveDrawerCategory('all')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 px-2.5 py-1 text-xs font-black text-amber-300 hover:bg-amber-500/25 transition-colors cursor-pointer whitespace-nowrap"
                title="Abrir lista de pendências do dia"
              >
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <span>{summary.totalAnomalies} {summary.totalAnomalies === 1 ? 'pendência no dia' : 'pendências no dia'}</span>
              </button>
            )}

            <span className="text-[11px] font-semibold text-stone-400 truncate hidden sm:inline">
              Conciliação de {formattedDateLabel}
            </span>
          </div>

          {/* 3 Métricas Horizontais */}
          <div className="flex flex-wrap items-center gap-2">
            {/* (a) Aguardando Check-in / Atrasados */}
            <button
              type="button"
              onClick={() => setActiveDrawerCategory('awaiting_checkin')}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-all cursor-pointer ${
                hasAwaitingCheckIn
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                  : 'bg-zinc-900 border-zinc-800 text-stone-400 hover:border-zinc-700 hover:text-stone-200'
              }`}
              title="Agendamentos pendentes/confirmados com horário já ultrapassado"
            >
              {hasAwaitingCheckIn ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              ) : (
                <Clock size={13} className="text-stone-500 shrink-0" />
              )}
              <span className="font-semibold whitespace-nowrap">Aguardando Check-in:</span>
              <strong className={`font-black tabular-nums ${hasAwaitingCheckIn ? 'text-amber-200' : 'text-stone-200'}`}>
                {summary.awaitingCheckIn.length}
              </strong>
            </button>

            {/* (b) Caixa Pendente */}
            <button
              type="button"
              onClick={() => setActiveDrawerCategory('pending_cash')}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-all cursor-pointer ${
                hasPendingCash
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                  : 'bg-zinc-900 border-zinc-800 text-stone-400 hover:border-zinc-700 hover:text-stone-200'
              }`}
              title={`Atendimentos em andamento ou finalizados com ${orderLabel.toLowerCase()} aberta`}
            >
              {hasPendingCash ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              ) : (
                <Receipt size={13} className="text-stone-500 shrink-0" />
              )}
              <span className="font-semibold whitespace-nowrap">Caixa Pendente:</span>
              <strong className={`font-black tabular-nums ${hasPendingCash ? 'text-amber-200' : 'text-stone-200'}`}>
                {summary.pendingCash.length}
              </strong>
              {hasPendingCash && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black text-amber-200 tabular-nums">
                  {formatBrl(summary.pendingCashTotal)}
                </span>
              )}
            </button>

            {/* (c) Ciclo Concluído */}
            <div
              className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs text-stone-300"
              title="Atendimentos finalizados com comanda quitada ou encerrados sem pendência"
            >
              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              <span className="font-semibold whitespace-nowrap">Ciclo Concluído:</span>
              <strong className="font-black text-emerald-300 tabular-nums">
                {summary.completedCycle.length}
              </strong>
              <span className="text-stone-500 tabular-nums">/ {appointments.length}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Drawer Lateral de Conciliação Rápida */}
      {activeDrawerCategory !== null && (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setActiveDrawerCategory(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Conciliação do Dia"
        >
          <aside
            className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Drawer */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-[#B88A44]" />
                  <h2 className="text-base font-black uppercase tracking-wider text-stone-100">
                    Conciliação do Dia
                  </h2>
                </div>
                <p className="text-xs text-stone-400 mt-0.5 capitalize">
                  {formattedDateLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawerCategory(null)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-stone-400 hover:text-stone-100 hover:border-[#B88A44]/50 transition-colors cursor-pointer"
                aria-label="Fechar painel de conciliação"
              >
                <X size={16} />
              </button>
            </div>

            {/* Abas de Filtro Rápido */}
            <div className="flex items-center gap-1.5 px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/40 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveDrawerCategory('all')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeDrawerCategory === 'all'
                    ? 'bg-[#B88A44] text-zinc-950'
                    : 'bg-zinc-900 border border-zinc-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                Todas ({summary.totalAnomalies})
              </button>
              <button
                type="button"
                onClick={() => setActiveDrawerCategory('awaiting_checkin')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeDrawerCategory === 'awaiting_checkin'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-900 border border-zinc-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                Check-in / Atrasados ({summary.awaitingCheckIn.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveDrawerCategory('pending_cash')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeDrawerCategory === 'pending_cash'
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-900 border border-zinc-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                Caixa Pendente ({summary.pendingCash.length})
              </button>
            </div>

            {/* Lista Enxuta de Anomalias */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {drawerItems.length === 0 ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
                  <CheckCircle2 size={28} className="mx-auto text-emerald-400 mb-2" />
                  <p className="text-sm font-bold text-emerald-200">
                    Nenhuma pendência nesta categoria
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    Todos os atendimentos filtrados estão devidamente conciliados.
                  </p>
                </div>
              ) : (
                drawerItems.map((item) => {
                  const isPendingCash = item.kind === 'pending_cash';
                  return (
                    <div
                      key={`${item.kind}-${item.appointment.id}`}
                      className="rounded-2xl border border-amber-500/30 bg-zinc-900/90 p-3.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="rounded bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 text-[10px] font-black font-mono text-[#B88A44] tabular-nums">
                              {formatHourLabel(item.appointment.start)}
                            </span>
                            <span className="rounded bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-300">
                              {isPendingCash
                                ? `${orderLabel} Aberta • ${formatBrl(item.amount)}`
                                : 'Atrasado s/ Check-in'}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-stone-100 truncate mt-1.5">
                            {item.appointment.client}
                          </h3>
                          <p className="text-xs text-stone-400 truncate">
                            {item.appointment.service} • {item.appointment.staffName || 'Profissional'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center gap-2">
                        {isPendingCash ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDrawerCategory(null);
                                onOpenComanda(item.appointment);
                              }}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs px-3 py-2 transition-colors cursor-pointer"
                            >
                              <Receipt size={14} />
                              <span>Cobrar no Caixa</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDrawerCategory(null);
                                onOpenDetails(item.appointment);
                              }}
                              className="rounded-xl border border-zinc-700 bg-zinc-950 hover:border-[#B88A44]/60 text-stone-200 font-bold text-xs px-3 py-2 transition-colors cursor-pointer"
                            >
                              Detalhes
                            </button>
                          </>
                        ) : (
                          <>
                            {onStartAppointment && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveDrawerCategory(null);
                                  onStartAppointment(item.appointment);
                                }}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#B88A44] hover:bg-[#c99a53] text-zinc-950 font-black text-xs px-3 py-2 transition-colors cursor-pointer"
                              >
                                <Play size={13} />
                                <span>Iniciar</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDrawerCategory(null);
                                onOpenDetails(item.appointment);
                              }}
                              className={`${onStartAppointment ? '' : 'flex-1'} rounded-xl border border-zinc-700 bg-zinc-950 hover:border-[#B88A44]/60 text-stone-200 font-bold text-xs px-3 py-2 transition-colors cursor-pointer`}
                            >
                              Abrir Detalhes
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default DailyReconciliationBar;
