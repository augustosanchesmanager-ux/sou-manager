/**
 * PublicBookingCancelModal - Modal / Bottom Sheet for Public Booking Cancellation.
 * Allows anonymous clients to securely cancel their booking using their publicToken.
 * Complies with ADR-032 cancellation window and cascades cancellation cleanly.
 */

import type React from 'react';
import { useState, useCallback } from 'react';
import {
  X,
  AlertTriangle,
  Clock,
  Loader2,
  CheckCircle2,
  MessageCircle,
  Scissors,
  User,
  Calendar,
  RotateCw,
} from 'lucide-react';
import { cancelPublicBooking } from '../hooks/bookingService';

export interface PublicBookingCancelModalProps {
  isOpen: boolean;
  tenantSlug: string;
  tenantName: string;
  publicToken: string;
  bookingDetails?: {
    appointmentId?: string;
    staffName?: string;
    servicesNames?: string;
    formattedDateTime?: string;
  } | null;
  whatsappUrl?: string | null;
  cancelWindowMinutes?: number;
  onSuccess: (result: { appointment_id: string; cancelled_at: string }) => void;
  onClose: () => void;
}

export const PublicBookingCancelModal: React.FC<PublicBookingCancelModalProps> = ({
  isOpen,
  tenantSlug,
  tenantName,
  publicToken,
  bookingDetails,
  whatsappUrl,
  cancelWindowMinutes = 120,
  onSuccess,
  onClose,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);

  // Format cancel window in hours or minutes
  const cancelWindowText =
    cancelWindowMinutes >= 60
      ? `${Math.round(cancelWindowMinutes / 60)}h`
      : `${cancelWindowMinutes} minutos`;

  const handleConfirmCancel = useCallback(async () => {
    if (!publicToken || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await cancelPublicBooking(tenantSlug, publicToken);
      setIsCancelled(true);

      // Clean local storage if it was saved
      try {
        localStorage.removeItem('smg_client_last_booking');
      } catch {
        // Ignore storage errors
      }

      onSuccess({
        appointment_id: result.appointment_id,
        cancelled_at: result.cancelled_at,
      });
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'cancellation_window_closed') {
        setErrorMessage(
          `A janela de cancelamento online encerrou (limite de ${cancelWindowText} de antecedência). Entre em contato diretamente com a barbearia pelo WhatsApp para solicitar o cancelamento.`
        );
      } else if (error.code === 'token_expired') {
        setErrorMessage('Este agendamento já expirou ou foi realizado em data anterior.');
      } else if (error.code === 'token_revoked') {
        setErrorMessage('Este agendamento já foi cancelado anteriormente.');
      } else {
        setErrorMessage(error.message || 'Não foi possível cancelar o agendamento. Verifique o link e tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [publicToken, isSubmitting, tenantSlug, cancelWindowText, onSuccess]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
    >
      <div className="w-full max-w-sm sm:max-w-md bg-neutral-950 border border-neutral-800 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle size={16} />
            </div>
            <div>
              <h2 id="cancel-modal-title" className="font-bold text-sm text-white">
                {isCancelled ? 'Agendamento Cancelado' : 'Cancelar Agendamento'}
              </h2>
              <p className="text-[11px] text-neutral-400">{tenantName}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {isCancelled ? (
            /* State: Cancelled Successfully */
            <div className="space-y-4 py-2 text-center">
              <div className="size-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 size={32} />
              </div>

              <div>
                <h3 className="text-base font-bold text-white">Horário Cancelado</h3>
                <p className="text-xs text-neutral-300 mt-1 max-w-xs mx-auto">
                  Seu agendamento foi cancelado e o horário foi liberado na barbearia.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCw size={14} />
                  Fazer Novo Agendamento
                </button>
              </div>
            </div>
          ) : (
            /* State: Confirmation Prompt */
            <>
              {/* Booking Details Card if available */}
              {bookingDetails && (
                <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-2 text-xs">
                  {bookingDetails.servicesNames && (
                    <div className="flex items-center gap-2 text-white">
                      <Scissors size={14} className="text-amber-400 flex-shrink-0" />
                      <span className="font-semibold truncate">{bookingDetails.servicesNames}</span>
                    </div>
                  )}

                  {bookingDetails.staffName && (
                    <div className="flex items-center gap-2 text-neutral-300">
                      <User size={14} className="text-amber-400 flex-shrink-0" />
                      <span>Com {bookingDetails.staffName}</span>
                    </div>
                  )}

                  {bookingDetails.formattedDateTime && (
                    <div className="flex items-center gap-2 text-neutral-300">
                      <Calendar size={14} className="text-amber-400 flex-shrink-0" />
                      <span>{bookingDetails.formattedDateTime}</span>
                    </div>
                  )}

                  {bookingDetails.appointmentId && (
                    <div className="pt-1 border-t border-neutral-800/60 flex items-center justify-between text-[10px] text-neutral-400">
                      <span>Código:</span>
                      <strong className="text-white font-mono">
                        {bookingDetails.appointmentId.slice(0, 8).toUpperCase()}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* Warning Notice */}
              <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-rose-300">
                  <AlertTriangle size={13} className="text-rose-400 flex-shrink-0" />
                  Deseja realmente cancelar este horário?
                </p>
                <p className="text-[11px] text-rose-300/80 leading-relaxed">
                  O horário será liberado para outros clientes e esta ação não poderá ser desfeita.
                </p>
              </div>

              {/* Policy Rule */}
              <div className="flex items-center gap-2 px-1 text-[11px] text-neutral-400">
                <Clock size={12} className="text-amber-400 flex-shrink-0" />
                <span>Cancelamento permitido em até {cancelWindowText} antes do horário.</span>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
                  <p className="leading-snug">{errorMessage}</p>
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-500 transition-colors shadow-sm"
                    >
                      <MessageCircle size={13} />
                      Falar pelo WhatsApp
                    </a>
                  )}
                </div>
              )}

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white font-bold text-xs transition-colors cursor-pointer text-center disabled:opacity-50"
                >
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs transition-all shadow-lg shadow-rose-600/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Cancelando...</span>
                    </>
                  ) : (
                    <span>Sim, Cancelar</span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicBookingCancelModal;
