import { getClientForTable, supabase } from '../../../services/supabaseClient';
import { logSupabaseError as logSupabaseErrorBase } from '../../lib/supabase/errors';
import {
  buildDashboardMetrics,
  buildReturningClients,
  buildRevenueChartData,
  buildUpcomingBirthdays,
  normalizeAppointmentRecord,
  normalizeServiceRecord,
} from './selectors';
import { shouldAppearOnSchedule } from '../../lib/staff/roles';
import type {
  DashboardClient,
  DashboardData,
  DashboardPeriod,
  DashboardProfile,
  DashboardService,
  DashboardStaff,
} from './types';

export type DashboardUserRole = 'barber' | 'receptionist' | 'manager' | 'superadmin' | 'unknown';

const APP_SLUG_FOR_DASHBOARD = 'barber' as const;

const logSupabaseError = (label: string, error: unknown) => {
  if (error) {
    logSupabaseErrorBase(label, error);
  }
};

const toDateInput = (date: Date): string => date.toISOString().split('T')[0];

const parseTransactionDate = (value: unknown): Date => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(String(value || ''));
};

const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getDashboardPeriodRange = (period: DashboardPeriod) => {
  const today = startOfDay(new Date());

  if (period === 'yesterday') {
    const currentStart = addDays(today, -1);
    const currentEnd = today;
    return {
      currentStart,
      currentEnd,
      previousStart: addDays(currentStart, -1),
      previousEnd: currentStart,
    };
  }

  if (period === 'week') {
    const day = today.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    const currentStart = addDays(today, -daysSinceMonday);
    const currentEnd = addDays(currentStart, 7);
    return {
      currentStart,
      currentEnd,
      previousStart: addDays(currentStart, -7),
      previousEnd: currentStart,
    };
  }

  if (period === 'month') {
    const currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return {
      currentStart,
      currentEnd,
      previousStart: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      previousEnd: currentStart,
    };
  }

  return {
    currentStart: today,
    currentEnd: addDays(today, 1),
    previousStart: addDays(today, -1),
    previousEnd: today,
  };
};

const fetchServicesWithFallback = async (tenantId: string): Promise<DashboardService[]> => {
  const servicesClient = getClientForTable('services', APP_SLUG_FOR_DASHBOARD);

  const primaryRes = await servicesClient
    .from('services')
    .select('id, name, duration, price')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name');

  if (primaryRes.error) {
    logSupabaseError('services.primary', primaryRes.error);
    const legacyRes = await servicesClient
      .from('services')
      .select('id, name, duration_minutes, price')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');

    logSupabaseError('services.legacy-on-error', legacyRes.error);
    return (legacyRes.data || []).map(normalizeServiceRecord);
  }

  if (primaryRes.data && primaryRes.data.length > 0) {
    return primaryRes.data.map(normalizeServiceRecord);
  }

  const fallbackRes = await servicesClient
    .from('services')
    .select('id, name, duration, price')
    .eq('tenant_id', tenantId)
    .neq('active', false)
    .order('name');

  logSupabaseError('services.fallback', fallbackRes.error);
  if (fallbackRes.data && fallbackRes.data.length > 0) {
    return fallbackRes.data.map(normalizeServiceRecord);
  }

  const legacyRes = await servicesClient
    .from('services')
    .select('id, name, duration_minutes, price')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name');

  logSupabaseError('services.legacy', legacyRes.error);
  return (legacyRes.data || []).map(normalizeServiceRecord);
};

export const fetchDashboardData = async ({
  tenantId,
  userId,
  role,
  period = 'today',
}: {
  tenantId: string;
  userId?: string | null;
  role?: DashboardUserRole;
  period?: DashboardPeriod;
}): Promise<DashboardData> => {
  const clientsClient = getClientForTable('clients', APP_SLUG_FOR_DASHBOARD);
  const appointmentsClient = getClientForTable('appointments', APP_SLUG_FOR_DASHBOARD);
  const transactionsClient = getClientForTable('transactions', APP_SLUG_FOR_DASHBOARD);
  const comandasClient = getClientForTable('comandas', APP_SLUG_FOR_DASHBOARD);
  const periodRange = getDashboardPeriodRange(period);
  const isBarber = role === 'barber' && userId;

  const profilePromise = userId
    ? supabase.from('profiles').select('onboarding_completed').eq('id', userId).single()
    : Promise.resolve({ data: null, error: null });

  const [
    clientsRes,
    staffRes,
    servicesList,
    appointmentsRes,
    profileRes,
    transactionsRes,
    previousAppointmentsCountRes,
    last90daysAppointmentsRes,
    upcomingAppointmentsRes,
    last30to60daysAppointmentsRes,
    last60to90daysAppointmentsRes,
    todayAppointmentsByStaffRes,
    currentAppointmentsCountRes,
    openComandasRes,
  ] = await Promise.all([
    clientsClient
      .from('clients')
      .select('id, name, phone, email, birthday, last_visit, avatar')
      .eq('tenant_id', tenantId)
      .order('name'),
    supabase.from('staff').select('id, name, role').eq('tenant_id', tenantId).eq('status', 'active'),
    fetchServicesWithFallback(tenantId),
    (() => {
      let q = appointmentsClient
        .from('appointments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('hidden_from_schedule', false)
        .neq('status', 'cancelled')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(10);
      if (isBarber) q = q.eq('staff_id', userId);
      return q;
    })(),
    profilePromise,
    (() => {
      let q = transactionsClient
        .from('transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('type', ['income', 'expense'])
        .gte('date', toDateInput(periodRange.previousStart))
        .lt('date', toDateInput(periodRange.currentEnd))
        .order('date', { ascending: true });
      if (isBarber) q = q.eq('user_id', userId);
      return q;
    })(),
    (() => {
      let q = appointmentsClient
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('hidden_from_schedule', false)
        .neq('status', 'cancelled')
        .gte('start_time', periodRange.previousStart.toISOString())
        .lt('start_time', periodRange.previousEnd.toISOString());
      if (isBarber) q = q.eq('staff_id', userId);
      return q;
    })(),
    (() => {
      let q = appointmentsClient
        .from('appointments')
        .select('id, client_id, client_name, start_time, status')
        .eq('tenant_id', tenantId)
        .eq('hidden_from_schedule', false)
        .neq('status', 'cancelled')
        .gte('start_time', (() => {
          const d = new Date();
          d.setDate(d.getDate() - 90);
          return d.toISOString();
        })());
      if (isBarber) q = q.eq('staff_id', userId);
      return q;
    })(),
    (() => {
      let q = appointmentsClient
        .from('appointments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('hidden_from_schedule', false)
        .neq('status', 'cancelled')
        .gte('start_time', (() => {
          const d = new Date();
          return d.toISOString();
        })());
      if (isBarber) q = q.eq('staff_id', userId);
      return q;
    })(),
    (() => {
      let q = appointmentsClient
        .from('appointments')
        .select('id, client_id, client_name, start_time, status')
        .eq('tenant_id', tenantId)
        .eq('hidden_from_schedule', false)
        .neq('status', 'cancelled')
        .gte('start_time', (() => {
          const d = new Date();
          d.setDate(d.getDate() - 60);
          return d.toISOString();
        })())
        .lt('start_time', (() => {
          const d = new Date();
          d.setDate(d.getDate() - 30);
          return d.toISOString();
        })());
      if (isBarber) q = q.eq('staff_id', userId);
      return q;
    })(),
    (() => {
      let q = appointmentsClient
        .from('appointments')
        .select('id, client_id, client_name, start_time, status')
        .eq('tenant_id', tenantId)
        .eq('hidden_from_schedule', false)
        .neq('status', 'cancelled')
        .gte('start_time', (() => {
          const d = new Date();
          d.setDate(d.getDate() - 90);
          return d.toISOString();
        })())
        .lt('start_time', (() => {
          const d = new Date();
          d.setDate(d.getDate() - 60);
          return d.toISOString();
        })());
      if (isBarber) q = q.eq('staff_id', userId);
      return q;
    })(),
    (() => {
      let q = appointmentsClient
        .from('appointments')
        .select('staff_id')
        .eq('tenant_id', tenantId)
        .eq('hidden_from_schedule', false)
        .eq('status', 'confirmed')
        .gte('start_time', `${new Date().toISOString().split('T')[0]}T00:00:00`)
        .lt('start_time', `${new Date().toISOString().split('T')[0]}T23:59:59`);
      if (isBarber) q = q.eq('staff_id', userId);
      return q;
    })(),
    (() => {
      let q = appointmentsClient
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('hidden_from_schedule', false)
        .neq('status', 'cancelled')
        .gte('start_time', periodRange.currentStart.toISOString())
        .lt('start_time', periodRange.currentEnd.toISOString());
      if (isBarber) q = q.eq('staff_id', userId);
      return q;
    })(),
    (() => {
      let q = appointmentsClient
        .from('appointments')
        .select('id, client_id')
        .eq('tenant_id', tenantId)
        .eq('hidden_from_schedule', false)
        .neq('status', 'cancelled')
        .gte('start_time', (() => {
          const d = new Date();
          return d.toISOString();
        })());
      if (isBarber) q = q.eq('staff_id', userId);
      return q;
    })(),
    (() => {
      let q = comandasClient
        .from('comandas')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'open');
      if (isBarber) q = q.eq('staff_id', userId);
      return q;
    })(),
  ]);

  logSupabaseError('clients', clientsRes.error);
  logSupabaseError('staff', staffRes.error);
  logSupabaseError('appointments', appointmentsRes.error);
  logSupabaseError('profile', profileRes.error);
  logSupabaseError('transactions', transactionsRes.error);
  logSupabaseError('appointments.previous-period-count', previousAppointmentsCountRes.error);
  logSupabaseError('appointments.last-90-days', last90daysAppointmentsRes.error);
  logSupabaseError('appointments.upcoming', upcomingAppointmentsRes.error);
  logSupabaseError('appointments.last-30-to-60-days', last30to60daysAppointmentsRes.error);
  logSupabaseError('appointments.last-60-to-90-days', last60to90daysAppointmentsRes.error);
  logSupabaseError('appointments.today-by-staff', todayAppointmentsByStaffRes.error);
  logSupabaseError('appointments.current-period-count', currentAppointmentsCountRes.error);
  logSupabaseError('comandas.open', openComandasRes.error);

  const goalsRes = await supabase
    .from('tenant_goals')
    .select('revenue_goal, appointments_goal, clients_goal')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .maybeSingle();

  if (goalsRes.error) {
    logSupabaseError('tenant_goals', goalsRes.error);
  }

  const goals = goalsRes.data || { revenue_goal: 0, appointments_goal: 0, clients_goal: 0 };

  const clients = (clientsRes.data || []) as DashboardClient[];
  const staffList = ((staffRes.data || []) as Array<DashboardStaff & { role?: string }>).filter(shouldAppearOnSchedule).map((staff) => ({
    id: staff.id,
    name: staff.name,
  }));

  const upcomingClientIds = new Set(
    (upcomingAppointmentsRes.data || [])
      .map((a: any) => a.client_id)
      .filter(Boolean)
  );

  const clientPhoneMap: Record<string, string> = {};
  (clientsRes.data || []).forEach((client: any) => {
    if (client.id && client.phone) {
      clientPhoneMap[client.id] = client.phone;
    }
  });

  const appointments = (appointmentsRes.data || []).map((apt: any) => {
    const phone = apt.client_phone || clientPhoneMap[apt.client_id] || null;
    return { ...normalizeAppointmentRecord(apt), client_phone: phone };
  });

  const allPeriodTransactions = transactionsRes.data || [];
  const currentTransactions = allPeriodTransactions.filter((transaction: any) => {
    const transactionDate = parseTransactionDate(transaction.date);
    return transactionDate >= periodRange.currentStart && transactionDate < periodRange.currentEnd;
  });
  const previousTransactions = allPeriodTransactions.filter((transaction: any) => {
    const transactionDate = parseTransactionDate(transaction.date);
    return transactionDate >= periodRange.previousStart && transactionDate < periodRange.previousEnd;
  });

  const returningClients = buildReturningClients({
    clients,
    appointments: last90daysAppointmentsRes.data || [],
    upcomingClientIds,
  });

  return {
    clients: clientsRes.data || [],
    staffList,
    servicesList,
    appointments,
    upcomingBirthdays: buildUpcomingBirthdays(clientsRes.data || []),
    returningClients,
    chartData: buildRevenueChartData(currentTransactions),
    metrics: buildDashboardMetrics(
      currentTransactions,
      previousTransactions,
      staffList,
      todayAppointmentsByStaffRes.data || [],
      currentAppointmentsCountRes.count || 0,
      previousAppointmentsCountRes.count || 0,
      last90daysAppointmentsRes.data || [],
      last60to90daysAppointmentsRes.data || [],
      goals.revenue_goal || 0,
      goals.appointments_goal || 0,
    ),
    profile: (profileRes.data as DashboardProfile | null) || null,
    openComandasCount: openComandasRes.count || 0,
  };
};
