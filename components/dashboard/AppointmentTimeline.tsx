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
  confirmed: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-200' },
  pending: { dot: 'bg-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-200' },
  cancelled: { dot: 'bg-slate-300', bg: 'bg-slate-100', border: 'border-slate-200' },
  completed: { dot: 'bg-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-200' },
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
  onComplete,
  onCancel,
  maxItems = 5,
  onNewAppointment,
}) => {
  const visibleAppointments = appointments.slice(0, maxItems);
  const remainingCount = appointments.length - maxItems;

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
              <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center">
        <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">event_busy</span>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Nenhum agendamento para hoje.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Aproveite para cadastrar um encaixe ou confirmar retornos.
        </p>
        <div className="flex items-center justify-center gap-3 mt-4">
          {onNewAppointment && (
            <button
              onClick={onNewAppointment}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Novo agendamento
            </button>
          )}
          <Link
            to="/schedule"
            className="px-4 py-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl transition-colors"
          >
            Ver agenda completa →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <h3 className="font-bold text-slate-900 dark:text-white">Agenda de hoje</h3>
        <Link to="/schedule" className="text-xs font-bold text-primary hover:text-blue-600 transition-colors">
          Ver todos →
        </Link>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {visibleAppointments.map((apt) => {
          const status = STATUS_COLORS[apt.status] || STATUS_COLORS.pending;
          return (
            <div
              key={apt.id}
              onClick={() => onSelectAppointment?.(apt)}
              className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 flex-shrink-0 text-center">
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                    {formatTime(apt.start_time)}
                  </span>
                </div>
                
                <div className={`w-2.5 h-2.5 rounded-full ${status.dot} flex-shrink-0`} />
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {apt.client_name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {apt.service_name}
                    {apt.staff_name && (
                      <>
                        <span className="mx-1">·</span>
                        {apt.staff_name}
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.bg} ${status.border} border`}>
                    {STATUS_LABELS[apt.status as keyof typeof STATUS_LABELS] || 'Pendente'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {remainingCount > 0 && (
        <div className="p-3 text-center border-t border-slate-100 dark:border-slate-700">
          <Link to="/schedule" className="text-xs font-medium text-slate-500 hover:text-primary transition-colors">
            +{remainingCount} agendamentos →
          </Link>
        </div>
      )}
    </div>
  );
};

export default AppointmentTimeline;