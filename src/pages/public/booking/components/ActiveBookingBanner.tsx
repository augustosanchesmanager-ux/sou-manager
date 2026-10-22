/**
 * ActiveBookingBanner - Compact luxury banner displaying client's upcoming booking.
 * Reads saved booking from localStorage ('smg_client_last_booking').
 * Automatically ignores and cleans entries if the booking date/time is in the past.
 */

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, ChevronRight, X, User } from 'lucide-react';

export interface SavedClientBooking {
  tenantSlug: string;
  appointmentId: string;
  publicToken: string;
  servicesNames: string;
  staffName: string;
  startTime: string; // ISO 8601
  formattedDateTime: string;
}

export const STORAGE_KEY_LAST_BOOKING = 'smg_client_last_booking';

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // In restricted iframe or SSR
  }
  return null;
}

export function getSavedActiveBooking(tenantSlug: string): SavedClientBooking | null {
  try {
    const storage = getStorage();
    if (!storage) return null;

    const raw = storage.getItem(STORAGE_KEY_LAST_BOOKING);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SavedClientBooking;
    if (!parsed || !parsed.publicToken || !parsed.startTime) {
      storage.removeItem(STORAGE_KEY_LAST_BOOKING);
      return null;
    }

    // Match tenant slug
    if (parsed.tenantSlug && parsed.tenantSlug !== tenantSlug) {
      return null;
    }

    // Check if appointment is in the past
    const appointmentTime = new Date(parsed.startTime).getTime();
    if (Number.isNaN(appointmentTime) || appointmentTime <= Date.now()) {
      // Past booking: silently clean it
      storage.removeItem(STORAGE_KEY_LAST_BOOKING);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveBooking(booking: SavedClientBooking): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(STORAGE_KEY_LAST_BOOKING, JSON.stringify(booking));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearActiveBooking(): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(STORAGE_KEY_LAST_BOOKING);
  } catch {
    // Ignore storage errors
  }
}

interface ActiveBookingBannerProps {
  tenantSlug: string;
  onOpenManage: (booking: SavedClientBooking) => void;
}

export const ActiveBookingBanner: React.FC<ActiveBookingBannerProps> = ({
  tenantSlug,
  onOpenManage,
}) => {
  const [activeBooking, setActiveBooking] = useState<SavedClientBooking | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const booking = getSavedActiveBooking(tenantSlug);
    setActiveBooking(booking);
  }, [tenantSlug]);

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
  }, []);

  if (!activeBooking || isDismissed) {
    return null;
  }

  return (
    <div
      onClick={() => onOpenManage(activeBooking)}
      className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-neutral-900 to-neutral-900 border border-amber-500/40 text-xs shadow-md transition-all hover:border-amber-500/60 cursor-pointer flex items-center justify-between gap-2.5 active:scale-[0.99]"
      role="region"
      aria-label="Lembrete de agendamento ativo"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="size-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
          <Calendar size={15} />
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
            Seu Próximo Agendamento
          </p>
          <div className="flex items-center gap-2 text-white font-medium truncate mt-0.5">
            <span className="truncate">{activeBooking.servicesNames}</span>
            <span className="text-neutral-500">•</span>
            <span className="text-neutral-300 flex items-center gap-1 text-[11px] flex-shrink-0">
              <Clock size={11} className="text-amber-400" />
              {activeBooking.formattedDateTime}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-[11px] font-bold text-amber-400 border border-neutral-700/60 flex items-center gap-1">
          <span>Ver / Cancelar</span>
          <ChevronRight size={12} />
        </span>

        <button
          type="button"
          onClick={handleDismiss}
          className="size-6 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Dispensar aviso"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};

export default ActiveBookingBanner;
