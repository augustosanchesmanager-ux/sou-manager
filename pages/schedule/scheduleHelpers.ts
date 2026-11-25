import {
  appointmentDotColors,
  normalizeAppointmentStatus,
} from '../../shared/status/appointment';
import type {
  ExistingAppointmentsAction,
  ScheduleBlock,
  ScheduleBlockInput,
} from '../../services/scheduleBlocksApi';
import type { RecurrenceFrequency } from '../../src/utils/recurringSchedule';

export interface DBStaff {
  id: string;
  name: string;
  role: string;
  avatar: string;
  commission_rate?: number | string | null;
}

export interface DBService {
  id: string;
  name: string;
  duration: number;
  buffer?: number;
  price?: number;
}

export interface DBClient {
  id: string;
  name: string;
  phone: string;
  parent_client_id?: string | null;
  is_shared_phone?: boolean | null;
}

export interface CalendarAppointment {
  id: string;
  clientId?: string | null;
  staffId: string;
  serviceId?: string | null;
  start: number;
  duration: number;
  client: string;
  service: string;
  status: string;
  color: string;
  staffName: string;
  clientPhone: string;
  price: number;
  startTime: string;
  notes: string;
  date: string;
  source?: string | null;
  channel?: string | null;
  isOverbooked?: boolean;
  isRecurring?: boolean;
  attendedAt?: string | null;
  attendedAtSource?: string | null;
  duration_minutes?: number;
}

export type DisplayMode = 'calendar' | 'list' | 'chair';
export type ListPeriod = 'today' | 'tomorrow' | 'week' | 'month' | 'custom';
export type QuickChip = 'all' | 'today' | 'pending' | 'confirmed' | 'in_progress' | 'overdue' | 'without_comanda';

export const SCHEDULE_START_HOUR = 7;
export const SCHEDULE_END_HOUR = 24;
export const SCHEDULE_SLOT_DURATION = 0.5;
export const SCHEDULE_TOTAL_HOURS = SCHEDULE_END_HOUR - SCHEDULE_START_HOUR;

export const isMissingColumnError = (error: { code?: string; message?: string } | null | undefined, columnName: string) => (
  error?.code === '42703' && String(error?.message || '').includes(columnName)
);

export const isHiddenFromScheduleMissingError = (error: { code?: string; message?: string } | null | undefined) => (
  isMissingColumnError(error, 'hidden_from_schedule')
);

export interface AppointmentFiltersState {
  date: string;
  period: ListPeriod;
  professional: string;
  status: string;
  service: string;
  origin: string;
  search: string;
  quickChip: QuickChip;
}

export interface EnrichedAppointment extends CalendarAppointment {
  normalizedStatus: string;
  statusLabel: string;
  statusIcon: string;
  statusBadgeClassName: string;
  originLabel: string;
  isOverdue: boolean;
  shortNotes: string;
  searchIndex: string;
  hasOpenComanda: boolean;
  comandaId: string | null;
  comandaStatus: string | null;
  comandaTotal: number | null;
  isAwaitingCheckout: boolean;
}

export interface NewAppointmentForm {
  client: string;
  clientPhone?: string;
  service: string;
  serviceIds: string[];
  staffId: string;
  date: string;
  start: number;
  duration: number;
  notes: string;
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceOccurrences?: number;
  recurrenceCustomDays?: number;
  recurrenceEndDate?: string;
}

export interface ScheduleBlockForm {
  type: 'full_day' | 'time_range';
  professionalScope: 'all' | 'specific';
  professionalId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  notes: string;
  recurrence: 'none' | 'weekly';
  recurrenceUntil: string;
  actionForExisting: ExistingAppointmentsAction;
}

export type ScheduleConfirmIntent =
  | { type: 'deleteBlock'; block: ScheduleBlock }
  | { type: 'saveImpactedBlock'; payload: ScheduleBlockInput; impacted: CalendarAppointment[] }
  | { type: 'statusChange'; appointment: CalendarAppointment; nextStatus: string; confirmationLabel: string };

export const roleLabels: Record<string, string> = { Manager: 'Gerente', Barber: 'Barbeiro', Receptionist: 'Recepcionista' };

export const statusColors: Record<string, string> = appointmentDotColors;

export const getAtelierAppointmentStyle = (status: string, comandaStatus?: string | null) => {
  const normalizedStatus = normalizeAppointmentStatus(status);
  if (normalizedStatus === 'completed') {
    if (comandaStatus === 'open') {
      return {
        card: 'bg-amber-500/15 border-l-4 border-l-amber-500 border-t border-r border-b border-amber-500/40 ring-1 ring-amber-500/30',
        clientText: 'text-amber-100 font-black',
        serviceText: 'text-amber-300 font-semibold',
        timeBadge: 'bg-amber-500 text-slate-950 font-black',
      };
    }

    if (comandaStatus === 'paid' || !comandaStatus) {
      return {
        card: 'bg-emerald-950/40 border-l-4 border-l-emerald-500 border-t border-r border-b border-emerald-500/30 opacity-85',
        clientText: 'text-emerald-100 font-bold',
        serviceText: 'text-emerald-300/80',
        timeBadge: 'bg-emerald-600 text-white font-bold',
      };
    }

    return {
      card: 'bg-zinc-950/90 border-l-2 border-l-stone-700 border-t border-r border-b border-zinc-900 opacity-50',
      clientText: 'text-stone-400 font-medium',
      serviceText: 'text-stone-500',
      timeBadge: 'bg-zinc-900 text-stone-500',
    };
  }

  switch (normalizedStatus) {
    case 'in_progress':
      return {
        card: 'bg-[#B88A44]/15 border-l-4 border-l-[#B88A44] border-t border-r border-b border-[#B88A44]/30',
        clientText: 'text-stone-50 font-black',
        serviceText: 'text-[#F3D9A4] font-medium',
        timeBadge: 'bg-[#B88A44] text-stone-950 font-bold',
      };
    case 'pending':
      return {
        card: 'bg-zinc-900 border-l-4 border-l-red-800 border-t border-r border-b border-zinc-800',
        clientText: 'text-stone-200 font-bold',
        serviceText: 'text-stone-400',
        timeBadge: 'bg-red-950/80 text-red-300 border border-red-800/40',
      };
    case 'confirmed':
    default:
      return {
        card: 'bg-zinc-900 border-l-4 border-l-[#B88A44] border-t border-r border-b border-zinc-800 hover:border-l-[#D99A2B]',
        clientText: 'text-stone-300 font-bold',
        serviceText: 'text-stone-400',
        timeBadge: 'bg-zinc-950 text-stone-300 border border-[#B88A44]/30',
      };
  }
};

export const getComandaStatusDisplay = (
  comandaStatus: string | null | undefined,
  isEsteticaApp = false,
): { label: string; toneClassName: string } => {
  switch (comandaStatus) {
    case 'open':
      return {
        label: isEsteticaApp ? 'Aberto' : 'Aberta',
        toneClassName: 'text-amber-600 dark:text-amber-400',
      };
    case 'paid':
      return {
        label: isEsteticaApp ? 'Finalizado' : 'Paga',
        toneClassName: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'blocked':
      return {
        label: isEsteticaApp ? 'Bloqueado' : 'Bloqueada',
        toneClassName: 'text-teal-600 dark:text-teal-400',
      };
    case 'cancelled':
      return {
        label: isEsteticaApp ? 'Cancelado' : 'Cancelada',
        toneClassName: 'text-slate-500 dark:text-slate-400',
      };
    default:
      return {
        label: 'Sem comanda',
        toneClassName: 'text-slate-500 dark:text-slate-400',
      };
  }
};

export const getOriginLabel = (source?: string | null, channel?: string | null, isEsteticaApp = false) => {
  const normalizedSource = `${source || ''}`.toLowerCase();
  const normalizedChannel = `${channel || ''}`.toLowerCase();

  if (normalizedChannel === 'whatsapp') return 'WhatsApp';
  if (normalizedChannel === 'admin') return 'Admin';
  if (normalizedSource === 'kiosk' && normalizedChannel === 'totem') return isEsteticaApp ? 'Autoatendimento' : 'Totem';
  if (normalizedSource === 'kiosk' && normalizedChannel === 'qr') return 'QR';
  if (normalizedSource === 'kiosk') return isEsteticaApp ? 'Autoatendimento' : 'Totem';
  return 'App';
};

export const getShortNotes = (notes: string) => {
  const clean = (notes || '').trim();
  if (clean.length <= 60) return clean;
  return `${clean.slice(0, 57)}...`;
};

export const isAppointmentOverdue = (appointment: Pick<CalendarAppointment, 'status' | 'startTime'>) => {
  const status = normalizeAppointmentStatus(appointment.status);
  if (status === 'in_progress' || status === 'completed' || status === 'cancelled') return false;
  const startDate = new Date(appointment.startTime);
  return !Number.isNaN(startDate.getTime()) && startDate.getTime() < Date.now();
};

export const getDecimalTimeLabel = (value: number) => {
  const hours = Math.floor(value);
  const minutes = Math.round((value % 1) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const getTimelinePercent = (value: number) => {
  const clamped = Math.max(SCHEDULE_START_HOUR, Math.min(SCHEDULE_START_HOUR + SCHEDULE_TOTAL_HOURS, value));
  return ((clamped - SCHEDULE_START_HOUR) / SCHEDULE_TOTAL_HOURS) * 100;
};

export const getAppointmentEndLabel = (appointment: Pick<CalendarAppointment, 'start' | 'duration'>) =>
  getDecimalTimeLabel(appointment.start + appointment.duration);

export const getDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateInputValue = (value: string, endOfDay = false) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
};

export const toLocalDatetimeInput = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
