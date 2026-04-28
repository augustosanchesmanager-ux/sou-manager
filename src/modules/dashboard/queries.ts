import { getClientForTable, supabase } from '../../../services/supabaseClient';
import {
  buildDashboardMetrics,
  buildRevenueChartData,
  buildUpcomingBirthdays,
  normalizeAppointmentRecord,
  normalizeServiceRecord,
} from './selectors';
import type {
  DashboardClient,
  DashboardData,
  DashboardProfile,
  DashboardService,
  DashboardStaff,
} from './types';

const APP_SLUG_FOR_DASHBOARD = 'barber' as const;

const logSupabaseError = (label: string, error: unknown) => {
  if (error) {
    console.error(`Dashboard query failed: ${label}`, error);
  }
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
}: {
  tenantId: string;
  userId?: string | null;
}): Promise<DashboardData> => {
  const clientsClient = getClientForTable('clients', APP_SLUG_FOR_DASHBOARD);
  const appointmentsClient = getClientForTable('appointments', APP_SLUG_FOR_DASHBOARD);
  const transactionsClient = getClientForTable('transactions', APP_SLUG_FOR_DASHBOARD);

  const profilePromise = userId
    ? supabase.from('profiles').select('onboarding_completed').eq('id', userId).single()
    : Promise.resolve({ data: null, error: null });

  const [clientsRes, staffRes, servicesList, appointmentsRes, profileRes, transactionsRes, yesterdayTransactionsRes, yesterdayAppointmentsCountRes] = await Promise.all([
    clientsClient
      .from('clients')
      .select('id, name, phone, email, birthday, last_visit, avatar')
      .eq('tenant_id', tenantId)
      .order('name'),
    supabase.from('staff').select('id, name').eq('tenant_id', tenantId).eq('status', 'active'),
    fetchServicesWithFallback(tenantId),
    appointmentsClient
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(10),
    profilePromise,
    transactionsClient.from('transactions').select('*').eq('tenant_id', tenantId).eq('type', 'income').order('date', { ascending: true }),
    transactionsClient
      .from('transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('type', 'income')
      .gte('date', (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
      })())
      .lt('date', (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(23, 59, 59, 999);
        return d.toISOString().split('T')[0];
      })()),
    appointmentsClient
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .gte('start_time', (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0] + 'T00:00:00';
      })())
      .lt('start_time', (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0] + 'T23:59:59';
      })()),
  ]);

  logSupabaseError('clients', clientsRes.error);
  logSupabaseError('staff', staffRes.error);
  logSupabaseError('appointments', appointmentsRes.error);
  logSupabaseError('profile', profileRes.error);
  logSupabaseError('transactions', transactionsRes.error);

  const clientPhoneMap: Record<string, string> = {};
  (clientsRes.data || []).forEach((client: any) => {
    if (client.id && client.phone) {
      clientPhoneMap[client.id] = client.phone;
    }
  });

  const clients = (clientsRes.data || []) as DashboardClient[];
  const appointments = (appointmentsRes.data || []).map((apt: any) => {
    const phone = apt.client_phone || clientPhoneMap[apt.client_id] || null;
    return { ...normalizeAppointmentRecord(apt), client_phone: phone };
  });
  const staffList = ((staffRes.data || []) as DashboardStaff[]).map((staff) => ({
    id: staff.id,
    name: staff.name,
  }));

  const [todayAppointmentsByStaffRes, todayAppointmentsCountRes] = await Promise.all([
    appointmentsClient
      .from('appointments')
      .select('staff_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'confirmed')
      .gte('start_time', `${new Date().toISOString().split('T')[0]}T00:00:00`)
      .lt('start_time', `${new Date().toISOString().split('T')[0]}T23:59:59`),
    appointmentsClient
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .gte('start_time', `${new Date().toISOString().split('T')[0]}T00:00:00`)
      .lt('start_time', `${new Date().toISOString().split('T')[0]}T23:59:59`),
  ]);

  logSupabaseError('appointments.today-by-staff', todayAppointmentsByStaffRes.error);
  logSupabaseError('appointments.today-count', todayAppointmentsCountRes.error);
  logSupabaseError('transactions.yesterday', yesterdayTransactionsRes.error);
  logSupabaseError('appointments.yesterday-count', yesterdayAppointmentsCountRes.error);

  return {
    clients,
    staffList,
    servicesList,
    appointments,
    upcomingBirthdays: buildUpcomingBirthdays(clients),
    chartData: buildRevenueChartData(transactionsRes.data || []),
    metrics: buildDashboardMetrics(
      transactionsRes.data || [],
      staffList,
      todayAppointmentsByStaffRes.data || [],
      todayAppointmentsCountRes.count || 0,
      yesterdayTransactionsRes.data || [],
      yesterdayAppointmentsCountRes.count || 0,
    ),
    profile: (profileRes.data as DashboardProfile | null) || null,
  };
};

