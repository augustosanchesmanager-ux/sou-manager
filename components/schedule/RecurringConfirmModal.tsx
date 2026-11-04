import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import {
  generateCativaConfirmationMessage,
  buildCativaWhatsAppUrl,
  sanitizePhoneForWhatsApp,
} from '../../src/utils/recurringSchedule';

export interface RecurringAppointmentInfo {
  id: string;
  client: string;
  clientPhone?: string;
  date: string;
  startTime: string;
  service: string;
  staffName: string;
  status: string;
}

export interface RecurringConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: RecurringAppointmentInfo | null;
  shopName?: string;
  onConfirmAppointment: (appointmentId: string) => Promise<void> | void;
  onReleaseAppointment: (appointmentId: string) => Promise<void> | void;
}

export const RecurringConfirmModal: React.FC<RecurringConfirmModalProps> = ({
  isOpen,
  onClose,
  appointment,
  shopName = '',
  onConfirmAppointment,
  onReleaseAppointment,
}) => {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (appointment && isOpen) {
      const initial = generateCativaConfirmationMessage({
        clientName: appointment.client,
        shopName,
        dateStr: appointment.date,
        timeStr: appointment.startTime,
        barberName: appointment.staffName,
      });
      setMessage(initial);
      setBusy(false);
    }
  }, [appointment, isOpen, shopName]);

  if (!appointment) return null;

  const cleanPhone = sanitizePhoneForWhatsApp(appointment.clientPhone || '');
  const hasValidPhone = Boolean(cleanPhone && cleanPhone.length >= 10);
  const whatsAppUrl = hasValidPhone ? buildCativaWhatsAppUrl(appointment.clientPhone || '', message) : '';

  const handleSendWhatsApp = () => {
    if (!whatsAppUrl) return;
    window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
  };

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirmAppointment(appointment.id);
      onClose();
    } catch {
      // tratado pelo parent
    } finally {
      setBusy(false);
    }
  };

  const handleRelease = async () => {
    try {
      setBusy(true);
      await onReleaseAppointment(appointment.id);
      onClose();
    } catch {
      // tratado pelo parent
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cadeira Cativa — Confirmação da Semana"
      maxWidth="lg"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          <button
            type="button"
            onClick={handleRelease}
            disabled={busy}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-500/20 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all flex items-center justify-center gap-1.5"
            title="Libera o horário deste dia mantendo as demais semanas da série"
          >
            <span className="material-symbols-outlined text-sm">event_busy</span>
            Liberar Apenas Esta Semana
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold text-night bg-primary hover:bg-primary-dark transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">check_circle</span>
              {busy ? 'Confirmando...' : 'Confirmar Presença'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Card do Horário da Semana */}
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-500/[0.04] space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <span className="material-symbols-outlined text-xs">event_repeat</span>
              Cadeira Cativa (Horário Fixo)
            </span>
            <span className="text-xs font-bold text-slate-500">
              {appointment.status === 'confirmed' ? '✅ Confirmado' : '⏳ Pendente de Confirmação'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Cliente</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {appointment.client}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Barbeiro</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {appointment.staffName}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Horário</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {appointment.date} às {appointment.startTime}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Serviço</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {appointment.service}
              </span>
            </div>
          </div>
        </div>

        {/* Confirmação via WhatsApp */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase text-slate-500">
              Mensagem de Confirmação (WhatsApp)
            </label>
            {hasValidPhone && (
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-sm">chat</span>
                Enviar no WhatsApp
              </button>
            )}
          </div>

          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl p-3 text-xs leading-relaxed text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary shadow-inner custom-scrollbar resize-y"
            placeholder="Mensagem de confirmação..."
          />

          {!hasValidPhone && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">info</span>
              Cliente sem telefone válido para envio direto pelo WhatsApp.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
