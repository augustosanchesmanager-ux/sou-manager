import React from 'react';
import { Link } from 'react-router-dom';
import type { DashboardAppointment } from '../../src/modules/dashboard/types';
import { appointmentStatusLabels, appointmentDotColors } from '../../shared/status/appointment';

interface NextAppointmentCardProps {
  appointments: DashboardAppointment[];
  loading?: boolean;
  onNewAppointment?: () => void;
}

const STATUS_COLORS: Record<string, { dot: string; badge: string }> = {
  confirmed: { dot: appointmentDotColors.confirmed || 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200' },
  pending: { dot: appointmentDotColors.pending || 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200' },
  cancelled: { dot: appointmentDotColors.cancelled || 'bg-slate-300', badge: 'bg-slate-100 text-slate-500 border-slate-200' },
  completed: { dot: appointmentDotColors.completed || 'bg-blue-500', badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200' },
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const getNextAppointment = (appointments: DashboardAppointment[]): DashboardAppointment | null => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const validStatuses = ['pending', 'confirmed'];

  const todayAppointments = appointments
    .filter((apt) => {
      const start = new Date(apt.start_time);
      return (
        start >= todayStart &&
        start < todayEnd &&
        validStatuses.includes(apt.status)
      );
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return todayAppointments[0] || null;
};

export const NextAppointmentCard: React.FC<NextAppointmentCardProps> = ({
  appointments,
  loading,
  onNewAppointment,
}) => {
  const next = getNextAppointment(appointments);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary">my_location</span>
          <h3 className="font-bold text-slate-900 dark:text-white">Próximo atendimento</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!next) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary">my_location</span>
          <h3 className="font-bold text-slate-900 dark:text-white">Próximo atendimento</h3>
        </div>
        <div className="text-center py-4">
          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">event_busy</span>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Nenhum próximo atendimento encontrado.
          </p>
        </div>
        {onNewAppointment && (
          <button
            onClick={onNewAppointment}
            className="w-full mt-3 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Novo agendamento
          </button>
        )}
      </div>
    );
  }

  const status = STATUS_COLORS[next.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;
  const statusLabel = appointmentStatusLabels[next.status as keyof typeof appointmentStatusLabels] || 'Pendente';

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary">my_location</span>
        <h3 className="font-bold text-slate-900 dark:text-white">Próximo atendimento</h3>
      </div>

      <div className="flex items-start gap-3">
        <div className={`w-3 h-3 rounded-full mt-1.5 ${status.dot} flex-shrink-0`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {formatTime(next.start_time)}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status.badge}`}>
              {statusLabel}
            </span>
          </div>

          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
            {next.client_name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {next.service_name}
            {next.staff_name && (
              <>
                <span className="mx-1">·</span>
                {next.staff_name}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-2">
        <Link
          to="/schedule"
          className="flex-1 py-2 text-center text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors"
        >
          Ver na agenda
        </Link>
      </div>
    </div>
  );
};

export default NextAppointmentCard;