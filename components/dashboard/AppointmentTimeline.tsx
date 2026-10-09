import React from 'react';
import { Link } from 'react-router-dom';
import { getBusinessLabels } from '../../src/lib/apps/businessLabels';
import { getEsteticaDemoServiceName } from '../../src/lib/catalog/display';
import type { DashboardAppointment } from '../../src/modules/dashboard/types';
import { appointmentStatusLabels, appointmentDotColors } from '../../shared/status/appointment';

interface AppointmentTimelineProps {
  appSlug?: string | null;
  appointments: DashboardAppointment[];
  loading?: boolean;
  onSelectAppointment?: (appointment: DashboardAppointment) => void;
  onComplete?: (id: string) => void;
  onCancel?: (id: string) => void;
  maxItems?: number;
  onNewAppointment?: () => void;
}

const STATUS_COLORS: Record<string, { dot: string; bg: string; border: string }> = {
  confirmed: { dot: appointmentDotColors.confirmed || 'bg-success', bg: 'bg-success/10', border: 'border-success/30' },
  pending: { dot: appointmentDotColors.pending || 'bg-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
  cancelled: { dot: appointmentDotColors.cancelled || 'bg-slate-400', bg: 'bg-slate-100', border: 'border-slate-200' },
  completed: { dot: appointmentDotColors.completed || 'bg-ink-soft', bg: 'bg-ink-soft/10', border: 'border-ink-soft/30' },
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const AppointmentTimeline: React.FC<AppointmentTimelineProps> = ({
  appSlug,
  appointments,
  loading,
  onSelectAppointment,
  maxItems = 5,
  onNewAppointment,
}) => {
  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';
  const visibleAppointments = appointments.slice(0, maxItems);
  const remainingCount = appointments.length - maxItems;

  if (loading) {
    return (
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-gold-pale p-3">
              <div className="h-12 w-12 rounded-lg bg-gold-soft" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-gold-soft" />
                <div className="h-2 w-1/2 rounded bg-gold-soft" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-card p-6 text-center">
        <span className="material-symbols-outlined text-4xl text-ink-soft">event_busy</span>
        <p className="mt-2 text-sm font-bold text-ink">
          {isEsteticaApp ? 'Nenhum atendimento agendado para hoje.' : 'Nenhum atendimento na fila.'}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          {isEsteticaApp
            ? `Cadastre ${labels.servicePlural.toLowerCase()} e ${labels.professionalPlural.toLowerCase()} para começar a usar a agenda.`
            : 'Aproveite para cadastrar um encaixe ou confirmar retornos.'}
        </p>
        <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {onNewAppointment && (
            <button
              onClick={onNewAppointment}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-xs font-black text-night transition hover:from-primary-dark hover:to-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              {isEsteticaApp ? 'Novo atendimento' : 'Novo agendamento'}
            </button>
          )}
          <Link
            to="/schedule"
            className="flex items-center gap-1 rounded-xl px-4 py-2 text-xs font-black text-primary transition hover:bg-primary/10"
          >
            Ver agenda completa
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line p-5">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-ink-soft">{isEsteticaApp ? 'Agenda da unidade' : 'Fila da cadeira'}</p>
          <h3 className="mt-1 font-bold text-ink">{isEsteticaApp ? 'Próximos atendimentos' : 'Próximos agendamentos'}</h3>
        </div>
        <Link to="/schedule" className="inline-flex items-center gap-1 text-xs font-black text-primary transition hover:text-primary-dark">
          Ver todos
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>

      <div className="divide-y divide-line">
        {visibleAppointments.map((apt) => {
          const status = STATUS_COLORS[apt.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;
          return (
            <button
              key={apt.id}
              onClick={() => onSelectAppointment?.(apt)}
              className="block w-full p-4 text-left transition hover:bg-gold-pale focus:bg-gold-pale focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 shrink-0 text-center">
                  <span className="font-mono text-xs font-bold text-ink">
                    {formatTime(apt.start_time)}
                  </span>
                </div>

                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.dot}`} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {apt.client_name || 'Cliente não informado'}
                  </p>
                  <p className="truncate text-xs text-ink-soft">
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

      {(remainingCount > 0 || onNewAppointment) && (
        <div className="space-y-3 border-t border-line p-3">
          {remainingCount > 0 && (
            <div className="text-center">
              <Link to="/schedule" className="text-xs font-medium text-ink-soft transition hover:text-primary">
                +{remainingCount} {isEsteticaApp ? 'atendimentos' : 'agendamentos'} na agenda
              </Link>
            </div>
          )}
          {onNewAppointment && (
            <button
              onClick={onNewAppointment}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 py-2.5 font-bold text-primary transition hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              {isEsteticaApp ? 'Novo atendimento' : 'Novo agendamento'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AppointmentTimeline;