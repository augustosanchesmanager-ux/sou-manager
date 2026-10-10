/**
 * StepDateTime - Date and time selection.
 * Horizontal day carousel (7-14 days), snap scroll, "Hoje"/"Amanhã" labels.
 * Time slot grid grouped Manhã (<12h) / Tarde (12h-18h) / Noite (>18h).
 * Slots: tabular-nums font. Empty state per period. Loading skeleton state.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react';
import type { PublicSlot, TimePeriodGroup } from './hooks/types';

interface StepDateTimeProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  selectedSlot: PublicSlot | null;
  onSelectSlot: (slot: PublicSlot) => void;
  groupedSlots: TimePeriodGroup[];
  isLoading: boolean;
  horizonDays: number;
  minBookingNoticeMinutes: number;
  timezone: string;
}

const StepDateTime: React.FC<StepDateTimeProps> = ({
  selectedDate,
  onSelectDate,
  selectedSlot,
  onSelectSlot,
  groupedSlots,
  isLoading,
  horizonDays,
  minBookingNoticeMinutes,
  timezone,
}) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Generate date options (today + horizonDays)
  const dateOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; dayLabel: string; weekday: string; day: string }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i <= horizonDays; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const value = `${y}-${m}-${d}`;

      let dayLabel = '';
      if (i === 0) dayLabel = 'Hoje';
      else if (i === 1) dayLabel = 'Amanhã';

      const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' });
      const day = String(date.getDate()).padStart(2, '0');

      options.push({ value, label: `${weekday}, ${day}`, dayLabel, weekday, day });
    }
    return options;
  }, [horizonDays]);

  // Check if date has available slots (for disabled state)
  const todayStr = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  // Scroll handling
  const checkScroll = useCallback(() => {
    if (!carouselRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

  useEffect(() => {
    checkScroll();
    const carousel = carouselRef.current;
    if (carousel) {
      carousel.addEventListener('scroll', checkScroll, { passive: true });
    }
    return () => {
      if (carousel) carousel.removeEventListener('scroll', checkScroll);
    };
  }, [checkScroll]);

  // Scroll to selected date
  useEffect(() => {
    if (!selectedDate || !carouselRef.current) return;
    const buttons = carouselRef.current.querySelectorAll('[data-date]');
    const selectedButton = carouselRef.current.querySelector(`[data-date="${selectedDate}"]`);
    if (selectedButton) {
      selectedButton.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedDate]);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const scrollAmount = 280; // Approximate width of 2-3 date pills
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Carregando horários">
        {/* Date carousel skeleton */}
        <div className="h-24 animate-pulse">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {[...Array(7)].map((_, i) => (
              <div key={i} className="w-20 h-20 bg-line/50 rounded-xl flex-shrink-0" />
            ))}
          </div>
        </div>
        {/* Time slots skeleton */}
        <div className="space-y-4">
          {['Manhã', 'Tarde', 'Noite'].map((period) => (
            <div key={period} className="animate-pulse">
              <div className="h-6 w-24 bg-line/50 rounded mb-3" />
              <div className="flex flex-wrap gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 w-24 bg-line/50 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No date selected yet
  if (!selectedDate) {
    return (
      <div className="space-y-6">
        {/* Date Carousel */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Calendar className="w-5 h-5 text-ink-soft" />
            <h3 className="font-bold text-ink">Selecione a data</h3>
          </div>
          <div className="relative">
            {showLeftArrow && (
              <button
                type="button"
                onClick={() => scrollCarousel('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 size-8 rounded-full bg-white/90 dark:bg-card-dark/90 border border-line flex items-center justify-center shadow-lg hover:bg-gold-pale/50 transition-colors"
                aria-label="Datas anteriores"
              >
                <ChevronLeft className="w-5 h-5 text-ink" />
              </button>
            )}
            <div
              ref={carouselRef}
              className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-2"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              role="listbox"
              aria-label="Datas disponíveis"
              onScroll={checkScroll}
            >
              {dateOptions.map((opt) => {
                const isSelected = selectedDate === opt.value;
                const isPast = opt.value < todayStr;
                const isDisabled = isPast;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => !isDisabled && onSelectDate(opt.value)}
                    disabled={isDisabled}
                    data-date={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isDisabled}
                    className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-w-[72px] ${
                      isSelected
                        ? 'border-primary bg-gold-pale dark:bg-gold-soft/20'
                        : isDisabled
                        ? 'border-line/50 bg-line/20 text-line cursor-not-allowed'
                        : 'border-line bg-white dark:bg-card-dark hover:border-primary/30'
                    }`}
                  >
                    {opt.dayLabel && (
                      <span className="text-[10px] font-black text-primary uppercase tracking-wide">{opt.dayLabel}</span>
                    )}
                    <span className="font-display font-bold text-lg text-ink tabular-nums">{opt.day}</span>
                    <span className="text-xs text-ink-soft capitalize">{opt.weekday}</span>
                  </button>
                );
              })}
            </div>
            {showRightArrow && (
              <button
                type="button"
                onClick={() => scrollCarousel('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 size-8 rounded-full bg-white/90 dark:bg-card-dark/90 border border-line flex items-center justify-center shadow-lg hover:bg-gold-pale/50 transition-colors"
                aria-label="Próximas datas"
              >
                <ChevronRight className="w-5 h-5 text-ink" />
              </button>
            )}
          </div>
        </div>

        {/* Placeholder for time slots */}
        <div className="text-center py-8 border border-dashed border-line rounded-2xl">
          <Clock className="w-12 h-12 mx-auto text-line mb-3" />
          <p className="text-ink-soft">Selecione uma data para ver os horários disponíveis</p>
        </div>
      </div>
    );
  }

  // Date selected - show time slots
  const hasAnySlots = groupedSlots.some((p) => p.slots.length > 0);

  if (!hasAnySlots) {
    return (
      <div className="space-y-6">
        {/* Selected date display */}
        <div className="flex items-center justify-center gap-2 p-4 bg-gold-pale/50 dark:bg-gold-soft/20 rounded-2xl border border-primary/20">
          <Calendar className="w-5 h-5 text-primary" />
          <span className="font-bold text-ink">
            {dateOptions.find((d) => d.value === selectedDate)?.label || selectedDate}
          </span>
          <button
            type="button"
            onClick={() => onSelectDate('')}
            className="text-sm text-ink-soft hover:text-primary transition-colors"
          >
            Alterar
          </button>
        </div>

        {/* Empty state */}
        <div className="text-center py-8 border border-dashed border-line rounded-2xl">
          <Clock className="w-12 h-12 mx-auto text-line mb-3" />
          <p className="text-ink-soft mb-2">Sem horários disponíveis para esta data</p>
          <p className="text-sm text-ink-soft">Tente outra data ou entre em contato com a barbearia</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selected date display */}
      <div className="flex items-center justify-between gap-2 p-4 bg-gold-pale/50 dark:bg-gold-soft/20 rounded-2xl border border-primary/20">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <span className="font-bold text-ink">
            {dateOptions.find((d) => d.value === selectedDate)?.label || selectedDate}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onSelectDate('')}
          className="text-sm text-ink-soft hover:text-primary transition-colors whitespace-nowrap"
        >
          Alterar data
        </button>
      </div>

      {/* Time slot groups */}
      <div className="space-y-6" role="list" aria-label="Horários disponíveis">
        {groupedSlots.map((period) => (
          <div key={period.label} className={period.slots.length === 0 ? 'hidden' : ''}>
            <h4 className="flex items-center gap-2 text-sm font-bold text-ink-soft mb-3">
              <Clock className="w-4 h-4" />
              {period.label}
            </h4>
            {period.slots.length > 0 ? (
              <div className="flex flex-wrap gap-2" role="listbox" aria-label={`${period.label} - horários`}>
                {period.slots.map((slot) => {
                  const isSelected = selectedSlot?.start_time === slot.start_time && selectedSlot?.staff_id === slot.staff_id;
                  const timeStr = formatTime(slot.start_time);

                  return (
                    <button
                      key={`${slot.staff_id}-${slot.start_time}`}
                      type="button"
                      onClick={() => onSelectSlot(slot)}
                      role="option"
                      aria-selected={isSelected}
                      className={`flex items-center justify-center min-w-[80px] px-4 py-3 rounded-xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 font-mono tabular-nums text-sm ${
                        isSelected
                          ? 'border-primary bg-primary text-night shadow-smg-glow'
                          : 'border-line bg-white dark:bg-card-dark hover:border-primary/30 text-ink'
                      }`}
                    >
                      {timeStr}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-line rounded-xl">
                <p className="text-sm text-line">Sem horários neste período</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StepDateTime;