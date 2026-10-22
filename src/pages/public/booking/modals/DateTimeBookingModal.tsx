/**
 * DateTimeBookingModal - Modal / Bottom Sheet for Phase 3 of Booking:
 * Date and Time slot selection with final booking confirmation.
 */

import type React from 'react';
import { ArrowLeft, X, Clock, Calendar as CalendarIcon, Loader2, ChevronRight, Check } from 'lucide-react';
import type { PublicSlot } from '../hooks/types';

interface DateTimeBookingModalProps {
  isOpen: boolean;
  dateOptions: Array<{ value: string; weekday: string; dayNumber: string; dayLabel: string }>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  availableSlots: PublicSlot[];
  selectedSlot: PublicSlot | null;
  onSelectSlot: (slot: PublicSlot) => void;
  isLoadingSlots: boolean;
  serviceName: string;
  staffName: string;
  totalPrice: number;
  totalDuration: number;
  isSubmitting: boolean;
  onConfirmBooking: () => void;
  onBack: () => void;
  onClose: () => void;
  formatPriceBRL: (price: number) => string;
  formatDuration: (minutes: number) => string;
  formatSlotTime: (iso: string) => string;
}

export const DateTimeBookingModal: React.FC<DateTimeBookingModalProps> = ({
  isOpen,
  dateOptions,
  selectedDate,
  onSelectDate,
  availableSlots,
  selectedSlot,
  onSelectSlot,
  isLoadingSlots,
  serviceName,
  staffName,
  totalPrice,
  totalDuration,
  isSubmitting,
  onConfirmBooking,
  onBack,
  onClose,
  formatPriceBRL,
  formatDuration,
  formatSlotTime,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="datetime-modal-title"
    >
      {/* Backdrop dismiss */}
      <div className="fixed inset-0 -z-10" onClick={onClose} aria-hidden="true" />

      {/* Modal Card */}
      <div className="w-full max-w-md bg-neutral-900 border-t sm:border border-neutral-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-6 duration-200">
        
        {/* Mobile handle */}
        <div className="w-12 h-1 bg-neutral-700 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" aria-hidden="true" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="size-8 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Voltar ao profissional"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">Fase 3 de 3</span>
              <h2 id="datetime-modal-title" className="text-white font-bold text-base sm:text-lg tracking-tight">
                Data e Horário
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Summary Banner */}
          <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                Resumo da Reserva
              </span>
              <p className="text-white font-bold truncate mt-0.5">{serviceName}</p>
              <p className="text-neutral-300 text-[11px] truncate">
                Profissional: <span className="text-amber-400 font-semibold">{staffName}</span>
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-amber-400 font-extrabold text-sm block tabular-nums">
                {formatPriceBRL(totalPrice)}
              </span>
              <span className="text-neutral-400 text-[10px] flex items-center justify-end gap-1 mt-0.5">
                <Clock size={11} className="text-amber-400" />
                {formatDuration(totalDuration)}
              </span>
            </div>
          </div>

          {/* Date Picker Carousel */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
              1. Selecione o Dia
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
              {dateOptions.map((date) => {
                const isSelected = selectedDate === date.value;

                return (
                  <button
                    key={date.value}
                    type="button"
                    onClick={() => onSelectDate(date.value)}
                    className={`flex flex-col items-center justify-center py-2 px-2.5 rounded-2xl flex-shrink-0 min-w-[56px] transition-all cursor-pointer snap-start ${
                      isSelected
                        ? 'bg-amber-500 text-neutral-950 font-black shadow-lg shadow-amber-500/25 scale-[1.02]'
                        : 'bg-neutral-950 border border-neutral-800 text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-tight">
                      {date.dayLabel || date.weekday}
                    </span>
                    <span className="text-sm font-black mt-0.5 tabular-nums">{date.dayNumber}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slots Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
                2. Selecione o Horário
              </span>
              {selectedSlot && (
                <span className="text-xs font-extrabold text-amber-400 flex items-center gap-1">
                  <Check size={12} strokeWidth={3} />
                  {formatSlotTime(selectedSlot.start_time)}
                </span>
              )}
            </div>

            {/* Loading Slots */}
            {isLoadingSlots ? (
              <div className="grid grid-cols-3 gap-2 animate-pulse py-2">
                {['slot-sk-1', 'slot-sk-2', 'slot-sk-3', 'slot-sk-4', 'slot-sk-5', 'slot-sk-6'].map((id) => (
                  <div key={id} className="h-10 bg-neutral-950 border border-neutral-800 rounded-xl" />
                ))}
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center space-y-1 py-6">
                <CalendarIcon className="size-6 text-neutral-500 mx-auto mb-1 opacity-60" />
                <p className="text-xs font-bold text-white">Nenhum horário disponível para esta data</p>
                <p className="text-[11px] text-neutral-400">
                  Tente selecionar outro dia no calendário ou altere o profissional.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 py-1 max-h-52 overflow-y-auto pr-1">
                {availableSlots.map((slot) => {
                  const isSelected = selectedSlot?.start_time === slot.start_time;
                  const timeDisplay = formatSlotTime(slot.start_time);

                  return (
                    <button
                      key={slot.start_time}
                      type="button"
                      onClick={() => onSelectSlot(slot)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-300 border-2 border-amber-500 shadow-md shadow-amber-500/10'
                          : 'bg-neutral-950 text-neutral-100 border-neutral-800 hover:border-amber-500/40 hover:text-white'
                      }`}
                    >
                      {timeDisplay}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex-shrink-0 space-y-2">
          <button
            type="button"
            onClick={onConfirmBooking}
            disabled={!selectedSlot || isSubmitting}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] shadow-lg ${
              selectedSlot && !isSubmitting
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 shadow-amber-500/25 cursor-pointer'
                : 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Garantindo seu horário...</span>
              </>
            ) : (
              <>
                <span>Confirmar Agendamento</span>
                <ChevronRight size={16} />
              </>
            )}
          </button>
          <p className="text-center text-[10px] text-neutral-400">
            Ao confirmar, sua reserva será gravada e abriremos o WhatsApp com seu comprovante.
          </p>
        </div>
      </div>
    </div>
  );
};
