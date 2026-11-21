/**
 * DateTimeBookingModal - Modal / Bottom Sheet for Phase 3 of Booking:
 * Date and Time slot selection with final booking confirmation.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  X,
  Clock,
  Calendar as CalendarIcon,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  Sunrise,
  Sun,
  Moon,
  MessageCircle,
  AlertCircle,
  Users,
  UserPlus,
} from 'lucide-react';
import type { PublicSlot, TimePeriodGroup, PublicClientLookupResult, PublicBookingError } from '../hooks/types';
import { groupSlotsByPeriod } from '../hooks/usePublicBooking';

export function buildFitInWhatsAppMessage(params: {
  services: string;
  staff: string;
  date: string;
  clientName: string;
}): string {
  const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.date)
    ? params.date.split('-').reverse().join('/')
    : params.date || 'hoje';
  const cleanClient = params.clientName.trim() || 'Cliente';
  return `Olá! Gostaria de verificar um encaixe para ${params.services} com ${params.staff} no dia ${formattedDate}. Meu nome é ${cleanClient}.`;
}

interface DateTimeBookingModalProps {
  isOpen: boolean;
  dateOptions: Array<{ value: string; weekday: string; dayNumber: string; dayLabel: string }>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  availableSlots: PublicSlot[];
  groupedSlots?: TimePeriodGroup[];
  selectedSlot: PublicSlot | null;
  onSelectSlot: (slot: PublicSlot) => void;
  isLoadingSlots: boolean;
  serviceName: string;
  staffName: string;
  totalPrice: number;
  totalDuration: number;
  isSubmitting: boolean;
  onConfirmBooking: (
    isForOther?: boolean,
    beneficiaryName?: string,
    dependentClientId?: string | null,
    linkAsDependent?: boolean,
  ) => void;
  onBack: () => void;
  onClose: () => void;
  formatPriceBRL: (price: number) => string;
  formatDuration: (minutes: number) => string;
  formatSlotTime: (iso: string) => string;
  whatsappFitInUrl?: string | null;
  clientName?: string;
  clientPhone?: string;
  bookingError?: PublicBookingError | null;
  onDismissError?: () => void;
  onLookupPhone?: (phoneDigits: string, targetDate?: string | null) => Promise<PublicClientLookupResult>;
}

export const DateTimeBookingModal: React.FC<DateTimeBookingModalProps> = ({
  isOpen,
  dateOptions,
  selectedDate,
  onSelectDate,
  availableSlots,
  groupedSlots,
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
  whatsappFitInUrl,
  clientName,
  clientPhone,
  bookingError,
  onDismissError,
  onLookupPhone,
}) => {
  const [isForOther, setIsForOther] = useState(false);
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [selectedDependentId, setSelectedDependentId] = useState<string | null>(null);
  const [linkAsDependent, setLinkAsDependent] = useState(true);
  const [otherRelationType, setOtherRelationType] = useState<'dependent' | 'guest'>('dependent');
  const [isSameDayConflictModalOpen, setIsSameDayConflictModalOpen] = useState(false);
  const [lookupInfo, setLookupInfo] = useState<PublicClientLookupResult | null>(null);
  const [sameDayBookingInfo, setSameDayBookingInfo] = useState<PublicClientLookupResult | null>(null);

  // Reconciliação / verificação de agendamento existente no mesmo dia e filhos vinculados
  useEffect(() => {
    if (!isOpen || !selectedDate || !clientPhone || !onLookupPhone) {
      setLookupInfo(null);
      setSameDayBookingInfo(null);
      setIsForOther(false);
      setBeneficiaryName('');
      setSelectedDependentId(null);
      setLinkAsDependent(true);
      setOtherRelationType('dependent');
      setIsSameDayConflictModalOpen(false);
      return;
    }

    const phoneDigits = clientPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) return;

    let cancelled = false;
    const checkSameDay = async () => {
      try {
        const res = await onLookupPhone(phoneDigits, selectedDate);
        if (!cancelled) {
          setLookupInfo(res || null);
          if (res?.has_same_day_booking) {
            setSameDayBookingInfo(res);
            setIsSameDayConflictModalOpen(true);
          } else {
            setSameDayBookingInfo(null);
            setIsForOther(false);
            setSelectedDependentId(null);
            setIsSameDayConflictModalOpen(false);
          }
        }
      } catch {
        if (!cancelled) {
          setLookupInfo(null);
          setSameDayBookingInfo(null);
        }
      }
    };

    checkSameDay();

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedDate, clientPhone, onLookupPhone]);

  // Se o submit retornar erro de limite no mesmo dia, abre o Modal Nível 2 automaticamente
  useEffect(() => {
    if (!isOpen || !bookingError) return;
    if (
      bookingError.code === 'same_day_booking_limit' ||
      bookingError.code === 'same_day_beneficiary_required'
    ) {
      setIsSameDayConflictModalOpen(true);
    }
  }, [isOpen, bookingError]);

  // Escape fecha primeiro o Modal Nível 2 se estiver aberto
  useEffect(() => {
    if (!isOpen || !isSameDayConflictModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setIsSameDayConflictModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, isSameDayConflictModalOpen]);
  const periodGroups = useMemo(() => {
    if (groupedSlots && groupedSlots.length > 0) {
      return groupedSlots.filter((group) => group.slots.length > 0);
    }
    return groupSlotsByPeriod(availableSlots).filter((group) => group.slots.length > 0);
  }, [groupedSlots, availableSlots]);

  const totalSlotsCount = useMemo(() => {
    return periodGroups.reduce((acc, g) => acc + g.slots.length, 0);
  }, [periodGroups]);

  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  const initialDate = useMemo(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const parts = selectedDate.split('-').map(Number);
      return { year: parts[0], month: parts[1] - 1 };
    }
    if (dateOptions.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dateOptions[0].value)) {
      const parts = dateOptions[0].value.split('-').map(Number);
      return { year: parts[0], month: parts[1] - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [selectedDate, dateOptions]);

  const [viewYear, setViewYear] = useState<number>(initialDate.year);
  const [viewMonth, setViewMonth] = useState<number>(initialDate.month);

  useEffect(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const parts = selectedDate.split('-').map(Number);
      setViewYear(parts[0]);
      setViewMonth(parts[1] - 1);
    }
  }, [selectedDate]);

  const activeMonthLabel = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    const monthName = d.toLocaleDateString('pt-BR', { month: 'long' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${viewYear}`;
  }, [viewYear, viewMonth]);

  const minDateStr = dateOptions[0]?.value || '';
  const maxDateStr = dateOptions[dateOptions.length - 1]?.value || '';

  const canGoPrevMonth = useMemo(() => {
    if (!minDateStr) return false;
    const parts = minDateStr.split('-').map(Number);
    return viewYear > parts[0] || (viewYear === parts[0] && viewMonth > parts[1] - 1);
  }, [viewYear, viewMonth, minDateStr]);

  const canGoNextMonth = useMemo(() => {
    if (!maxDateStr) return false;
    const parts = maxDateStr.split('-').map(Number);
    return viewYear < parts[0] || (viewYear === parts[0] && viewMonth < parts[1] - 1);
  }, [viewYear, viewMonth, maxDateStr]);

  const handlePrevMonth = () => {
    if (!canGoPrevMonth) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (!canGoNextMonth) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const availableSet = new Set(dateOptions.map((d) => d.value));

    const cells: Array<{
      key: string;
      dayNumber: number;
      dateValue: string | null;
      isAvailable: boolean;
      isSelected: boolean;
    }> = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({
        key: `empty-${i}`,
        dayNumber: 0,
        dateValue: null,
        isAvailable: false,
        isSelected: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const mm = String(viewMonth + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateValue = `${viewYear}-${mm}-${dd}`;
      const isAvailable = availableSet.has(dateValue);
      const isSelected = selectedDate === dateValue;

      cells.push({
        key: dateValue,
        dayNumber: day,
        dateValue,
        isAvailable,
        isSelected,
      });
    }

    return cells;
  }, [viewYear, viewMonth, dateOptions, selectedDate]);

  // Current week (7 days) or the 7-day chunk containing the selectedDate
  const weekDays = useMemo(() => {
    if (dateOptions.length <= 7) return dateOptions;

    const selectedIdx = dateOptions.findIndex((d) => d.value === selectedDate);
    if (selectedIdx === -1 || selectedIdx < 7) {
      return dateOptions.slice(0, 7);
    }

    const startIndex = Math.min(
      Math.floor(selectedIdx / 7) * 7,
      Math.max(0, dateOptions.length - 7)
    );
    return dateOptions.slice(startIndex, startIndex + 7);
  }, [dateOptions, selectedDate]);

  if (!isOpen) return null;

  const isSameDayError =
    bookingError?.code === 'same_day_booking_limit' ||
    bookingError?.code === 'same_day_beneficiary_required';

  const modalMarkup = (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
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

          {/* Date Picker (Semana Atual + Expandir Calendário Mensal) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  1. Selecione o Dia
                </span>
                <span className="text-[11px] font-semibold text-amber-400 capitalize block">
                  {activeMonthLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCalendarExpanded((prev) => !prev)}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-colors cursor-pointer"
              >
                <CalendarIcon size={13} />
                <span>{isCalendarExpanded ? 'Ver semana' : 'Expandir calendário'}</span>
              </button>
            </div>

            {isCalendarExpanded ? (
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
                {/* Month Navigation */}
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    disabled={!canGoPrevMonth}
                    className={`size-7 rounded-lg border flex items-center justify-center transition-colors ${
                      canGoPrevMonth
                        ? 'border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white cursor-pointer'
                        : 'border-neutral-900 text-neutral-700 cursor-not-allowed opacity-40'
                    }`}
                    title="Mês anterior"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <span className="text-xs font-bold text-white capitalize">
                    {activeMonthLabel}
                  </span>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    disabled={!canGoNextMonth}
                    className={`size-7 rounded-lg border flex items-center justify-center transition-colors ${
                      canGoNextMonth
                        ? 'border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white cursor-pointer'
                        : 'border-neutral-900 text-neutral-700 cursor-not-allowed opacity-40'
                    }`}
                    title="Próximo mês"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((w) => (
                    <span key={w} className="text-[10px] font-bold text-neutral-500 uppercase">
                      {w}
                    </span>
                  ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((cell) => {
                    if (!cell.dateValue) {
                      return <div key={cell.key} className="h-8" />;
                    }

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        disabled={!cell.isAvailable}
                        onClick={() => {
                          if (cell.dateValue) {
                            onSelectDate(cell.dateValue);
                          }
                        }}
                        className={`h-8 rounded-xl text-xs font-bold transition-all flex items-center justify-center tabular-nums ${
                          cell.isSelected
                            ? 'bg-amber-500 text-neutral-950 font-black shadow-md shadow-amber-500/25 scale-105'
                            : cell.isAvailable
                            ? 'text-neutral-200 hover:bg-neutral-800 hover:text-amber-400 cursor-pointer'
                            : 'text-neutral-700 cursor-not-allowed opacity-30'
                        }`}
                      >
                        {cell.dayNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Week view (Semana Atual) */
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
                {weekDays.map((date) => {
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
            )}
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
            {!selectedDate ? (
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center space-y-1 py-6">
                <CalendarIcon className="size-6 text-neutral-500 mx-auto mb-1 opacity-60" />
                <p className="text-xs font-bold text-white">Selecione uma data acima</p>
                <p className="text-[11px] text-neutral-400">
                  Escolha um dia para carregar os horários disponíveis.
                </p>
              </div>
            ) : isLoadingSlots ? (
              <div className="grid grid-cols-3 gap-2 animate-pulse py-2">
                {['slot-sk-1', 'slot-sk-2', 'slot-sk-3', 'slot-sk-4', 'slot-sk-5', 'slot-sk-6'].map((id) => (
                  <div key={id} className="h-10 bg-neutral-950 border border-neutral-800 rounded-xl" />
                ))}
              </div>
            ) : totalSlotsCount === 0 ? (
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 text-center space-y-1 py-6">
                <CalendarIcon className="size-6 text-neutral-500 mx-auto mb-1 opacity-60" />
                <p className="text-xs font-bold text-white">Nenhum horário disponível para esta data</p>
                <p className="text-[11px] text-neutral-400">
                  Tente selecionar outro dia no calendário ou altere o profissional.
                </p>
              </div>
            ) : (
              <div className="space-y-4 py-1 max-h-56 overflow-y-auto pr-1">
                {periodGroups.map((group) => {
                  const Icon = group.label === 'Manhã' ? Sunrise : group.label === 'Tarde' ? Sun : Moon;
                  return (
                    <div key={group.label} className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                        <Icon size={13} className="text-amber-400 flex-shrink-0" />
                        <span>{group.label}</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {group.slots.map((slot) => {
                          const isSelected = selectedSlot?.start_time === slot.start_time;
                          const timeDisplay = formatSlotTime(slot.start_time);

                          return (
                            <button
                              key={`${slot.staff_id}-${slot.start_time}`}
                              type="button"
                              onClick={() => onSelectSlot(slot)}
                              className={`py-2 px-2 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer active:scale-95 ${
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
                    </div>
                  );
                })}
              </div>
            )}

            {selectedDate && !isLoadingSlots && whatsappFitInUrl && (
              <div className="pt-2">
                <a
                  href={whatsappFitInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500/40 text-neutral-300 hover:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle size={14} className="text-emerald-400 flex-shrink-0" />
                  <span>Solicitar encaixe via WhatsApp</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex-shrink-0 space-y-3">
          {/* Seletor rápido de filhos vinculados (quando titular não tem colisão no mesmo dia) */}
          {!sameDayBookingInfo?.has_same_day_booking && (lookupInfo?.dependents?.length || 0) > 0 && (
            <div className="p-3 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                  <Users size={12} className="text-amber-400" />
                  <span>Para quem é o atendimento?</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsForOther(false);
                    setSelectedDependentId(null);
                    setBeneficiaryName('');
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    !isForOther
                      ? 'bg-amber-400 text-neutral-950 shadow-sm'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  Para mim ({(clientName || lookupInfo?.client_name || 'Titular').split(' ')[0]})
                </button>
                {lookupInfo?.dependents?.map((dep) => {
                  const isSelectedDep = isForOther && selectedDependentId === dep.id;
                  return (
                    <button
                      key={dep.id}
                      type="button"
                      onClick={() => {
                        setIsForOther(true);
                        setSelectedDependentId(dep.id);
                        setBeneficiaryName(dep.name);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelectedDep
                          ? 'bg-amber-400 text-neutral-950 shadow-sm'
                          : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                      }`}
                    >
                      Para {dep.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setIsForOther(true);
                    setSelectedDependentId(null);
                    setBeneficiaryName('');
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isForOther && !selectedDependentId
                      ? 'bg-amber-400 text-neutral-950 shadow-sm'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  + Outro filho
                </button>
              </div>
              {isForOther && !selectedDependentId && (
                <div className="pt-1">
                  <input
                    type="text"
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    placeholder="Nome do filho ou dependente..."
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 focus:border-amber-400 rounded-xl text-xs text-white placeholder:text-neutral-500 outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Resumo inline quando há agendamento no mesmo dia (permite reabrir Modal Nível 2) */}
          {(sameDayBookingInfo?.has_same_day_booking || isSameDayError) && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-center justify-between gap-2.5 animate-in fade-in duration-200">
              <div className="flex items-start gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs min-w-0">
                  {isForOther && beneficiaryName.trim().length >= 3 ? (
                    <p className="font-semibold text-amber-200 truncate">
                      Atendimento para: <strong className="text-amber-300">{beneficiaryName.trim()}</strong>
                      {!selectedDependentId && (
                        <span className="text-[10px] text-neutral-300 ml-1">
                          ({linkAsDependent ? 'vincular ao cadastro' : 'sem vincular'})
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="font-bold text-amber-300">
                      Você já possui agendamento nesta data
                      {sameDayBookingInfo?.existing_booking_time ? ` às ${sameDayBookingInfo.existing_booking_time}` : ''}.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSameDayConflictModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-amber-400 text-neutral-950 text-[11px] font-bold shrink-0 hover:bg-amber-300 transition-colors cursor-pointer"
              >
                {isForOther && beneficiaryName.trim().length >= 3 ? 'Alterar' : 'Resolver'}
              </button>
            </div>
          )}

          {/* Erro inline de submissão (visível dentro do modal mesmo se o toast expirar) */}
          {bookingError && !isSameDayError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 flex items-start justify-between gap-2 text-xs"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{bookingError.message}</span>
              </div>
              {onDismissError && (
                <button
                  type="button"
                  onClick={onDismissError}
                  className="text-red-300 hover:text-white p-0.5 shrink-0"
                  aria-label="Fechar aviso"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {(() => {
            const isSameDayBlocked = Boolean(
              ((sameDayBookingInfo?.has_same_day_booking || isSameDayError) && (!isForOther || beneficiaryName.trim().length < 3)) ||
              (isForOther && beneficiaryName.trim().length < 3)
            );

            return (
              <button
                type="button"
                onClick={() => {
                  if (isSameDayBlocked) {
                    setIsSameDayConflictModalOpen(true);
                    return;
                  }
                  if (!selectedSlot || isSubmitting) return;
                  onConfirmBooking(
                    isForOther,
                    isForOther ? beneficiaryName.trim() : undefined,
                    isForOther ? selectedDependentId : null,
                    isForOther ? linkAsDependent : undefined,
                  );
                }}
                disabled={!selectedSlot || isSubmitting}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] shadow-lg ${
                  selectedSlot && !isSubmitting && !isSameDayBlocked
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 shadow-amber-500/25 cursor-pointer'
                    : selectedSlot && !isSubmitting && isSameDayBlocked
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 cursor-pointer'
                      : 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Garantindo seu horário...</span>
                  </>
                ) : isSameDayBlocked && selectedSlot ? (
                  <>
                    <AlertCircle size={16} />
                    <span>Definir quem será atendido</span>
                  </>
                ) : (
                  <>
                    <span>{isForOther ? `Confirmar para ${beneficiaryName.trim() || 'Outra Pessoa'}` : 'Confirmar Agendamento'}</span>
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            );
          })()}
          <p className="text-center text-[10px] text-neutral-400">
            Ao confirmar, sua reserva será gravada e abriremos o WhatsApp com seu comprovante.
          </p>
        </div>
      </div>
    </div>
  );

  const level2ModalMarkup = isSameDayConflictModalOpen ? (
    <div
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sameday-conflict-title"
    >
      <div
        className="fixed inset-0 -z-10"
        onClick={() => setIsSameDayConflictModalOpen(false)}
        aria-hidden="true"
      />

      <div className="w-full max-w-md bg-neutral-900 border-t sm:border border-amber-500/35 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-start justify-between gap-3 bg-amber-500/10">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 id="sameday-conflict-title" className="text-sm font-bold text-white">
                Você já possui um agendamento nesta data
              </h4>
              <p className="text-xs text-amber-200/90 mt-0.5">
                {sameDayBookingInfo?.existing_booking_time
                  ? `Horário reservado às ${sameDayBookingInfo.existing_booking_time}${sameDayBookingInfo.existing_staff_name ? ` com ${sameDayBookingInfo.existing_staff_name}` : ''}.`
                  : 'Só é permitido 1 horário por dia para a mesma pessoa.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSameDayConflictModalOpen(false)}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            aria-label="Fechar alerta"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <p className="text-xs text-neutral-300 leading-relaxed">
            Este novo horário é para <strong className="text-white">um filho ou amigo</strong>? Escolha uma opção abaixo:
          </p>

          {(lookupInfo?.dependents?.length || 0) > 0 && (
            <div className="space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Filhos / Dependentes já cadastrados
              </span>
              <div className="flex flex-wrap gap-2">
                {lookupInfo?.dependents?.map((dep) => {
                  const isSelectedDep = isForOther && selectedDependentId === dep.id;
                  return (
                    <button
                      key={dep.id}
                      type="button"
                      onClick={() => {
                        setIsForOther(true);
                        setOtherRelationType('dependent');
                        setSelectedDependentId(dep.id);
                        setBeneficiaryName(dep.name);
                        setLinkAsDependent(true);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelectedDep
                          ? 'bg-amber-400 text-neutral-950 shadow-md shadow-amber-400/20'
                          : 'bg-neutral-800 text-neutral-200 border border-neutral-700 hover:border-amber-400/50'
                      }`}
                    >
                      {dep.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setIsForOther(true);
                setOtherRelationType('dependent');
                setLinkAsDependent(true);
                if (selectedDependentId) {
                  setSelectedDependentId(null);
                  setBeneficiaryName('');
                }
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                isForOther && otherRelationType === 'dependent'
                  ? 'bg-amber-500/15 border-amber-400 text-white'
                  : 'bg-neutral-800/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <UserPlus size={14} className="text-amber-400" />
                <span>Filho / Dependente</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Cadastrar ou selecionar filho
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsForOther(true);
                setOtherRelationType('guest');
                setSelectedDependentId(null);
                setLinkAsDependent(false);
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                isForOther && otherRelationType === 'guest'
                  ? 'bg-amber-500/15 border-amber-400 text-white'
                  : 'bg-neutral-800/60 border-neutral-800 text-neutral-300 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Users size={14} className="text-amber-400" />
                <span>Amigo / Parente</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Agendamento pontual
              </p>
            </button>
          </div>

          {isForOther && (
            <div className="space-y-3 pt-1">
              <div>
                <label htmlFor="level2-beneficiary-name" className="block text-xs font-bold text-neutral-200 mb-1.5">
                  Nome de quem será atendido <strong className="text-amber-400">*</strong>
                </label>
                <input
                  id="level2-beneficiary-name"
                  type="text"
                  value={beneficiaryName}
                  onChange={(e) => {
                    setBeneficiaryName(e.target.value);
                    setSelectedDependentId(null);
                  }}
                  placeholder={otherRelationType === 'dependent' ? 'Ex: Enzo (filho)' : 'Ex: Pedro (amigo)'}
                  className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-700 focus:border-amber-400 rounded-xl text-sm text-white placeholder:text-neutral-500 outline-none"
                />
                {beneficiaryName.trim().length > 0 && beneficiaryName.trim().length < 3 && (
                  <p className="text-[11px] text-red-400 mt-1">Informe pelo menos 3 letras para o nome.</p>
                )}
              </div>

              {!selectedDependentId && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkAsDependent}
                    onChange={(e) => setLinkAsDependent(e.target.checked)}
                    className="mt-0.5 accent-amber-400 w-4 h-4 rounded cursor-pointer"
                  />
                  <span className="text-xs text-neutral-200 leading-snug">
                    <strong className="block text-white">Vincular ao meu cadastro</strong>
                    <span className="text-[11px] text-neutral-400">
                      Salva como dependente no seu perfil para facilitar os próximos agendamentos.
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 border-t border-neutral-800 bg-neutral-950/60 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => {
              setIsForOther(false);
              setSelectedDependentId(null);
              setBeneficiaryName('');
              setIsSameDayConflictModalOpen(false);
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Era para mim (trocar data)
          </button>
          <button
            type="button"
            disabled={!isForOther || beneficiaryName.trim().length < 3}
            onClick={() => {
              setIsSameDayConflictModalOpen(false);
              if (onDismissError) onDismissError();
            }}
            className={`w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
              isForOther && beneficiaryName.trim().length >= 3
                ? 'bg-amber-400 hover:bg-amber-300 text-neutral-950 cursor-pointer'
                : 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
            }`}
          >
            Continuar para {beneficiaryName.trim() || 'esta pessoa'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {typeof document !== 'undefined' ? createPortal(modalMarkup, document.body) : modalMarkup}
      {level2ModalMarkup && (typeof document !== 'undefined' ? createPortal(level2ModalMarkup, document.body) : level2ModalMarkup)}
    </>
  );
};
