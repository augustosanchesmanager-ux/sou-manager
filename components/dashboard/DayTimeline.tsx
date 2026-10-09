import React from 'react';
import { Link } from 'react-router-dom';
import { getBusinessLabels } from '../../src/lib/apps/businessLabels';
import { getEsteticaDemoServiceName } from '../../src/lib/catalog/display';
import type { DashboardAppointment } from '../../src/modules/dashboard/types';
import { appointmentStatusLabels, appointmentDotColors } from '../../shared/status/appointment';

interface DayTimelineProps {
  appSlug?: string | null;
  appointments: DashboardAppointment[];
  loading?: boolean;
  onSelectAppointment?: (appointment: DashboardAppointment) => void;
}

const STATUS_COLORS: Record<string, { dot: string; bg: string; border: string }> = {
  confirmed: { dot: appointmentDotColors.confirmed || 'bg-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-200 dark:border-blue-800/30' },
  pending: { dot: appointmentDotColors.pending || 'bg-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-200 dark:border-amber-800/30' },
  cancelled: { dot: appointmentDotColors.cancelled || 'bg-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-200 dark:border-rose-800/30' },
  completed: { dot: appointmentDotColors.completed || 'bg-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-800/30' },
  in_progress: { dot: appointmentDotColors.in_progress || 'bg-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-200 dark:border-sky-800/30' },
  scheduled: { dot: appointmentDotColors.scheduled || 'bg-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-200 dark:border-slate-700' },
  no_show: { dot: appointmentDotColors.no_show || 'bg-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-200 dark:border-slate-700' },
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
};

export const DayTimeline: React.FC<DayTimelineProps> = ({
  appSlug,
  appointments,
  loading,
  onSelectAppointment,
}) => {
  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1A1A1A]">
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">schedule</span>
          <h3 className="font-bold text-slate-900 dark:text-white">Agenda de hoje</h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
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
          {isEsteticaApp ? 'Nenhum atendimento agendado para hoje.' : 'Nenhum agendamento para hoje.'}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {isEsteticaApp
            ? `Cadastre ${labels.servicePlural.toLowerCase()} e ${labels.professionalPlural.toLowerCase()} para começar a usar a agenda.`
            : 'Aproveite para cadastrar um encaixe ou confirmar retornos.'}
        </p>
        <Link
          to="/schedule"
          className="mt-4 inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          Ver agenda completa
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-[#1A1A1A]">
      <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-700">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{isEsteticaApp ? 'Agenda da unidade' : 'Agenda do dia'}</p>
          <h3 className="mt-1 font-bold text-slate-900 dark:text-white">{isEsteticaApp ? 'Atendimentos de hoje' : 'Agendamentos de hoje'}</h3>
        </div>
        <Link to="/schedule" className="inline-flex items-center gap-1 text-xs font-black text-primary transition hover:text-blue-600">
          Ver todos
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {appointments.map((apt) => {
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
                    {getEsteticaDemoServiceName(apt.service_name, appSlug) || `${labels.service} não informado`}
                    {apt.staff_name && (
                      <>
                        <span className="mx-1">·</span>
                        {apt.staff_name}
                      </>
                    )}
                  </p>
                </div>

                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.bg} ${status.border}`}>
                  {appointmentStatusLabels[apt.status as keyof typeof appointmentStatusLabels] || 'Pendente'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DayTimeline;