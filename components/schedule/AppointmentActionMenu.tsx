import React, { useState, useRef, useEffect } from 'react';
import type { QueueAppointment } from '../../src/utils/barberQueue';

export interface AppointmentActionMenuProps {
  appointment: QueueAppointment;
  onOpenDetails: (apt: QueueAppointment) => void;
  onEdit: (apt: QueueAppointment) => void;
  onStatusChange?: (apt: QueueAppointment, status: string, label: string) => void;
  onCancel: (apt: QueueAppointment) => void;
  onOpenClient: (apt: QueueAppointment) => void;
  onOpenComanda: (apt: QueueAppointment) => void;
  onWhatsApp?: (apt: QueueAppointment) => void;
  orderLabel?: string;
}

export const AppointmentActionMenu: React.FC<AppointmentActionMenuProps> = ({
  appointment,
  onOpenDetails,
  onEdit,
  onStatusChange,
  onCancel,
  onOpenClient,
  onOpenComanda,
  onWhatsApp,
  orderLabel = 'Comanda',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleAction = (callback: () => void) => {
    setIsOpen(false);
    callback();
  };

  const isCompleted = appointment.status === 'completed';
  const isCancelled = appointment.status === 'cancelled' || appointment.status === 'no_show';

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="flex size-9 items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shadow-xs active:scale-95"
        title="Mais opções do agendamento"
        aria-label="Mais opções"
        aria-expanded={isOpen}
      >
        <span className="material-symbols-outlined text-lg">more_vert</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-52 origin-top-right rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-1.5 shadow-xl ring-1 ring-black/5 animate-fade-in focus:outline-none">
          <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/5">
            Opções do Atendimento
          </div>

          <div className="py-1 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => handleAction(() => onOpenDetails(appointment))}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-base text-slate-500">visibility</span>
              Ver detalhes
            </button>

            {!isCompleted && !isCancelled && (
              <button
                type="button"
                onClick={() => handleAction(() => onEdit(appointment))}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-base text-slate-500">edit</span>
                Editar atendimento
              </button>
            )}

            {appointment.status === 'pending' && onStatusChange && (
              <button
                type="button"
                onClick={() => handleAction(() => onStatusChange(appointment, 'confirmed', 'Confirmado'))}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                Confirmar horário
              </button>
            )}

            {onWhatsApp && Boolean(appointment.clientPhone) && (
              <button
                type="button"
                onClick={() => handleAction(() => onWhatsApp(appointment))}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                WhatsApp do cliente
              </button>
            )}

            <button
              type="button"
              onClick={() => handleAction(() => onOpenClient(appointment))}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-base text-slate-500">person</span>
              Ficha do cliente
            </button>

            <button
              type="button"
              onClick={() => handleAction(() => onOpenComanda(appointment))}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-base text-slate-500">receipt_long</span>
              Abrir {orderLabel}
            </button>

            {!isCompleted && !isCancelled && (
              <>
                <div className="my-1 border-t border-slate-100 dark:border-white/5" />
                <button
                  type="button"
                  onClick={() => handleAction(() => onCancel(appointment))}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-base">cancel</span>
                  Cancelar / No-Show
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentActionMenu;
