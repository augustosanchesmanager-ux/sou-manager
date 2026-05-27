import React from 'react';
import { Link } from 'react-router-dom';
import type { DashboardAppointment } from '../../src/modules/dashboard/types';

interface AppointmentTimelineProps {
  appointments: DashboardAppointment[];
  loading?: boolean;
  onSelectAppointment?: (appointment: DashboardAppointment) => void;
  onComplete?: (id: string) => void;
  onCancel?: (id: string) => void;
  maxItems?: number;
  onNewAppointment?: () => void;
}

const STATUS_COLORS = {
  confirmed: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-800/30' },
  pending: { dot: 'bg-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-200 dark:border-amber-800/30' },
  cancelled: { dot: 'bg-slate-300', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700' },
  completed: { dot: 'bg-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-200 dark:border-blue-800/30' },
};

const STATUS_LABELS = {
  confirmed: 'Confirmado',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  completed: 'Concluído',
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const AppointmentTimeline: React.FC<AppointmentTimelineProps> = ({
  appointments,
  loading,
  onSelectAppointment,
  maxItems = 5,
  onNewAppointment,
}) => {
  const visibleAppointments = appointments.slice(0, maxItems);
  const remainingCount = appointments.length - maxItems;

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1A1A1A]">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <div className="h-12 w-12 rounded-lg bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-2 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-[#1A1A1A]">
        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">event_busy</span>
        <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">
          Nenhum atendimento na fila.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Aproveite para cadastrar um encaixe ou confirmar retornos.
        </p>
        <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {onNewAppointment && (
            <button
              onClick={onNewAppointment}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Novo agendamento
            </button>
          )}
          <Link
            to="/schedule"
            className="flex items-center gap-1 rounded-xl px-4 py-2 text-xs font-bold text-primary transition hover:bg-primary/10"
          >
            Ver agenda completa
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#1A1A1A]">
      <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-700">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Fila da cadeira</p>
          <h3 className="mt-1 font-bold text-slate-900 dark:text-white">Próximos agendamentos</h3>
        </div>
        <Link to="/schedule" className="inline-flex items-center gap-1 text-xs font-black text-primary transition hover:text-blue-600">
          Ver todos
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {visibleAppointments.map((apt) => {
          const status = STATUS_COLORS[apt.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;
          return (
            <button
              key={apt.id}
              onClick={() => onSelectAppointment?.(apt)}
              className="block w-full p-4 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:hover:bg-slate-800/50 dark:focus:bg-slate-800/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 shrink-0 text-center">
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {formatTime(apt.start_time)}
                  </span>
                </div>

                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.dot}`} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {apt.client_name || 'Cliente não informado'}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {apt.service_name || 'Serviço não informado'}
                    {apt.staff_name && (
                      <>
                        <span className="mx-1">·</span>
                        {apt.staff_name}
                      </>
                    )}
                  </p>
                </div>

                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.bg} ${status.border}`}>
                  {STATUS_LABELS[apt.status as keyof typeof STATUS_LABELS] || 'Pendente'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {(remainingCount > 0 || onNewAppointment) && (
        <div className="space-y-3 border-t border-slate-100 p-3 dark:border-slate-700">
          {remainingCount > 0 && (
            <div className="text-center">
              <Link to="/schedule" className="text-xs font-medium text-slate-500 transition hover:text-primary">
                +{remainingCount} agendamentos na agenda
              </Link>
            </div>
          )}
          {onNewAppointment && (
            <button
              onClick={onNewAppointment}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 py-2.5 font-bold text-primary transition hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Novo agendamento
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AppointmentTimeline;
