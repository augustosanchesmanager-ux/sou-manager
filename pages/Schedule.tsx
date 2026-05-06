import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase, getClientForTable, ensureAppSupportsModule } from '../services/supabaseClient';
import { generateIdempotencyKey } from '@/src/utils/idempotency';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import DatePickerInput from '../components/ui/DatePickerInput';
import { useAuth } from '../context/AuthContext';
import {
  ExistingAppointmentsAction,
  ScheduleBlock,
  ScheduleBlockInput,
  blockAppliesToDate,
  blockMatchesProfessional,
  blockOverlapsTimeRange,
  detectBlockConflicts,
  getBlocksForDate,
  isDateFullyBlocked,
  scheduleBlocksApi,
  toDateKey,
} from '../services/scheduleBlocksApi';



interface DBStaff {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

interface DBService {
  id: string;
  name: string;
  duration: number;
  buffer?: number;
  price?: number;
}

interface DBClient {
  id: string;
  name: string;
  phone: string;
}

interface CalendarAppointment {
  id: string;
  clientId?: string | null;
  staffId: string;
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
  subscriptionId?: string | null;
  eligibleForPlanCredit?: boolean;
  planCreditPreview?: Record<string, unknown> | null;
}

type DisplayMode = 'calendar' | 'list';
type ListPeriod = 'today' | 'tomorrow' | 'week' | 'month' | 'custom';
type QuickChip = 'all' | 'today' | 'pending' | 'confirmed' | 'in_progress' | 'overdue' | 'without_comanda';

interface AppointmentFiltersState {
  date: string;
  period: ListPeriod;
  professional: string;
  status: string;
  service: string;
  origin: string;
  search: string;
  quickChip: QuickChip;
}

interface EnrichedAppointment extends CalendarAppointment {
  normalizedStatus: string;
  statusLabel: string;
  statusIcon: string;
  statusBadgeClassName: string;
  originLabel: string;
  isOverdue: boolean;
  shortNotes: string;
  searchIndex: string;
  hasOpenComanda: boolean;
}

interface NewAppointmentForm {
  client: string;
  clientPhone?: string;
  service: string;
  staffId: string;
  date: string;
  start: number;
  duration: number;
  notes: string;
  isFitIn: boolean;
}

interface ScheduleBlockForm {
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

const statusColors: Record<string, string> = {
  scheduled: 'bg-slate-500',
  confirmed: 'bg-blue-500',
  pending: 'bg-amber-500',
  in_progress: 'bg-violet-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-rose-500',
  no_show: 'bg-slate-600',
};

const roleLabels: Record<string, string> = { Manager: 'Gerente', Barber: 'Barbeiro', Receptionist: 'Recepcionista' };

const appointmentStatusMeta: Record<string, { label: string; icon: string; badge: string }> = {
  scheduled: {
    label: 'Agendado',
    icon: 'event',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
  pending: {
    label: 'Pendente',
    icon: 'schedule',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  confirmed: {
    label: 'Confirmado',
    icon: 'check_circle',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  in_progress: {
    label: 'Em atendimento',
    icon: 'content_cut',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
  completed: {
    label: 'Finalizado',
    icon: 'task_alt',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  cancelled: {
    label: 'Cancelado',
    icon: 'cancel',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  },
  no_show: {
    label: 'Não compareceu',
    icon: 'person_off',
    badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  },
};

const normalizeAppointmentStatus = (status: string | null | undefined) => {
  const normalized = `${status || 'pending'}`.toLowerCase();
  return appointmentStatusMeta[normalized] ? normalized : 'pending';
};

const getAppointmentStatusMeta = (status: string | null | undefined) => {
  const normalized = normalizeAppointmentStatus(status);
  return {
    normalized,
    ...appointmentStatusMeta[normalized],
  };
};

const getOriginLabel = (source?: string | null, channel?: string | null) => {
  const normalizedSource = `${source || ''}`.toLowerCase();
  const normalizedChannel = `${channel || ''}`.toLowerCase();

  if (normalizedChannel === 'whatsapp') return 'WhatsApp';
  if (normalizedChannel === 'admin') return 'Admin';
  if (normalizedSource === 'kiosk' && normalizedChannel === 'totem') return 'Totem';
  if (normalizedSource === 'kiosk' && normalizedChannel === 'qr') return 'QR';
  if (normalizedSource === 'kiosk') return 'Totem';
  return 'App';
};

const getShortNotes = (notes: string) => {
  const clean = (notes || '').trim();
  if (clean.length <= 60) return clean;
  return `${clean.slice(0, 57)}...`;
};

const isAppointmentOverdue = (appointment: CalendarAppointment) => {
  const status = normalizeAppointmentStatus(appointment.status);
  if (status === 'in_progress' || status === 'completed' || status === 'cancelled') return false;
  const startDate = new Date(appointment.startTime);
  return !Number.isNaN(startDate.getTime()) && startDate.getTime() < Date.now();
};

const getDecimalTimeLabel = (value: number) => {
  const hours = Math.floor(value);
  const minutes = Math.round((value % 1) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getAppointmentEndLabel = (appointment: CalendarAppointment) =>
  getDecimalTimeLabel(appointment.start + appointment.duration);

const getDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value: string, endOfDay = false) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
};

const Schedule: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { appSlug, tenantId, user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [displayMode, setDisplayMode] = useState<DisplayMode>('calendar');
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Data from Supabase
  const [staffList, setStaffList] = useState<DBStaff[]>([]);
  const [servicesList, setServicesList] = useState<DBService[]>([]);
  const [clientsList, setClientsList] = useState<DBClient[]>([]);
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [scheduleBlockHistory, setScheduleBlockHistory] = useState<ScheduleBlock[]>([]);
  const [activePromotions, setActivePromotions] = useState<any[]>([]);
  const [openComandasByAppointment, setOpenComandasByAppointment] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [blockSaving, setBlockSaving] = useState(false);
  const [showOnlyBlocks, setShowOnlyBlocks] = useState(false);
  const [listFilters, setListFilters] = useState<AppointmentFiltersState>({
    date: getDateInputValue(new Date()),
    period: 'today',
    professional: 'all',
    status: 'all',
    service: 'all',
    origin: 'all',
    search: '',
    quickChip: 'all',
  });
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);
  const scheduleCreateLockRef = useRef(false);
  const scheduleIdempotencyKeyRef = useRef<string | null>(null);

  // Week days (Mon-Sun of the week containing selectedDate)
  const getWeekDays = (date: Date): Date[] => {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const wd = new Date(monday);
      wd.setDate(monday.getDate() + i);
      return wd;
    });
  };
  const weekDays = getWeekDays(selectedDate);
  const selectedDateKey = toDateKey(selectedDate);

  const toHourDecimal = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    return hour + (minute / 60);
  };

  const startOfRangeDate = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const endOfRangeDate = (date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const getListRange = useCallback(() => {
    const now = new Date();
    if (listFilters.period === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      return { start: startOfRangeDate(tomorrow), end: endOfRangeDate(tomorrow) };
    }

    if (listFilters.period === 'week') {
      const start = startOfRangeDate(now);
      const end = endOfRangeDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6));
      return { start, end };
    }

    if (listFilters.period === 'month') {
      const start = startOfRangeDate(now);
      const end = endOfRangeDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { start, end };
    }

    if (listFilters.period === 'custom') {
      const customDate = parseDateInputValue(listFilters.date) || selectedDate;
      return { start: startOfRangeDate(customDate), end: endOfRangeDate(customDate) };
    }

    return { start: startOfRangeDate(now), end: endOfRangeDate(now) };
  }, [listFilters.date, listFilters.period, selectedDate]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [impactPreview, setImpactPreview] = useState<CalendarAppointment[]>([]);
  const [blockForm, setBlockForm] = useState<ScheduleBlockForm>({
    type: 'full_day',
    professionalScope: 'all',
    professionalId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    startTime: '12:00',
    endTime: '13:00',
    reason: 'Agenda fechada',
    notes: '',
    recurrence: 'none',
    recurrenceUntil: '',
    actionForExisting: 'keep',
  });

  // Detail Modal State
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const isDetailModalOpen = false;
  const setIsDetailModalOpen = (_open: boolean) => {};

  // Cancel Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellationType, setCancellationType] = useState<string>('');
  const [appointmentToCancel, setAppointmentToCancel] = useState<{ id: string; client: string } | null>(null);

  // Lógica de Horário Dinâmico (Opção C: Expansão Automática)
  const displayEndHour = React.useMemo(() => {
    if (appointments.length === 0) return 20;
    const maxAptEndTime = Math.max(...appointments.map(a => a.start + a.duration));
    return Math.min(23, Math.max(20, Math.ceil(maxAptEndTime - 1)));
  }, [appointments]);

  const dynamicTimeSlots = React.useMemo(() => {
    return Array.from({ length: displayEndHour - 8 + 1 }, (_, i) => i + 8);
  }, [displayEndHour]);

  const totalSlots = dynamicTimeSlots.length;
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<NewAppointmentForm>({
    client: '',
    clientPhone: '',
    service: '',
    staffId: '',
    date: new Date().toISOString().split('T')[0],
    start: 8,
    duration: 1,
    notes: '',
    isFitIn: false,
  });

  useEffect(() => {
    const shouldOpenNew = Boolean((location.state as { openNewAppointment?: boolean } | null)?.openNewAppointment);
    if (!shouldOpenNew) return;

    setEditingAppointmentId(null);
    setFormData(prev => ({ ...prev, client: '', clientPhone: '', service: '', duration: 1, notes: '', isFitIn: false }));
    setSelectedServices([]);
    setServiceSearch('');
    setIsModalOpen(true);

    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  // Client Autocomplete State
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [filteredClients, setFilteredClients] = useState<DBClient[]>([]);
  const [isNewClientMode, setIsNewClientMode] = useState(false);
  const [chefClubInfo, setChefClubInfo] = useState<{ planName: string; credits: number; status: string } | null>(null);
  const [showOverbookModal, setShowOverbookModal] = useState(false);
  const [overbookConflicts, setOverbookConflicts] = useState<CalendarAppointment[]>([]);
  const [forceOverbook, setForceOverbook] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Multiple services selection state
  const [selectedServices, setSelectedServices] = useState<DBService[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [servicesLoadedForEdit, setServicesLoadedForEdit] = useState(false);

  // Fetch base data
  const fetchBaseData = useCallback(async () => {
    if (!tenantId) {
      setStaffList([]);
      setServicesList([]);
      setClientsList([]);
      setFilteredClients([]);
      return;
    }

    const scheduleAppSlug = ensureAppSupportsModule(appSlug, 'schedule', ['barber']);
    const servicesClient = getClientForTable('services', scheduleAppSlug);
    const clientsClient = getClientForTable('clients', scheduleAppSlug);
    const promotionsClient = getClientForTable('promotions', scheduleAppSlug);

    const [staffRes, servicesRes, clientsRes, promoRes] = await Promise.all([
      supabase.from('staff').select('id, name, role, avatar').eq('tenant_id', tenantId).eq('status', 'active').in('role', ['Barber', 'Manager']),
      servicesClient.from('services').select('id, name, duration, buffer, price').eq('tenant_id', tenantId).eq('active', true),
      clientsClient.from('clients').select('id, name, phone').eq('tenant_id', tenantId).order('name'),
      promotionsClient.from('promotions').select('*').eq('tenant_id', tenantId).eq('active', true),
    ]);

    if (staffRes.data) setStaffList(staffRes.data);

    if (servicesRes.error) {
      console.error('Erro ao buscar serviços com buffer:', servicesRes.error);
      const retryServices = await servicesClient
        .from('services')
        .select('id, name, duration, price')
        .eq('tenant_id', tenantId)
        .neq('active', false)
        .order('name');

      if (retryServices.data) {
        setServicesList(retryServices.data);
      } else {
        const legacyServices = await servicesClient
          .from('services')
          .select('id, name, duration_minutes, price')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('name');

        if (legacyServices.data) {
          setServicesList(
            legacyServices.data.map((s: any) => ({
              id: s.id,
              name: s.name,
              duration: Number(s.duration_minutes) || 30,
              price: Number(s.price) || 0,
            }))
          );
        }
      }
    } else if (servicesRes.data && servicesRes.data.length > 0) {
      setServicesList(servicesRes.data);
    } else {
      const retryServices = await servicesClient
        .from('services')
        .select('id, name, duration, price')
        .eq('tenant_id', tenantId)
        .neq('active', false)
        .order('name');

      if (retryServices.data && retryServices.data.length > 0) {
        setServicesList(retryServices.data);
      } else {
        const legacyServices = await servicesClient
          .from('services')
          .select('id, name, duration_minutes, price')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('name');

        if (legacyServices.data) {
          setServicesList(
            legacyServices.data.map((s: any) => ({
              id: s.id,
              name: s.name,
              duration: Number(s.duration_minutes) || 30,
              price: Number(s.price) || 0,
            }))
          );
        }
      }
    }

    if (clientsRes.data) { setClientsList(clientsRes.data); setFilteredClients(clientsRes.data); }
    if (promoRes.data) {
      const now = new Date();
      const validPromos = promoRes.data.filter((p: any) => {
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        end.setHours(23, 59, 59, 999);
        return now >= start && now <= end;
      });
      setActivePromotions(validPromos);
    }
  }, [appSlug, tenantId]);

  // Fetch appointments for the selected date (or week)
  const fetchAppointments = useCallback(async () => {
    if (!tenantId) {
      setAppointments([]);
      setOpenComandasByAppointment({});
      setLoading(false);
      return;
    }

    setLoading(true);

    let rangeStart: string;
    let rangeEnd: string;

    if (displayMode === 'list') {
      const listRange = getListRange();
      rangeStart = listRange.start.toISOString();
      rangeEnd = listRange.end.toISOString();
    } else if (viewMode === 'week') {
      const days = getWeekDays(selectedDate);
      const first = new Date(days[0]);
      first.setHours(0, 0, 0, 0);
      const last = new Date(days[6]);
      last.setHours(23, 59, 59, 999);
      rangeStart = first.toISOString();
      rangeEnd = last.toISOString();
    } else {
      const dStart = new Date(selectedDate);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(selectedDate);
      dEnd.setHours(23, 59, 59, 999);
      rangeStart = dStart.toISOString();
      rangeEnd = dEnd.toISOString();
    }

    const scheduleAppSlug = ensureAppSupportsModule(appSlug, 'schedule', ['barber']);
    const appointmentsClient = getClientForTable('appointments', scheduleAppSlug);
    const comandasClient = getClientForTable('comandas', scheduleAppSlug);

    const { data, error } = await appointmentsClient
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('hidden_from_schedule', false)
      .gte('start_time', rangeStart)
      .lte('start_time', rangeEnd);

    let appointmentRows = data || [];

    if (error) {
      console.warn('Falha ao carregar agendamentos com filtro por start_time. Aplicando fallback local.', error);

      const { data: fallbackData, error: fallbackError } = await appointmentsClient
        .from('appointments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('hidden_from_schedule', false);

      if (fallbackError) {
        throw fallbackError;
      }

      appointmentRows = (fallbackData || []).filter((apt: any) => {
        const startTime = new Date(apt.start_time).getTime();
        return !Number.isNaN(startTime)
          && startTime >= new Date(rangeStart).getTime()
          && startTime <= new Date(rangeEnd).getTime();
      });
    }

    appointmentRows = [...appointmentRows].sort(
      (first: any, second: any) => new Date(first.start_time).getTime() - new Date(second.start_time).getTime(),
    );

    if (appointmentRows.length > 0) {
      const mapped: CalendarAppointment[] = appointmentRows.map(apt => {
        const d = new Date(apt.start_time);
        const startHour = d.getHours() + d.getMinutes() / 60;
        return {
          id: apt.id,
          clientId: apt.client_id || null,
          staffId: apt.staff_id,
          start: startHour,
          duration: Number(apt.duration) || 1,
          client: apt.client_name || 'Cliente',
          service: apt.service_name || 'Serviço',
          status: apt.status,
          color: statusColors[apt.status] || 'bg-blue-500',
          staffName: apt.staff_name || '',
          clientPhone: apt.client_phone || '',
          price: apt.price || 0,
          startTime: apt.start_time,
          notes: apt.notes || '',
          date: apt.start_time,
          source: apt.source || null,
          channel: apt.channel || null,
          isOverbooked: apt.is_overbooked || false,
          subscriptionId: apt.subscription_id || null,
          eligibleForPlanCredit: apt.eligible_for_plan_credit || false,
          planCreditPreview: apt.plan_credit_preview || null,
        };
      });
      setAppointments(mapped);

      const appointmentIds = mapped.map((apt) => apt.id);
      if (appointmentIds.length > 0) {
        const { data: comandas } = await comandasClient
          .from('comandas')
          .select('id, appointment_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'open')
          .in('appointment_id', appointmentIds);

        const nextOpenComandasByAppointment: Record<string, string> = {};
        (comandas || []).forEach((comanda: any) => {
          if (comanda.appointment_id) {
            nextOpenComandasByAppointment[comanda.appointment_id] = comanda.id;
          }
        });
        setOpenComandasByAppointment(nextOpenComandasByAppointment);
      } else {
        setOpenComandasByAppointment({});
      }
    } else {
      setAppointments([]);
      setOpenComandasByAppointment({});
    }
    setLoading(false);
  }, [displayMode, getListRange, selectedDate, tenantId, viewMode]);

  const fetchScheduleBlocks = useCallback(async () => {
    if (!tenantId) {
      setScheduleBlocks([]);
      setScheduleBlockHistory([]);
      return;
    }

    let rangeStartDate: Date;
    let rangeEndDate: Date;

    if (viewMode === 'week') {
      const days = getWeekDays(selectedDate);
      rangeStartDate = startOfRangeDate(days[0]);
      rangeEndDate = endOfRangeDate(days[6]);
    } else {
      rangeStartDate = startOfRangeDate(selectedDate);
      rangeEndDate = endOfRangeDate(selectedDate);
    }

    const rangeStart = toDateKey(rangeStartDate);
    const rangeEnd = toDateKey(rangeEndDate);

    try {
      const [activeBlocks, history] = await Promise.all([
        scheduleBlocksApi.listByRange(tenantId, { startDate: rangeStart, endDate: rangeEnd }),
        scheduleBlocksApi.listHistory(tenantId, 100),
      ]);
      setScheduleBlocks(activeBlocks);
      setScheduleBlockHistory(history);
    } catch (err) {
      console.error('Erro ao buscar bloqueios da agenda:', err);
      setToast({ message: 'Não foi possível carregar os bloqueios da agenda.', type: 'error' });
    }
  }, [selectedDate, tenantId, viewMode]);

  useEffect(() => { fetchBaseData(); }, [fetchBaseData]);
  useEffect(() => { fetchAppointments(); }, [fetchAppointments, selectedDate]);
  useEffect(() => { fetchScheduleBlocks(); }, [fetchScheduleBlocks]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
        setShowClientSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync modal date with selected view date
  useEffect(() => {
    if (isModalOpen) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setFormData(prev => ({ ...prev, date: `${year}-${month}-${day}`, staffId: prev.staffId || (staffList[0]?.id ?? '') }));
    }
  }, [isModalOpen, selectedDate, staffList]);

  const handleNavigateToCheckout = async (apt: CalendarAppointment) => {
    try {
      if (!tenantId) {
        navigate('/checkout');
        return;
      }

      const scheduleAppSlug = ensureAppSupportsModule(appSlug || 'barber', 'schedule', ['barber']);
      const checkoutComandasClient = getClientForTable('comandas', scheduleAppSlug);
      const checkoutClientsClient = getClientForTable('clients', scheduleAppSlug);

      const { data: existingComanda, error: existingComandaError } = await checkoutComandasClient
        .from('comandas')
        .select('id, status')
        .eq('tenant_id', tenantId)
        .eq('appointment_id', apt.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingComandaError) {
        throw existingComandaError;
      }

      if (existingComanda?.id && existingComanda.status !== 'cancelled') {
        setOpenComandasByAppointment((prev) => ({ ...prev, [apt.id]: existingComanda.id }));
        navigate(`/checkout/${existingComanda.id}`);
        return;
      }

      const { data: clientData } = await checkoutClientsClient
        .from('clients')
        .select('id')
        .eq('tenant_id', tenantId)
        .or(`phone.eq.${apt.clientPhone},name.eq.${apt.client}`)
        .limit(1)
        .single();

      const clientId = clientData?.id || '';

      navigate('/checkout', {
        state: {
          fromAppointment: true,
          appointmentId: apt.id,
          clientId: clientId,
          clientName: apt.client,
          serviceName: apt.service,
          staffId: apt.staffId,
          price: apt.price
        }
      });
    } catch (err) {
      console.error('Error navigating to checkout:', err);
      navigate('/checkout');
    }
  };

  const handleInputChange = (field: keyof NewAppointmentForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);

    if (field === 'service') {
      const selectedService = servicesList.find(s => s.name === value);
      if (selectedService) {
        const fullDuration = (selectedService.duration + (selectedService.buffer || 0)) / 60;
        setFormData(prev => ({ ...prev, service: value, duration: fullDuration }));
      }
    }

    if (field === 'client') {
      const filtered = clientsList.filter(c =>
        c.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredClients(filtered);
      setShowClientSuggestions(true);
      setIsNewClientMode(false);
    }
  };

  // Multiple services helpers
  const toggleService = (service: DBService) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.filter(s => s.id !== service.id);
      }
      return [...prev, service];
    });
    setError(null);
  };

  const removeService = (serviceId: string) => {
    setSelectedServices(prev => prev.filter(s => s.id !== serviceId));
  };

  const filteredServices = servicesList.filter(s =>
    s.name.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const totalDurationMinutes = selectedServices.reduce(
    (sum, s) => sum + (s.duration || 30) + (s.buffer || 0),
    0
  );
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);

  // Auto-update form duration when services change
  useEffect(() => {
    if (selectedServices.length > 0) {
      const hours = totalDurationMinutes / 60;
      const roundedHours = Math.ceil(hours * 2) / 2; // Round to nearest 0.5
      setFormData(prev => ({ ...prev, duration: Math.max(0.5, roundedHours) }));
    }
  }, [selectedServices, totalDurationMinutes]);

  const loadChefClubInfo = async (clientName: string) => {
    const client = clientsList.find(c => c.name === clientName);
    if (!client) {
      setChefClubInfo(null);
      return;
    }

    const { data: subscription, error: subError } = await supabase
      .from('customer_subscriptions')
      .select('id, plan_id, status, tenant_id')
      .eq('tenant_id', tenantId)
      .eq('client_id', client.id)
      .eq('status', 'active')
      .maybeSingle();

    if (subError) {
      console.warn('[loadChefClubInfo] Falha ao buscar subscription:', subError);
    }

    if (!subscription) {
      setChefClubInfo(null);
      return;
    }

    let planName = 'Plano ativo';
    const { data: plan, error: planError } = await supabase
      .from('customer_plans')
      .select('name')
      .eq('tenant_id', tenantId)
      .eq('id', subscription.plan_id)
      .maybeSingle();

    if (planError) {
      console.warn('[loadChefClubInfo] Falha ao buscar plano:', planError);
    }
    if (plan?.name) {
      planName = plan.name;
    }

    let availableCredits = 0;
    const { data: credits, error: creditsError } = await supabase
      .rpc('get_current_subscription_credits', {
        p_subscription_id: subscription.id,
        p_tenant_id: tenantId,
      })
      .maybeSingle();

    if (creditsError) {
      console.warn('[loadChefClubInfo] Falha ao buscar créditos:', creditsError);
    }
    if (credits?.available_credits !== undefined) {
      availableCredits = Number(credits.available_credits);
    }

    setChefClubInfo({
      planName,
      credits: availableCredits,
      status: subscription.status
    });
  };

  const selectClient = async (clientName: string) => {
    setFormData(prev => ({ ...prev, client: clientName, clientPhone: '' }));
    setShowClientSuggestions(false);
    setIsNewClientMode(false);
    await loadChefClubInfo(clientName);
  };

  const enableNewClientMode = () => {
    setIsNewClientMode(true);
    setShowClientSuggestions(false);
    setChefClubInfo(null);
  };

  const handleEditAppointment = async (apt: CalendarAppointment) => {
    setEditingAppointmentId(apt.id);
    setServicesLoadedForEdit(false);
    setSelectedServices([]);
    setServiceSearch('');
    const datePart = apt.startTime.split('T')[0];

    setFormData({
      client: apt.client,
      clientPhone: apt.clientPhone,
      service: apt.service,
      staffId: apt.staffId,
      date: datePart,
      start: apt.start,
      duration: apt.duration,
      notes: apt.notes || '',
    });

    // Load appointment_services for this appointment
    const { data: apptServices } = await supabase
      .from('appointment_services')
      .select('service_id, services(id, name, duration, price, buffer)')
      .eq('appointment_id', apt.id)
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    if (apptServices && apptServices.length > 0) {
      const loadedServices: DBService[] = apptServices
        .map((as: any): DBService | null => {
          const service = as.services;
          if (!service) return null;
          return {
            id: service.id,
            name: service.name,
            duration: service.duration || 30,
            buffer: service.buffer || 0,
            price: service.price || 0,
          };
        })
        .filter((s): s is DBService => s !== null);
      setSelectedServices(loadedServices);
    }

    setServicesLoadedForEdit(true);
    void loadChefClubInfo(apt.client);
    setIsDetailDrawerOpen(false);
    setIsModalOpen(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessário para permitir o drop
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropAppointment = async (e: React.DragEvent, dropStaffId: string, dropDate?: string) => {
    e.preventDefault();
    const aptId = e.dataTransfer.getData('aptId');
    if (!aptId) return;

    const apt = appointments.find(a => a.id === aptId);
    if (!apt) return;

    const columnRect = e.currentTarget.getBoundingClientRect();
    const yPosition = e.clientY - columnRect.top;

    // Calcula o novo horário dinamicamente
    const totalHours = dynamicTimeSlots.length;
    const percentage = yPosition / columnRect.height;
    const exactHour = 8 + (percentage * totalHours);

    // Arredonda para blocos de 15 minutos mais próximos
    const roundedHour = Math.floor(exactHour * 4) / 4;

    if (roundedHour < 8 || roundedHour >= (displayEndHour + 1)) {
      setToast({ message: 'Horário fora de operação.', type: 'error' });
      return;
    }

    // Calcula nova Start_time
    const newHours = Math.floor(roundedHour);
    const newMinutes = (roundedHour % 1) * 60;

    const dateStr = dropDate || apt.startTime.split('T')[0];
    const newStartTimeLine = new Date(`${dateStr}T${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:00`);
    const newEndTimeLine = new Date(newStartTimeLine.getTime() + apt.duration * 60 * 60 * 1000);

    // Validação Anti-Overbooking
    const overlapping = appointments.filter(a =>
      a.id !== apt.id &&
      a.staffId === dropStaffId &&
      new Date(a.date).toDateString() === new Date(dateStr).toDateString() &&
      !(
        (roundedHour + apt.duration) <= a.start ||
        roundedHour >= (a.start + a.duration)
      )
    );

    if (overlapping.length > 0) {
      setToast({ message: 'Conflito de horário! Não é possível encaixar aqui.', type: 'error' });
      return;
    }

    const blockDateKey = toDateKey(dateStr);
    const hasBlockConflict = scheduleBlocks.some((block) =>
      doesBlockMatchDateAndStaff(block, blockDateKey, dropStaffId) &&
      blockOverlapsTimeRange(block, roundedHour, roundedHour + apt.duration),
    );
    if (hasBlockConflict) {
      setToast({ message: 'Não é possível mover: existe bloqueio de agenda nesse período.', type: 'error' });
      return;
    }

    // Otimista Update UI
    setAppointments(prev => prev.map(a =>
      a.id === apt.id
        ? {
          ...a,
          staffId: dropStaffId,
          staffName: staffList.find(s => s.id === dropStaffId)?.name || apt.staffName,
          start: roundedHour,
          startTime: newStartTimeLine.toISOString(),
          date: newStartTimeLine.toISOString(),
        }
        : a
    ));

    try {
      if (!tenantId) {
        setToast({ message: 'Tenant inválido para mover agendamento.', type: 'error' });
        fetchAppointments();
        return;
      }

      const selectedStaff = staffList.find(s => s.id === dropStaffId);
      const scheduleAppSlug = ensureAppSupportsModule(appSlug || 'barber', 'schedule', ['barber']);
      const dragAppointmentsClient = getClientForTable('appointments', scheduleAppSlug);
      const dragComandasClient = getClientForTable('comandas', scheduleAppSlug);

      const { error } = await dragAppointmentsClient.from('appointments').update({
        staff_id: dropStaffId,
        staff_name: selectedStaff?.name || apt.staffName,
        start_time: newStartTimeLine.toISOString(),
        end_time: newEndTimeLine.toISOString(),
        duration: apt.duration,
      }).eq('id', apt.id).eq('tenant_id', tenantId);

      if (error) {
        setToast({ message: 'Erro ao salvar alteração no banco.', type: 'error' });
        fetchAppointments();
      } else {
        await dragComandasClient
          .from('comandas')
          .update({
            staff_id: dropStaffId,
          }).eq('appointment_id', apt.id).eq('tenant_id', tenantId).eq('status', 'open');

        setToast({ message: 'Agendamento movido com sucesso!', type: 'success' });
        fetchAppointments(); // Refresh for safety
      }
    } catch (err) {
      console.error('Error dragging appointment:', err);
      fetchAppointments(); // Revert on failure
      setToast({ message: 'Erro ao mover agendamento.', type: 'error' });
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!tenantId) {
      setToast({ message: 'Tenant inválido para cancelar agendamento.', type: 'error' });
      return;
    }

    const scheduleAppSlug = ensureAppSupportsModule(appSlug || 'barber', 'schedule', ['barber']);
    const cancelAppointmentsClient = getClientForTable('appointments', scheduleAppSlug);
    const cancelComandasClient = getClientForTable('comandas', scheduleAppSlug);

    const isHidden = cancellationType === 'registration_error' || cancellationType === 'test';
    const newStatus = cancellationType === 'no_show' ? 'no_show' : 'cancelled';

    try {
      const { error } = await cancelAppointmentsClient
        .from('appointments')
        .update({
          status: newStatus,
          cancellation_reason: cancelReason || 'Não informado',
          cancellation_type: cancellationType || null,
          hidden_from_schedule: isHidden,
          cancelled_at: new Date().toISOString(),
          cancelled_by_user_id: user?.id || null
        })
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      await cancelComandasClient
        .from('comandas')
        .update({ status: 'cancelled' })
        .eq('appointment_id', appointmentId)
        .eq('tenant_id', tenantId)
        .eq('status', 'open');

      setToast({ message: 'Agendamento cancelado com sucesso.', type: 'info' });
      closeDetailDrawer();
      fetchAppointments();
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      setToast({ message: 'Erro ao cancelar agendamento.', type: 'error' });
    }
  };

  const openCancelModal = (appointment: CalendarAppointment) => {
    setAppointmentToCancel({ id: appointment.id, client: appointment.client });
    setCancelReason('');
    setCancellationType('');
    setShowCancelModal(true);
  };

  const confirmCancelAppointment = async () => {
    if (!appointmentToCancel) return;
    setShowCancelModal(false);
    await handleCancelAppointment(appointmentToCancel.id);
    setAppointmentToCancel(null);
  };

  const doesBlockMatchDateAndStaff = (block: ScheduleBlock, dateKey: string, staffId: string) => {
    return blockAppliesToDate(block, dateKey) && blockMatchesProfessional(block, staffId);
  };

  const isAppointmentInsideBlock = (apt: CalendarAppointment, draft: ScheduleBlockInput) => {
    const aptDate = toDateKey(apt.startTime);
    const aptEnd = apt.start + apt.duration;

    const inDateRange = aptDate >= draft.start_date && aptDate <= draft.end_date;
    if (!inDateRange) return false;

    if (draft.professional_id && apt.staffId !== draft.professional_id) return false;
    if (draft.block_type === 'full_day') return true;

    const startHour = toHourDecimal(draft.start_time || '00:00');
    const endHour = toHourDecimal(draft.end_time || '00:00');
    return apt.start < endHour && aptEnd > startHour;
  };

  const buildBlockPayloadFromForm = (): ScheduleBlockInput | null => {
    if (!blockForm.reason.trim()) {
      setBlockError('Informe o motivo do bloqueio.');
      return null;
    }

    if (!blockForm.startDate || !blockForm.endDate) {
      setBlockError('Informe a data inicial e final.');
      return null;
    }

    if (blockForm.endDate < blockForm.startDate) {
      setBlockError('A data final não pode ser anterior à data inicial.');
      return null;
    }

    if (blockForm.type === 'time_range' && blockForm.endTime <= blockForm.startTime) {
      setBlockError('O horário final deve ser maior que o horário inicial.');
      return null;
    }

    if (blockForm.recurrence === 'weekly' && blockForm.endDate !== blockForm.startDate) {
      setBlockError('Recorrência semanal exige bloqueio de um único dia por vez.');
      return null;
    }

    if (blockForm.recurrence === 'weekly' && blockForm.recurrenceUntil && blockForm.recurrenceUntil < blockForm.startDate) {
      setBlockError('A data final da recorrência deve ser maior ou igual à data inicial.');
      return null;
    }

    return {
      professional_id: blockForm.professionalScope === 'specific' ? blockForm.professionalId : null,
      block_type: blockForm.type,
      start_date: blockForm.startDate,
      end_date: blockForm.endDate,
      start_time: blockForm.type === 'time_range' ? blockForm.startTime : null,
      end_time: blockForm.type === 'time_range' ? blockForm.endTime : null,
      reason: blockForm.reason.trim(),
      notes: blockForm.notes.trim() || null,
      recurrence_type: blockForm.recurrence,
      recurrence_until: blockForm.recurrence === 'weekly' ? (blockForm.recurrenceUntil || null) : null,
      existing_appointments_action: blockForm.actionForExisting,
    };
  };

  const resetBlockForm = () => {
    const today = toDateKey(new Date());
    setEditingBlockId(null);
    setImpactPreview([]);
    setBlockError(null);
    setBlockForm({
      type: 'full_day',
      professionalScope: 'all',
      professionalId: staffList[0]?.id || '',
      startDate: today,
      endDate: today,
      startTime: '12:00',
      endTime: '13:00',
      reason: 'Agenda fechada',
      notes: '',
      recurrence: 'none',
      recurrenceUntil: '',
      actionForExisting: 'keep',
    });
  };

  const handleOpenCreateBlockModal = () => {
    resetBlockForm();
    setIsBlockModalOpen(true);
  };

  const handleEditBlock = (block: ScheduleBlock) => {
    setEditingBlockId(block.id);
    setBlockError(null);
    setImpactPreview([]);
    setBlockForm({
      type: block.block_type,
      professionalScope: block.professional_id ? 'specific' : 'all',
      professionalId: block.professional_id || staffList[0]?.id || '',
      startDate: block.start_date,
      endDate: block.end_date,
      startTime: (block.start_time || '12:00').slice(0, 5),
      endTime: (block.end_time || '13:00').slice(0, 5),
      reason: block.reason,
      notes: block.notes || '',
      recurrence: block.recurrence_type,
      recurrenceUntil: block.recurrence_until || '',
      actionForExisting: block.existing_appointments_action,
    });
    setIsBlockModalOpen(true);
  };

  const handleDeleteBlock = async (block: ScheduleBlock) => {
    if (!window.confirm('Deseja realmente remover este bloqueio?')) return;
    try {
      await scheduleBlocksApi.remove(block.id, user?.id || null);
      setToast({ message: 'Bloqueio removido com sucesso.', type: 'success' });
      fetchScheduleBlocks();
    } catch (err) {
      console.error('Erro ao remover bloqueio:', err);
      setToast({ message: 'Não foi possível remover o bloqueio.', type: 'error' });
    }
  };

  const handleSaveBlock = async () => {
    if (!tenantId) {
      setBlockError('Tenant inválido para salvar bloqueio.');
      return;
    }

    const payload = buildBlockPayloadFromForm();
    if (!payload) return;

    if (payload.professional_id && !payload.professional_id.trim()) {
      setBlockError('Selecione um profissional.');
      return;
    }

    const activeBlocks = scheduleBlockHistory.filter((block) => block.status === 'active' && block.id !== editingBlockId);
    const conflicts = detectBlockConflicts(activeBlocks, payload);
    if (conflicts.length > 0) {
      setBlockError(`Já existe bloqueio sobreposto (${conflicts.length}). Edite o bloqueio existente ou ajuste o período.`);
      return;
    }

    const impacted = appointments.filter((apt) => apt.status !== 'cancelled' && isAppointmentInsideBlock(apt, payload));
    setImpactPreview(impacted);

    if (impacted.length > 0) {
      const confirmed = window.confirm(`Existem ${impacted.length} agendamentos impactados. Deseja confirmar o bloqueio mesmo assim?`);
      if (!confirmed) {
        setBlockError('Operação cancelada para revisar agendamentos impactados.');
        return;
      }
    }

    setBlockSaving(true);
    try {
      if (editingBlockId) {
        await scheduleBlocksApi.update(editingBlockId, payload);
      } else {
        await scheduleBlocksApi.create(tenantId, user?.id || null, payload);
      }

      if (payload.existing_appointments_action === 'cancel' && impacted.length > 0) {
        const impactedIds = impacted.map((apt) => apt.id);
        await supabase
          .from('appointments')
          .update({ status: 'cancelled' })
          .in('id', impactedIds)
          .eq('tenant_id', tenantId);
      }

      if (payload.existing_appointments_action === 'review' && impacted.length > 0) {
        setToast({ message: `${impacted.length} agendamentos exigem revisão manual.`, type: 'info' });
      }

      setIsBlockModalOpen(false);
      resetBlockForm();
      await Promise.all([fetchAppointments(), fetchScheduleBlocks()]);
      setToast({
        message: editingBlockId ? 'Bloqueio atualizado com sucesso.' : 'Agenda fechada com sucesso.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Erro ao salvar bloqueio:', err);
      setBlockError(err?.message || 'Não foi possível salvar o bloqueio.');
    } finally {
      setBlockSaving(false);
    }
  };

  const handleSave = async (options?: { preventLock?: boolean }) => {
    if (!tenantId) {
      setError('Tenant inválido para salvar agendamento.');
      return;
    }

    // Creation: must have at least one service selected
    if (!editingAppointmentId) {
      if (!formData.client || selectedServices.length === 0) {
        setError("Por favor, preencha o nome do cliente e selecione pelo menos um serviço.");
        return;
      }
    } else {
      // Editing: validate services loaded and not empty
      if (!servicesLoadedForEdit) {
        setError('Não foi possível carregar os serviços do agendamento. Tente novamente.');
        return;
      }
      // In edit mode, if selectedServices is empty, block save (user might have cleared by mistake)
      // We don't allow clearing services in edit mode for Phase 8.1
      if (selectedServices.length === 0) {
        setError("Não é permitido remover todos os serviços de um agendamento existente nesta fase.");
        return;
      }
      if (!formData.client) {
        setError("Por favor, preencha o nome do cliente.");
        return;
      }
    }

    if (isNewClientMode && !formData.clientPhone) {
      setError("Para novos clientes, informe um telefone de contato.");
      return;
    }

    if (scheduleCreateLockRef.current && !options?.preventLock) {
      setError('Agendamento já está sendo criado. Aguarde alguns segundos.');
      return;
    }
    if (!options?.preventLock) {
      scheduleCreateLockRef.current = true;
    }

    if (!scheduleIdempotencyKeyRef.current) {
      scheduleIdempotencyKeyRef.current = generateIdempotencyKey('schedule-appt');
    }

    const scheduleAppSlug = ensureAppSupportsModule(appSlug || 'barber', 'schedule', ['barber']);
    const saveClientsClient = getClientForTable('clients', scheduleAppSlug);
    const saveAppointmentsClient = getClientForTable('appointments', scheduleAppSlug);
    const saveComandasClient = getClientForTable('comandas', scheduleAppSlug);
    const saveServicesClient = getClientForTable('services', scheduleAppSlug);
    const saveComandaItemsClient = getClientForTable('comanda_items', scheduleAppSlug);

    const selectedStaff = staffList.find(s => s.id === formData.staffId);
    const firstSelectedService = selectedServices.length > 0 ? selectedServices[0] : null;
    const serviceNamesForEdit = selectedServices.map(s => s.name).join(' + ');

    let clientId: string | null = null;
    if (isNewClientMode) {
      const { data: newClient, error: clientError } = await saveClientsClient.from('clients').insert({
        name: formData.client,
        phone: formData.clientPhone || '',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.client)}&background=random`,
        tenant_id: tenantId
      }).select().single();
      if (clientError) { setError('Erro ao cadastrar cliente.'); return; }
      clientId = newClient.id;
      setClientsList(prev => [...prev, newClient]);
    } else {
      const existing = clientsList.find(c => c.name.toLowerCase() === formData.client.toLowerCase());
      if (existing) clientId = existing.id;
    }

    const startHours = Math.floor(formData.start);
    const startMinutes = (formData.start % 1) * 60;
    const startTimeLine = new Date(`${formData.date}T${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}:00.000`);

    const endTimeLine = new Date(startTimeLine.getTime() + Number(formData.duration) * 60 * 60 * 1000);
    const selectedDateKeyForSave = toDateKey(formData.date);
    const activeBlocks = scheduleBlockHistory.filter((block) => block.status === 'active');
    const hasBlockConflict = activeBlocks.some((block) =>
      doesBlockMatchDateAndStaff(block, selectedDateKeyForSave, formData.staffId) &&
      blockOverlapsTimeRange(block, formData.start, formData.start + Number(formData.duration)),
    );

    if (hasBlockConflict) {
      setError('Existe um bloqueio de agenda nesse período. Escolha outro horário.');
      scheduleCreateLockRef.current = false;
      scheduleIdempotencyKeyRef.current = null;
      return;
    }

    let forceOverbookEffective = forceOverbook;
    if (formData.isFitIn && !forceOverbook) {
      const selectedDateKeyForCheck = toDateKey(formData.date);
      const newStart = formData.start;
      const newEnd = formData.start + Number(formData.duration);
      const conflictingAppointments = appointments.filter(apt =>
        apt.staffId === formData.staffId &&
        toDateKey(apt.date) === selectedDateKeyForCheck &&
        apt.status !== 'cancelled' &&
        apt.id !== editingAppointmentId &&
        !(
          newEnd <= apt.start ||
          newStart >= apt.start + apt.duration
        )
      );
      if (conflictingAppointments.length > 0) {
        const confirmMsg = "Este horário já possui atendimento. Deseja criar como encaixe mesmo assim?";
        if (!window.confirm(confirmMsg)) {
          scheduleCreateLockRef.current = false;
          scheduleIdempotencyKeyRef.current = null;
          return;
        }
        forceOverbookEffective = true;
      }
    } else if (!forceOverbook) {
      const selectedDateKeyForCheck = toDateKey(formData.date);
      const newStart = formData.start;
      const newEnd = formData.start + Number(formData.duration);
      const conflictingAppointments = appointments.filter(apt =>
        apt.staffId === formData.staffId &&
        toDateKey(apt.date) === selectedDateKeyForCheck &&
        apt.status !== 'cancelled' &&
        apt.id !== editingAppointmentId &&
        !(
          newEnd <= apt.start ||
          newStart >= apt.start + apt.duration
        )
      );
      if (conflictingAppointments.length > 0) {
        setOverbookConflicts(conflictingAppointments);
        setShowOverbookModal(true);
        scheduleCreateLockRef.current = false;
        scheduleIdempotencyKeyRef.current = null;
        return;
      }
    }

    try {
      if (editingAppointmentId) {
      const endTimeLine = new Date(startTimeLine.getTime() + Number(formData.duration) * 60 * 60 * 1000);
      const updatedStartIso = startTimeLine.toISOString();
      const updatedAppointmentDate = updatedStartIso;

      // UPDATE EXISTING
      const { error: updateError } = await supabase.from('appointments').update({
        service_id: firstSelectedService?.id || null,
        staff_id: formData.staffId || null,
        client_id: clientId,
        client_name: formData.client,
        service_name: serviceNamesForEdit || formData.service,
        notes: formData.notes.trim(),
        staff_name: selectedStaff?.name || '',
        start_time: updatedStartIso,
        end_time: endTimeLine.toISOString(),
        duration: Number(formData.duration),
        price: totalPrice,
      }).eq('id', editingAppointmentId).eq('tenant_id', tenantId);

      if (updateError) {
        console.error('Erro ao atualizar agendamento:', updateError);
        setError(`Erro ao atualizar agendamento: ${updateError.message}`);
        return;
      }

      await saveComandasClient.from('comandas').update({
        staff_id: formData.staffId || null,
      }).eq('appointment_id', editingAppointmentId).eq('tenant_id', tenantId).eq('status', 'open');

      setAppointments(prev => prev.map((apt) =>
        apt.id === editingAppointmentId
          ? {
            ...apt,
            staffId: formData.staffId,
            staffName: selectedStaff?.name || '',
            start: formData.start,
            duration: Number(formData.duration),
            client: formData.client,
            clientPhone: formData.clientPhone || '',
            service: serviceNamesForEdit || formData.service,
            price: totalPrice,
            startTime: updatedStartIso,
            notes: formData.notes.trim(),
            date: updatedAppointmentDate,
          }
          : apt
      ));

      setToast({ message: 'Agendamento atualizado com sucesso!', type: 'success' });
    } else {
      const serviceNames = selectedServices.map(s => s.name).join(' + ');

      // Validate required fields
      if (!tenantId) {
        setError('Tenant inválido');
        return;
      }
      if (!clientId) {
        setError('Cliente não selecionado');
        return;
      }
      if (!formData.staffId) {
        setError('Profissional não selecionado');
        return;
      }
      if (selectedServices.length === 0) {
        setError('Selecione pelo menos um serviço');
        return;
      }

      // Build services payload - MUST be array of objects, NOT stringified
      const servicesPayload = selectedServices.map((service, index) => ({
        service_id: service.id,
        quantity: 1,
        sort_order: index,
      }));

      // Validation log
      console.log('[Schedule] servicesPayload:', JSON.stringify(servicesPayload, null, 2));
      console.log('[Schedule] Array.isArray:', Array.isArray(servicesPayload));
      console.log('[Schedule] selectedServices.length:', selectedServices.length);

      const { data: rpcResult, error: rpcError } = await supabase.rpc('create_appointment_with_services', {
        p_tenant_id: tenantId,
        p_client_id: clientId,
        p_client_name: formData.client,
        p_client_phone: formData.clientPhone || null,
        p_staff_id: formData.staffId || null,
        p_start_time: startTimeLine.toISOString(),
        p_notes: formData.notes.trim() || null,
        p_idempotency_key: scheduleIdempotencyKeyRef.current,
        p_services: servicesPayload,
      });

      if (rpcError || !rpcResult) {
        console.error('Erro ao criar agendamento via RPC:', rpcError);
        setError(`Erro ao criar agendamento: ${rpcError?.message || 'Erro desconhecido'}`);
        return;
      }

      const newAptId = (rpcResult as any).appointment_id;
      const totalPriceRpc = (rpcResult as any).total_price || 0;

      setAppointments(prev => [...prev, {
        id: newAptId,
        clientId: clientId,
        staffId: formData.staffId,
        start: formData.start,
        duration: Number(formData.duration),
        client: formData.client,
        service: serviceNames,
        status: 'confirmed',
        color: 'bg-blue-500',
        staffName: selectedStaff?.name || '',
        clientPhone: formData.clientPhone || '',
        price: totalPriceRpc,
        startTime: startTimeLine.toISOString(),
        notes: formData.notes.trim(),
        date: startTimeLine.toISOString(),
        source: null,
        channel: null,
      }]);

      setToast({ message: 'Agendamento criado com sucesso!', type: 'success' });
      navigate('/operation-success', {
        state: {
          operationType: 'appointment',
          appointment: {
            id: newAptId,
            client: formData.client,
            service: serviceNames,
            professional: selectedStaff?.name || '',
            dateTime: startTimeLine.toISOString(),
            status: 'confirmed',
          },
        },
        replace: true,
      });
    }
    } finally {
      scheduleCreateLockRef.current = false;
      scheduleIdempotencyKeyRef.current = null;
    }

    setIsModalOpen(false);
    setIsNewClientMode(false);
    setEditingAppointmentId(null);
    setForceOverbook(false);
    setOverbookConflicts([]);
    setFormData({ client: '', clientPhone: '', service: '', staffId: staffList[0]?.id ?? '', date: formData.date, start: 8, duration: 1, notes: '', isFitIn: false });
    setSelectedServices([]);
    setServiceSearch('');
    fetchAppointments();
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const exportToCSV = () => {
    if (appointments.length === 0) {
      setToast({ message: 'Não há agendamentos para exportar no período selecionado.', type: 'error' });
      return;
    }

    const headers = ['Data', 'Início', 'Fim', 'Cliente', 'Telefone', 'Serviço', 'Profissional', 'Duração (min)', 'Valor (R$)', 'Status'];

    const rows = appointments.map(apt => {
      const dateStr = apt.date.split('-').reverse().join('/');
      const startHour = `${Math.floor(apt.start).toString().padStart(2, '0')}:${(apt.start % 1 === 0 ? '00' : '30')}`;
      const endCalc = apt.start + apt.duration;
      const endHour = `${Math.floor(endCalc).toString().padStart(2, '0')}:${(endCalc % 1 === 0 ? '00' : '30')}`;

      return [
        dateStr,
        startHour,
        endHour,
        `"${apt.client}"`,
        `"${apt.clientPhone || ''}"`,
        `"${apt.service}"`,
        `"${apt.staffName}"`,
        apt.duration * 60,
        apt.price || 0,
        apt.status
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n'); // \uFEFF for BOM (UTF-8 Excel interpretation)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `agenda_exportada_${selectedDate.toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToast({ message: 'Agenda exportada com sucesso!', type: 'success' });
  };

  const enrichedAppointments = React.useMemo<EnrichedAppointment[]>(() => {
    return appointments.map((apt) => {
      const statusMeta = getAppointmentStatusMeta(apt.status);
      const originLabel = getOriginLabel(apt.source, apt.channel);
      const shortNotes = getShortNotes(apt.notes || '');
      const isOverdue = isAppointmentOverdue(apt);
      return {
        ...apt,
        normalizedStatus: statusMeta.normalized,
        statusLabel: statusMeta.label,
        statusIcon: statusMeta.icon,
        statusBadgeClassName: statusMeta.badge,
        originLabel,
        isOverdue,
        shortNotes,
        searchIndex: `${apt.client} ${apt.clientPhone} ${apt.service} ${apt.staffName} ${shortNotes}`.toLowerCase(),
        hasOpenComanda: Boolean(openComandasByAppointment[apt.id]),
      };
    });
  }, [appointments, openComandasByAppointment]);

  const appointmentsForSummary = React.useMemo(() => {
    return enrichedAppointments.filter((apt) => {
      const selectedFilterDate = parseDateInputValue(listFilters.date);
      const matchesDate = !selectedFilterDate || new Date(apt.startTime).toDateString() === selectedFilterDate.toDateString();
      const matchesProfessional = listFilters.professional === 'all' || apt.staffId === listFilters.professional;
      const matchesStatus = listFilters.status === 'all' || apt.normalizedStatus === listFilters.status;
      const matchesService = listFilters.service === 'all' || apt.service === listFilters.service;
      const matchesOrigin = listFilters.origin === 'all' || apt.originLabel === listFilters.origin;
      const matchesQuickChip =
        listFilters.quickChip === 'all' ||
        (listFilters.quickChip === 'today' && new Date(apt.startTime).toDateString() === new Date().toDateString()) ||
        (listFilters.quickChip === 'pending' && apt.normalizedStatus === 'pending') ||
        (listFilters.quickChip === 'confirmed' && apt.normalizedStatus === 'confirmed') ||
        (listFilters.quickChip === 'in_progress' && apt.normalizedStatus === 'in_progress') ||
        (listFilters.quickChip === 'overdue' && apt.isOverdue) ||
        (listFilters.quickChip === 'without_comanda' && !apt.hasOpenComanda);
      return matchesDate && matchesProfessional && matchesStatus && matchesService && matchesOrigin && matchesQuickChip;
    });
  }, [enrichedAppointments, listFilters]);

  const filteredListAppointments = React.useMemo(() => {
    const searchTerm = listFilters.search.trim().toLowerCase();
    return appointmentsForSummary
      .filter((apt) => !searchTerm || apt.searchIndex.includes(searchTerm))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [appointmentsForSummary, listFilters.search]);

  const summaryCards = React.useMemo(() => [
    { key: 'total', label: 'Total', value: appointmentsForSummary.length, tone: 'text-slate-700 dark:text-slate-100' },
    { key: 'confirmed', label: 'Confirmados', value: appointmentsForSummary.filter((apt) => apt.normalizedStatus === 'confirmed').length, tone: 'text-blue-600 dark:text-blue-300' },
    { key: 'pending', label: 'Pendentes', value: appointmentsForSummary.filter((apt) => apt.normalizedStatus === 'pending').length, tone: 'text-amber-600 dark:text-amber-300' },
    { key: 'in_progress', label: 'Em atendimento', value: appointmentsForSummary.filter((apt) => apt.normalizedStatus === 'in_progress').length, tone: 'text-violet-600 dark:text-violet-300' },
    { key: 'completed', label: 'Finalizados', value: appointmentsForSummary.filter((apt) => apt.normalizedStatus === 'completed').length, tone: 'text-emerald-600 dark:text-emerald-300' },
    { key: 'cancelled', label: 'Cancelados', value: appointmentsForSummary.filter((apt) => apt.normalizedStatus === 'cancelled').length, tone: 'text-rose-600 dark:text-rose-300' },
    { key: 'overdue', label: 'Atrasados', value: appointmentsForSummary.filter((apt) => apt.isOverdue).length, tone: 'text-red-600 dark:text-red-300' },
  ], [appointmentsForSummary]);

  const originOptions = React.useMemo(() => Array.from(new Set(enrichedAppointments.map((apt) => apt.originLabel))).sort(), [enrichedAppointments]);

  const selectedAppointmentDetails = React.useMemo(() => {
    if (!selectedAppointment) return null;
    return enrichedAppointments.find((apt) => apt.id === selectedAppointment.id) || null;
  }, [enrichedAppointments, selectedAppointment]);

  const handleOpenAppointmentDetails = (apt: CalendarAppointment) => {
    setSelectedAppointment(apt);
    setIsDetailDrawerOpen(true);
  };

  const closeDetailDrawer = () => {
    setIsDetailDrawerOpen(false);
    setSelectedAppointment(null);
  };

  const handleAppointmentStatusChange = async (appointment: CalendarAppointment, nextStatus: string, confirmationLabel: string) => {
    if (!tenantId) return;
    if (!window.confirm(`Deseja ${confirmationLabel.toLowerCase()} este agendamento?`)) return;

    try {
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: nextStatus })
        .eq('id', appointment.id)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;

      setAppointments((prev) => prev.map((apt) => apt.id === appointment.id ? { ...apt, status: nextStatus, color: statusColors[nextStatus] || apt.color } : apt));
      setSelectedAppointment((prev) => prev && prev.id === appointment.id ? { ...prev, status: nextStatus, color: statusColors[nextStatus] || prev.color } : prev);
      setToast({ message: `${confirmationLabel} com sucesso.`, type: 'success' });
    } catch (err) {
      console.error('Erro ao atualizar status do agendamento:', err);
      setToast({ message: 'Erro ao atualizar status do agendamento.', type: 'error' });
    }
  };

  const handleOpenClient = (appointment: CalendarAppointment) => {
    if (appointment.clientId) {
      navigate('/clients', { state: { openClientId: appointment.clientId } });
      return;
    }

    navigate('/clients', { state: { clientSearch: appointment.clientPhone || appointment.client } });
  };

  const handleOpenComanda = async (appointment: CalendarAppointment) => {
    const openComandaId = openComandasByAppointment[appointment.id];
    if (openComandaId) {
      navigate(`/checkout/${openComandaId}`);
      return;
    }

    await handleNavigateToCheckout(appointment);
  };

  const handleSendWhatsApp = (appointment: CalendarAppointment) => {
    if (!appointment.clientPhone) {
      setToast({ message: 'Esse cliente não possui telefone cadastrado.', type: 'error' });
      return;
    }

    const cleanPhone = appointment.clientPhone.replace(/\D/g, '');
    const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = `Olá ${appointment.client.split(' ')[0]}! Tudo bem? Aqui é da barbearia. Passando para confirmar seu agendamento:

📅 *Data:* ${new Date(appointment.startTime).toLocaleDateString('pt-BR')}
⏰ *Hora:* ${new Date(appointment.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
💈 *Serviço:* ${appointment.service}
🧔 *Profissional:* ${appointment.staffName}

Podemos confirmar? 😄`;

    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-fade-in relative">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-2 bg-white dark:bg-surface-dark p-1 rounded-lg border border-slate-200 dark:border-border-dark shadow-sm">
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(selectedDate.getDate() - (viewMode === 'week' ? 7 : 1));
              setSelectedDate(newDate);
            }}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-500 dark:text-slate-400"
          >
            <span className="material-symbols-outlined text-lg">chevron_left</span>
          </button>
          <div className="flex items-center gap-1 px-1.5 text-slate-900 dark:text-white font-bold min-w-0 justify-center">
            <span className="text-xs">
              {viewMode === 'week'
                ? `${weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
                : formatDateDisplay(selectedDate)
              }
            </span>
          </div>
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(selectedDate.getDate() + (viewMode === 'week' ? 7 : 1));
              setSelectedDate(newDate);
            }}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-500 dark:text-slate-400"
          >
            <span className="material-symbols-outlined text-lg">chevron_right</span>
          </button>
          <span className="flex items-center">
            <DatePickerInput
              value={getDateInputValue(selectedDate)}
              onChange={(e) => {
                const newDate = parseDateInputValue(e.target.value);
                if (newDate) setSelectedDate(newDate);
              }}
              className="text-xs bg-transparent border-0 p-0 w-auto"
            />
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex bg-slate-100 dark:bg-surface-dark p-0.5 rounded border border-slate-200 dark:border-border-dark">
            <button
              onClick={() => setDisplayMode('calendar')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${displayMode === 'calendar'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
            >Calendário</button>
            <button
              onClick={() => setDisplayMode('list')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${displayMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
            >Lista</button>
          </div>
          {displayMode === 'calendar' && (
            <div className="flex bg-slate-100 dark:bg-surface-dark p-0.5 rounded border border-slate-200 dark:border-border-dark">
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${viewMode === 'day'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >Dia</button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${viewMode === 'week'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >Semana</button>
            </div>
          )}
          <button
            onClick={exportToCSV}
            className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            title="Exportar agenda em CSV"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span className="hidden lg:inline">Exportar CSV</span>
          </button>

          {displayMode === 'calendar' && (
            <>
              <button
                onClick={() => setShowOnlyBlocks(prev => !prev)}
                className={`border px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all ${showOnlyBlocks
                  ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                  : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-300'
                  }`}
                title="Exibir apenas bloqueios na grade"
              >
                <span className="material-symbols-outlined text-base">block</span>
                <span className="hidden lg:inline">Bloqueios</span>
              </button>

              <button
                onClick={handleOpenCreateBlockModal}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow transition-all"
              >
                <span className="material-symbols-outlined text-base">event_busy</span>
                <span className="hidden sm:inline">Fechar agenda</span>
              </button>
            </>
          )}

          <button
            onClick={() => navigate('/operations')}
            className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
            title="Operações do dia"
          >
            <span className="material-symbols-outlined text-base">insights</span>
            <span className="hidden sm:inline">Operações</span>
          </button>

          <button
            onClick={() => {
              setEditingAppointmentId(null);
              setFormData(prev => ({ ...prev, client: '', clientPhone: '', service: '', duration: 1, notes: '', isFitIn: false }));
              setChefClubInfo(null);
              setIsModalOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow transition-all"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span className="hidden sm:inline">Novo Agendamento</span>
          </button>
        </div>
      </div>

      {displayMode === 'calendar' ? (
      <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 flex-1 min-h-0">
        {/* DASHBOARD INDICATORS - Ocultos para simplificar */}
        <div className="hidden" />

        <div className="flex-1 bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden flex flex-col shadow-sm min-w-0">
          {viewMode === 'week' ? (
            <>
              <div className="flex border-b border-slate-200 dark:border-border-dark shrink-0">
                <div className="w-20 shrink-0 border-r border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5" />
                {weekDays.map((day, i) => {
                  const isToday = day.toDateString() === new Date().toDateString();
                  const isSelected = day.toDateString() === selectedDate.toDateString();
                  const dayApts = appointments.filter(a => {
                    const d = new Date((a as any).date);
                    return d.toDateString() === day.toDateString();
                  });
                  const dayKey = toDateKey(day);
                  const hasDayBlock = scheduleBlocks.some((block) => block.block_type === 'full_day' && blockAppliesToDate(block, dayKey));
                  return (
                    <div
                      key={i}
                      onClick={() => { setSelectedDate(day); setViewMode('day'); }}
                      className={`flex-1 py-3 px-2 border-r border-slate-200 dark:border-border-dark last:border-r-0 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''
                        } ${hasDayBlock ? 'bg-red-50/70 dark:bg-red-900/10' : ''
                        }`}
                    >
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-primary' : 'text-slate-400'
                        }`}>
                        {day.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                      </p>
                      <div className={`size-8 rounded-full flex items-center justify-center text-sm font-black ${isToday ? 'bg-primary text-white' : 'text-slate-700 dark:text-white'
                        }`}>
                        {day.getDate()}
                      </div>
                      {dayApts.length > 0 && !showOnlyBlocks && (
                        <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                          {dayApts.length} aptos
                        </span>
                      )}
                      {hasDayBlock && (
                        <span className="text-[9px] font-bold bg-red-500/10 text-red-600 dark:text-red-300 px-1.5 py-0.5 rounded-full">
                          Agenda fechada
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (
                  <div className="flex min-h-[2600px]">
                    <div className="w-20 shrink-0 border-r border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5 flex flex-col">
                      {dynamicTimeSlots.map(hour => (
                        <div key={hour} className="flex-1 border-b border-slate-200 dark:border-border-dark text-xs font-bold text-slate-400 flex items-start justify-center pt-2">
                          {hour}:00
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 flex">
                      {weekDays.map((day, di) => {
                        const dayApts = appointments.filter(a => {
                          const d = new Date((a as any).date);
                          return d.toDateString() === day.toDateString();
                        });
                        const dayKey = toDateKey(day);
                        const dayBlocks = getBlocksForDate(scheduleBlocks, dayKey);
                        const isDayFullyBlocked = dayBlocks.some((block) => block.block_type === 'full_day' && !block.professional_id);
                        const isToday = day.toDateString() === new Date().toDateString();
                        return (
                          <div
                            key={di}
                            className={`flex-1 border-r border-slate-200 dark:border-border-dark last:border-r-0 relative group ${isToday ? 'bg-primary/[0.02]' : ''} ${isDayFullyBlocked ? 'bg-red-50/40 dark:bg-red-900/10' : ''}`}
                            onDragOver={handleDragOver}
                            onDrop={(e) => {
                              const aptId = e.dataTransfer.getData('aptId');
                              const apt = appointments.find(a => a.id === aptId);
                              if (apt) {
                                const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                                handleDropAppointment(e, apt.staffId, dateStr);
                              }
                            }}
                          >
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-slate-50/50 dark:bg-white/[0.02] pointer-events-none transition-opacity"></div>
                            {dayBlocks
                              .filter((block) => block.block_type === 'time_range' && !block.professional_id)
                              .map((block) => {
                                const start = Number(block.start_time?.slice(0, 2) || '0') + Number(block.start_time?.slice(3, 5) || '0') / 60;
                                const end = Number(block.end_time?.slice(0, 2) || '0') + Number(block.end_time?.slice(3, 5) || '0') / 60;
                                const top = (start - 8) * (100 / totalSlots);
                                const height = (end - start) * (100 / totalSlots);
                                return (
                                  <div
                                    key={block.id}
                                    className="absolute left-0 right-0 bg-red-400/20 border-y border-red-500/30 z-[1]"
                                    style={{ top: `${top}%`, height: `${Math.max(height, 2)}%` }}
                                    title={`Agenda fechada: ${block.reason}`}
                                  />
                                );
                              })}
                            <div className="absolute inset-0 flex flex-col z-0">
                              {dynamicTimeSlots.map(h => <div key={h} className="flex-1 border-b border-slate-100 dark:border-border-dark/50" />)}
                            </div>
                            {!showOnlyBlocks && dayApts.map((apt, idx) => {
                              const startOffset = (apt.start - 8) * (100 / totalSlots);
                              const height = apt.duration * (100 / totalSlots);
                              const barberColors = ['bg-barber-1', 'bg-barber-2', 'bg-barber-3', 'bg-barber-4', 'bg-barber-5', 'bg-barber-6'];
                              const borderColors = ['border-barber-1', 'border-barber-2', 'border-barber-3', 'border-barber-4', 'border-barber-5', 'border-barber-6'];
                              const staffIdx = staffList.findIndex(s => s.id === apt.staffId);
                              const barberColor = barberColors[Math.max(0, staffIdx) % barberColors.length];
                              const borderColor = borderColors[Math.max(0, staffIdx) % borderColors.length];
                              return (
                                <div
                                  key={apt.id}
                                  draggable
                                  onDragStart={(e) => { e.dataTransfer.setData('aptId', apt.id); }}
                                  onClick={() => handleOpenAppointmentDetails(apt)}
                                  className={`absolute left-0.5 right-0.5 rounded-md p-1.5 border-l-4 ${borderColor} ${barberColor} z-10 overflow-hidden shadow-sm hover:brightness-110 cursor-pointer transition-all hover:shadow-md active:scale-95 active:opacity-80 ${apt.isOverbooked ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                                  style={{ top: `${startOffset}%`, height: `${Math.max(height, 4)}%` }}
                                  title={`${apt.client} — ${apt.service}${apt.isOverbooked ? ' (ENCAIXE)' : ''}`}
                                >
                                  {apt.isOverbooked && (
                                    <span className="absolute top-0.5 right-0.5 text-[8px] bg-amber-400 text-white rounded px-0.5 font-black">ENCAIXE</span>
                                  )}
                                  {apt.eligibleForPlanCredit && (
                                    <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-amber-500/80 text-white rounded px-0.5 font-black">CC</span>
                                  )}
                                  <p className="text-[10px] font-black text-white truncate leading-tight drop-shadow-sm">
                                    <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">person</span>
                                    {apt.client}
                                  </p>
                                  <p className="text-[9px] text-white/90 font-bold truncate drop-shadow-sm">
                                    <span className="material-symbols-outlined text-[9px] align-middle mr-0.5">content_cut</span>
                                    {apt.service}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex border-b border-slate-200 dark:border-border-dark">
                <div className="w-20 shrink-0 border-r border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5"></div>
                <div className="flex-1 flex">
                  {staffList.length === 0 ? (
                    <div className="flex-1 py-4 text-center text-sm text-slate-500">Nenhum profissional encontrado</div>
                  ) : (
                    staffList.map(resource => (
                      <div key={resource.id} className="flex-1 py-4 px-2 border-r border-slate-200 dark:border-border-dark last:border-r-0 flex flex-col items-center justify-center gap-2">
                        <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-slate-100 dark:border-slate-600 bg-cover bg-center"
                          style={{ backgroundImage: `url(${resource.avatar || ''})` }}>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{resource.name}</p>
                          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">{roleLabels[resource.role] || resource.role}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="flex min-h-[2600px]">
                    <div className="w-20 shrink-0 border-r border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5 flex flex-col">
                      {dynamicTimeSlots.map(hour => (
                        <div key={hour} className="flex-1 border-b border-slate-200 dark:border-border-dark text-xs font-bold text-slate-400 flex items-start justify-center pt-2 relative">
                          {hour}:00
                        </div>
                      ))}
                    </div>

                    <div className="flex-1 flex relative">
                      <div className="absolute inset-0 flex flex-col z-0">
                        {dynamicTimeSlots.map(hour => (
                          <div key={hour} className="flex-1 border-b border-slate-100 dark:border-border-dark/50"></div>
                        ))}
                      </div>

                      {staffList.map(resource => (
                        <div
                          key={resource.id}
                          className="flex-1 border-r border-slate-200 dark:border-border-dark last:border-r-0 relative z-10 group"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDropAppointment(e, resource.id)}
                        >
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-slate-50/50 dark:bg-white/[0.02] pointer-events-none transition-opacity"></div>
                          {!showOnlyBlocks && appointments
                            .filter(apt => apt.staffId === resource.id)
                            .map((apt, idx) => {
                              const startOffset = (apt.start - 8) * (100 / totalSlots);
                              const height = apt.duration * (100 / totalSlots);
                              const staffIndex = staffList.findIndex(s => s.id === resource.id);
                              const barberColors = ['bg-barber-1', 'bg-barber-2', 'bg-barber-3', 'bg-barber-4', 'bg-barber-5', 'bg-barber-6'];
                              const borderColors = ['border-barber-1', 'border-barber-2', 'border-barber-3', 'border-barber-4', 'border-barber-5', 'border-barber-6'];
                              const barberColor = barberColors[staffIndex % barberColors.length];
                              const borderColor = borderColors[staffIndex % borderColors.length];

                              return (
                                <div
                                  key={apt.id}
                                  draggable
                                  onDragStart={(e) => { e.dataTransfer.setData('aptId', apt.id); }}
                                  onClick={() => handleOpenAppointmentDetails(apt)}
                                  className={`absolute left-1 right-1 rounded-lg px-2 py-1.5 border-l-4 ${borderColor} ${barberColor} hover:brightness-110 cursor-pointer transition-all shadow-md hover:shadow-lg flex flex-col justify-start z-20 overflow-hidden active:scale-[0.98] active:opacity-80`}
                                  style={{ top: `${startOffset}%`, height: `${height}%` }}
                                  title={`${apt.client} — ${apt.service}`}
                                >
                                  <div className="flex items-center justify-between mb-0.5 shrink-0">
                                    <span className="text-[9px] font-black px-1 py-0.5 rounded bg-black/20 text-white uppercase tracking-tighter leading-none">
                                      {Math.floor(apt.start)}:{apt.start % 1 === 0 ? '00' : '30'}
                                    </span>
                                    <div className="flex bg-black/10 rounded px-1 py-0.5">
                                      {apt.status === 'confirmed' && <span className="material-symbols-outlined text-[12px] text-white">check_circle</span>}
                                      {apt.status === 'completed' && <span className="material-symbols-outlined text-[12px] text-emerald-300">task_alt</span>}
                                      {apt.status === 'pending' && <span className="material-symbols-outlined text-[12px] text-amber-300">schedule</span>}
                                      {apt.eligibleForPlanCredit && (
                                        <span className="ml-1 text-[10px] font-black text-amber-300" title="Clube dos Chefes - Elegível para crédito">CC</span>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs font-black text-white truncate leading-none drop-shadow-sm mt-0.5">
                                    {apt.client}
                                  </p>
                                  <p className="text-[10px] text-white/90 font-bold truncate leading-none drop-shadow-sm mt-0.5">
                                    {apt.service}
                                  </p>
                                </div>
                              );
                            })
                          }
                          {getBlocksForDate(scheduleBlocks, selectedDateKey, resource.id).map((block) => {
                            if (block.block_type === 'full_day') {
                              return (
                                <div
                                  key={block.id}
                                  className="absolute inset-0 bg-red-400/15 border border-red-500/30 z-[5] pointer-events-none"
                                  title={`Agenda fechada: ${block.reason}`}
                                />
                              );
                            }

                            const start = Number(block.start_time?.slice(0, 2) || '0') + Number(block.start_time?.slice(3, 5) || '0') / 60;
                            const end = Number(block.end_time?.slice(0, 2) || '0') + Number(block.end_time?.slice(3, 5) || '0') / 60;
                            const top = (start - 8) * (100 / totalSlots);
                            const height = (end - start) * (100 / totalSlots);
                            return (
                              <div
                                key={block.id}
                                className="absolute left-0 right-0 bg-red-400/20 border-y border-red-500/40 z-[6] pointer-events-none"
                                style={{ top: `${top}%`, height: `${Math.max(height, 2)}%` }}
                                title={`${block.reason}${block.notes ? ` - ${block.notes}` : ''}`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Próximos Agendamentos - Oculto para simplificar */}
        <div className="hidden" />
      </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pr-1">
          <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-border-dark p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <input
                  type="text"
                  value={listFilters.search}
                  onChange={(e) => setListFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Buscar cliente ou telefone..."
                  className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl pl-9 pr-3 py-2.5 text-sm"
                />
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'all', label: 'Todos' },
                  { key: 'pending', label: 'Pendentes' },
                  { key: 'confirmed', label: 'Confirmados' },
                  { key: 'in_progress', label: 'Em atend.' },
                  { key: 'overdue', label: 'Atrasados' },
                ].map((chip) => (
                  <button
                    key={chip.key}
                    onClick={() => setListFilters((prev) => ({ ...prev, quickChip: chip.key as QuickChip }))}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${listFilters.quickChip === chip.key
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowFiltersDropdown(!showFiltersDropdown)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${showFiltersDropdown
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
              >
                <span className="material-symbols-outlined text-lg">tune</span>
                Filtros
              </button>
            </div>

            {showFiltersDropdown && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-border-dark">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Período</label>
                    <select
                      value={listFilters.period}
                      onChange={(e) => setListFilters((prev) => ({ ...prev, period: e.target.value as ListPeriod }))}
                      className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2.5 text-sm"
                    >
                      <option value="today">Hoje</option>
                      <option value="tomorrow">Amanhã</option>
                      <option value="week">Próximos 7 dias</option>
                      <option value="month">Este mês</option>
                      <option value="custom">Data específica</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Data</label>
                    <DatePickerInput
                      value={listFilters.date}
                      onChange={(e) => setListFilters((prev) => ({ ...prev, date: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Profissional</label>
                    <select
                      value={listFilters.professional}
                      onChange={(e) => setListFilters((prev) => ({ ...prev, professional: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2.5 text-sm"
                    >
                      <option value="all">Todos</option>
                      {staffList.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Serviço</label>
                    <select
                      value={listFilters.service}
                      onChange={(e) => setListFilters((prev) => ({ ...prev, service: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2.5 text-sm"
                    >
                      <option value="all">Todos</option>
                      {servicesList.map((service) => <option key={service.id} value={service.name}>{service.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Origem</label>
                    <select
                      value={listFilters.origin}
                      onChange={(e) => setListFilters((prev) => ({ ...prev, origin: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2.5 text-sm"
                    >
                      <option value="all">Todas</option>
                      {originOptions.map((origin) => <option key={origin} value={origin}>{origin}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Status</label>
                    <select
                      value={listFilters.status}
                      onChange={(e) => setListFilters((prev) => ({ ...prev, status: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl px-3 py-2.5 text-sm"
                    >
                      <option value="all">Todos</option>
                      {Object.entries(appointmentStatusMeta).map(([status, meta]) => <option key={status} value={status}>{meta.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'today', label: 'Hoje' },
                    { key: 'pending', label: 'Pendentes' },
                    { key: 'confirmed', label: 'Confirmados' },
                    { key: 'in_progress', label: 'Em atendimento' },
                    { key: 'overdue', label: 'Atrasados' },
                    { key: 'without_comanda', label: 'Sem comanda' },
                  ].map((chip) => (
                    <button
                      key={chip.key}
                      onClick={() => setListFilters((prev) => ({ ...prev, quickChip: chip.key as QuickChip }))}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${listFilters.quickChip === chip.key
                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-7 gap-3">
            {summaryCards.map((card) => (
              <div key={card.key} className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-border-dark p-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{card.label}</p>
                <p className={`text-2xl font-black ${card.tone}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="hidden lg:block bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-border-dark">
                  <tr className="text-left">
                    {['Horário', 'Cliente', 'Telefone', 'Serviço', 'Profissional', 'Status', 'Observação', 'Origem', 'Ações'].map((label) => (
                      <th key={label} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredListAppointments.map((apt) => (
                    <tr key={apt.id} className={`${apt.isOverdue ? 'bg-red-50/80 dark:bg-red-900/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'} transition-colors`}>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 dark:text-white">{getDecimalTimeLabel(apt.start)}</span>
                          <span className="text-[11px] text-slate-500">até {getAppointmentEndLabel(apt)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{apt.client}</span>
                          {apt.isOverdue && <span className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-300">Atrasado</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{apt.clientPhone || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{apt.service}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{apt.staffName || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${apt.statusBadgeClassName}`}>
                          <span className="material-symbols-outlined text-[14px]">{apt.statusIcon}</span>
                          {apt.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300" title={apt.notes || ''}>{apt.shortNotes || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{apt.originLabel}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button onClick={() => handleOpenAppointmentDetails(apt)} className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10" title="Ver detalhes"><span className="material-symbols-outlined text-[18px]">visibility</span></button>
                          <button onClick={() => handleEditAppointment(apt)} className="p-2 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-amber-500/10" title="Editar"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                          <button onClick={() => handleAppointmentStatusChange(apt, 'confirmed', 'Confirmado')} className="p-2 rounded-lg text-slate-500 hover:text-blue-500 hover:bg-blue-500/10" title="Confirmar"><span className="material-symbols-outlined text-[18px]">check_circle</span></button>
                          <button onClick={() => handleAppointmentStatusChange(apt, 'in_progress', 'Atendimento iniciado')} className="p-2 rounded-lg text-slate-500 hover:text-violet-500 hover:bg-violet-500/10" title="Iniciar atendimento"><span className="material-symbols-outlined text-[18px]">play_circle</span></button>
                          <button onClick={() => handleAppointmentStatusChange(apt, 'completed', 'Atendimento finalizado')} className="p-2 rounded-lg text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/10" title="Finalizar"><span className="material-symbols-outlined text-[18px]">task_alt</span></button>
                          <button onClick={() => handleEditAppointment(apt)} className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10" title="Reagendar"><span className="material-symbols-outlined text-[18px]">update</span></button>
                          <button onClick={() => handleCancelAppointment(apt.id)} className="p-2 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10" title="Cancelar"><span className="material-symbols-outlined text-[18px]">cancel</span></button>
                          <button onClick={() => handleOpenClient(apt)} className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10" title="Abrir cliente"><span className="material-symbols-outlined text-[18px]">person</span></button>
                          <button onClick={() => handleOpenComanda(apt)} className="p-2 rounded-lg text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/10" title="Abrir comanda"><span className="material-symbols-outlined text-[18px]">receipt_long</span></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && filteredListAppointments.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">Nenhum agendamento encontrado com os filtros atuais.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:hidden space-y-3">
            {filteredListAppointments.map((apt) => (
              <div key={apt.id} className={`bg-white dark:bg-surface-dark rounded-2xl border p-4 shadow-sm ${apt.isOverdue ? 'border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-900/10' : 'border-slate-200 dark:border-border-dark'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-slate-900 dark:text-white">{getDecimalTimeLabel(apt.start)}</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{apt.client}</p>
                    <p className="text-xs text-slate-500">{apt.clientPhone || 'Sem telefone'}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${apt.statusBadgeClassName}`}>
                    <span className="material-symbols-outlined text-[14px]">{apt.statusIcon}</span>
                    {apt.statusLabel}
                  </span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <p><strong>Serviço:</strong> {apt.service}</p>
                  <p><strong>Profissional:</strong> {apt.staffName || '-'}</p>
                  <p><strong>Origem:</strong> {apt.originLabel}</p>
                  <p title={apt.notes || ''}><strong>Obs.:</strong> {apt.shortNotes || '-'}</p>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  <button onClick={() => handleOpenAppointmentDetails(apt)} className="px-2 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-bold">Detalhes</button>
                  <button onClick={() => handleEditAppointment(apt)} className="px-2 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-bold">Editar</button>
                  <button onClick={() => handleAppointmentStatusChange(apt, 'confirmed', 'Confirmado')} className="px-2 py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold">Confirmar</button>
                  <button onClick={() => handleAppointmentStatusChange(apt, 'in_progress', 'Atendimento iniciado')} className="px-2 py-2 rounded-xl bg-violet-50 text-violet-600 text-xs font-bold">Iniciar</button>
                  <button onClick={() => handleAppointmentStatusChange(apt, 'completed', 'Atendimento finalizado')} className="px-2 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold">Finalizar</button>
                  <button onClick={() => handleCancelAppointment(apt.id)} className="px-2 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold">Cancelar</button>
                  <button onClick={() => handleOpenClient(apt)} className="px-2 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-bold">Cliente</button>
                  <button onClick={() => handleOpenComanda(apt)} className="px-2 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-bold">Comanda</button>
                </div>
              </div>
            ))}
            {!loading && filteredListAppointments.length === 0 && (
              <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-border-dark p-8 text-center text-sm text-slate-500">
                Nenhum agendamento encontrado com os filtros atuais.
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setIsNewClientMode(false); setEditingAppointmentId(null); setChefClubInfo(null); setError(null); setSelectedServices([]); setServiceSearch(''); }}
        title={editingAppointmentId ? "Editar Agendamento" : "Novo Agendamento"}
        maxWidth="md"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <span className="material-symbols-outlined text-red-500 text-sm mt-0.5">error</span>
              <p className="text-xs text-red-600 dark:text-red-300 font-medium">{error}</p>
            </div>
          )}

          <div className="relative" ref={searchWrapperRef}>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Cliente</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar ou cadastrar cliente..."
                value={formData.client}
                onChange={(e) => handleInputChange('client', e.target.value)}
                onFocus={() => setShowClientSuggestions(true)}
                className={`w-full bg-slate-50 dark:bg-background-dark border ${isNewClientMode ? 'border-primary' : 'border-slate-200 dark:border-border-dark'} rounded-lg p-2.5 pl-9 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none`}
              />
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            </div>

            {isNewClientMode && (
              <div className="mt-2 animate-fade-in bg-primary/5 p-3 rounded-lg border border-primary/20">
                <label className="block text-xs font-bold uppercase text-primary mb-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  Novo Cadastro
                </label>
                <input
                  type="tel"
                  placeholder="Telefone (Obrigatório)"
                  value={formData.clientPhone}
                  onChange={(e) => handleInputChange('clientPhone', e.target.value)}
                  className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            )}

            {showClientSuggestions && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                {filteredClients.length > 0 ? (
                  filteredClients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectClient(c.name)}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 flex flex-col border-b border-slate-50 dark:border-border-dark last:border-0"
                    >
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</span>
                      <span className="text-xs text-slate-500">{c.phone}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-center">
                    <p className="text-xs text-slate-500 mb-2">Cliente não encontrado.</p>
                    <button
                      onClick={enableNewClientMode}
                      className="w-full py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded text-xs font-bold uppercase transition-colors"
                    >
                      Cadastrar "{formData.client}"
                    </button>
                  </div>
                )}
              </div>
            )}
            {chefClubInfo && (
              <div className="mt-2 animate-bounce-in bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 flex items-center justify-between">
                <div>
                  <label className="block text-[10px] font-black uppercase text-amber-600 mb-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">workspace_premium</span>
                    Membro Clube do Chefe
                  </label>
                  <p className="text-xs font-bold text-slate-700 dark:text-amber-200">Plano {chefClubInfo.planName}</p>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">
                    {chefClubInfo.status === 'active' ? 'Membro ativo' : 'Assinatura pendente'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-amber-600 uppercase">Créditos</p>
                  <p className="text-lg font-black text-amber-600">{chefClubInfo.credits}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Serviços</label>
            <div className="relative mb-2">
              <input
                type="text"
                placeholder="Buscar serviços..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 pl-9 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
              />
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            </div>
            <div className="border border-slate-200 dark:border-white/10 rounded-lg max-h-44 overflow-y-auto custom-scrollbar">
              {filteredServices.length > 0 ? (
                filteredServices.map(s => (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-slate-100 dark:border-border-dark last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 ${selectedServices.find(sv => sv.id === s.id) ? 'bg-primary/5' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(selectedServices.find(sv => sv.id === s.id))}
                      onChange={() => toggleService(s)}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{s.name}</span>
                      <span className="ml-2 text-xs text-slate-500">{s.duration}min</span>
                    </div>
                    <span className="text-sm font-semibold text-primary">R$ {s.price?.toFixed(2) || '0.00'}</span>
                  </label>
                ))
              ) : (
                <div className="px-4 py-3 text-center text-xs text-slate-500">Nenhum serviço disponível</div>
              )}
            </div>

            {selectedServices.length > 0 && (
              <div className="mt-3 space-y-2">
                {editingAppointmentId && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Edição de serviços fica para próxima fase.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {selectedServices.map((s, idx) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold"
                    >
                      <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">{idx + 1}</span>
                      {s.name}
                      {!editingAppointmentId && (
                        <button
                          type="button"
                          onClick={() => removeService(s.id)}
                          className="ml-1 hover:text-red-500 transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="material-symbols-outlined text-primary">schedule</span>
                    <span className="text-slate-600 dark:text-slate-300">Duração total:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{totalDurationMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="material-symbols-outlined text-primary">payments</span>
                    <span className="text-slate-600 dark:text-slate-300">Valor total:</span>
                    <span className="font-bold text-primary">R$ {totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Profissional</label>
            <div className="relative">
              <select
                value={formData.staffId}
                onChange={(e) => handleInputChange('staffId', e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none appearance-none"
              >
                {staffList.map(r => (
                  <option key={r.id} value={r.id}>{r.name} - {roleLabels[r.role] || r.role}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Data</label>
            <DatePickerInput
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Horário</label>
              <div className="relative">
                <select
                  value={formData.start}
                  onChange={(e) => handleInputChange('start', Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none appearance-none"
                >
                  {(() => {
                    // Gerando slots de 8h às 00h (33 slots total: 8, 8.5, ..., 24)
                    const allSlots = Array.from({ length: 33 }, (_, i) => 8 + i * 0.5);
                    const aptsOnDay = appointments.filter(a => {
                      const aptDate = new Date(a.date);
                      const fDate = new Date(formData.date + 'T12:00:00'); // Midday to safely compare day/month/year
                      return aptDate.getFullYear() === fDate.getFullYear() &&
                        aptDate.getMonth() === fDate.getMonth() &&
                        aptDate.getDate() === fDate.getDate() &&
                        a.staffId === formData.staffId &&
                        a.id !== editingAppointmentId;
                    });
                    const activeBlocks = scheduleBlockHistory.filter((block) => block.status === 'active');
                    const blocksOnDay = getBlocksForDate(activeBlocks, formData.date, formData.staffId);

                    return allSlots.map(slot => {
                      const slotEnd = slot + formData.duration;
                      const hasConflict = aptsOnDay.some(apt =>
                        slot < (apt.start + apt.duration) && slotEnd > apt.start
                      );
                      const hasBlock = blocksOnDay.some((block) => blockOverlapsTimeRange(block, slot, slotEnd));
                      const isDisabled = hasConflict || hasBlock;

                      return (
                        <option key={slot} value={slot} disabled={isDisabled} className={isDisabled ? 'text-red-400 bg-red-50 dark:bg-red-900/10' : ''}>
                          {Math.floor(slot)}:{slot % 1 === 0 ? '00' : '30'} {hasConflict ? '(Ocupado)' : hasBlock ? '(Bloqueado)' : ''}
                        </option>
                      );
                    });
                  })()}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">schedule</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Duração (h)</label>
              <div className="relative">
                <select
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none appearance-none"
                >
                  <option value="0.25">15 min</option>
                  <option value="0.5">30 min</option>
                  <option value="0.75">45 min</option>
                  <option value="1">1h</option>
                  <option value="1.5">1h 30m</option>
                  <option value="2">2h</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">hourglass_empty</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">ObservaÃ§Ãµes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={4}
              placeholder="Adicione detalhes importantes do atendimento..."
              className="w-full resize-none bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          {!editingAppointmentId && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.isFitIn}
                  onChange={(e) => setFormData(prev => ({ ...prev, isFitIn: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded border-amber-400 text-amber-500 focus:ring-amber-400"
                />
                <div>
                  <span className="text-sm font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">flash_on</span>
                    Criar como encaixe
                  </span>
                  <span className="block text-xs text-amber-600 dark:text-amber-400 mt-0.5 ml-0.5">
                    Use quando o cliente será atendido mesmo com outro horário já ocupado.
                  </span>
                </div>
              </label>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3">
            <button
              onClick={() => { setIsModalOpen(false); setIsNewClientMode(false); setChefClubInfo(null); setError(null); setSelectedServices([]); setServiceSearch(''); }}
              className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
            >
              {editingAppointmentId ? "Salvar Alterações" : "Confirmar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isBlockModalOpen}
        onClose={() => { setIsBlockModalOpen(false); resetBlockForm(); }}
        title={editingBlockId ? 'Editar fechamento de agenda' : 'Fechar agenda'}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {blockError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-xs text-red-700 dark:text-red-300 font-semibold">{blockError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Tipo de bloqueio</label>
              <select
                value={blockForm.type}
                onChange={(e) => setBlockForm(prev => ({ ...prev, type: e.target.value as 'full_day' | 'time_range' }))}
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm"
              >
                <option value="full_day">Dia inteiro</option>
                <option value="time_range">Intervalo de horário</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Profissional</label>
              <select
                value={blockForm.professionalScope === 'all' ? 'all' : blockForm.professionalId}
                onChange={(e) => {
                  if (e.target.value === 'all') {
                    setBlockForm(prev => ({ ...prev, professionalScope: 'all', professionalId: '' }));
                  } else {
                    setBlockForm(prev => ({ ...prev, professionalScope: 'specific', professionalId: e.target.value }));
                  }
                }}
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm"
              >
                <option value="all">Todos</option>
                {staffList.map(staff => (
                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Data inicial</label>
              <DatePickerInput
                value={blockForm.startDate}
                onChange={(e) => setBlockForm(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Data final</label>
              <DatePickerInput
                value={blockForm.endDate}
                onChange={(e) => setBlockForm(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm"
              />
            </div>
          </div>

          {blockForm.type === 'time_range' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Hora inicial</label>
                <input
                  type="time"
                  value={blockForm.startTime}
                  onChange={(e) => setBlockForm(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Hora final</label>
                <input
                  type="time"
                  value={blockForm.endTime}
                  onChange={(e) => setBlockForm(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Motivo</label>
              <input
                type="text"
                value={blockForm.reason}
                onChange={(e) => setBlockForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Agenda fechada, Almoço, Feriado..."
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Ação para agendamentos existentes</label>
              <select
                value={blockForm.actionForExisting}
                onChange={(e) => setBlockForm(prev => ({ ...prev, actionForExisting: e.target.value as ExistingAppointmentsAction }))}
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm"
              >
                <option value="keep">Manter e bloquear apenas novos</option>
                <option value="review">Bloquear e revisar manualmente</option>
                <option value="cancel">Cancelar agendamentos impactados</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Observação interna</label>
            <textarea
              value={blockForm.notes}
              onChange={(e) => setBlockForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Recorrência</label>
              <select
                value={blockForm.recurrence}
                onChange={(e) => setBlockForm(prev => ({ ...prev, recurrence: e.target.value as 'none' | 'weekly' }))}
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm"
              >
                <option value="none">Sem recorrência</option>
                <option value="weekly">Repetir semanalmente</option>
              </select>
            </div>
            {blockForm.recurrence === 'weekly' && (
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Repetir até</label>
                <DatePickerInput
                  value={blockForm.recurrenceUntil}
                  onChange={(e) => setBlockForm(prev => ({ ...prev, recurrenceUntil: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm"
                />
              </div>
            )}
          </div>

          {impactPreview.length > 0 && (
            <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
              <p className="text-xs font-black uppercase text-amber-700 dark:text-amber-300 mb-2">
                {impactPreview.length} agendamentos impactados
              </p>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {impactPreview.slice(0, 10).map((apt) => (
                  <p key={apt.id} className="text-xs text-amber-800 dark:text-amber-200">
                    {new Date(apt.startTime).toLocaleDateString('pt-BR')} {Math.floor(apt.start).toString().padStart(2, '0')}:{apt.start % 1 === 0 ? '00' : '30'} - {apt.client}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-white/10">
            <button
              onClick={() => { setIsBlockModalOpen(false); resetBlockForm(); }}
              className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveBlock}
              disabled={blockSaving}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 transition-all"
            >
              {blockSaving ? 'Salvando...' : editingBlockId ? 'Salvar Bloqueio' : 'Confirmar Bloqueio'}
            </button>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-white/10">
            <p className="text-xs font-black uppercase text-slate-500 mb-2">Histórico de bloqueios</p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {scheduleBlockHistory.length === 0 && (
                <p className="text-xs text-slate-500">Nenhum bloqueio cadastrado.</p>
              )}
              {scheduleBlockHistory.map((block) => {
                const isInactive = block.status !== 'active';
                const professional = block.professional_id
                  ? staffList.find((s) => s.id === block.professional_id)?.name || 'Profissional'
                  : 'Todos';
                return (
                  <div key={block.id} className={`p-2 rounded-lg border ${isInactive ? 'border-slate-200 opacity-60' : 'border-slate-300 dark:border-slate-700'} bg-slate-50 dark:bg-white/5`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {block.reason} - {professional}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(`${block.start_date}T12:00:00`).toLocaleDateString('pt-BR')} ate {new Date(`${block.end_date}T12:00:00`).toLocaleDateString('pt-BR')}
                          {block.block_type === 'time_range' ? ` (${(block.start_time || '').slice(0, 5)}-${(block.end_time || '').slice(0, 5)})` : ' (Dia inteiro)'}
                        </p>
                      </div>
                      {!isInactive && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleEditBlock(block)}
                            className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600"
                            title="Editar bloqueio"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteBlock(block)}
                            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600"
                            title="Remover bloqueio"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedAppointment(null); }}
        title="Resumo do Atendimento"
        maxWidth="md"
      >
        {selectedAppointment && (() => {
          const apt = selectedAppointment;
          const startDate = new Date(apt.startTime);
          const endDate = new Date(startDate.getTime() + apt.duration * 60 * 60 * 1000);
          const staff = staffList.find(s => s.id === apt.staffId);

          const statusLabels: Record<string, string> = {
            confirmed: 'Confirmado',
            pending: 'Pendente',
            completed: 'Concluído',
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
                <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold ${statusBgColors[apt.status] || 'bg-slate-100 text-slate-700'}`}>
                  <span className="material-symbols-outlined text-base">{statusIcons[apt.status] || 'info'}</span>
                  {statusLabels[apt.status] || apt.status}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-2xl">person</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-black text-slate-900 dark:text-white truncate">{apt.client}</p>
                    {apt.clientPhone && (
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-sm">phone</span>
                        {apt.clientPhone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">Serviço</p>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">content_cut</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{apt.service}</p>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">Profissional</p>
                  <div className="flex items-center gap-2">
                    {staff?.avatar ? (
                      <img src={staff.avatar} alt={staff.name || 'Avatar do profissional'} className="size-7 rounded-full bg-slate-200 object-cover object-center border border-slate-100 dark:border-slate-600" />
                    ) : (
                      <span className="material-symbols-outlined text-primary text-lg">badge</span>
                    )}
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{staff?.name || apt.staffName || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Data</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Horário</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — {endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Duração</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {apt.duration >= 1 ? `${Math.floor(apt.duration)}h` : ''}{apt.duration % 1 !== 0 ? ` ${Math.round((apt.duration % 1) * 60)}min` : ''}
                  </p>
                </div>
              </div>

              {apt.notes && (
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">Observações</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{apt.notes}</p>
                </div>
              )}

              <div className="pt-4 flex justify-center gap-3 border-t border-slate-100 dark:border-white/5 mt-2 flex-wrap">
                <button
                  onClick={() => {
                    if (!apt.clientPhone) {
                      setToast({ message: 'Cliente sem telefone cadastrado.', type: 'error' });
                      return;
                    }
                    const cleanPhone = apt.clientPhone.replace(/\D/g, '');
                    const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                    const text = `Olá ${apt.client.split(' ')[0]}! Tudo bem? Aqui é da barbearia. Passando para confirmar seu agendamento:

📅 *Data:* ${new Date(apt.startTime).toLocaleDateString('pt-BR')} 
⏰ *Hora:* ${new Date(apt.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
💈 *Serviço:* ${apt.service}
🧔 *Profissional:* ${staff?.name || apt.staffName}

Podemos confirmar? 😄`;
                    const link = `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
                    window.open(link, '_blank');
                  }}
                  className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-bold bg-[#25D366] text-white hover:bg-[#20b857] shadow-lg shadow-[#25D366]/20 transition-all flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.559 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  WhatsApp
                </button>

                <button
                  onClick={() => handleEditAppointment(apt)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                  Editar
                </button>

                <button
                  onClick={() => handleNavigateToCheckout(apt)}
                  className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">point_of_sale</span>
                  Checkout
                </button>

                <button
                  onClick={() => handleCancelAppointment(apt.id)}
                  className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-bold border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                  Cancelar
                </button>

                <button
                  onClick={() => { setIsDetailModalOpen(false); setSelectedAppointment(null); }}
                  className="w-full mt-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
                >
                  Fechar Revisor
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {isDetailDrawerOpen && selectedAppointmentDetails && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button className="absolute inset-0 bg-black/40" onClick={closeDetailDrawer} aria-label="Fechar detalhes" />
          <div className="relative w-full max-w-xl h-full bg-white dark:bg-[#111318] border-l border-slate-200 dark:border-border-dark shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-border-dark flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Detalhes do atendimento</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{selectedAppointmentDetails.client}</h3>
              </div>
              <button onClick={closeDetailDrawer} className="size-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${selectedAppointmentDetails.statusBadgeClassName}`}>
                  <span className="material-symbols-outlined text-sm">{selectedAppointmentDetails.statusIcon}</span>
                  {selectedAppointmentDetails.statusLabel}
                </span>
                {selectedAppointmentDetails.isOverdue && (
                  <span className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    Atrasado
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Cliente</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{selectedAppointmentDetails.client}</p>
                  <p className="text-sm text-slate-500">{selectedAppointmentDetails.clientPhone || 'Sem telefone'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Profissional</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{selectedAppointmentDetails.staffName || '-'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Serviço</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{selectedAppointmentDetails.service}</p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Origem</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{selectedAppointmentDetails.originLabel}</p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Data</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{new Date(selectedAppointmentDetails.startTime).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Horário</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{getDecimalTimeLabel(selectedAppointmentDetails.start)} - {getAppointmentEndLabel(selectedAppointmentDetails)}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Observação</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{selectedAppointmentDetails.notes || 'Sem observações.'}</p>
              </div>

              {selectedAppointmentDetails.eligibleForPlanCredit && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-amber-600 text-lg">workspace_premium</span>
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Clube dos Chefes</p>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Este serviço está elegível para crédito do plano.</p>
                  {selectedAppointmentDetails.planCreditPreview && (
                    <p className="text-xs text-amber-500 dark:text-amber-500">
                      Serviço: {selectedAppointmentDetails.planCreditPreview?.service_name || selectedAppointmentDetails.service}
                    </p>
                  )}
                </div>
              )}
            </div>

             <div className="p-5 border-t border-slate-200 dark:border-border-dark grid grid-cols-2 gap-2">
               <button onClick={() => { if (selectedAppointmentDetails) handleEditAppointment(selectedAppointmentDetails); }} className="px-3 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-sm font-bold">Editar</button>
               <button onClick={() => { if (selectedAppointmentDetails) handleAppointmentStatusChange(selectedAppointmentDetails, 'confirmed', 'Confirmado'); }} className="px-3 py-3 rounded-xl bg-blue-50 text-blue-600 text-sm font-bold">Confirmar</button>
               <button onClick={() => { if (selectedAppointmentDetails) handleAppointmentStatusChange(selectedAppointmentDetails, 'in_progress', 'Atendimento iniciado'); }} className="px-3 py-3 rounded-xl bg-violet-50 text-violet-600 text-sm font-bold">Iniciar</button>
               <button onClick={() => { if (selectedAppointmentDetails) handleAppointmentStatusChange(selectedAppointmentDetails, 'completed', 'Atendimento finalizado'); }} className="px-3 py-3 rounded-xl bg-emerald-50 text-emerald-600 text-sm font-bold">Finalizar</button>
               <button onClick={() => { if (selectedAppointmentDetails) handleSendWhatsApp(selectedAppointmentDetails); }} className="px-3 py-3 rounded-xl bg-[#25D366] text-white text-sm font-bold hover:bg-[#20b857] transition-colors">WhatsApp</button>
               <button onClick={() => { if (selectedAppointmentDetails) handleOpenClient(selectedAppointmentDetails); }} className="px-3 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-sm font-bold">Abrir cliente</button>
               <button onClick={() => { if (selectedAppointmentDetails) handleOpenComanda(selectedAppointmentDetails); }} className="px-3 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-sm font-bold">Abrir comanda</button>
               <button onClick={() => { if (selectedAppointmentDetails) openCancelModal(selectedAppointmentDetails); }} className="px-3 py-3 rounded-xl border border-red-500 text-red-500 text-sm font-bold">Cancelar</button>
               <button onClick={closeDetailDrawer} className="px-3 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-sm font-bold">Fechar</button>
             </div>
          </div>
        </div>
      )}

      {showCancelModal && appointmentToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCancelModal(false)} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cancelar Agendamento</h3>
              <p className="text-sm text-slate-500 mt-1">Cliente: <span className="font-semibold">{appointmentToCancel.client}</span></p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Motivo do cancelamento</label>
              <select
                value={cancellationType}
                onChange={(e) => {
                  setCancellationType(e.target.value);
                  setCancelReason(e.target.value === 'other' ? '' : e.target.value);
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">Selecione um motivo</option>
                <option value="client_cancelled">Cliente cancelou</option>
                <option value="no_show">Não compareceu</option>
                <option value="rescheduled">Reagendado</option>
                <option value="registration_error">Erro de cadastro</option>
                <option value="test">Teste interno</option>
                <option value="other">Outro</option>
              </select>
            </div>

            {cancellationType === 'registration_error' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800 font-medium">
                  ⚠️ Este agendamento será <strong>ocultado da agenda operacional</strong>. Use esta opção quando o agendamento foi criado por engano ou com dados incorretos.
                </p>
              </div>
            )}

            {cancellationType === 'test' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800 font-medium">
                  ⚠️ Este agendamento será <strong>ocultado da agenda operacional</strong>. Use esta opção para agendamentos de teste interno que não devem aparecer na operação.
                </p>
              </div>
            )}

            {cancellationType === 'other' && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Justificativa</label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Descreva o motivo..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={confirmCancelAppointment}
                disabled={!cancellationType || (cancellationType === 'other' && !cancelReason.trim())}
                className="px-4 py-3 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {showOverbookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowOverbookModal(false); setOverbookConflicts([]); setForceOverbook(false); }} />
          <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Conflito de Horário</h3>
              <p className="text-sm text-slate-500 mt-1">Horários já ocupados pelo profissional:</p>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {overbookConflicts.map((apt) => (
                <div key={apt.id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                  <p className="text-sm font-semibold text-slate-700 dark:text-white">{apt.client}</p>
                  <p className="text-xs text-slate-500">
                    {apt.service} • {Math.floor(apt.start)}:{String(Math.round((apt.start % 1) * 60)).padStart(2, '0')} - {Math.floor(apt.start + apt.duration)}:{String(Math.round(((apt.start + apt.duration) % 1) * 60)).padStart(2, '0')}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800 font-medium">
                ⚠️ Criar como <strong>encaixe</strong> significa sobrepor horários. Confirme que o profissional(atendimento) está ciente.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setShowOverbookModal(false); setOverbookConflicts([]); setForceOverbook(false); }}
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setForceOverbook(true);
                  setShowOverbookModal(false);
                  setOverbookConflicts([]);
                  handleSave({ preventLock: true } as any);
                }}
                className="px-4 py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors"
              >
                Criar como Encaixe
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default Schedule;
