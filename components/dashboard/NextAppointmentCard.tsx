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
  confirmed: { dot: appointmentDotColors.confirmed || 'bg-success', badge: 'bg-success/10 text-success border-success/30' },
  pending: { dot: appointmentDotColors.pending || 'bg-primary', badge: 'bg-primary/10 text-primary-dark border-primary/30' },
  cancelled: { dot: appointmentDotColors.cancelled || 'bg-slate-400', badge: 'bg-slate-100 text-slate-500 border-slate-200' },
  completed: { dot: appointmentDotColors.completed || 'bg-ink-soft', badge: 'bg-ink-soft/10 text-ink-soft border-ink-soft/30' },
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
      <div className="bg-card border border-line rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary-dark">my_location</span>
          <h3 className="font-bold text-ink">Próximo atendimento</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-gold-pale rounded-xl" />
        </div>
      </div>
    );
  }

  if (!next) {
    return (
      <div className="bg-card border border-line rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-primary-dark">my_location</span>
          <h3 className="font-bold text-ink">Próximo atendimento</h3>
        </div>
        <div className="text-center py-4">
          <span className="material-symbols-outlined text-4xl text-ink-soft">event_busy</span>
          <p className="text-sm text-ink-soft mt-2">
            Nenhum próximo atendimento encontrado.
          </p>
        </div>
        {onNewAppointment && (
          <button
            onClick={onNewAppointment}
            className="w-full mt-3 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary-dark font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
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
    <div className="bg-card border border-line rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary-dark">my_location</span>
        <h3 className="font-bold text-ink">Próximo atendimento</h3>
      </div>

      <div className="flex items-start gap-3">
        <div className={`w-3 h-3 rounded-full mt-1.5 ${status.dot} flex-shrink-0`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-black text-ink">
              {formatTime(next.start_time)}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status.badge}`}>
              {statusLabel}
            </span>
          </div>

          <p className="text-sm font-semibold text-ink truncate">
            {next.client_name}
          </p>
          <p className="text-xs text-ink-soft truncate">
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

      <div className="mt-4 pt-3 border-t border-line flex gap-2">
        <Link
          to="/schedule"
          className="flex-1 py-2 text-center text-xs font-black text-primary hover:bg-primary/10 rounded-lg transition-colors"
        >
          Ver na agenda
        </Link>
      </div>
    </div>
  );
};

export default NextAppointmentCard;