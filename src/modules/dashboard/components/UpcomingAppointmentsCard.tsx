import React from 'react';
import { Link } from 'react-router-dom';
import { formatAppointmentTime } from '../selectors';
import type { DashboardAppointment } from '../types';

interface UpcomingAppointmentsCardProps {
  appointments: DashboardAppointment[];
  loading: boolean;
  activeMenuId: string | null;
  onToggleMenu: (id: string) => void;
  onSelectAppointment: (appointment: DashboardAppointment) => void;
  onOpenSchedule: () => void;
  onCompleteAppointment: (id: string) => void;
  onCancelAppointment: (id: string) => void;
}

export const UpcomingAppointmentsCard: React.FC<UpcomingAppointmentsCardProps> = ({
  appointments,
  loading,
  activeMenuId,
  onToggleMenu,
  onSelectAppointment,
  onOpenSchedule,
  onCompleteAppointment,
  onCancelAppointment,
}) => (
  <div className="card-boutique p-6">
    <div className="relative z-10 flex justify-between items-center mb-6">
      <h3 className="font-bold text-slate-900 dark:text-white">Proximos Agendamentos</h3>
      <Link to="/schedule" className="relative z-20 inline-flex items-center text-primary text-xs font-bold uppercase tracking-wider hover:text-blue-600 dark:hover:text-white transition-colors">
        Ver Todos
      </Link>
    </div>

    <div className="space-y-4">
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="animate-pulse flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-white/5">
              <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">Nenhum agendamento encontrado.</p>
      ) : (
        appointments.map((appointment) => (
          <div key={appointment.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer group relative">
            <div className="w-12 h-12 rounded-lg bg-white dark:bg-white/5 flex flex-col items-center justify-center border border-slate-200 dark:border-transparent text-primary group-hover:bg-primary/20 group-hover:text-primary transition-colors shrink-0">
              <span className="text-xs font-bold">{formatAppointmentTime(appointment.start_time)}</span>
            </div>
            <div className="flex-1 min-w-0" onClick={() => onSelectAppointment(appointment)}>
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{appointment.client_name || 'Cliente'}</p>
              <p className="text-[10px] text-slate-500 truncate">
                {appointment.service_name || 'Servico'} • {appointment.staff_name || 'Profissional'}
              </p>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => onToggleMenu(appointment.id)}
                className="text-slate-400 dark:text-slate-600 shrink-0 hover:text-slate-700 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10"
              >
                <span className="material-symbols-outlined">more_vert</span>
              </button>
              {activeMenuId === appointment.id && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg shadow-xl py-1 min-w-[160px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (appointment.client_phone) {
                        const date = new Date(appointment.start_time);
                        const text = `Ola ${appointment.client_name.split(' ')[0]}! Passando para confirmar seu agendamento no dia ${date.toLocaleDateString(
                          'pt-BR',
                        )} as ${date.toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })} para o servico ${appointment.service_name}. Nos vemos la!`;
                        window.open(`https://wa.me/55${appointment.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                      }
                    }}
                    className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center gap-2 ${
                      appointment.client_phone ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-slate-400 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">chat</span> WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSchedule}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span> Visualizar
                  </button>
                  <button
                    type="button"
                    onClick={() => onCompleteAppointment(appointment.id)}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span> Concluir
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancelAppointment(appointment.id)}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">cancel</span> Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

