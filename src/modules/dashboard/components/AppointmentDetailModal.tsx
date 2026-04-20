import React from 'react';
import Modal from '../../../../components/ui/Modal';
import type { DashboardAppointment } from '../types';

interface AppointmentDetailModalProps {
  appointment: DashboardAppointment | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenSchedule: () => void;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  appointment,
  isOpen,
  onClose,
  onOpenSchedule,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Resumo do Atendimento" maxWidth="md">
    {appointment && (() => {
      const startDate = new Date(appointment.start_time);
      const statusLabels: Record<string, string> = {
        confirmed: 'Confirmado',
        pending: 'Pendente',
        completed: 'Concluido',
      };
      const statusBgColors: Record<string, string> = {
        confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      };
      const statusIcons: Record<string, string> = {
        confirmed: 'check_circle',
        pending: 'schedule',
        completed: 'task_alt',
      };

      return (
        <div className="space-y-5">
          <div className="flex justify-center">
            <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold ${statusBgColors[appointment.status] || 'bg-slate-100 text-slate-700'}`}>
              <span className="material-symbols-outlined text-base">{statusIcons[appointment.status] || 'info'}</span>
              {statusLabels[appointment.status] || appointment.status}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-2xl">person</span>
              </div>
              <div className="min-w-0">
                <p className="text-base font-black text-slate-900 dark:text-white truncate">{appointment.client_name}</p>
                {appointment.client_phone && (
                  <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-sm">phone</span>
                    {appointment.client_phone}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">Servico</p>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">content_cut</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{appointment.service_name}</p>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">Profissional</p>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">badge</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{appointment.staff_name || '-'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Data</p>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Horario</p>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3 border-t border-slate-100 dark:border-white/5 mt-2">
            <button
              onClick={() => {
                if (appointment.client_phone) {
                  const text = `Ola ${appointment.client_name.split(' ')[0]}! Passando para confirmar seu agendamento no dia ${startDate.toLocaleDateString(
                    'pt-BR',
                  )} as ${startDate.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} para o servico ${appointment.service_name}. Nos vemos la!`;
                  window.open(`https://wa.me/55${appointment.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                }
              }}
              disabled={!appointment.client_phone}
              className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-bold bg-[#25D366] text-white hover:bg-[#20b857] shadow-lg shadow-[#25D366]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
            >
              <span className="material-symbols-outlined text-sm">chat</span> WhatsApp
            </button>

            <button
              onClick={onOpenSchedule}
              className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">calendar_month</span>
              Agenda Completa
            </button>
          </div>
        </div>
      );
    })()}
  </Modal>
);

