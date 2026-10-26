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
    <div className={`relative inline-block text-left ${isOpen ? 'z-50' : 'z-20'}`} ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="flex size-9 items-center justify-center rounded-xl border border-line dark:border-border-dark bg-card dark:bg-surface-dark text-ink-soft hover:text-ink dark:hover:text-white hover:border-primary/40 transition-colors shadow-xs active:scale-95 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        title="Mais opções do agendamento"
        aria-label="Mais opções do agendamento"
        aria-expanded={isOpen}
      >
        <span className="material-symbols-outlined text-lg">more_vert</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-52 origin-top-right rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-[#1A1610] p-1.5 shadow-2xl ring-1 ring-black/20 animate-fade-in focus:outline-none">
          <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-ink-soft border-b border-line dark:border-border-dark">
            Opções do Atendimento
          </div>

          <div className="py-1 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => handleAction(() => onOpenDetails(appointment))}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-ink dark:text-slate-200 hover:bg-gold-pale dark:hover:bg-white/5 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-base text-ink-soft">visibility</span>
              Ver detalhes
            </button>

            {!isCompleted && !isCancelled && (
              <button
                type="button"
                onClick={() => handleAction(() => onEdit(appointment))}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-ink dark:text-slate-200 hover:bg-gold-pale dark:hover:bg-white/5 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-base text-ink-soft">edit</span>
                Editar atendimento
              </button>
            )}

            {appointment.status === 'pending' && onStatusChange && (
              <button
                type="button"
                onClick={() => handleAction(() => onStatusChange(appointment, 'confirmed', 'Confirmado'))}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-primary-dark dark:text-primary-light hover:bg-primary/10 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                Confirmar horário
              </button>
            )}

            {onWhatsApp && Boolean(appointment.clientPhone) && (
              <button
                type="button"
                onClick={() => handleAction(() => onWhatsApp(appointment))}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-success hover:bg-success/10 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                WhatsApp do cliente
              </button>
            )}

            <button
              type="button"
              onClick={() => handleAction(() => onOpenClient(appointment))}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-ink dark:text-slate-200 hover:bg-gold-pale dark:hover:bg-white/5 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-base text-ink-soft">person</span>
              Ficha do cliente
            </button>

            <button
              type="button"
              onClick={() => handleAction(() => onOpenComanda(appointment))}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-ink dark:text-slate-200 hover:bg-gold-pale dark:hover:bg-white/5 transition-colors text-left"
            >
              <span className="material-symbols-outlined text-base text-primary">receipt_long</span>
              Abrir {orderLabel}
            </button>

            {!isCompleted && !isCancelled && (
              <>
                <div className="my-1 border-t border-line dark:border-border-dark" />
                <button
                  type="button"
                  onClick={() => handleAction(() => onCancel(appointment))}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-danger hover:bg-danger/10 transition-colors text-left"
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
